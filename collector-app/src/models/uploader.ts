import { AppState } from 'react-native';
import { File, Paths, UploadTask } from 'expo-file-system';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { API, ApiError, api, authHeader, hasSession, type ProcessingStatus, type UploadSession } from './api';
import { queue, type QueueItem } from './db';
import { deleteLocal, readTrajectory } from './storage';
import type { Trajectory } from './types';

// 재개 업로드 (백엔드 "React Native resumable upload 구현 지침", D22):
// 세션을 만들고 청크(8MiB)씩 PATCH, 다 보내면 complete에 궤적을 붙이고, 서버 검사(ready)를 확인한 뒤에만 로컬 영상을 지운다.
// 끊기면 다음 시도에서 서버가 받은 위치(received_bytes)부터 이어 간다 — 앱은 offset을 추측하지 않는다.
// 서버 영상은 complete 때 궤적과 함께 하나로 생긴다. 영상만 있고 궤적이 없는 상태는 여전히 없다.
// 전체 해시는 서버가 계산한다. 폰(Hermes)에서 JS SHA-256은 초당 2MB라 450MB에 3분 반이 걸렸다 (2026-10-05).

// 켜기 전에 성동구 안에서 촬영할 것 — 서버 도로 데이터가 성동구뿐이다. 서버에 삭제 API가 없어 테스트 영상은 남는다.
export const UPLOAD_ENABLED = true;

const RETRY_DELAYS_S = [2, 5, 15, 30];   // 네트워크 오류·429·5xx
const READY_POLL_MS = 2000;
const READY_WAIT_MS = 60_000;            // 넘으면 다음 업로드 때 다시 확인한다

/** 다시 해도 결과가 같은 실패 — 자동으로 다시 시도하지 않는다 */
class Fatal extends Error {}
const retryable = (e: unknown) =>
  e instanceof ApiError ? e.status === 429 || e.status >= 500 : !(e instanceof Fatal);
// 자동 재시도 금지(413·415·422 등, 서버 검사 실패). 사용자가 업로드를 직접 누를 때만 다시 해 본다
const noAuto = new Set<string>();
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

let running = false;
// 사용자가 마지막으로 업로드를 눌렀을 때 큐에 있던 클립 중 아직 안 끝난 것. 앱이 다시 앞으로 오면 이것만 이어 간다.
// 그 뒤에 찍은 클립은 넣지 않는다 — 모바일 데이터 확인 없이 올라가면 안 된다 (D21).
let chosen = new Set<string>();
const autoLeft = () => [...chosen].some(id => !noAuto.has(id));

const listeners = new Set<() => void>();
export function onQueueChange(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
const notify = () => listeners.forEach(l => l());
const log = (m: string) => { if (__DEV__) console.log(`[upload] ${m}`); };
export const isUploading = () => running;

// iOS는 백그라운드로 가면 JS가 멈춘다 — 보내던 청크 하나는 네이티브 세션이 마저 보낸다.
// 안드로이드는 OS가 프로세스를 정리하기 전까지 백그라운드에서도 계속 보낸다.
AppState.addEventListener('change', s => { if (s === 'active' && autoLeft()) void processQueue(true); });

/** auto: 사용자가 누른 게 아니라 앱 복귀로 이어 가는 것 — 자동 재시도 금지 항목은 건너뛴다 */
export async function processQueue(auto = false): Promise<void> {
  if (!UPLOAD_ENABLED || running || !hasSession()) return;
  running = true; notify();
  // iOS는 화면이 꺼지면 JS가 멈춰 다음 청크를 못 보낸다 — 업로드하는 동안은 자동 잠금을 막는다
  await activateKeepAwakeAsync('upload').catch(() => {});
  try {
    const items = (await queue.list()).filter(i => i.status !== 'done');
    // 사용자 실행은 지금 큐를 고른다. auto는 고른 것 중 아직 큐에 남은 것만 (지운 클립은 빠진다)
    chosen = new Set(items.map(i => i.local_id).filter(id => !auto || chosen.has(id)));
    for (const item of items) {
      if (!chosen.has(item.local_id) || (auto && noAuto.has(item.local_id))) continue;
      if (await upload(item)) chosen.delete(item.local_id);
    }
  } finally {
    running = false;
    void deactivateKeepAwake('upload').catch(() => {});
    notify();
  }
}

/**
 * 서버 궤적 형식: 점 배열 [{longitude, latitude, offset_ms}] (backend app/schemas.py TrackPoint).
 * accuracy_m·speed_mps는 지금 서버가 무시하고 버린다. 서버가 같은 이름으로 받기 시작하면 앱 수정 없이 저장된다
 * (docs/04 — acc 저장 요청 중).
 */
export const toServerTrack = (traj: Trajectory) => traj.points.map(p => ({
  longitude: p.lon,
  latitude: p.lat,
  offset_ms: Math.round(p.t * 1000),
  accuracy_m: p.acc,
  ...(p.spd != null && p.spd >= 0 ? { speed_mps: p.spd } : {}),
}));

/** 서버 검사(ready)까지 끝났으면 true. 네트워크·서버 과부하는 2·5·15·30초 쉬고 서버 위치부터 다시 */
async function upload(item: QueueItem): Promise<boolean> {
  const id = item.local_id;
  noAuto.delete(id);
  for (let attempt = 0; ; attempt++) {
    await queue.update(id, { status: 'uploading', error: null });
    notify();
    try {
      return await uploadOnce(item);
    } catch (e: any) {
      const message = e?.message ?? '업로드 실패';
      log(`failed ${message}`);
      const delay = RETRY_DELAYS_S[attempt];
      if (retryable(e) && delay) {
        await queue.update(id, { error: `${message} · ${delay}초 뒤 다시 시도` });
        notify();
        await sleep(delay * 1000);
        continue;
      }
      if (!retryable(e)) noAuto.add(id);
      // 로컬 영상은 그대로. 다음 업로드 때 서버가 받은 곳부터 이어 간다
      await queue.update(id, { status: 'failed', error: message });
      notify();
      return false;
    }
  }
}

async function uploadOnce(item: QueueItem): Promise<boolean> {
  const id = item.local_id;
  log(`start ${id} upload_id=${item.upload_id ?? '-'} processing=${item.processing_status ?? '-'}`);
  const video = new File(item.video_path);
  if (!video.exists) {
    // ready 확인 뒤 지웠는데 done을 적기 전에 앱이 죽은 경우
    if (item.processing_status === 'ready') return finish(id);
    throw new Fatal('영상 파일이 없습니다');
  }
  const size = video.size;

  const session = await openSession(item, size);
  log(`session ${session.status} ${session.received_bytes}/${size} chunk=${session.chunk_size}`);
  let offset = session.received_bytes;
  while (offset < size) {
    const next = await sendChunk(id, video, session, offset, size);
    if (next <= offset) throw new Error('서버가 이어 받지 못했습니다');
    offset = next;
    await queue.update(id, { progress: offset / size });
    notify();
  }

  const v = await complete(id, session.upload_id);
  log(`complete ${v.video_id} ${v.processing_status}`);
  await queue.update(id, { video_id: v.video_id, processing_status: v.processing_status, progress: 1 });
  notify();

  const status = await waitUntilReady(id, v.video_id, v.processing_status);
  if (status === 'failed') throw new Fatal('서버가 영상을 확인하지 못했습니다 (영상은 폰에 남아 있어요)');
  if (status !== 'ready') {
    // 아직 검사 중. 영상은 남겨 두고 다음 업로드 때(앱이 다시 앞으로 올 때 포함) 다시 확인한다
    await queue.update(id, { status: 'queued' });
    return false;
  }
  // 서버가 영상으로 확인한 뒤에만 지운다 — 궤적·썸네일은 남긴다 (D1)
  await deleteLocal(id, { keepTrajectory: true });
  return finish(id);
}

async function finish(id: string) {
  await queue.update(id, { status: 'done', progress: 1, error: null });
  return true;
}

/** worker가 ffprobe로 영상인지 검사한다 — 보통 몇 초 */
async function waitUntilReady(id: string, videoId: string, status: ProcessingStatus) {
  const until = Date.now() + READY_WAIT_MS;
  while ((status === 'uploaded' || status === 'processing') && Date.now() < until) {
    await sleep(READY_POLL_MS);
    status = (await api.video(videoId)).processing_status;
    await queue.update(id, { processing_status: status });
    notify();
  }
  log(`processing ${videoId} ${status}`);
  return status;
}

/** 저장한 세션이 살아 있으면 이어 쓰고, 없거나(404) 만료(410)·실패면 새로 만든다 */
async function openSession(item: QueueItem, size: number): Promise<UploadSession> {
  if (item.upload_id) {
    try {
      const s = await api.uploadSession(item.upload_id);
      if (s.status !== 'failed') return s;
      await api.cancelUploadSession(item.upload_id).catch(() => {});
    } catch (e) {
      if (!(e instanceof ApiError) || (e.status !== 404 && e.status !== 410)) throw e;
    }
  }
  const s = await api.createUploadSession(item.local_id, { filename: `${item.local_id}.mp4`, size_bytes: size });
  await queue.update(item.local_id, { upload_id: s.upload_id });
  return s;
}

/**
 * 청크 하나를 보내고 서버가 알려준 다음 위치를 돌려준다.
 * 청크를 임시 파일로 써서 네이티브 업로드로 보낸다 — iOS에서 앱이 백그라운드로 가도 보내던 청크는 끝까지 간다.
 */
async function sendChunk(localId: string, video: File, s: UploadSession, offset: number, size: number): Promise<number> {
  const handle = video.open();
  let bytes: Uint8Array;
  try {
    handle.offset = offset;
    bytes = handle.readBytes(Math.min(s.chunk_size, size - offset));
  } finally {
    handle.close();
  }
  const chunk = new File(Paths.cache, `${localId}.chunk`);
  chunk.write(bytes);

  const type = 'application/offset+octet-stream';
  const send = async (renew: boolean) => new UploadTask(chunk, `${API}/upload-sessions/${s.upload_id}`, {
    httpMethod: 'PATCH',
    mimeType: type,
    headers: { ...(await authHeader(renew)), 'Upload-Offset': String(offset), 'Content-Type': type },
    onProgress: p => {
      void queue.update(localId, { progress: (offset + p.bytesSent) / size });
      notify();
    },
  }).uploadAsync();

  const started = Date.now();
  try {
    let r = await send(false);
    if (r.status === 401) r = await send(true);
    log(`chunk @${offset} → ${r.status} offset=${r.headers['Upload-Offset'] ?? r.headers['upload-offset']} ${Date.now() - started}ms`);
    // 409: 서버가 아는 위치와 다르다. 응답을 못 받은 앞 청크가 실제로는 들어갔을 때 — 서버 위치를 다시 읽는다
    if (r.status === 409) return (await api.uploadSession(s.upload_id)).received_bytes;
    if (r.status >= 300) throw new ApiError(errorMessage(r.status, r.body), r.status);
    const next = Number(Object.entries(r.headers).find(([k]) => k.toLowerCase() === 'upload-offset')?.[1]);
    return Number.isFinite(next) ? next : (await api.uploadSession(s.upload_id)).received_bytes;
  } finally {
    if (chunk.exists) chunk.delete();
  }
}

async function complete(localId: string, uploadId: string) {
  const traj = await readTrajectory(localId);
  if (!traj) throw new Fatal('궤적 파일이 없습니다');
  // 파일 이름이 그대로 multipart filename이 된다. 원본 궤적은 documentDirectory/pending에 있어 겹치지 않는다
  const track = new File(Paths.cache, `${localId}.json`);
  track.write(JSON.stringify(toServerTrack(traj)));
  try {
    const form = new FormData();
    // SDK 57의 fetch(expo/fetch)는 RN식 { uri, name, type } 파트를 못 보낸다 ("Unsupported FormDataPart").
    // expo-file-system File은 bytes()를 가져서 그대로 넣으면 된다
    form.append('trajectory', track as unknown as Blob);
    return (await api.completeUpload(uploadId, form)).video;
  } finally {
    if (track.exists) track.delete();
  }
}

// 서버 에러는 { error: { message } } — 한국어라 그대로 보여준다. nginx가 직접 준 413 등은 JSON이 아니다
function errorMessage(status: number, body: string) {
  try {
    return JSON.parse(body).error?.message ?? `업로드 실패 (${status})`;
  } catch {
    return `업로드 실패 (${status})`;
  }
}
