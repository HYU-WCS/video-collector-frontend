import * as FileSystem from 'expo-file-system/legacy';
import { API, authHeader, hasSession } from './api';
import { queue, type QueueItem } from './db';
import { deleteLocal, readTrajectory } from './storage';
import type { Trajectory } from './types';

// 영상과 trajectory는 한 요청에 묶어 보낸다.
// 따로 보내면 한쪽만 성공하는 상태가 생기고, 그때부터 정합성 코드를 쓰게 된다.

let running = false;

// 실제 서버 업로드는 아직 끈다 — 테스트 계정, 그리고 테스트 영상을 지울 방법(서버에 삭제 API가 없다)이 정해진 뒤에.
// 켜기 전에 성동구 안에서 촬영할 것 — 서버 도로 데이터가 성동구뿐이다.
const UPLOAD_ENABLED = false;

export async function processQueue(onProgress?: (localId: string, ratio: number) => void): Promise<void> {
  if (!UPLOAD_ENABLED || running || !hasSession()) return;
  running = true;
  try {
    const items = await queue.list();
    for (const item of items) {
      if (item.status === 'done' || item.status === 'uploading') continue;
      await uploadOne(item, onProgress);
    }
  } finally {
    running = false;
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

interface XhrResult { status: number; body: string }

// fetch는 업로드 진행률을 주지 않는다. 영상·궤적 두 파일을 한 요청에 넣으면서 진행률도 받으려고 XHR을 쓴다.
function send(form: FormData, headers: Record<string, string>, onProgress: (ratio: number) => void) {
  return new Promise<XhrResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API}/videos`);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = e => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
    xhr.onload = () => resolve({ status: xhr.status, body: xhr.responseText });
    xhr.onerror = () => reject(new Error('네트워크 오류'));
    xhr.ontimeout = () => reject(new Error('시간 초과'));
    xhr.send(form);
  });
}

async function uploadOne(item: QueueItem, onProgress?: (localId: string, ratio: number) => void) {
  await queue.update(item.local_id, { status: 'uploading', progress: 0, error: null });
  const trackPath = `${FileSystem.cacheDirectory}${item.local_id}.track.json`;

  try {
    const traj = await readTrajectory(item.local_id);
    if (!traj) throw new Error('궤적 파일이 없습니다');
    await FileSystem.writeAsStringAsync(trackPath, JSON.stringify(toServerTrack(traj)));

    const form = new FormData();
    // 서버는 파일 이름 확장자로 형식을 고른다 (.mp4 / .mov / .webm)
    form.append('file', { uri: item.video_path, name: `${item.local_id}.mp4`, type: 'video/mp4' } as any);
    form.append('trajectory', { uri: trackPath, name: `${item.local_id}.json`, type: 'application/json' } as any);

    const progress = (ratio: number) => {
      void queue.update(item.local_id, { progress: ratio });
      onProgress?.(item.local_id, ratio);
    };
    // 같은 키로 다시 보내면 서버가 새로 만들지 않고 기존 영상을 돌려준다 — 응답을 못 받고 재시도해도 중복이 안 생긴다
    const headers = { 'Idempotency-Key': item.local_id };

    let res = await send(form, { ...headers, ...(await authHeader()) }, progress);
    if (res.status === 401) res = await send(form, { ...headers, ...(await authHeader(true)) }, progress);
    if (res.status >= 300) {
      // 서버 에러는 { error: { message } } — 한국어라 그대로 보여준다. nginx가 직접 준 413 등은 JSON이 아니다
      let message = `업로드 실패 (${res.status})`;
      try { message = JSON.parse(res.body).error?.message ?? message; } catch {}
      throw new Error(message);
    }
    const { video_id } = JSON.parse(res.body) as { video_id: string };

    // 서버가 받은 뒤에만 로컬 영상을 지운다. trajectory와 썸네일은 남겨서 오프라인에서도 목록이 보이게.
    await deleteLocal(item.local_id, { keepTrajectory: true });
    await queue.update(item.local_id, { status: 'done', progress: 1, video_id });
  } catch (e: any) {
    await queue.update(item.local_id, { status: 'failed', error: e?.message ?? '업로드 실패' });
  } finally {
    await FileSystem.deleteAsync(trackPath, { idempotent: true });
  }
}

export async function retryFailed() {
  for (const item of await queue.list('failed')) {
    await queue.update(item.local_id, { status: 'queued', error: null });
  }
  return processQueue();
}
