import { useCallback, useEffect, useRef, useState } from 'react';
import { Dimensions } from 'react-native';
import * as Location from 'expo-location';
import { getDb } from '@/models/db';
import { mockApi } from '@/models/mockApi';
import dongBoundaries from '@/models/data/dongs.json';
import { dongCoverage, nodesOf, reviewedRoads, roadsInBBox } from '@/models/roadCache';
import { extraRoads, isMajorClip, isMajorName } from '@/models/roadClass';
import type { Region } from 'react-native-maps';
import type { ClipTrace, RoadNode, RoadSegment } from '@/models/types';
import { useRoadSync } from './useRoadSync';

// 도로·동별 %는 로컬 도로 캐시(서버 동기화)를 읽는다 — 오프라인에서도 마지막으로 받은 상태가 보인다.
// 내 클립은 서버 클립 API가 없어 아직 폰에 남은 궤적(mock). 검수자가 도로에 매칭하기 전의 내 촬영을 보여주는 용도.
const source = mockApi;

/** dong: 동별 % / road: 큰길만 / clip: 골목까지 전부 (D20) */
export type MapLevel = 'dong' | 'road' | 'clip';

export function levelForZoom(zoom: number): MapLevel {
  if (zoom <= 14) return 'dong';
  if (zoom <= 15) return 'road';   // 골목은 z16부터 — z17은 너무 들어가야 보였다 (2026-10-05)
  return 'clip';
}

/** ratio null: 최초 도로 동기화 전이라 아직 모른다 */
export type DongArea = { code: string; name: string; label: [number, number]; ring: [number, number][]; ratio: number | null };
export type MapClip = ClipTrace & { major: boolean };
export type MapRoad = RoadSegment & { major: boolean };

const boundaries = dongBoundaries as Omit<DongArea, 'ratio'>[];
const SEONGDONG: [number, number] = [37.5506, 127.0409];
const NODE_RADIUS_PT = 3;   // 노드 점 반지름. 지도 Circle은 미터 단위라 줌마다 화면 크기에 맞춰 다시 잰다

// ponytail: 세션 동안만 기억한다. 클립이 수백 개로 늘어 지도 열 때마다 느려지면 파일로 남길 것
const majorCache = new Map<string, boolean>();

/** 클립 주변 도로(로컬 캐시)로 큰길/골목을 가른다. 캐시에 없는 곳(성동구 밖)은 앱에 넣은 도로명만 본다 */
async function classify(c: ClipTrace, ready: boolean): Promise<MapClip> {
  const hit = majorCache.get(c.video_id);
  if (hit !== undefined) return { ...c, major: hit };
  const lats = c.geometry.map(p => p[0]), lons = c.geometry.map(p => p[1]);
  const m = 0.0005;   // 약 45~55m — 매칭 거리 40m보다 넉넉하게
  const roads = ready ? await roadsInBBox(await getDb(), {
    minLat: Math.min(...lats) - m, maxLat: Math.max(...lats) + m, minLon: Math.min(...lons) - m, maxLon: Math.max(...lons) + m,
  }) : [];
  const major = isMajorClip(c.geometry, [...roads.map(r => ({ name: r.road_name, points: r.geometry })), ...extraRoads]);
  if (ready) majorCache.set(c.video_id, major);   // 도로를 다 받기 전 결과는 다음에 다시 센다
  return { ...c, major };
}

export function useCoverage() {
  const sync = useRoadSync();
  const [level, setLevel] = useState<MapLevel>('dong');
  const [start, setStart] = useState<[number, number] | null>(null);
  const [dongs, setDongs] = useState<DongArea[]>(boundaries.map(d => ({ ...d, ratio: null })));
  const [roads, setRoads] = useState<MapRoad[]>([]);
  const [rawClips, setRawClips] = useState<ClipTrace[]>([]);
  const [clips, setClips] = useState<MapClip[]>([]);
  const [region, setRegion] = useState<Region | null>(null);
  const [nodes, setNodes] = useState<RoadNode[]>([]);
  const [network, setNetwork] = useState<RoadSegment[]>([]);   // 화면 안 아직 안 찍은 구간 — 노드를 잇는 회색 선

  useEffect(() => {
    // 마지막으로 알던 위치에서 시작. 권한이 없거나 기록이 없으면 성동구
    void Location.getLastKnownPositionAsync()
      .then(p => setStart(p ? [p.coords.latitude, p.coords.longitude] : SEONGDONG), () => setStart(SEONGDONG));
    void source.clips().then(r => setRawClips(r.clips), e => console.warn('[map] clips', e));
  }, []);

  // 동기화 페이지가 커밋될 때마다(revision이 바뀔 때) 다시 읽는다. 최초 동기화가 끝나기 전엔 도로·%를 그리지 않는다
  useEffect(() => {
    if (!sync.ready) return;
    void (async () => {
      const db = await getDb();
      const ratio = await dongCoverage(db, boundaries);
      setDongs(boundaries.map(d => ({ ...d, ratio: ratio.get(d.code) ?? 0 })));
      setRoads((await reviewedRoads(db)).map(r => ({ ...r, major: isMajorName(r.road_name) })));
    })().catch(e => console.warn('[map] roads', e));
  }, [sync.ready, sync.revision]);

  useEffect(() => {
    void Promise.all(rawClips.map(c => classify(c, sync.ready))).then(setClips, e => console.warn('[map] classify', e));
  }, [rawClips, sync.ready]);

  // 도로망(노드 + 안 찍은 구간)은 골목 단계(z16~)에서 화면 안만 — 성동구 전체는 노드 7,800개·구간 9,500개라 다 그리면 버벅인다.
  // ponytail: 가장 촘촘한 곳은 골목 단계 첫 화면에 노드 870개쯤. 버벅이면 z17부터 그리거나 개수를 자를 것
  useEffect(() => {
    if (!sync.ready || !region || level !== 'clip') { setNodes([]); setNetwork([]); return; }
    let live = true;   // 지도를 빨리 옮기면 앞선 조회가 늦게 끝나 덮어쓰지 않게
    const { latitude: lat, longitude: lon, latitudeDelta: dLat, longitudeDelta: dLon } = region;
    const b = { minLat: lat - dLat / 2, maxLat: lat + dLat / 2, minLon: lon - dLon / 2, maxLon: lon + dLon / 2 };
    void getDb()
      .then(db => roadsInBBox(db, b))
      .then(rs => {
        if (!live) return;
        setNodes(nodesOf(rs, b));
        setNetwork(rs.filter(r => r.status === 'none'));   // 찍은 구간은 roads가 색으로 그린다
      }, e => console.warn('[map] network', e));
    return () => { live = false; };
  }, [sync.ready, sync.revision, region, level]);

  const onRegion = useCallback((r: Region) => {
    setRegion(r);
    setLevel(levelForZoom(Math.round(Math.log2(360 / r.longitudeDelta))));
  }, []);

  const nodeRadius = region
    ? region.longitudeDelta * 111_320 * Math.cos(region.latitude * Math.PI / 180) / Dimensions.get('window').width * NODE_RADIUS_PT
    : 0;

  return { level, start, dongs, roads, clips, network, nodes, nodeRadius, onRegion, sync };
}

/**
 * 촬영 화면 미니맵용. 첫 위치가 잡히면 주변 구간을 로컬 캐시에서 **한 번만** 읽어 메모리에 둔다.
 * 최초 도로 동기화가 아직이면 끝난 뒤에 읽는다.
 */
export function useNearbyRoads(position: [number, number] | null) {
  const { ready } = useRoadSync();
  const [roads, setRoads] = useState<RoadSegment[]>([]);
  const loaded = useRef(false);

  useEffect(() => {
    if (!position || !ready || loaded.current) return;
    loaded.current = true;
    const [lat, lon] = position;   // 주변 약 ±330m × ±350m
    void getDb()
      .then(db => roadsInBBox(db, { minLat: lat - 0.003, maxLat: lat + 0.003, minLon: lon - 0.004, maxLon: lon + 0.004 }))
      .then(setRoads)
      .catch(e => { loaded.current = false; console.warn('[minimap] roads', e); });
  }, [position, ready]);

  return roads;
}
