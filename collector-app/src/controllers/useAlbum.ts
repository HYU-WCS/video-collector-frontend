import { useCallback, useEffect, useState } from 'react';
import { mockApi } from '@/models/mockApi';
import type { Video } from '@/models/types';

const source = mockApi;

export type AlbumFilter = 'all' | 'pending' | 'rejected' | 'failed';

// 수천 건이 쌓이므로 offset이 아니라 커서로 넘긴다.
export function useAlbum(filter: AlbumFilter = 'all') {
  const [items, setItems] = useState<Video[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const load = useCallback(async (reset = false) => {
    if (loading || (!reset && (done || !cursor))) return;
    setLoading(true);
    try {
      const res = await source.videos(reset ? {} : { cursor: cursor! });
      setItems(prev => (reset ? res.items : [...prev, ...res.items]));
      setCursor(res.next_cursor);
      setDone(!res.next_cursor);
    } finally {
      setLoading(false);
    }
  }, [loading, done, cursor]);

  useEffect(() => { setDone(false); void load(true); }, [filter]);

  return { items, loading, done, cursor, loadMore: () => load(false), refresh: () => load(true) };
}
