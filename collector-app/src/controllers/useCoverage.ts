import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/models/api';
import { mockApi } from '@/models/mockApi';
import type { BBox, ClipTrace, CoverageCell, RoadSegment } from '@/models/types';

// 도로 구간은 실제 서버. 동 단위 집계(coverage)·개별 클립(clips)은 서버 API가 없어 아직 mock.
const source = mockApi;
const roadsSource = api;

export type MapLevel = 'grid' | 'road' | 'clip';

export function levelForZoom(zoom: number): MapLevel {
  // 도로 응답이 무겁다(2000구간=1.2MB). 반경 1km 안팎(z15)부터만 구간을 받는다.
  if (zoom <= 14) return 'grid';
  if (zoom <= 16) return 'road';
  return 'clip';
}

export function useCoverage() {
  const [level, setLevel] = useState<MapLevel>('road');
  const [cells, setCells] = useState<CoverageCell[]>([]);
  const [roads, setRoads] = useState<RoadSegment[]>([]);
  const [clips, setClips] = useState<ClipTrace[]>([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** 카메라가 멈춘 뒤에만 요청한다. 팬 중에 매번 부르면 기기가 뜨거워진다. */
  const onRegionChange = useCallback((bbox: BBox, zoom: number) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const next = levelForZoom(zoom);
      setLevel(next);
      setLoading(true);
      try {
        if (next === 'grid') setCells((await source.coverage()).cells);
        else if (next === 'road') setRoads((await roadsSource.roads(bbox, 800)).roads);
        else {
          const [r, c] = await Promise.all([roadsSource.roads(bbox, 800), source.clips()]);
          setRoads(r.roads); setClips(c.clips);
        }
      } catch (e) {
        console.warn('[map] roads', e);
      } finally {
        setLoading(false);
      }
    }, 400);
  }, []);

  return { level, cells, roads, clips, loading, onRegionChange };
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
