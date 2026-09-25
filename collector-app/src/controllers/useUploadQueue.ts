import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { queue, type QueueItem } from '@/models/db';
import { processQueue, retryFailed } from '@/models/uploader';
import { loadToken } from '@/models/storage';

export function useUploadQueue(auto = true) {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [pending, setPending] = useState(0);

  const refresh = useCallback(async () => {
    setItems(await queue.list());
    setPending(await queue.pendingCount());
  }, []);

  const run = useCallback(async () => {
    const token = await loadToken();
    if (!token) return;
    await processQueue(token, () => void refresh());
    await refresh();
  }, [refresh]);

  const retry = useCallback(async () => {
    const token = await loadToken();
    if (!token) return;
    await retryFailed(token);
    await refresh();
  }, [refresh]);

  useEffect(() => { void refresh(); }, [refresh]);

  // 앱이 포그라운드로 돌아올 때마다 큐를 한 번 밀어준다.
  useEffect(() => {
    if (!auto) return;
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active') void run();
    });
    void run();
    return () => sub.remove();
  }, [auto, run]);

  return { items, pending, refresh, run, retry };
}
