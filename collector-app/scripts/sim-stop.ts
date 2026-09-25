// 멈출 때 화면 거리가 줄어드는 문제 재현·검증용 (2026-09-25 실측 제보).
// 실행: npx tsx scripts/sim-stop.ts [비교할 이전 distance.ts 경로]
import * as cur from '../src/models/distance';

type P = { t: number; lat: number; lon: number; acc: number; spd?: number };
let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
const LAT0 = 37.5503, LON0 = 127.0731, mLat = 1 / 111320, mLon = 1 / (111320 * Math.cos(LAT0 * Math.PI / 180));

// 속도 v로 걷다가(구간별) 서 있기. segs: [초, 속도]
function make(segs: [number, number][], doppler: boolean, sigma = 4, rho = 0.9) {
  const out: P[] = []; let x = 0, t = 0, ex = 0, ey = 0;
  for (const [secs, v] of segs) for (let i = 0; i < secs; i++, t++) {
    const k = Math.sqrt(1 - rho ** 2) * sigma; ex = rho * ex + k * gauss(); ey = rho * ey + k * gauss();
    out.push({ t, lat: LAT0 + ey * mLat, lon: LON0 + (x + ex) * mLon, acc: 5 + rnd() * 10,
      spd: doppler ? Math.max(0, v + gauss() * 0.2) : undefined });
    x += v;
  }
  return { ps: out, truth: x };
}

function run(mod: typeof cur, ps: P[]) {
  let s = mod.initialDistance(), prev = 0, maxDrop = 0;
  for (const p of ps) {
    s = mod.stepDistance(s, p as any);
    const shown = (mod as any).displayDistance ? (mod as any).displayDistance(s) : mod.shownDistance(s);
    maxDrop = Math.max(maxDrop, prev - shown); prev = shown;
  }
  return { final: mod.shownDistance(s), maxDrop };
}

const scenarios: [string, [number, number][]][] = [
  ['직진 100m → 끝에서 15초 서 있다가 종료', [[72, 1.4], [15, 0]]],
  ['50m 걷기 → 20초 정지 → 50m 걷기', [[36, 1.4], [20, 0], [36, 1.4]]],
  ['직진 100m (정지 없음)', [[72, 1.4]]],
  ['20m마다 5초씩 멈춤 × 5', Array.from({ length: 5 }, () => [[14, 1.4], [5, 0]] as [number, number][]).flat()],
];

(async () => {
  const prevPath = process.argv[2];
  const before = prevPath ? await import(prevPath) : null;
  const N = 300;
  for (const doppler of [true, false]) {
    console.log(`\n### 도플러 속도 ${doppler ? '있음(iOS·안드로이드 GPS)' : '없음'} · 정확도 5~15m · ${N}회`);
    console.log('시나리오'.padEnd(30), '정답', '|', '최종 거리 평균[10~90%] / 화면 최대 감소 평균·최대');
    for (const [name, segs] of scenarios) {
      const rows: string[] = [];
      for (const [label, mod] of [['이전', before], ['현재', cur]] as const) {
        if (!mod) continue;
        const f: number[] = [], d: number[] = []; let truth = 0;
        for (let i = 0; i < N; i++) { const g = make(segs, doppler); truth = g.truth; const r = run(mod, g.ps); f.push(r.final); d.push(r.maxDrop); }
        const s = [...f].sort((a, b) => a - b), m = (xs: number[]) => xs.reduce((a, b) => a + b) / xs.length;
        rows.push(`${label} ${m(f).toFixed(0)}m [${s[N * .1 | 0].toFixed(0)}~${s[N * .9 | 0].toFixed(0)}] / 감소 ${m(d).toFixed(1)}m·최대 ${Math.max(...d).toFixed(1)}m`);
        if (label === '현재' || !before) console.log(name.padEnd(30), `${truth.toFixed(0)}m`, '|', rows.join('  ||  '));
      }
    }
  }
})();
