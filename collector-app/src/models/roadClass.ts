import susaekRoads from './data/susaek-roads.json';

// 큰길/골목은 도로명 끝글자로 나눈다. 도로명주소법 시행령: 대로(8차로↑)·로(2~7차로) = 큰길, 길 = 그 외.
// 서버 도보 네트워크는 성동구뿐이라 은평구 수색동은 OSM 도로명을 앱에 넣어 두었다 (테스트 클립이 거기 있음).

export type NamedLine = { name: string; points: [number, number][] };   // [lat, lon][]

export const extraRoads = susaekRoads as NamedLine[];

/** 서버가 도로명을 못 붙인 구간은 "행당동 보행로"라 끝이 '로'여도 큰길이 아니다 */
export const isMajorName = (n: string) => n.endsWith('로') && !n.endsWith('보행로');

const M_PER_DEG = 111320;

/** 점에서 선분까지 거리(m). 100m 클립 범위라 평면 근사로 충분하다 */
function distM(p: [number, number], a: [number, number], b: [number, number]) {
  const k = Math.cos((p[0] * Math.PI) / 180);
  const ax = (a[1] - p[1]) * M_PER_DEG * k, ay = (a[0] - p[0]) * M_PER_DEG;
  const bx = (b[1] - p[1]) * M_PER_DEG * k, by = (b[0] - p[0]) * M_PER_DEG;
  const dx = bx - ax, dy = by - ay, len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len)) : 0;
  return Math.hypot(ax + t * dx, ay + t * dy);
}

/**
 * 점마다 maxM 안의 가장 가까운 도로에 붙이고, **전체 점의 절반 넘게** 큰길에 붙으면 큰길. 나머지는 골목 —
 * 가까이 확대했을 때만 보이니 놓치지는 않는다.
 * 40m: OSM은 차도 중심선이고 GPS 오차도 있다. 70m부터는 단지 안을 걸은 클립이 옆 큰길에 붙는다 (data/raw 실측).
 * '붙은 점 중 다수결'로 하면 대부분 안 붙은 단지 안 클립이 몇 점 때문에 큰길이 된다 — 그래서 전체 점 기준.
 */
export function isMajorClip(points: [number, number][], roads: NamedLine[], maxM = 40) {
  let major = 0;
  for (const p of points) {
    let best: NamedLine | null = null, bestD = maxM;
    for (const r of roads) {
      for (let i = 1; i < r.points.length; i++) {
        const d = distM(p, r.points[i - 1], r.points[i]);
        if (d < bestD) { bestD = d; best = r; }
      }
    }
    if (best && isMajorName(best.name)) major++;
  }
  return major > points.length / 2;
}
