import * as SQLite from 'expo-sqlite';
import { BUSY_TIMEOUT, migrateRoadCache } from './roadCache';
import type { UploadStatus } from './types';

// 로컬 캐시 + 업로드 큐.
// 서버가 진실이지만, 현장에서 네트워크가 끊겨도 앱이 돌아가야 한다.

let _db: SQLite.SQLiteDatabase | null = null;

export async function getDb() {
  if (_db) return _db;
  _db = await SQLite.openDatabaseAsync('collector.db');
  // 도로 동기화 transaction(다른 연결)이 쓰는 동안 큐 쓰기가 실패하지 않고 기다리게 (roadCache.ts BUSY_TIMEOUT)
  await _db.execAsync(BUSY_TIMEOUT);
  await _db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS upload_queue (
      local_id      TEXT PRIMARY KEY,
      video_path    TEXT NOT NULL,
      traj_path     TEXT NOT NULL,
      recorded_at   TEXT NOT NULL,
      duration_sec  INTEGER NOT NULL,
      distance_m    INTEGER NOT NULL,
      status        TEXT NOT NULL,      -- queued | uploading | done | failed
      progress      REAL DEFAULT 0,
      error         TEXT,
      video_id      TEXT,               -- 업로드 성공 후 서버가 준 id (UUID)
      created_at    INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_queue_status ON upload_queue(status);
  `);
  // 재개 업로드용 컬럼 (2026-10-05). 이미 찍어 둔 클립을 지키려고 없는 컬럼만 추가한다
  const cols = new Set((await _db.getAllAsync<{ name: string }>('PRAGMA table_info(upload_queue)')).map(c => c.name));
  for (const [name, type] of [['upload_id', 'TEXT'], ['processing_status', 'TEXT']]) {
    if (!cols.has(name)) await _db.execAsync(`ALTER TABLE upload_queue ADD COLUMN ${name} ${type}`);
  }
  // 업로드 중 앱이 죽으면 uploading이 남는다. 그대로 두면 다시는 안 올라가니 대기로 되돌린다 — 서버가 받은 곳부터 이어 간다
  await _db.runAsync(`UPDATE upload_queue SET status = 'queued' WHERE status = 'uploading'`);
  await migrateRoadCache(_db);
  return _db;
}

export interface QueueItem {
  local_id: string;
  video_path: string;
  traj_path: string;
  recorded_at: string;
  duration_sec: number;
  distance_m: number;
  status: UploadStatus;
  progress: number;
  error: string | null;
  video_id: string | null;
  upload_id: string | null;           // 서버 업로드 세션. 있으면 이어 올린다
  processing_status: string | null;   // 서버 worker 검사 — ready가 돼야 로컬 영상을 지운다
}

export const queue = {
  async add(item: Omit<QueueItem, 'status' | 'progress' | 'error' | 'video_id' | 'upload_id' | 'processing_status'>) {
    const db = await getDb();
    await db.runAsync(
      `INSERT INTO upload_queue
       (local_id, video_path, traj_path, recorded_at, duration_sec, distance_m, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'queued', ?)`,
      item.local_id, item.video_path, item.traj_path, item.recorded_at,
      item.duration_sec, item.distance_m, Date.now(),
    );
  },

  async list(status?: UploadStatus) {
    const db = await getDb();
    return status
      ? db.getAllAsync<QueueItem>('SELECT * FROM upload_queue WHERE status = ? ORDER BY created_at', status)
      : db.getAllAsync<QueueItem>('SELECT * FROM upload_queue ORDER BY created_at');
  },

  async pendingCount() {
    const db = await getDb();
    const row = await db.getFirstAsync<{ n: number }>(
      `SELECT COUNT(*) AS n FROM upload_queue WHERE status IN ('queued','uploading','failed')`,
    );
    return row?.n ?? 0;
  },

  async update(localId: string, patch: Partial<QueueItem>) {
    const db = await getDb();
    const keys = Object.keys(patch);
    if (!keys.length) return;
    const set = keys.map(k => `${k} = ?`).join(', ');
    await db.runAsync(
      `UPDATE upload_queue SET ${set} WHERE local_id = ?`,
      ...keys.map(k => (patch as any)[k]), localId,
    );
  },

  async remove(localId: string) {
    const db = await getDb();
    await db.runAsync('DELETE FROM upload_queue WHERE local_id = ?', localId);
  },
};
