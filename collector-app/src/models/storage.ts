// SDK 54+에서 기존 API는 legacy로 옮겨졌다. 새 File/Directory API 이전은 실기기 검증 후.
import * as FileSystem from 'expo-file-system/legacy';
import * as SecureStore from 'expo-secure-store';
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
