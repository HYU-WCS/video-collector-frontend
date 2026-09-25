import * as FileSystem from 'expo-file-system/legacy';
import { BASE_URL } from './api';
import { queue, type QueueItem } from './db';
import { deleteLocal, readTrajectory } from './storage';

// 영상과 trajectory는 한 요청에 묶어 보낸다.
// 따로 보내면 한쪽만 성공하는 상태가 생기고, 그때부터 정합성 코드를 쓰게 된다.

let running = false;

// 실제 서버 업로드는 아직 끈다 — 궤적 파일 형식 합의와 수집가 계정이 먼저 (docs/04 확인 필요).
// 켜기 전에 경로(/api/v1/videos, 필드 file·trajectory, Idempotency-Key)와 토큰(access)부터 맞출 것.
const UPLOAD_ENABLED = false;

export async function processQueue(
  token: string,
  onProgress?: (localId: string, ratio: number) => void,
): Promise<void> {
  if (!UPLOAD_ENABLED || running) return;
  running = true;
  try {
    const items = await queue.list();
    for (const item of items) {
      if (item.status === 'done' || item.status === 'uploading') continue;
      await uploadOne(item, token, onProgress);
    }
  } finally {
    running = false;
  }
}

async function uploadOne(
  item: QueueItem,
  token: string,
  onProgress?: (localId: string, ratio: number) => void,
) {
  await queue.update(item.local_id, { status: 'uploading', progress: 0, error: null });

  const task = FileSystem.createUploadTask(
    `${BASE_URL}/api/upload`,
    item.video_path,
    {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: 'video',
      headers: { Authorization: `Bearer ${token}` },
      parameters: {
        trajectory: JSON.stringify(await readTrajectory(item.local_id)),
        recorded_at: item.recorded_at,
        duration_sec: String(item.duration_sec),
        distance_m: String(item.distance_m),
      },
    },
    ({ totalBytesSent, totalBytesExpectedToSend }) => {
      const ratio = totalBytesExpectedToSend ? totalBytesSent / totalBytesExpectedToSend : 0;
      queue.update(item.local_id, { progress: ratio });
      onProgress?.(item.local_id, ratio);
    },
  );

  try {
    const res = await task.uploadAsync();
    if (!res || res.status >= 300) throw new Error(`HTTP ${res?.status}`);
    const { video_id } = JSON.parse(res.body);

    // 서버가 받은 뒤에만 로컬 영상을 지운다. trajectory와 썸네일은 남겨서 오프라인에서도 목록이 보이게.
    await deleteLocal(item.local_id, { keepTrajectory: true });
    await queue.update(item.local_id, { status: 'done', progress: 1, video_id });
  } catch (e: any) {
    await queue.update(item.local_id, { status: 'failed', error: e?.message ?? '업로드 실패' });
  }
}

export async function retryFailed(token: string) {
  for (const item of await queue.list('failed')) {
    await queue.update(item.local_id, { status: 'queued', error: null });
  }
  return processQueue(token);
}
