// 정확도 문턱(MAX_ACC_M) 검증용. 정확도 22~25m로 보고되는 구간이 섞일 때 20m/25m 문턱을 비교한다.
// 위험: 문턱을 올리면 실제로 더 많이 튀는 점도 받아들인다. 그 구간의 노이즈를 σ 8~12m로 키워 본다.
// 실행: npx tsx scripts/sim-gate.ts
import { DIST, initialDistance, stepDistance, shownDistance } from '../src/models/distance';
type P = { t: number; lat: number; lon: number; acc: number; spd?: number };
let seed = 11;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
const LAT0 = 37.5503, LON0 = 127.0731, mLat = 1 / 111320, mLon = 1 / (111320 * Math.cos(LAT0 * Math.PI / 180));

// segs: [초, 속도, 나쁜 구간 여부]. 나쁜 구간은 acc 22~25, 노이즈 σ=badSigma
function make(segs: [number, number, boolean][], badSigma: number) {
  const out: P[] = []; let x = 0, t = 0, ex = 0, ey = 0; const rho = 0.9;
  for (const [secs, v, bad] of segs) for (let i = 0; i < secs; i++, t++) {
    const sigma = bad ? badSigma : 4, k = Math.sqrt(1 - rho ** 2) * sigma;
    ex = rho * ex + k * gauss(); ey = rho * ey + k * gauss();
    out.push({ t, lat: LAT0 + ey * mLat, lon: LON0 + (x + ex) * mLon,
      acc: bad ? 22 + rnd() * 3 : 8 + rnd() * 7, spd: Math.max(0, v + gauss() * 0.2) });
    x += v;
  }
  return { ps: out, truth: x };
}
function dist(ps: P[]) { let s = initialDistance(); for (const p of ps) s = stepDistance(s, p as any); return shownDistance(s); }

const scen: [string, [number, number, boolean][]][] = [
  ['출발 15초가 나쁨 → 100m',        [[15, 1.2, true], [68, 1.2, false]]],
  ['중간 20초가 나쁨 → 100m',        [[30, 1.2, false], [20, 1.2, true], [33, 1.2, false]]],
  ['전부 나쁨 100m',                 [[83, 1.2, true]]],
  ['나쁜 상태로 60초 정지 (유령 거리)', [[60, 0, true]]],
];
for (const badSigma of [6, 10]) {
  console.log(`\n### 나쁜 구간 노이즈 σ${badSigma}m · 300회 · 평균 [10~90%]`);
  for (const [name, segs] of scen) {
    const row = [20, 25].map(g => {
      DIST.MAX_ACC_M = g; seed = 11;
      const r = Array.from({ length: 300 }, () => { const m = make(segs, badSigma); return [dist(m.ps), m.truth]; });
      const v = r.map(([d]) => d).sort((a, b) => a - b), truth = r[0][1];
      const out = r.filter(([d, tr]) => tr > 0 && Math.abs(d / tr - 1) > 0.1).length / r.length;
      return `${g}m: ${Math.round(v.reduce((a, b) => a + b) / v.length)}m [${Math.round(v[30])}~${Math.round(v[270])}]` + (truth > 0 ? ` ±10%밖 ${Math.round(out * 100)}%` : '');
    });
    console.log(`${name.padEnd(24)} | ${row.join('  ||  ')}`);
  }
}
