import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { api } from '@/models/api';
import { mockApi } from '@/models/mockApi';
import dongBoundaries from '@/models/data/dongs.json';
import { extraRoads, isMajorClip } from '@/models/roadClass';
import type { ClipTrace, RoadSegment } from '@/models/types';

// 도로 구간은 실제 서버. 동별 달성률(coverage)·클립(clips)은 서버 API가 없어 아직 mock.
const source = mockApi;
const roadsSource = api;

/** dong: 동별 % / road: 큰길 클립만 / clip: 골목까지 전부 (D6) */
export type MapLevel = 'dong' | 'road' | 'clip';

export function levelForZoom(zoom: number): MapLevel {
  if (zoom <= 14) return 'dong';
  if (zoom <= 15) return 'road';   // 골목은 z16부터 — z17은 너무 들어가야 보였다 (2026-10-05)
  return 'clip';
}

export type DongArea = { code: string; name: string; label: [number, number]; ring: [number, number][]; ratio: number };
export type MapClip = ClipTrace & { major: boolean };

const SEONGDONG: [number, number] = [37.5506, 127.0409];

// ponytail: 세션 동안만 기억한다. 클립이 수백 개로 늘어 지도 열 때마다 느려지면 파일로 남길 것
const majorCache = new Map<string, boolean>();

/** 클립 주변 서버 도로를 받아 큰길/골목을 가른다. 서버가 없는 곳(성동구 밖)은 앱에 넣은 도로명만 본다 */
async function classify(c: ClipTrace): Promise<MapClip> {
  const hit = majorCache.get(c.video_id);
  if (hit !== undefined) return { ...c, major: hit };
  const lats = c.geometry.map(p => p[0]), lons = c.geometry.map(p => p[1]);
  const m = 0.0005;   // 약 45~55m — 매칭 거리 40m보다 넉넉하게
  const server = await roadsSource.roads(
    { minLat: Math.min(...lats) - m, maxLat: Math.max(...lats) + m, minLon: Math.min(...lons) - m, maxLon: Math.max(...lons) + m }, 500,
  ).then(r => r.roads, e => { console.warn('[map] roads', e); return null; });
  const major = isMajorClip(c.geometry, [...(server ?? []).map(r => ({ name: r.road_name, points: r.geometry })), ...extraRoads]);
  if (server) majorCache.set(c.video_id, major);   // 서버 실패 땐 다음에 다시 시도
  return { ...c, major };
}

export function useCoverage() {
  const [level, setLevel] = useState<MapLevel>('dong');
  const [start, setStart] = useState<[number, number] | null>(null);
  const [dongs, setDongs] = useState<DongArea[]>([]);
  const [clips, setClips] = useState<MapClip[]>([]);

  useEffect(() => {
    // 마지막으로 알던 위치에서 시작. 권한이 없거나 기록이 없으면 성동구
    void Location.getLastKnownPositionAsync()
      .then(p => setStart(p ? [p.coords.latitude, p.coords.longitude] : SEONGDONG), () => setStart(SEONGDONG));
    void source.coverage().then(r => {
      const ratio = new Map(r.dongs.map(d => [d.code, d.ratio]));
      setDongs((dongBoundaries as Omit<DongArea, 'ratio'>[]).map(d => ({ ...d, ratio: ratio.get(d.code) ?? 0 })));
    }, e => console.warn('[map] coverage', e));
    void source.clips()
      .then(r => Promise.all(r.clips.map(classify)))
      .then(setClips, e => console.warn('[map] clips', e));
  }, []);

  const onZoom = useCallback((zoom: number) => setLevel(levelForZoom(zoom)), []);

  return { level, start, dongs, clips, onZoom };
}

/**
 * 촬영 화면 미니맵용. 첫 위치가 잡히면 주변 구간을 **한 번만** 받아 메모리에 둔다.
 * 걷는 동안 계속 요청하면 네트워크 없는 곳에서 멈추고 배터리를 먹는다.
 */
export function useNearbyRoads(position: [number, number] | null) {
  const [roads, setRoads] = useState<RoadSegment[]>([]);
  const loaded = useRef(false);

  useEffect(() => {
    if (!position || loaded.current) return;
    loaded.current = true;
    const [lat, lon] = position;   // 주변 약 ±330m × ±350m
    void roadsSource.roads({ minLat: lat - 0.003, maxLat: lat + 0.003, minLon: lon - 0.004, maxLon: lon + 0.004 }, 500)
      .then(r => setRoads(r.roads))
      .catch(e => { loaded.current = false; console.warn('[minimap] roads', e); });
  }, [position]);

  return roads;
}
