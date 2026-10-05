import { initialDistance, shownDistance, stepDistance } from './distance';
import { queue } from './db';
import { listTrajectories } from './storage';
import dongs from './data/dongs.json';
import type { BBox, ClipTrace, DongCoverage, Progress, RoadSegment, Video } from './types';

// 백엔드가 준비되기 전까지 화면 개발용으로 쓰는 가짜 응답.
// api.ts와 같은 모양을 유지할 것 — 교체는 controllers에서 import만 바꾸면 된다.

const seoul = { lat: 37.5503, lon: 127.0731 };   // 실기기 테스트 위치(세종대) 근방. 실제 대상 지역과 무관

const line = (n: number, dLat: number, dLon: number): [number, number][] =>
  Array.from({ length: n }, (_, i) => [seoul.lat + dLat * i, seoul.lon + dLon * i]);

export const mockProgress: Progress = {
  total_ratio: 0.42,
  my_distance_m: 18400,
  confirmed_distance_m: 8100,
  pending_distance_m: 4300,
};

export const mockRoads: RoadSegment[] = [
  { road_id: 'm11', road_number: '1', road_name: '동소문로', status: 'accepted', geometry: line(6, 0.0004, 0.0009) },
  { road_id: 'm12', road_number: '2', road_name: '동소문로', status: 'rejected', reject_reason: 'GPS 이상', geometry: line(5, -0.0005, 0.0008) },
  { road_id: 'm13', road_number: '3', road_name: '동소문로', status: 'pending', geometry: line(7, 0.0006, -0.0007) },
  { road_id: 'm14', road_number: '1', road_name: '보문로', status: 'none', geometry: line(8, -0.0007, -0.0005) },
];

export const mockVideos: Video[] = [
  { video_id: '1042', video_name: 'clip_1042.mp4', upload_date: '2026-09-20T13:47:00+09:00', duration_sec: 18, distance_m: 112, review: 'pending', superseded: false, upload: 'done' },
  { video_id: '1041', video_name: 'clip_1041.mp4', upload_date: '2026-09-20T13:44:00+09:00', duration_sec: 21, distance_m: 130, review: 'rejected', reject_reason: 'GPS 이상', reviewed_at: '2026-09-22T18:30:00+09:00', superseded: false, upload: 'done' },
  { video_id: '1038', video_name: 'clip_1038.mp4', upload_date: '2026-09-19T15:01:00+09:00', duration_sec: 17, distance_m: 104, review: 'rejected', reject_reason: '화질 불량', reviewed_at: '2026-09-20T10:12:00+09:00', superseded: true, upload: 'done' },
  { video_id: '1037', video_name: 'clip_1037.mp4', upload_date: '2026-09-19T14:58:00+09:00', duration_sec: 19, distance_m: 118, review: 'accepted', superseded: false, upload: 'done' },
];

// 폰에 남아 있는 실제 클립을 업로드된 영상처럼 보여준다. 앨범 썸네일을 실기기에서 확인하려고.
async function localVideos(): Promise<Video[]> {
  const upload = new Map((await queue.list()).map(q => [q.local_id, q.status]));
  return (await listTrajectories()).reverse().map(t => ({
    video_id: t.local_id,
    video_name: `${t.local_id}.mp4`,
    upload_date: t.recorded_at,
    duration_sec: t.points.at(-1)?.t ?? 0,
    distance_m: Math.round(shownDistance(t.points.reduce(stepDistance, initialDistance()))),
    review: 'pending',
    superseded: false,
    upload: upload.get(t.local_id) ?? 'done',   // 큐에 없으면 이미 올라간 것으로 본다
  }));
}

const delay = <T,>(v: T, ms = 300) => new Promise<T>(r => setTimeout(() => r(v), ms));

export const mockApi = {
  health: () => delay({ ok: true }),
  login: (username: string, _password: string) => delay({ refresh_token: 'mock-token', user: { user_id: 'u1', username } }),
  signup: (username: string, _password: string) =>
    username === 'taken'   // 아이디 중복 에러 화면 확인용
      ? delay(null).then(() => { throw new Error('409'); })
      : delay({ refresh_token: 'mock-token', user: { user_id: 'u2', username } }),
  progress: () => delay(mockProgress),
  // 서버의 동별 길 목표치가 아직 없다. 동 코드로 0~89% 사이 아무 값이나 만든 추정치
  coverage: () => delay({ dongs: dongs.map((d): DongCoverage => ({ code: d.code, ratio: (Number(d.code.slice(-5)) % 89) / 100 })) }),
  roads: (_b: BBox, _limit?: number) => delay({ roads: mockRoads, truncated: false }),
  // 폰에 남은 내 궤적. 검수 결과를 아직 못 받으니 전부 검수 대기
  clips: async () => delay({ clips: (await listTrajectories()).map((t): ClipTrace => ({
    video_id: t.local_id, status: 'pending', geometry: t.points.map(p => [p.lat, p.lon]),
  })) }),
  videos: async (params: { status?: string; reviewed_after?: string; cursor?: string } = {}) => delay({
    items: [...await localVideos(), ...mockVideos].filter(v =>
      (!params.status || v.review === params.status) &&
      (!params.reviewed_after || (v.reviewed_at ?? '') > params.reviewed_after)),
    next_cursor: null,
  }),
  video: async (id: string) => delay([...await localVideos(), ...mockVideos].find(v => v.video_id === id) ?? null),
};
