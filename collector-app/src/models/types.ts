export type RoadStatus = 'none' | 'pending' | 'accepted' | 'rejected';
export type UploadStatus = 'queued' | 'uploading' | 'done' | 'failed';

export interface User {
  user_id: string;
  username: string;
  role?: string;          // reviewer | admin | 그 외(수집가)
}

export interface TrajectoryPoint {
  t: number;    // 영상 시작 기준 경과 초
  lat: number;
  lon: number;
  acc: number;  // 위치 정확도 (m)
  spd?: number;
  hdg?: number;
}

export interface Trajectory {
  video_id?: number;
  local_id: string;
  recorded_at: string;
  sample_rate_sec: number;
  points: TrajectoryPoint[];
}

export interface Video {
  video_id: number;
  video_name: string;
  upload_date: string;
  duration_sec: number;
  distance_m: number;
  thumbnail_url?: string;
  review: RoadStatus;
  superseded: boolean;    // 반려됐지만 이후 누군가 다시 찍어 통과됨
  reject_reason?: string;
  reviewed_at?: string;   // 검수 판정 시각 — 반려 알림 기준
  upload: UploadStatus;
}

export interface RoadSegment {
  road_id: string;
  road_number: string | null;
  road_name: string;
  path_type?: string;     // walkable_link | roadside_walkway | crosswalk | footbridge | tunnel | park_path
  length_m?: number;
  status: RoadStatus;
  reject_reason?: string;
  geometry: [number, number][];   // [lat, lon][]
}

export interface CoverageCell {
  bounds: [number, number, number, number];  // [minLat, minLon, maxLat, maxLon]
  coverage: number;                          // 0..1
}

export interface ClipTrace {
  video_id: number;
  status: RoadStatus;
  geometry: [number, number][];
}

export interface Progress {
  total_ratio: number;
  my_distance_m: number;
  confirmed_distance_m: number;   // accept된 것만
  pending_distance_m: number;     // 검수 대기분
}

export interface BBox { minLat: number; minLon: number; maxLat: number; maxLon: number }
