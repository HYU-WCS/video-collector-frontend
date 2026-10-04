import { useEffect, useState } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import { api } from '@/models/api';
import { queue } from '@/models/db';
import { mockApi } from '@/models/mockApi';
import { isPortraitVideo, readTrajectory, videoPath } from '@/models/storage';
import type { Video } from '@/models/types';

const source = mockApi;

/**
 * 재생 주소: 업로드 전이면 폰에 있는 파일, 업로드 후면 서버 스트림.
 * 업로드가 끝나면 로컬 영상은 지워진다 (D1).
 */
export function useVideoDetail(id: string) {
  const [video, setVideo] = useState<Video | null>(null);
  const [uri, setUri] = useState<string | null>(null);
  const [sideways, setSideways] = useState(false);
  const [trail, setTrail] = useState<[number, number][] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const v = await source.video(id);
        setVideo(v);
        if (!v) return;
        const localId = v.video_name.replace(/\.\w+$/, '');
        // 궤적은 이 폰에서 찍은 클립만 있다. 서버 궤적(GeoJSON)은 아직 안 쓴다.
        void readTrajectory(localId).then(t => setTrail(t?.points.map(p => [p.lat, p.lon]) ?? null));
        const local = videoPath(localId);
        let u = local;
        if (!(await FileSystem.getInfoAsync(local)).exists) {
          // 업로드 큐가 서버 video_id를 기억한다. 큐에 없으면(다른 기기 등) 목록의 id가 서버 id다.
          const serverId = (await queue.list()).find(q => q.local_id === localId)?.video_id ?? v.video_id;
          u = await api.playbackUrl(serverId);
        }
        setUri(u);
        // 가로 화면을 세로 파일로 저장한 옛 클립(D17 이전 버그)만 화면에서 돌린다. 판별 실패는 그냥 둔다.
        isPortraitVideo(u).then(setSideways, () => {});
      } catch (e: any) {
        setError(e?.message ?? '영상을 불러오지 못했습니다');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  return { video, uri, sideways, trail, error, loading };
}
