import { useCallback, useEffect, useState } from 'react';
import { Image } from 'react-native';
import { mockApi } from '@/models/mockApi';
import { useUploadQueue } from '@/controllers/useUploadQueue';
import { localThumbnail, readTrajectory } from '@/models/storage';
import type { Video } from '@/models/types';

const source = mockApi;

export type AlbumItem = Video & {
  trail: [number, number][] | null;   // [lat, lon][] — 이 폰에서 찍은 클립만 있다
  thumb: string | null;               // 첫 프레임 jpg
  thumbSideways: boolean;             // 세로로 저장된 옛 클립 — 화면에서 -90° 돌린다
};

// 서버 파일명이 `${local_id}.mp4`라서 이걸로 로컬 궤적·썸네일을 찾는다.
async function withLocal(v: Video): Promise<AlbumItem> {
  const localId = v.video_name.replace(/\.\w+$/, '');
  const [traj, thumb] = await Promise.all([readTrajectory(localId), localThumbnail(localId)]);
  const thumbSideways = thumb ? await Image.getSize(thumb).then(s => s.height > s.width, () => false) : false;
  return { ...v, trail: traj?.points.map(p => [p.lat, p.lon]) ?? null, thumb, thumbSideways };
}

/** 안 올라간 클립은 항상 맨 위 (D21). 나머지 순서는 그대로 */
const pinUnuploaded = (a: AlbumItem[]) => [...a.filter(v => v.upload !== 'done'), ...a.filter(v => v.upload === 'done')];

export type AlbumFilter = 'all' | 'pending' | 'rejected' | 'failed';

// 수천 건이 쌓이므로 offset이 아니라 커서로 넘긴다.
export function useAlbum(filter: AlbumFilter = 'all') {
  const [items, setItems] = useState<AlbumItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const load = useCallback(async (reset = false) => {
    if (loading || (!reset && (done || !cursor))) return;
    setLoading(true);
    try {
      const res = await source.videos(reset ? {} : { cursor: cursor! });
      const page = await Promise.all(res.items.map(withLocal));
      setItems(prev => pinUnuploaded(reset ? page : [...prev, ...page]));
      setCursor(res.next_cursor);
      setDone(!res.next_cursor);
    } finally {
      setLoading(false);
    }
  }, [loading, done, cursor]);

  useEffect(() => { setDone(false); void load(true); }, [filter]);

  const q = useUploadQueue();
  const upload = useCallback(async () => {
    await q.uploadNow();
    await load(true);
  }, [q.uploadNow, load]);

  return {
    items, loading, done, cursor, loadMore: () => load(false), refresh: () => load(true),
    unuploaded: q.pending, uploading: q.uploading, upload,
  };
}
