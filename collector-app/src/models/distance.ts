import type { TrajectoryPoint } from './types';

// 도보 거리 누적기. 순수 함수라 화면·센서 없이 시뮬레이션으로 검증한다.
//
// 참고한 방식 (docs/05-decisions.md D8):
//   - OpenTracks: 마지막으로 채택한 점에서 일정 거리(기본 10m) 이상 벗어났을 때만 거리에 더한다.
//     시간 간격으로 솎으면 제자리 지터가 창마다 조금씩 쌓인다.
//   - 이상치(점프) 제거: 도보로 불가능한 속도는 버린다.
//   - 평활: 최근 몇 개 점의 평균을 써서 무작위 노이즈를 줄인다 (칼만 필터의 단순한 대체).
//   - 정지 판정: 기기가 주는 도플러 속도(spd)가 매우 낮으면 이동으로 치지 않는다.
//
// 여기서 나온 거리는 촬영 중 "100m쯤 됐다"는 안내용이다.
// 정산 km는 검수에서 매칭된 도로 구간 길이로 계산하는 게 맞다 (D18 제안).

export const DIST = {
  MAX_ACC_M: 20,        // 이보다 부정확한 점은 거리에 안 쓴다
  MIN_STEP_M: 15,       // 기준점에서 이만큼(또는 정확도만큼) 벗어나야 이동으로 인정 (10→15, 2026-09-25 조정)
  MAX_SPEED_MPS: 5,     // 도보로 불가능한 속도 — 건물 반사 등으로 튄 점
  STILL_SPEED_MPS: 0.3, // 도플러 속도가 이보다 낮으면 서 있는 것
  SMOOTH_N: 5,          // 평균 낼 최근 점 개수 (3→5 — 흔들림이 거리를 부풀리는 치우침을 줄임)
  JUMP_RESET_SEC: 10,   // 이 시간 넘게 계속 튀면 기준점이 틀린 것으로 보고 다시 잡는다
};

export interface DistanceState {
  total: number;                    // 확정 거리 — 기준점을 넘어선 이동만
  pending: number;                  // 표시용 잠정 거리 — 기준점에서 지금 위치까지. 서 있으면 0
  peak: number;                     // 지금까지 보여준 최대값 — 화면 숫자는 줄어들지 않는다
  anchor: TrajectoryPoint | null;   // 마지막으로 거리를 더한 (평활된) 점
  recent: TrajectoryPoint[];        // 평활용 최근 정상 점
}

export const initialDistance = (): DistanceState => ({ total: 0, pending: 0, peak: 0, anchor: null, recent: [] });

/**
 * 화면에 보여주고 저장할 거리. 확정분에 잠정분을 더해 걷는 동안 숫자가 부드럽게 오르고,
 * GPS 흔들림으로 잠정분이 잠깐 줄어도 화면 숫자는 뒤로 가지 않는다.
 */
export const shownDistance = (s: DistanceState) => s.peak;

export function stepDistance(s: DistanceState, p: TrajectoryPoint): DistanceState {
  const n = step(s, p);
  return n === s ? s : { ...n, peak: Math.max(n.peak, n.total + n.pending) };
}

function step(s: DistanceState, p: TrajectoryPoint): DistanceState {
  if (p.acc > DIST.MAX_ACC_M) return s;

  // 튄 점은 평활에 섞이기 전에 버린다
  if (s.anchor) {
    const dt = p.t - s.anchor.t;
    const d = haversine(s.anchor.lat, s.anchor.lon, p.lat, p.lon);
    if (dt > 0 && dt < DIST.JUMP_RESET_SEC && d / dt > DIST.MAX_SPEED_MPS) return s;
  }

  const recent = [...s.recent, p].slice(-DIST.SMOOTH_N);
  const sm: TrajectoryPoint = {
    ...p,
    lat: avg(recent.map(q => q.lat)),
    lon: avg(recent.map(q => q.lon)),
  };

  if (!s.anchor) return { ...s, recent, anchor: sm, pending: 0 };

  const dt = sm.t - s.anchor.t;
  const d = haversine(s.anchor.lat, s.anchor.lon, sm.lat, sm.lon);

  // 오래 튄 채로 있으면 기준점 자체가 틀렸던 것 — 거리는 더하지 않고 기준만 옮긴다
  if (dt >= DIST.JUMP_RESET_SEC && d / dt > DIST.MAX_SPEED_MPS) return { ...s, recent, anchor: sm, pending: 0 };

  const still = p.spd != null && p.spd >= 0 && p.spd < DIST.STILL_SPEED_MPS;
  // 서 있는 동안은 흔들림을 거리로 치지 않는다. 기준점은 옮기지 않으므로 멈추기 전 걸은 만큼은
  // 다시 걸을 때 기준점부터의 거리에 그대로 들어간다. 화면은 peak라 멈춰도 숫자가 줄지 않는다.
  // (이전엔 여기서 잠정분을 0으로 만들어 멈출 때마다 화면이 3~15m 줄었다 — 2026-09-25 실측 제보)
  if (still) return { ...s, recent, pending: 0 };

  if (d < Math.max(DIST.MIN_STEP_M, p.acc)) return { ...s, recent, pending: d };
  return { ...s, total: s.total + d, pending: 0, anchor: sm, recent };
}

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

export function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad, dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
