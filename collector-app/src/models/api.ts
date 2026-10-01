import type { BBox, RoadSegment, RoadStatus, User } from './types';

// 실제 백엔드: 팀원이 만든 video-collector (docs/04-api.md "실제 백엔드").
// 지금 연결된 건 로그인·지도(도로)뿐. 앨범·업로드·진척도는 수집가 계정과 궤적 형식이 정해진 뒤.
// 응답 모양이 앱 타입과 다른 곳은 여기서 변환해, controllers는 mockApi와 같은 모양만 보게 한다.

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://166.104.36.71:8002/video-collector';
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
    } catch {
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

  logout: async () => {
    await raw('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken, client_type: 'mobile' }),
    }).catch(() => {});
    setRefreshToken(null);
  },

  /** 구간 단위. 한 페이지만 받는다 — 2000개면 1.2MB라, 지도는 충분히 확대됐을 때만 부른다. */
  roads: async (b: BBox, limit = 500) => {
    const r = await request<{ features: RoadFeature[]; next_cursor: string | null }>(
      `/roads?bbox=${bbox(b)}&limit=${limit}`,
    );
    return { roads: r.features.map(toRoad), truncated: r.next_cursor != null };
  },
};

export { BASE_URL };
