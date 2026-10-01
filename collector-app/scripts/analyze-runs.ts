/// <reference types="node" />
// 실기기 궤적 분석. 앱에서 내보낸 궤적 파일들을 합쳐, 촬영마다 거리 계산 방법별 결과를 표로 낸다.
// 내보내기는 폰에 있는 궤적 전부를 담으므로 파일끼리 겹친다 → local_id로 합치고, 마지막 파일에만 있는 촬영을 ★로 표시.
//
// 실행: npx tsx scripts/analyze-runs.ts [--since 2026-10-01] [--stride 0.55] [--json ../data/out/runs.json] [파일·폴더...]
// 기본 입력: ../data/raw/
import { readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { join } from 'path';
import { DIST, initialDistance, shownDistance, stepDistance } from '../src/models/distance';
import type { Trajectory, TrajectoryPoint } from '../src/models/types';

const args = process.argv.slice(2);
const opt = (name: string) => { const i = args.indexOf(name); return i >= 0 ? args.splice(i, 2)[1] : undefined; };
const since = opt('--since') ?? '';
const stride = Number(opt('--stride') ?? 0.6);    // 보폭(m). 큰길 직선에서 시작–끝 직선거리로 확인한 값 (2026-10-01)
const jsonOut = opt('--json');
const inputs = args.length ? args : [join(__dirname, '../../data/raw')];

const files = inputs.flatMap(p => statSync(p).isDirectory()
  ? readdirSync(p).filter(n => /\.(json|txt)$/.test(n)).sort().map(n => join(p, n))
  : [p]);

// local_id별로 점이 가장 많은 사본을 쓴다 (녹화 중 백업본이 섞일 수 있다)
const runs = new Map<string, Trajectory>();
const firstFile = new Map<string, number>();
files.forEach((f, fi) => {
  for (const t of JSON.parse(readFileSync(f, 'utf8')) as Trajectory[]) {
    if (!firstFile.has(t.local_id)) firstFile.set(t.local_id, fi);
    const prev = runs.get(t.local_id);
    if (!prev || t.points.length > prev.points.length) runs.set(t.local_id, t);
  }
});

const R = 6371000, rad = Math.PI / 180;
const hav = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => {
  const h = Math.sin((b.lat - a.lat) * rad / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin((b.lon - a.lon) * rad / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

function measure(p: TrajectoryPoint[]) {
  let s = initialDistance();
  for (const q of p) s = stepDistance(s, q);
  const app = shownDistance(s);
  // 도플러: 기기가 준 속도 × 시간. 위치가 끌려가도 영향이 없지만 대체로 짧게 잰다
  let doppler = 0;
  for (let k = 1; k < p.length; k++) { const v = p[k].spd; if (v != null && v >= 0) doppler += v * (p[k].t - p[k - 1].t); }
  // 궤적 길이: 9점 이동평균한 선의 길이. 모퉁이를 덜 자르지만 지터가 남으면 길게 잰다
  const sm = p.map((_, k) => { const w = p.slice(Math.max(0, k - 4), k + 5); return { lat: w.reduce((a, b) => a + b.lat, 0) / w.length, lon: w.reduce((a, b) => a + b.lon, 0) / w.length }; });
  let geom = 0; for (let k = 1; k < sm.length; k++) geom += hav(sm[k - 1], sm[k]);
  return { app, doppler, geom };
}

const kst = (iso: string) => new Date(new Date(iso).getTime() + 9 * 3600e3).toISOString().slice(5, 16).replace('T', ' ');
const pct = (v: number, truth?: number) => truth ? `${v / truth - 1 >= 0 ? '+' : ''}${Math.round((v / truth - 1) * 100)}%` : '';
const cell = (v: number, truth?: number) => `${Math.round(v)}${truth ? ` (${pct(v, truth)})` : ''}`;

const last = files.length - 1;
const rows = [...runs.values()]
  .filter(t => t.points.length > 1 && t.recorded_at >= since)
  .sort((a, b) => a.recorded_at.localeCompare(b.recorded_at))
  .map(t => {
    const p = t.points, m = measure(p);
    const truth = t.steps ? t.steps * stride : undefined;
    return {
      local_id: t.local_id, isNew: files.length > 1 && firstFile.get(t.local_id) === last,
      at: kst(t.recorded_at), sec: Math.round(p[p.length - 1].t), n: p.length,
      bad: p.filter(q => q.acc > DIST.MAX_ACC_M).length,
      settleSec: p.find(q => q.acc <= 20)?.t ?? null,   // 정확도 20m 안으로 처음 들어온 시각 — 출발 손실 진단
      disp: hav(p[0], p[p.length - 1]),                  // 시작–끝 직선거리. 원형이면 0 근처
      steps: t.steps, truth, ...m, points: p,
    };
  });

console.log(`입력 ${files.length}개 파일 · 촬영 ${rows.length}건 · 문턱 MAX_ACC_M=${DIST.MAX_ACC_M} · 보폭 ${stride}m${since ? ` · ${since} 이후` : ''}\n`);
console.log('| | 시각(KST) | 초 | 점 | 불량 | 안정(초) | 시작–끝 | 걸음 → 기준 | 앱 | 도플러 | 궤적 길이 |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|');
for (const r of rows) {
  console.log(`| ${r.isNew ? '★' : ''} | ${r.at} | ${r.sec} | ${r.n} | ${r.bad} | ${r.settleSec ?? '-'} | ${Math.round(r.disp)} | ${r.steps ? `${r.steps} → ${Math.round(r.truth!)}` : '-'} | ${cell(r.app, r.truth)} | ${cell(r.doppler, r.truth)} | ${cell(r.geom, r.truth)} |`);
}

const judged = rows.filter(r => r.truth);
if (judged.length) {
  const within = (k: 'app' | 'doppler' | 'geom') => judged.filter(r => Math.abs(r[k] / r.truth! - 1) <= 0.1).length;
  console.log(`\n±10% 안: 앱 ${within('app')}/${judged.length} · 도플러 ${within('doppler')}/${judged.length} · 궤적 길이 ${within('geom')}/${judged.length} (걸음 수 있는 촬영만)`);
}

if (jsonOut) {
  writeFileSync(jsonOut, JSON.stringify({ stride, maxAcc: DIST.MAX_ACC_M, runs: rows }));
  console.log(`\nJSON → ${jsonOut}`);
}
