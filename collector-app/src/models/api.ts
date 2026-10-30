import type { BBox, RoadSegment, RoadStatus, User } from './types';

// 실제 백엔드: 팀원이 만든 video-collector (docs/04-api.md "실제 백엔드").
// 지금 연결된 건 로그인·가입·업로드·지도(도로)뿐. 앨범·진척도는 수집가 계정과 궤적 형식이 정해진 뒤.
// 응답 모양이 앱 타입과 다른 곳은 여기서 변환해, controllers는 mockApi와 같은 모양만 보게 한다.

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://dblab.166.104.36.71.nip.io:8002/video-collector';
export const API = `${BASE_URL}/api/v1`;

// access 토큰(15분)은 메모리에만, refresh 토큰은 SecureStore에 둔다 (storage.ts).
let accessToken: string | null = null;
let refreshToken: string | null = null;
let onRefreshTokenChange: (t: string | null) => void = () => {};
let onUnauthorized: () => void = () => {};

export const setRefreshToken = (t: string | null) => { refreshToken = t; if (!t) accessToken = null; };
/** 갱신 때마다 refresh 토큰이 바뀐다(rotation). 바뀐 값을 저장할 곳을 App이 연결한다. */
export const onTokenRotated = (fn: (t: string | null) => void) => { onRefreshTokenChange = fn; };
/** 갱신까지 실패하면 로그아웃시킬 곳을 App이 연결한다. models가 controllers를 import하지 않기 위함. */
export const onSessionExpired = (fn: () => void) => { onUnauthorized = fn; };

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export interface UploadSession {
  upload_id: string;
  size_bytes: number;
  received_bytes: number;   // 서버가 받은 바이트 = 다음에 보낼 위치
  status: 'created' | 'uploading' | 'uploaded' | 'verifying' | 'completed' | 'failed';
  chunk_size: number;
  video_id: string | null;
}

/** /roads/sync 한 페이지 (백엔드 docs/road-sync.md) */
export interface RoadSyncRow {
  road_id: string;
  road_number: string | null;
  road_name: string;
  dataset_id: string;
  source_link_id: string | null;
  segment_index: number | null;
  side: string;
  path_type: string;
  length_m: number | null;
  geometry: { type: 'LineString'; coordinates: [number, number][] };   // [경도, 위도]
  accepted: number;
  pending: number;
  rejected: number;
  review_status: RoadStatus;
}

export interface RoadSyncPage {
  head_revision: number;
  next_revision: number;
  has_more: boolean;
  upserts: RoadSyncRow[];
  deletes: string[];
}

export type ProcessingStatus = 'uploaded' | 'processing' | 'ready' | 'failed';

interface AuthResponse { access_token: string; refresh_token: string; expires_in: number; user: User }

async function raw<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      ...(init?.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    // 서버 에러는 { error: { code, message } } — message가 한국어라 그대로 보여준다
    const body = await res.json().catch(() => null);
    throw new ApiError(body?.error?.message ?? `요청을 처리하지 못했습니다 (${res.status})`, res.status);
  }
  return (res.status === 204 ? null : res.json()) as Promise<T>;
}

let refreshing: Promise<void> | null = null;
function refresh() {
  if (!refreshing) {
    refreshing = raw<AuthResponse>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken, client_type: 'mobile' }),
    }).then(r => {
      accessToken = r.access_token;
      refreshToken = r.refresh_token;
      onRefreshTokenChange(r.refresh_token);
    }).finally(() => { refreshing = null; });
  }
  return refreshing;
}

export const hasSession = () => refreshToken != null;

/** fetch를 쓰지 않는 요청(업로드)용. renew면 지금 토큰을 버리고 새로 받는다 — 401을 받은 뒤. */
export async function authHeader(renew = false): Promise<Record<string, string>> {
  if ((renew || !accessToken) && refreshToken) await refresh();
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}

/** access 토큰이 없거나 만료(401)면 한 번 갱신하고 다시 보낸다. */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!accessToken && refreshToken) await refresh().catch(() => {});
  try {
    return await raw<T>(path, init);
  } catch (e) {
    if (!(e instanceof ApiError) || e.status !== 401 || !refreshToken) throw e;
    try {
      await refresh();
    } catch (r) {
      // 서버가 refresh 토큰을 거부했을 때만 로그아웃. 네트워크 오류·5xx는 토큰을 두고 그 오류로 실패시킨다 —
      // 401로 던지면 업로드가 재시도 없는 실패로 본다 (uploader.ts retryable)
      if (!(r instanceof ApiError) || (r.status !== 401 && r.status !== 403)) throw r;
      setRefreshToken(null);
      onRefreshTokenChange(null);
      onUnauthorized();
      throw e;
    }
    return raw<T>(path, init);
  }
}

// --- 변환 ---

// 서버 bbox는 경도 먼저: minLon,minLat,maxLon,maxLat
const bbox = (b: BBox) => `${b.minLon},${b.minLat},${b.maxLon},${b.maxLat}`;

interface RoadFeature {
  geometry: { coordinates: [number, number][] };   // [lon, lat]
  properties: {
    road_id: string; road_name: string; road_number: string | null;
    path_type: string; length_m: number | null;
    accepted: number; pending: number; rejected: number;
  };
}

/** 도로 상태는 판정 개수에서 파생 — accept가 하나라도 있으면 완료 (D5) */
const roadStatus = (p: RoadFeature['properties']): RoadStatus =>
  p.accepted > 0 ? 'accepted' : p.pending > 0 ? 'pending' : p.rejected > 0 ? 'rejected' : 'none';

const toRoad = (f: RoadFeature): RoadSegment => ({
  road_id: f.properties.road_id,
  road_name: f.properties.road_name,
  road_number: f.properties.road_number,
  path_type: f.properties.path_type,
  length_m: f.properties.length_m ?? undefined,
  status: roadStatus(f.properties),
  geometry: f.geometry.coordinates.map(([lon, lat]) => [lat, lon]),
});

export const api = {
  health: () => raw<{ status: string }>('/health'),

  // client_type 기본값(web)은 Origin 검사에 걸린다. 앱은 반드시 mobile.
  login: async (username: string, password: string) => {
    const r = await raw<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password, client_type: 'mobile' }),
    });
    accessToken = r.access_token;
    refreshToken = r.refresh_token;
    return { refresh_token: r.refresh_token, user: r.user };
  },

  /** 새 계정은 항상 수집가 권한. 가입 응답 모양이 문서에 없어서, 가입 뒤 바로 로그인해 토큰을 받는다. */
  register: async (username: string, password: string): Promise<{ refresh_token: string; user: User }> => {
    await raw('/auth/register', { method: 'POST', body: JSON.stringify({ username, password }) });
    return api.login(username, password);
  },

  logout: async () => {
    await raw('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken, client_type: 'mobile' }),
    }).catch(() => {});
    setRefreshToken(null);
  },

  /** since 이후 바뀐 도로. 로컬 revision이 서버보다 앞서면 409 */
  roadSync: (since: number, limit = 1000) => request<RoadSyncPage>(`/roads/sync?since=${since}&limit=${limit}`),

  /** 구간 단위. 한 페이지만 받는다 — 2000개면 1.2MB라, 지도는 충분히 확대됐을 때만 부른다. */
  roads: async (b: BBox, limit = 500) => {
    const r = await request<{ features: RoadFeature[]; next_cursor: string | null }>(
      `/roads?bbox=${bbox(b)}&limit=${limit}`,
    );
    return { roads: r.features.map(toRoad), truncated: r.next_cursor != null };
  },

  // --- 재개 업로드. 청크 PATCH는 파일 업로드라 uploader.ts가 직접 보낸다 ---

  /** 같은 키·같은 파일 정보면 서버가 기존 세션을 돌려준다 */
  createUploadSession: (key: string, body: { filename: string; size_bytes: number }) =>
    request<UploadSession>('/upload-sessions', { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(body) }),

  uploadSession: (id: string) => request<UploadSession>(`/upload-sessions/${id}`),

  cancelUploadSession: (id: string) => request<null>(`/upload-sessions/${id}`, { method: 'DELETE' }),

  /** 멱등 — 응답을 못 받고 다시 보내도 영상은 하나만 생긴다 */
  completeUpload: (id: string, form: FormData) =>
    request<{ video: { video_id: string; processing_status: ProcessingStatus } }>(`/upload-sessions/${id}/complete`, { method: 'POST', body: form }),

  /** ready가 돼야 로컬 영상을 지운다 */
  video: (id: string) => request<{ video_id: string; processing_status: ProcessingStatus }>(`/videos/${id}`),

  /** 재생용 임시 주소. 서버는 호스트 없이 `/video-collector/api/v1/...?token=`을 준다. */
  playbackUrl: async (videoId: string) => {
    const r = await request<{ url: string }>(`/videos/${videoId}/playback-token`, { method: 'POST' });
    return BASE_URL.match(/^https?:\/\/[^/]+/)![0] + r.url;
  },
};

export { BASE_URL };
