// 도로 동기화 핵심 로직 self-check — Node 내장 SQLite로 src/models/roadCache.ts를 그대로 돌린다.
// 실행: node tests/roadCache.check.ts   (Node 23.6+, 타입 제거 실행)
// 실서버 export(data/seongdong-roads-*.sqlite3)가 있으면 9,529개로 성능도 잰다.
import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import {
  applyRoadSyncPage, dongCoverage, migrateRoadCache, nodesOf, readRoadMeta, reviewedRoads, roadsInBBox, syncAllRoads,
} from '../src/models/roadCache.ts';

/** expo-sqlite에서 roadCache.ts가 쓰는 만큼만 흉내 낸다 */
function memoryDb(): any {
  const raw = new DatabaseSync(':memory:');
  const db = {
    raw,
    execAsync: async (sql: string) => raw.exec(sql),
    runAsync: async (sql: string, ...p: any[]) => raw.prepare(sql).run(...p),
    getAllAsync: async (sql: string, ...p: any[]) => raw.prepare(sql).all(...p),
    getFirstAsync: async (sql: string, ...p: any[]) => raw.prepare(sql).get(...p) ?? null,
    prepareAsync: async (sql: string) => {
      const st = raw.prepare(sql);
      return { executeAsync: async (...p: any[]) => st.run(...p), finalizeAsync: async () => {} };
    },
    withExclusiveTransactionAsync: async (fn: (txn: any) => Promise<void>) => {
      raw.exec('BEGIN');
      try { await fn(db); raw.exec('COMMIT'); } catch (e) { raw.exec('ROLLBACK'); throw e; }
    },
  };
  return db;
}

const road = (id: string, status = 'none', lon = 127.04, lat = 37.55): any => ({
  road_id: id, road_number: '1', road_name: '왕십리로', dataset_id: 'd', source_link_id: null, segment_index: 0,
  side: 'left', path_type: 'roadside_walkway', length_m: 40,
  geometry: { type: 'LineString', coordinates: [[lon, lat], [lon + 0.0003, lat + 0.0002]] },
  accepted: status === 'accepted' ? 1 : 0, pending: status === 'pending' ? 1 : 0, rejected: status === 'rejected' ? 1 : 0,
  review_status: status,
});
const page = (next: number, more: boolean, upserts: any[], deletes: string[] = []) =>
  ({ head_revision: 999, next_revision: next, has_more: more, upserts, deletes });

/** since → 페이지. 호출된 since를 기록한다 */
function server(pages: Record<number, any>) {
  const calls: number[] = [];
  const fetch = async (since: number) => {
    calls.push(since);
    const p = pages[since];
    if (p instanceof Error) throw p;
    if (!p) throw Object.assign(new Error(`no page for ${since}`), { status: 500 });
    return p;
  };
  return { fetch, calls };
}

const conflict = () => Object.assign(new Error('revision ahead'), { status: 409 });

async function main() {
  // 1. 예전 스키마를 지우지 않고 컬럼만 더한다
  {
    const db = memoryDb();
    db.raw.exec(`CREATE TABLE road_cache (road_id TEXT PRIMARY KEY, road_number TEXT, road_name TEXT, seq INTEGER,
                 status TEXT, geometry TEXT, updated_at INTEGER); INSERT INTO road_cache (road_id) VALUES ('old');`);
    await migrateRoadCache(db);
    await migrateRoadCache(db);   // 두 번 불러도 괜찮아야 한다
    const cols = db.raw.prepare('PRAGMA table_info(road_cache)').all().map((c: any) => c.name);
    assert.ok(cols.includes('review_status') && cols.includes('min_lat') && cols.includes('seq'));
    assert.equal(db.raw.prepare("SELECT COUNT(*) n FROM road_cache WHERE road_id = 'old'").get().n, 1);
    console.log('✓ migration keeps old rows');
  }

  // 2. 빈 DB 최초 다중 페이지 + 3. 증분 upsert·delete
  {
    const db = memoryDb();
    await migrateRoadCache(db);
    const s = server({
      0: page(2, true, [road('a'), road('b')]),
      2: page(4, true, []),                          // upserts가 비어도 has_more면 계속
      4: page(5, false, [road('c', 'accepted')]),
    });
    let pages = 0;
    await syncAllRoads(db, s.fetch, () => pages++);
    assert.deepEqual(s.calls, [0, 2, 4]);
    assert.equal(pages, 3);
    let m = await readRoadMeta(db);
    assert.deepEqual([m.revision, m.ready, m.count], [5, true, 3]);

    const s2 = server({ 5: page(7, false, [road('a', 'rejected')], ['b']) });
    await syncAllRoads(db, s2.fetch);
    m = await readRoadMeta(db);
    assert.deepEqual([m.revision, m.count], [7, 2]);
    assert.deepEqual((await reviewedRoads(db)).map(r => [r.road_id, r.status]).sort(), [['a', 'rejected'], ['c', 'accepted']]);
    console.log('✓ initial multi-page sync, incremental upsert/delete');
  }

  // 4. 페이지 적용 중 실패하면 그 페이지 전체가 없던 일이 되고 revision도 그대로
  {
    const db = memoryDb();
    await migrateRoadCache(db);
    await applyRoadSyncPage(db, page(1, false, [road('a')]));
    const bad = road('z');
    bad.geometry = null;   // upsertParams에서 터진다
    await assert.rejects(applyRoadSyncPage(db, page(9, false, [road('b'), bad])));
    const m = await readRoadMeta(db);
    assert.deepEqual([m.revision, m.count], [1, 1]);
    console.log('✓ failed page rolls back, revision not advanced');
  }

  // 5. 받던 중 끊기면 커밋된 페이지까지 남고, 다음엔 거기서부터
  {
    const db = memoryDb();
    await migrateRoadCache(db);
    await assert.rejects(syncAllRoads(db, server({ 0: page(3, true, [road('a')]), 3: new TypeError('Network request failed') }).fetch));
    let m = await readRoadMeta(db);
    assert.deepEqual([m.revision, m.ready, m.count], [3, false, 1]);
    const s = server({ 3: page(4, false, [road('b')]) });
    await syncAllRoads(db, s.fetch);
    assert.deepEqual(s.calls, [3]);
    m = await readRoadMeta(db);
    assert.deepEqual([m.revision, m.ready, m.count], [4, true, 2]);
    console.log('✓ resume from committed revision after network failure');
  }

  // 6. 네트워크·5xx·401은 캐시를 지우지 않고, 409만 비우고 처음부터
  {
    const db = memoryDb();
    await migrateRoadCache(db);
    await syncAllRoads(db, server({ 0: page(50, false, [road('a'), road('b')]) }).fetch);
    for (const status of [500, 503, 401]) {
      await assert.rejects(syncAllRoads(db, server({ 50: Object.assign(new Error('x'), { status }) }).fetch));
      assert.equal((await readRoadMeta(db)).count, 2, `cache kept on ${status}`);
    }
    const s = server({ 50: conflict(), 0: page(10, false, [road('n')]) });
    await syncAllRoads(db, s.fetch);
    assert.deepEqual(s.calls, [50, 0]);
    const m = await readRoadMeta(db);
    assert.deepEqual([m.revision, m.count, m.ready], [10, 1, true]);
    // 비우고 다시 받아도 또 409면 무한 반복하지 않고 던진다
    await assert.rejects(syncAllRoads(db, server({ 10: conflict(), 0: conflict() }).fetch));
    console.log('✓ only 409 resets cache; network/5xx/401 keep it');
  }

  // 7. GeoJSON [경도, 위도] → 앱 [위도, 경도], bbox 조회, 동별 %
  {
    const db = memoryDb();
    await migrateRoadCache(db);
    await applyRoadSyncPage(db, page(1, false, [road('in', 'accepted', 127.04, 37.55), road('in2', 'none', 127.041, 37.551), road('far', 'none', 126.9, 37.6)]));
    const [seg] = await roadsInBBox(db, { minLat: 37.549, maxLat: 37.5505, minLon: 127.039, maxLon: 127.0401 });
    assert.equal(seg.road_id, 'in');
    assert.deepEqual(seg.geometry[0], [37.55, 127.04]);   // 위도가 먼저
    const square: [number, number][] = [[37.54, 127.03], [37.54, 127.05], [37.56, 127.05], [37.56, 127.03]];
    const cov = await dongCoverage(db, [{ code: 'A', ring: square }, { code: 'B', ring: [[0, 0], [0, 1], [1, 1]] }]);
    assert.equal(cov.get('A'), 0.5);   // 40m accepted / 80m
    assert.equal(cov.get('B'), 0);     // 도로 없는 동
    console.log('✓ coordinate order, bbox query, dong coverage');
  }

  // 7-1. 노드: 끝 좌표가 같은 구간은 한 노드, 색은 가장 앞선 상태, bbox 밖 끝점은 뺀다
  {
    const db = memoryDb();
    await migrateRoadCache(db);
    // a: (37.55,127.04)→(37.5502,127.0403), b: 그 끝에서 시작. 부동소수 합이라 끝 좌표가 미세하게 달라도 같은 노드여야 한다
    await applyRoadSyncPage(db, page(1, false, [road('a', 'accepted'), road('b', 'none', 127.04 + 0.0003, 37.55 + 0.0002), road('c', 'rejected', 127.0403, 37.5502)]));
    const wide = { minLat: 37.5, maxLat: 37.6, minLon: 127.0, maxLon: 127.1 };
    const all = nodesOf(await roadsInBBox(db, wide), wide);
    const byId = new Map(all.map(n => [n.id, n.status]));
    assert.equal(all.length, 3);   // a 시작, a·b·c가 만나는 곳, b·c 끝
    assert.equal(byId.get('37.550200,127.040300'), 'accepted');   // accepted > rejected > none
    assert.equal(byId.get('37.550400,127.040600'), 'rejected');
    const narrow = { ...wide, minLat: 37.5501 };
    const part = nodesOf(await roadsInBBox(db, narrow), narrow);
    assert.equal(part.length, 2);   // a 시작점(37.55)은 bbox 밖
    console.log('✓ nodes merge shared endpoints, best status wins');
  }

  // 8. 실서버 export로 성능 (없으면 건너뜀)
  const dataDir = new URL('../../data/', import.meta.url);
  const exportFile = existsSync(dataDir) && readdirSync(dataDir).find(f => /^seongdong-roads-.*\.sqlite3$/.test(f));
  if (exportFile) {
    const src = new DatabaseSync(fileURLToPath(new URL(exportFile, dataDir)), { readOnly: true });
    const rows = src.prepare('SELECT * FROM roads WHERE is_active = 1').all().map((r: any) => ({
      road_id: r.road_id, road_number: r.road_number, road_name: r.road_name, dataset_id: r.dataset_id,
      source_link_id: r.source_link_id, segment_index: r.segment_index, side: r.side, path_type: r.path_type,
      length_m: r.length_m, geometry: JSON.parse(r.geometry_geojson), accepted: 0, pending: 0, rejected: 0, review_status: 'none',
    }));
    const pages: Record<number, any> = {};
    for (let i = 0; i < rows.length; i += 1000) pages[i] = page(Math.min(i + 1000, rows.length), i + 1000 < rows.length, rows.slice(i, i + 1000));
    const db = memoryDb();
    await migrateRoadCache(db);
    let t = Date.now();
    await syncAllRoads(db, server(pages).fetch);
    const m = await readRoadMeta(db);
    assert.equal(m.count, rows.length);
    console.log(`  export ${rows.length} roads: sync ${Date.now() - t}ms`);
    const dongs = (await import('../src/models/data/dongs.json', { with: { type: 'json' } })).default;
    t = Date.now();
    const cov = await dongCoverage(db, dongs as any);
    console.log(`  dong coverage ${Date.now() - t}ms (${cov.size} dongs)`);
    t = Date.now();
    const near = await roadsInBBox(db, { minLat: 37.547, maxLat: 37.553, minLon: 127.036, maxLon: 127.044 });
    console.log(`  bbox ±330m: ${near.length} roads ${Date.now() - t}ms`);
    t = Date.now();   // 골목 단계가 시작되는 화면(경도폭 0.0078°, 폰 세로라 위도폭 0.0134°) — 그릴 노드 수의 최대치
    const screen = { minLat: 37.5433, maxLat: 37.5567, minLon: 127.0366, maxLon: 127.0444 };
    const rs = await roadsInBBox(db, screen);
    const ns = nodesOf(rs, screen);
    console.log(`  widest clip-level screen: ${rs.length} roads, ${ns.length} nodes ${Date.now() - t}ms`);
  }
  console.log('all checks passed');
}

main().catch(e => { console.error(e); process.exit(1); });
