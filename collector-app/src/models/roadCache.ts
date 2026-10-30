import type { SQLiteDatabase } from 'expo-sqlite';
import type { RoadSyncPage, RoadSyncRow } from './api';
import type { BBox, RoadNode, RoadSegment, RoadStatus } from './types';

// 서버 도로의 로컬 사본 (백엔드 docs/road-sync.md). 서버가 원본이고, 앱은 revision까지 받은 결과를 들고 있다.
// 지도·미니맵·큰길 분류는 네트워크가 아니라 여기를 읽는다 — 오프라인에서도 마지막으로 받은 도로가 보인다.
// expo-sqlite를 타입으로만 쓴다. tests/roadCache.check.ts가 Node 내장 SQLite로 같은 함수를 돌린다.

type Db = Pick<SQLiteDatabase, 'execAsync' | 'runAsync' | 'getAllAsync' | 'getFirstAsync' | 'prepareAsync' | 'withExclusiveTransactionAsync'>;

// 페이지마다 9,529개 도로 중 화면 범위만 고르려고 bbox를 따로 둔다 (geometry JSON을 다 풀지 않게)
const COLUMNS: [string, string][] = [
  ['road_number', 'TEXT'], ['road_name', 'TEXT'], ['dataset_id', 'TEXT'], ['source_link_id', 'TEXT'],
  ['segment_index', 'INTEGER'], ['side', 'TEXT'], ['path_type', 'TEXT'], ['length_m', 'REAL'], ['geometry', 'TEXT'],
  ['review_status', "TEXT NOT NULL DEFAULT 'none'"],
  ['accepted', 'INTEGER NOT NULL DEFAULT 0'], ['pending', 'INTEGER NOT NULL DEFAULT 0'], ['rejected', 'INTEGER NOT NULL DEFAULT 0'],
  ['min_lat', 'REAL'], ['max_lat', 'REAL'], ['min_lon', 'REAL'], ['max_lon', 'REAL'],
  ['updated_at', 'INTEGER'],
];

/**
 * 예전 road_cache(road_id, road_number, road_name, seq, status, geometry, updated_at)는 만들어만 두고 쓴 적이 없다.
 * 그래도 지우지 않고 없는 컬럼만 더한다. 예전 seq·status 컬럼은 남지만 읽지 않는다.
 */
export async function migrateRoadCache(db: Db) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS road_cache (road_id TEXT PRIMARY KEY, ${COLUMNS.map(([n, t]) => `${n} ${t}`).join(', ')});
    CREATE TABLE IF NOT EXISTS road_sync_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  `);
  const have = new Set((await db.getAllAsync<{ name: string }>('PRAGMA table_info(road_cache)')).map(c => c.name));
  for (const [name, type] of COLUMNS) {
    if (!have.has(name)) await db.execAsync(`ALTER TABLE road_cache ADD COLUMN ${name} ${type}`);
  }
  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS road_cache_name ON road_cache(road_name, road_number);
    CREATE INDEX IF NOT EXISTS road_cache_status ON road_cache(review_status);
    CREATE INDEX IF NOT EXISTS road_cache_bbox ON road_cache(min_lat, max_lat, min_lon, max_lon);
  `);
}

const UPSERT = (() => {
  const names = ['road_id', ...COLUMNS.map(([n]) => n)];
  return `INSERT INTO road_cache (${names.join(', ')}) VALUES (${names.map(() => '?').join(', ')})
    ON CONFLICT(road_id) DO UPDATE SET ${names.slice(1).map(n => `${n} = excluded.${n}`).join(', ')}`;
})();

function upsertParams(r: RoadSyncRow, now: number) {
  // GeoJSON은 [경도, 위도]
  const lons = r.geometry.coordinates.map(([longitude]) => longitude);
  const lats = r.geometry.coordinates.map(([, latitude]) => latitude);
  return [
    r.road_id, r.road_number ?? null, r.road_name, r.dataset_id ?? null, r.source_link_id ?? null,
    r.segment_index ?? null, r.side ?? null, r.path_type ?? null, r.length_m ?? null, JSON.stringify(r.geometry),
    r.review_status, r.accepted, r.pending, r.rejected,
    Math.min(...lats), Math.max(...lats), Math.min(...lons), Math.max(...lons),
    now,
  ];
}

// expo-sqlite는 busy_timeout을 안 걸어 잠금을 만나면 바로 'database is locked'로 실패한다.
// withExclusiveTransactionAsync는 새 연결을 열어서 메인 연결(db.ts)과 이 transaction 연결 양쪽에 건다.
// BEGIN은 DEFERRED라 잠금을 잡지 않으니 task 첫 줄에서 걸어도 첫 쓰기 전에 적용된다
export const BUSY_TIMEOUT = 'PRAGMA busy_timeout = 5000';

const setMeta = (db: Db, key: string, value: string | number) =>
  db.runAsync('INSERT INTO road_sync_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, String(value));

/**
 * 한 페이지의 upsert·delete와 next_revision 저장을 한 transaction으로.
 * 따로 하면 중간에 앱이 죽었을 때 revision만 앞서 가서 변경을 건너뛴다.
 */
export async function applyRoadSyncPage(db: Db, page: RoadSyncPage, now = Date.now()) {
  await db.withExclusiveTransactionAsync(async txn => {
    await txn.execAsync(BUSY_TIMEOUT);
    // 최초 동기화는 페이지당 1,000행 — 행마다 prepare/finalize하지 않게 한 번만 준비한다
    const upsert = await txn.prepareAsync(UPSERT);
    try {
      for (const r of page.upserts) await upsert.executeAsync(...upsertParams(r, now));
    } finally {
      await upsert.finalizeAsync();
    }
    for (const id of page.deletes) await txn.runAsync('DELETE FROM road_cache WHERE road_id = ?', id);
    await setMeta(txn, 'revision', page.next_revision);
    if (!page.has_more) {
      await setMeta(txn, 'last_success_at', now);
      await setMeta(txn, 'initial_sync_complete', 1);
    }
  });
}

/** 서버 revision이 로컬보다 뒤(서버 복원 등)일 때만 — 409. 네트워크 오류·5xx에서는 부르지 않는다 */
export async function resetRoadCache(db: Db) {
  await db.withExclusiveTransactionAsync(async txn => {
    await txn.execAsync(BUSY_TIMEOUT);
    await txn.runAsync('DELETE FROM road_cache');
    await txn.runAsync('DELETE FROM road_sync_meta');
  });
}

export interface RoadMeta {
  revision: number;
  ready: boolean;              // 최초 전체 동기화가 끝났는가
  lastSuccessAt: number | null;
  count: number;
}

export async function readRoadMeta(db: Db): Promise<RoadMeta> {
  const rows = await db.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM road_sync_meta');
  const m = new Map(rows.map(r => [r.key, r.value]));
  const count = (await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM road_cache'))?.n ?? 0;
  return {
    revision: Number(m.get('revision') ?? 0),
    ready: m.get('initial_sync_complete') === '1',
    lastSuccessAt: m.has('last_success_at') ? Number(m.get('last_success_at')) : null,
    count,
  };
}

/**
 * revision부터 has_more가 false가 될 때까지 페이지를 받아 적용한다.
 * 같은 도로가 한 페이지에 한 번만 나와 upserts가 limit보다 적어도 has_more만 본다.
 * 409면 로컬을 비우고 처음부터 한 번 다시. 그 밖의 오류는 그대로 던진다 — 받아 둔 페이지는 이미 커밋돼 있다.
 */
export async function syncAllRoads(db: Db, fetchPage: (since: number) => Promise<RoadSyncPage>, onPage?: () => void) {
  let since = (await readRoadMeta(db)).revision;
  for (let reset = false; ;) {
    try {
      let page: RoadSyncPage;
      do {
        page = await fetchPage(since);
        await applyRoadSyncPage(db, page);
        since = page.next_revision;
        onPage?.();
      } while (page.has_more);
      return;
    } catch (e) {
      if ((e as { status?: number })?.status !== 409 || reset) throw e;
      await resetRoadCache(db);
      since = 0;
      reset = true;
    }
  }
}

type RoadRow = {
  road_id: string; road_number: string | null; road_name: string; path_type: string | null;
  length_m: number | null; review_status: RoadStatus; geometry: string;
};

const toSegment = (r: RoadRow): RoadSegment => ({
  road_id: r.road_id,
  road_number: r.road_number,
  road_name: r.road_name,
  path_type: r.path_type ?? undefined,
  length_m: r.length_m ?? undefined,
  status: r.review_status,   // 서버가 accepted > pending > rejected > none으로 계산한 값을 그대로 쓴다
  // 앱 안의 좌표는 [위도, 경도]. 이름을 붙여 꺼내 순서를 헷갈리지 않게 한다
  geometry: (JSON.parse(r.geometry).coordinates as [number, number][]).map(([longitude, latitude]) => [latitude, longitude]),
});

const SEGMENT = 'road_id, road_number, road_name, path_type, length_m, review_status, geometry';

/** 누군가 찍어 검수에 걸린 도로 — 지도는 찍은 길만 칠한다 (D20) */
export async function reviewedRoads(db: Db) {
  return (await db.getAllAsync<RoadRow>(`SELECT ${SEGMENT} FROM road_cache WHERE review_status != 'none'`)).map(toSegment);
}

/** bbox와 겹치는 도로 — 미니맵, 큰길/골목 분류 */
export async function roadsInBBox(db: Db, b: BBox) {
  return (await db.getAllAsync<RoadRow>(
    `SELECT ${SEGMENT} FROM road_cache WHERE max_lat >= ? AND min_lat <= ? AND max_lon >= ? AND min_lon <= ?`,
    b.minLat, b.maxLat, b.minLon, b.maxLon,
  )).map(toSegment);
}

const RANK: Record<RoadStatus, number> = { none: 0, rejected: 1, pending: 2, accepted: 3 };

/**
 * bbox 안 노드(교차점·끝점). 구간 선의 양 끝 좌표가 같으면 같은 노드로 본다 — 서버 응답엔 노드 번호가 없다.
 * 원본의 source_begin/end_node와 거의 같다 (성동구 노드 번호 7,718개, 좌표로 묶으면 7,780개).
 * 색은 닿은 구간 중 가장 앞선 상태 — 도로 상태와 같은 순서 accepted > pending > rejected > none.
 * roads는 같은 bbox의 roadsInBBox 결과 — 노드가 bbox 안이면 닿은 구간의 bbox도 반드시 겹치므로 빠짐없이 모인다.
 */
export function nodesOf(roads: RoadSegment[], b: BBox): RoadNode[] {
  const nodes = new Map<string, RoadNode>();
  for (const r of roads) {
    for (const [lat, lon] of [r.geometry[0], r.geometry[r.geometry.length - 1]]) {
      if (lat < b.minLat || lat > b.maxLat || lon < b.minLon || lon > b.maxLon) continue;
      const id = `${lat.toFixed(6)},${lon.toFixed(6)}`;
      const n = nodes.get(id);
      if (!n) nodes.set(id, { id, lat, lon, status: r.status });
      else if (RANK[r.status] > RANK[n.status]) n.status = r.status;
    }
  }
  return [...nodes.values()];
}

/** 점이 다각형 안인가 (ray casting). ring은 [위도, 경도][] */
function inRing(lat: number, lon: number, ring: [number, number][]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [yi, xi] = ring[i], [yj, xj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * 동별 달성률 = accept된 도로 길이 ÷ 동 안 전체 도로 길이. 도로는 bbox 중심이 든 동에 넣는다.
 * ponytail: 지도를 열 때마다 9,529 × 동 18개를 다시 센다. 느려지면 동 코드를 upsert 때 컬럼에 적어 둘 것
 */
export async function dongCoverage(db: Db, dongs: { code: string; ring: [number, number][] }[]) {
  const rows = await db.getAllAsync<{ lat: number; lon: number; len: number; accepted: number }>(
    `SELECT (min_lat + max_lat) / 2 AS lat, (min_lon + max_lon) / 2 AS lon, COALESCE(length_m, 0) AS len,
            review_status = 'accepted' AS accepted FROM road_cache`,
  );
  // 동 다각형 검사 전에 bbox로 먼저 거른다
  const boxes = dongs.map(d => {
    const lats = d.ring.map(p => p[0]), lons = d.ring.map(p => p[1]);
    return { ...d, minLat: Math.min(...lats), maxLat: Math.max(...lats), minLon: Math.min(...lons), maxLon: Math.max(...lons) };
  });
  const total = new Map<string, number>(), done = new Map<string, number>();
  for (const r of rows) {
    const d = boxes.find(d => r.lat >= d.minLat && r.lat <= d.maxLat && r.lon >= d.minLon && r.lon <= d.maxLon && inRing(r.lat, r.lon, d.ring));
    if (!d) continue;
    total.set(d.code, (total.get(d.code) ?? 0) + r.len);
    if (r.accepted) done.set(d.code, (done.get(d.code) ?? 0) + r.len);
  }
  return new Map(dongs.map(d => [d.code, total.get(d.code) ? (done.get(d.code) ?? 0) / total.get(d.code)! : 0]));
}
