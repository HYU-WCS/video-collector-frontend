import { useCallback, useEffect, useState } from 'react';
import { mockApi } from '@/models/mockApi';
import { loadNoticeSeenAt, saveNoticeSeenAt } from '@/models/storage';
import type { Video } from '@/models/types';

const source = mockApi;

// 반려는 과제가 아니라 알림이다 (D14). 다른 사람이 다시 찍을 수도 있어서 "재촬영 필요 N건"을 세지 않는다.
// 마지막으로 읽은 판정 이후의 내 반려만 보여주고, 읽으면 사라진다.
export function useRejectNotice() {
  const [items, setItems] = useState<Video[]>([]);

  useEffect(() => {
    (async () => {
      const seenAt = await loadNoticeSeenAt();
      const res = await source.videos({ status: 'rejected', ...(seenAt ? { reviewed_after: seenAt } : {}) });
      setItems(res.items);
    })();
  }, []);

  /** 기기 시계가 아니라 서버 판정 시각을 기준으로 저장한다. */
  const dismiss = useCallback(async () => {
    const latest = items.map(v => v.reviewed_at ?? '').sort().pop();
    if (latest) await saveNoticeSeenAt(latest);
    setItems([]);
  }, [items]);

  return { items, dismiss };
}
