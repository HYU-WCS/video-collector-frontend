// SDK 54+에서 기존 API는 legacy로 옮겨졌다. 새 File/Directory API 이전은 실기기 검증 후.
import * as FileSystem from 'expo-file-system/legacy';
import * as SecureStore from 'expo-secure-store';
import * as VideoThumbnails from 'expo-video-thumbnails';
import type { Trajectory } from './types';

// 영상은 핸드폰 앨범(사진 앱)에 저장하지 않는다.
// 카메라가 쓴 캐시 → 앱 전용 저장소로 즉시 옮기고, 업로드 성공 후에만 삭제한다.

export const PENDING_DIR = `${FileSystem.documentDirectory}pending/`;

export async function ensureDirs() {
  const info = await FileSystem.getInfoAsync(PENDING_DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(PENDING_DIR, { intermediates: true });
}

export const videoPath = (localId: string) => `${PENDING_DIR}${localId}.mp4`;
export const trajPath  = (localId: string) => `${PENDING_DIR}${localId}.json`;
export const thumbPath = (localId: string) => `${PENDING_DIR}${localId}.jpg`;

/** 카메라 캐시에 있는 영상을 앱 저장소로 옮긴다. 캐시는 OS가 예고 없이 비운다. */
export async function adoptRecording(cacheUri: string, localId: string) {
  await ensureDirs();
  const dest = videoPath(localId);
  await FileSystem.moveAsync({ from: cacheUri, to: dest });
  return dest;
}

export async function writeTrajectory(localId: string, traj: Trajectory) {
  await ensureDirs();
  const dest = trajPath(localId);
  await FileSystem.writeAsStringAsync(dest, JSON.stringify(traj));
  return dest;
}

export async function readTrajectory(localId: string): Promise<Trajectory | null> {
  try {
    return JSON.parse(await FileSystem.readAsStringAsync(trajPath(localId)));
  } catch {
    return null;
  }
}

/** 첫 프레임을 썸네일로 남긴다. 영상은 업로드 후 지워지므로 촬영 직후에 뽑아야 한다 (D1). */
export async function saveThumbnail(localId: string, videoUri: string) {
  const { uri } = await VideoThumbnails.getThumbnailAsync(videoUri, { time: 0, quality: 0.5 });
  await FileSystem.moveAsync({ from: uri, to: thumbPath(localId) });
}

/** 회전 메타데이터까지 반영한 첫 프레임이 세로인가. 세로 고정 상태로 찍힌 옛 클립 판별용 (원격 주소도 된다). */
export async function isPortraitVideo(uri: string) {
  const { width, height } = await VideoThumbnails.getThumbnailAsync(uri, { time: 0, quality: 0.1 });
  return height > width;
}

/** 없으면 null. 업로드돼 영상이 지워진 클립과 다른 기기에서 찍은 클립은 만들 수 없다. */
export async function localThumbnail(localId: string) {
  const p = thumbPath(localId);
  if ((await FileSystem.getInfoAsync(p)).exists) return p;
  // 썸네일 기능 전에 찍었지만 아직 업로드 전이라 영상이 남아 있으면 지금 뽑는다
  if (!(await FileSystem.getInfoAsync(videoPath(localId))).exists) return null;
  try {
    await saveThumbnail(localId, videoPath(localId));
    return p;
  } catch {
    return null;
  }
}

export async function deleteLocal(localId: string, opts = { keepTrajectory: true }) {
  await FileSystem.deleteAsync(videoPath(localId), { idempotent: true });
  if (!opts.keepTrajectory) {
    await FileSystem.deleteAsync(trajPath(localId), { idempotent: true });
  }
}

export async function freeSpaceBytes() {
  return FileSystem.getFreeDiskStorageAsync();
}

// --- 토큰 --- refresh 토큰만 저장한다. access 토큰(15분)은 메모리에만 (api.ts).
const TOKEN_KEY = 'auth_token';
export const saveToken = (t: string) => SecureStore.setItemAsync(TOKEN_KEY, t);
export const loadToken = () => SecureStore.getItemAsync(TOKEN_KEY);
export const clearToken = () => SecureStore.deleteItemAsync(TOKEN_KEY);

// --- 반려 알림 읽음 기준 ---
// 마지막으로 읽은 판정의 reviewed_at. 서버에 읽음 상태를 두지 않는다 (D14).
const NOTICE_KEY = 'reject_seen_at';
export const saveNoticeSeenAt = (iso: string) => SecureStore.setItemAsync(NOTICE_KEY, iso);
export const loadNoticeSeenAt = () => SecureStore.getItemAsync(NOTICE_KEY);

/** 저장된 궤적 전부 (개발용 내보내기). 업로드 전이라 pending 폴더에 남아 있다. */
export async function listTrajectories(): Promise<Trajectory[]> {
  await ensureDirs();
  const names = (await FileSystem.readDirectoryAsync(PENDING_DIR)).filter(n => n.endsWith('.json'));
  const out: Trajectory[] = [];
  for (const n of names) {
    try { out.push(JSON.parse(await FileSystem.readAsStringAsync(PENDING_DIR + n))); } catch {}
  }
  return out.sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
}
