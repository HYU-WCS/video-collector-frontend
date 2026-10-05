import { useSyncExternalStore } from 'react';
import { onRoadSyncChange, roadSyncState, syncRoads } from '@/models/roadSync';

/** 도로 동기화 상태 구독. 일정은 models/roadSync가 앱에 하나만 돌린다 */
export function useRoadSync() {
  const state = useSyncExternalStore(onRoadSyncChange, roadSyncState);
  return { ...state, refresh: () => syncRoads() };
}
