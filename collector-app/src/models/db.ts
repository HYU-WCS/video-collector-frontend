import * as SQLite from 'expo-sqlite';
import type { UploadStatus } from './types';

// 로컬 캐시 + 업로드 큐.
// 서버가 진실이지만, 현장에서 네트워크가 끊겨도 앱이 돌아가야 한다.

let _db: SQLite.SQLiteDatabase | null = null;

export async function getDb() {
  if (_db) return _db;
  _db = await SQLite.openDatabaseAsync('collector.db');
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
      video_id      INTEGER,            -- 업로드 성공 후 서버가 준 id
      created_at    INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS road_cache (
      road_id     TEXT PRIMARY KEY,
      road_number TEXT,
      road_name   TEXT,
      seq         INTEGER,
      status      TEXT,
      geometry    TEXT,
      updated_at  INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_queue_status ON upload_queue(status);
  `);
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
  video_id: number | null;
}

export const queue = {
  async add(item: Omit<QueueItem, 'status' | 'progress' | 'error' | 'video_id'>) {
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
