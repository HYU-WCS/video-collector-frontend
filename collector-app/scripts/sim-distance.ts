// 거리 누적기 검증용 시뮬레이션. 합성 GPS(노이즈·정지·코너·점프)로 기존/새 방식을 비교한다.
// 실행: npx tsx scripts/sim-distance.ts   — 거리 로직을 고치면 꼭 다시 돌릴 것.

import { initialDistance, stepDistance, shownDistance, haversine } from '../src/models/distance';
type P = { t: number; lat: number; lon: number; acc: number; spd?: number };

// 결정적 난수
let seed = 1;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());

const LAT0 = 37.5503, LON0 = 127.0731;
const mLat = 1 / 111320, mLon = 1 / (111320 * Math.cos(LAT0 * Math.PI / 180));

// 진짜 경로(m 단위 x,y)를 초마다 받아 노이즈 섞인 GPS 점으로
function track(truth: [number, number][], opt: { sigma: number; rho: number; doppler: boolean; jumpAt?: number }) {
  let ex = 0, ey = 0; const out: P[] = [];
  truth.forEach(([x, y], t) => {
    const k = Math.sqrt(1 - opt.rho ** 2) * opt.sigma;
    ex = opt.rho * ex + k * gauss(); ey = opt.rho * ey + k * gauss();
    let jx = 0; if (opt.jumpAt === t) jx = 60;           // 60m 한 번 튐
    const prev = truth[Math.max(0, t - 1)];
    const v = Math.hypot(x - prev[0], y - prev[1]);
    out.push({ t, lat: LAT0 + (y + ey) * mLat, lon: LON0 + (x + ex + jx) * mLon, acc: 4 + rnd() * 4,
      spd: opt.doppler ? Math.max(0, v + gauss() * 0.2) : undefined });
  });
  return out;
}

// 기존 알고리즘: 3초 이상 벌어진 점끼리, acc<=20, d<1 무시
function oldAlgo(ps: P[]) {
  let anchor: P | null = null, total = 0;
  for (const p of ps) {
    if (p.acc > 20) continue;
    if (!anchor) { anchor = p; continue; }
    if (p.t - anchor.t < 3) continue;
    const d = haversine(anchor.lat, anchor.lon, p.lat, p.lon); anchor = p;
    if (d >= 1) total += d;
  }
  return total;
}
// 저장·표시되는 값(확정 + 잠정) 기준으로 잰다
function newAlgo(ps: P[]) { let s = initialDistance(); for (const p of ps) s = stepDistance(s, p as any); return shownDistance(s); }

const walk = (secs: number, v = 1.4, stopFrom = -1, stopSecs = 0) => {
  const pts: [number, number][] = []; let x = 0;
  for (let t = 0; t < secs; t++) { pts.push([x, 0]); if (!(t >= stopFrom && t < stopFrom + stopSecs)) x += v; }
  return pts;
};
const still = (secs: number) => Array.from({ length: secs }, () => [0, 0] as [number, number]);
// ㄱ자로 50m + 50m
const corner = () => { const p: [number, number][] = []; for (let t = 0; t <= 72; t++) { const d = t * 1.4; p.push(d <= 50 ? [d, 0] : [50, d - 50]); } return p; };

const scenarios: [string, [number, number][], number, number?][] = [
  ['정지 60초', still(60), 0],
  ['직진 100m', walk(72), 100],
  ['100m + 중간 30초 정지', walk(102, 1.4, 35, 30), 100],
  ['ㄱ자 100m', corner(), 100],
  ['직진 100m + 60m 점프 1회', walk(72), 100, 30],
];

const N = 300;
for (const noise of [{ name: '상관 노이즈 σ4m ρ0.9', sigma: 4, rho: 0.9 }, { name: '독립 노이즈 σ4m', sigma: 4, rho: 0 }]) {
  for (const doppler of [true, false]) {
    console.log(`\n### ${noise.name} · 도플러 속도 ${doppler ? '있음' : '없음'}  (각 ${N}회, 평균 [10%~90%])`);
    console.log('시나리오'.padEnd(22), '정답'.padStart(5), '기존'.padStart(18), '새 방식'.padStart(18));
    for (const [name, truth, answer, jumpAt] of scenarios) {
      const o: number[] = [], n: number[] = [];
      for (let i = 0; i < N; i++) { const ps = track(truth, { ...noise, doppler, jumpAt }); o.push(oldAlgo(ps)); n.push(newAlgo(ps)); }
      const fmt = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); const m = xs.reduce((a, b) => a + b) / xs.length;
        return `${m.toFixed(0)}m [${s[Math.floor(N * .1)].toFixed(0)}~${s[Math.floor(N * .9)].toFixed(0)}]`; };
      console.log(name.padEnd(22), `${answer}m`.padStart(5), fmt(o).padStart(18), fmt(n).padStart(18));
    }
  }
}
