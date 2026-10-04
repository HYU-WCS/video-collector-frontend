import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { useKeepAwake } from 'expo-keep-awake';
import { adoptRecording, saveThumbnail, writeTrajectory } from '@/models/storage';
import { queue } from '@/models/db';
import { initialDistance, shownDistance, stepDistance } from '@/models/distance';
import type { TrajectoryPoint } from '@/models/types';

// 도보 촬영 기준으로 맞춰져 있다. 차량이 아니다.
//
// 좌표는 받는 대로 전부 궤적에 남기고, 거리는 models/distance.ts의 누적기로 따로 잰다.
// 이전의 "3초 간격 점끼리 재기"는 제자리 지터가 쌓여 60초 정지에 70~130m가 붙었다 (D8 개정).

const SAMPLE_MS = 1000;
const GPS_STALL_MS = 5000;     // 이만큼 위치가 안 오면 구독을 다시 건다 — iOS가 업데이트를 멈추는 경우 대비
const BACKUP_EVERY = 10;       // 10초마다 임시 저장 — 앱이 죽어도 손실은 10초치
const GPS_WARN_M = 15;
const GPS_BLOCK_M = 40;
// 녹화 전 GPS 안정 대기. 화면에 들어온 직후엔 정확도가 22~24m로 나오다 10~30초 뒤 좋아진다.
// 그 상태로 찍기 시작하면 출발 구간 궤적이 부정확하다. 단 실내·빌딩 숲에서 영영 못 찍지 않게 상한을 둔다.
const READY_M = 20;
const READY_WAIT_SEC = 30;

export type GpsQuality = 'good' | 'weak' | 'none';

export function useRecorder() {
  useKeepAwake();   // 없으면 걷는 도중 화면이 꺼지고 녹화가 끊긴다

  const [recording, setRecording] = useState(false);
  const [now, setNow] = useState(Date.now());   // 1초 틱 — 녹화 시간은 GPS와 무관하게 흐른다
  const [distance, setDistance] = useState(0);
  const [gps, setGps] = useState<GpsQuality>('none');
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [position, setPosition] = useState<[number, number] | null>(null);   // [lat, lon] — 미니맵 중심
  const [settled, setSettled] = useState(false);   // 한 번 READY_M 안으로 들어오면 이후 흔들려도 유지
  // [임시 진단] 실외 보행 시 GPS 업데이트가 멈추는 원인 추적용. 원인 확인되면 지운다.
  const [fixes, setFixes] = useState(0);
  const [lastFixAt, setLastFixAt] = useState<number | null>(null);
  const [resubs, setResubs] = useState(0);

  const points = useRef<TrajectoryPoint[]>([]);
  const dist = useRef(initialDistance());
  const lastFixRef = useRef(0);
  const granted = useRef(false);
  const enteredAt = useRef(Date.now());
  const startedAt = useRef<number>(0);
  const localId = useRef<string>('');
  const sub = useRef<Location.LocationSubscription | null>(null);

  // 촬영 화면에 있는 동안은 항상 위치를 구독한다. 녹화 전에도 GPS 상태를 보여줘야 하므로.
  const subscribe = useCallback(async () => {
    sub.current?.remove();
    sub.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, timeInterval: SAMPLE_MS, distanceInterval: 0 },
      onFix,
      reason => console.warn('[gps] watch error', reason),
    );
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted' || !alive) return;
      granted.current = true;
      lastFixRef.current = Date.now();
      await subscribe();
    })().catch(e => console.warn('[gps] subscribe failed', e));
    return () => { alive = false; sub.current?.remove(); };
  }, [subscribe]);

  // 감시견: iOS는 오류나 자동 일시정지로 위치 스트림을 조용히 끝내는 경우가 있다.
  // 끝난 스트림은 다시 살아나지 않으므로, 몇 초간 소식이 없으면 새로 구독한다.
  useEffect(() => {
    const t = setInterval(() => {
      if (!granted.current || Date.now() - lastFixRef.current < GPS_STALL_MS) return;
      console.warn('[gps] 위치 업데이트 멈춤 — 재구독');
      lastFixRef.current = Date.now();
      setResubs(n => n + 1);
      void subscribe().catch(e => console.warn('[gps] resubscribe failed', e));
    }, 1000);
    return () => clearInterval(t);
  }, [subscribe]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const onFix = useCallback((loc: Location.LocationObject) => {
    const acc = loc.coords.accuracy ?? 999;
    setAccuracy(acc);
    setPosition([loc.coords.latitude, loc.coords.longitude]);
    setFixes(n => n + 1);
    setLastFixAt(Date.now());
    lastFixRef.current = Date.now();
    setGps(acc <= GPS_WARN_M ? 'good' : acc <= GPS_BLOCK_M ? 'weak' : 'none');
    if (acc <= READY_M) setSettled(true);

    if (!startedAt.current) return;

    const p: TrajectoryPoint = {
      t: Math.round((Date.now() - startedAt.current) / 1000),
      lat: loc.coords.latitude,
      lon: loc.coords.longitude,
      acc: Math.round(acc * 10) / 10,
      spd: loc.coords.speed ?? undefined,
      hdg: loc.coords.heading ?? undefined,
    };

    points.current.push(p);       // 궤적에는 전부 남긴다
    if (__DEV__ && points.current.length % 5 === 0) console.log(`[gps] t=${p.t}s n=${points.current.length} acc=${p.acc}m`);
    dist.current = stepDistance(dist.current, p);   // 거리는 걸러서 잰다
    setDistance(shownDistance(dist.current));

    if (points.current.length % BACKUP_EVERY === 0) void backup();
  }, []);

  const backup = useCallback(async () => {
    if (!localId.current) return;
    await writeTrajectory(localId.current, {
      local_id: localId.current,
      recorded_at: new Date(startedAt.current).toISOString(),
      sample_rate_sec: SAMPLE_MS / 1000,
      points: points.current,
    });
  }, []);

  const start = useCallback(() => {
    localId.current = `clip_${Date.now()}`;
    startedAt.current = Date.now();
    points.current = [];
    dist.current = initialDistance();
    setNow(Date.now()); setDistance(0); setRecording(true);
    return localId.current;
  }, []);

  /** 카메라가 돌려준 캐시 uri를 받아 앱 저장소로 옮기고 업로드 큐에 넣는다. */
  const finish = useCallback(async (cacheUri: string, keep: boolean, steps?: number) => {
    setRecording(false);
    const id = localId.current;
    const durationSec = startedAt.current ? Math.round((Date.now() - startedAt.current) / 1000) : 0;
    startedAt.current = 0;
    if (!keep || !id) return null;

    const videoPath = await adoptRecording(cacheUri, id);
    const trajPathStr = await writeTrajectory(id, {
      local_id: id,
      recorded_at: new Date().toISOString(),
      sample_rate_sec: SAMPLE_MS / 1000,
      points: points.current,
      steps,
    });

    await queue.add({
      local_id: id,
      video_path: videoPath,
      traj_path: trajPathStr,
      recorded_at: new Date().toISOString(),
      duration_sec: durationSec,
      distance_m: Math.round(distance),
    });
    // 썸네일 실패가 업로드를 막으면 안 된다. 큐에 넣은 뒤에 뽑는다.
    await saveThumbnail(id, videoPath).catch(e => console.warn('[thumb]', e));
    return id;
  }, [distance]);

  const waited = Math.floor((now - enteredAt.current) / 1000);
  const ready = settled || waited >= READY_WAIT_SEC;

  return {
    recording, distance, gps, accuracy, position,
    ready, readyWaitLeft: Math.max(0, READY_WAIT_SEC - waited),
    elapsed: recording && startedAt.current ? Math.floor((now - startedAt.current) / 1000) : 0,
    diag: { fixes, resubs, lastFixAgo: lastFixAt ? Math.round((now - lastFixAt) / 1000) : null },
    canRecord: gps !== 'none' && ready,
    trail: points.current,
    start, finish,
  };
}
