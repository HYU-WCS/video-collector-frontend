import { AppState, type NativeEventSubscription } from 'react-native';
import { api, hasSession } from './api';
import { getDb } from './db';
import { readRoadMeta, syncAllRoads, type RoadMeta } from './roadCache';

// 도로 동기화 일정 (백엔드 docs/road-sync.md):
// 로그인·세션 복원 직후 한 번, 앞으로 돌아왔고 마지막 성공이 1분 넘었으면 한 번, 앞에 있는 동안 5분마다.
// 화면마다 따로 돌면 타이머가 겹치니 앱에 하나만 둔다 — App이 로그인 상태에 맞춰 start/stop한다.

const STALE_MS = 60_000;
const EVERY_MS = 5 * 60_000;
const BACKOFF_S = [2, 5, 15, 30];

export type RoadSyncState = RoadMeta & { syncing: boolean; error: string | null };

let state: RoadSyncState = { revision: 0, ready: false, lastSuccessAt: null, count: 0, syncing: false, error: null };
const listeners = new Set<() => void>();
const set = (patch: Partial<RoadSyncState>) => { state = { ...state, ...patch }; listeners.forEach(l => l()); };

export const roadSyncState = () => state;
export function onRoadSyncChange(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

let running: Promise<void> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryIndex = 0;
let interval: ReturnType<typeof setInterval> | null = null;
let appState: NativeEventSubscription | null = null;

const clearRetry = () => { if (retryTimer) clearTimeout(retryTimer); retryTimer = null; };

/** 이미 돌고 있으면 그 promise를 돌려준다 — 동시에 두 번 돌지 않는다. retry가 아니면 backoff를 처음부터 */
export function syncRoads(retry = false): Promise<void> {
  if (running) return running;
  clearRetry();
  if (!retry) retryIndex = 0;
  if (!hasSession()) return Promise.resolve();
  running = (async () => {
    set({ syncing: true });
    const db = await getDb();
    const started = Date.now();
    try {
      // 페이지가 커밋될 때마다 다시 읽어 화면을 갱신한다 — 커밋 전 상태는 내보내지 않는다
      await syncAllRoads(db, since => api.roadSync(since), () => void readRoadMeta(db).then(set));
      retryIndex = 0;
      set({ ...(await readRoadMeta(db)), error: null });
      if (__DEV__) console.log(`[roads] sync rev=${state.revision} roads=${state.count} ${Date.now() - started}ms`);
    } catch (e: any) {
      // 캐시는 그대로 둔다. 지도는 마지막으로 받은 도로를 계속 보여준다
      if (__DEV__) console.warn('[roads] sync', e?.message);
      set({ ...(await readRoadMeta(db)), error: e?.message ?? '도로 정보를 받지 못했습니다' });
      const delay = BACKOFF_S[retryIndex++];
      if (delay) retryTimer = setTimeout(() => void syncRoads(true), delay * 1000);
    } finally {
      running = null;
      set({ syncing: false });
    }
  })();
  return running;
}

const startInterval = () => { if (!interval) interval = setInterval(() => void syncRoads(), EVERY_MS); };
const stopInterval = () => { if (interval) clearInterval(interval); interval = null; };

function onAppState(s: string) {
  if (s !== 'active') { stopInterval(); return; }
  startInterval();
  if (retryTimer) void syncRoads(true);   // 예약된 재시도 하나만 앞당긴다
  else if (!state.lastSuccessAt || Date.now() - state.lastSuccessAt >= STALE_MS) void syncRoads();
}

/** 로그인 성공·세션 복원 직후 */
export async function startRoadSync() {
  if (appState) return;
  set(await readRoadMeta(await getDb()));
  appState = AppState.addEventListener('change', onAppState);
  if (AppState.currentState === 'active') startInterval();
  void syncRoads();
}

/** 로그아웃 — 도로 캐시는 개인 정보가 아니라 남긴다 */
export function stopRoadSync() {
  appState?.remove();
  appState = null;
  stopInterval();
  clearRetry();
}
