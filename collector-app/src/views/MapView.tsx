import { useEffect, useRef } from 'react';
import { ActivityIndicator, Pressable, Text, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Circle, Marker, Polygon, Polyline } from 'react-native-maps';
import { useCoverage } from '@/controllers/useCoverage';
import { Color, StatusColor, StatusLabel } from '@/theme/colors';
import type { RoadSegment, TrajectoryPoint } from '@/models/types';

// 지도 SDK는 나중에 네이버로 교체한다. 그 교체 비용을 줄이려고 이 파일 밖으로 새어나가지 않게 둔다.
// 찍은 길을 색으로 칠한다 — 서버 도로 중 검수에 걸린 것(모든 사용자) + 아직 매칭 전인 내 클립. 탭해도 아무것도 안 뜬다 (D20).
// 골목 단계(z16~)에서는 안 찍은 길도 회색 선과 교차점으로 깐다 — 점만으로는 길이 어떻게 이어지는지 안 보였다.
export function CoverageMapView({ navigation }: any) {
  const { level, start, dongs, roads, clips, network, nodes, nodeRadius, onRegion, sync } = useCoverage();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1 }}>
      {start && (
        <MapView
          style={{ flex: 1 }}
          initialRegion={{ latitude: start[0], longitude: start[1], latitudeDelta: 0.04, longitudeDelta: 0.04 }}   // 약 z13, 동 단위
          showsUserLocation
          rotateEnabled={false}
          pitchEnabled={false}
          onRegionChangeComplete={onRegion}
        >
          {level === 'dong' && dongs.map(d => (
            <Polygon key={d.code}
              coordinates={d.ring.map(([latitude, longitude]) => ({ latitude, longitude }))}
              fillColor={`rgba(37, 99, 235, ${0.08 + (d.ratio ?? 0) * 0.5})`}
              strokeColor="rgba(37, 99, 235, 0.6)" strokeWidth={1} />
          ))}
          {level === 'dong' && dongs.map(d => (
            <Marker key={`label-${d.code}`} coordinate={{ latitude: d.label[0], longitude: d.label[1] }} anchor={{ x: 0.5, y: 0.5 }}>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 11, color: Color.text }}>{d.name}</Text>
                {d.ratio != null && <Text style={{ fontSize: 15, fontWeight: '600', color: Color.text }}>{Math.round(d.ratio * 100)}%</Text>}
              </View>
            </Marker>
          ))}
          {/* 안 찍은 길 — 색 선 아래에 깔리게 먼저 그린다 */}
          {network.map(r => (
            <Polyline key={`net-${r.road_id}`}
              coordinates={r.geometry.map(([latitude, longitude]) => ({ latitude, longitude }))}
              strokeColor={StatusColor.none} strokeWidth={2} />
          ))}
          {level !== 'dong' && clips.filter(c => level === 'clip' || c.major).map(c => (
            <Polyline key={c.video_id}
              coordinates={c.geometry.map(([latitude, longitude]) => ({ latitude, longitude }))}
              strokeColor={StatusColor[c.status]} strokeWidth={5} />
          ))}
          {/* 서버 검수 상태가 내 클립 위에 오게 나중에 그린다 */}
          {level !== 'dong' && roads.filter(r => level === 'clip' || r.major).map(r => (
            <Polyline key={r.road_id}
              coordinates={r.geometry.map(([latitude, longitude]) => ({ latitude, longitude }))}
              strokeColor={StatusColor[r.status]} strokeWidth={5} />
          ))}
          {/* 교차점 — 골목 단계에서 화면 안만. 닿은 구간이 하나라도 찍혔으면 그 상태 색, 아니면 회색(미촬영) */}
          {nodes.map(n => (
            <Circle key={n.id} center={{ latitude: n.lat, longitude: n.lon }} radius={nodeRadius}
              fillColor={StatusColor[n.status]} strokeColor="#fff" strokeWidth={1} />
          ))}
        </MapView>
      )}

      {/* 동기화 실패가 지도를 막지 않는다 — 받아 둔 도로를 계속 보여주고 위에 작게 알린다 */}
      {(!sync.ready || sync.syncing) && (
        <View style={{ position: 'absolute', top: insets.top + 8, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: Color.border }}>
          {sync.syncing && <ActivityIndicator size="small" />}
          <Text style={{ fontSize: 12, color: Color.textMuted }}>
            {sync.ready ? '동기화 중' : sync.syncing ? `도로 정보를 준비하는 중 · ${sync.count.toLocaleString()}개` : '도로 정보를 아직 못 받았어요'}
          </Text>
        </View>
      )}

      <Pressable onPress={() => navigation.goBack()} hitSlop={12}
        style={{ position: 'absolute', top: insets.top + 8, left: 12, backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: Color.border }}>
        <Text style={{ color: Color.text }}>← 뒤로</Text>
      </Pressable>

      {level !== 'dong' && <Legend />}
    </View>
  );
}

function Legend() {
  return (
    <View style={{ position: 'absolute', left: 12, bottom: 24, backgroundColor: '#fff', borderRadius: 8, padding: 10, gap: 5 }}>
      {(['none', 'pending', 'accepted', 'rejected'] as const).map(s => (
        <View key={s} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 14, height: 3, backgroundColor: StatusColor[s] }} />
          <Text style={{ fontSize: 11, color: Color.textMuted }}>{StatusLabel[s]}</Text>
        </View>
      ))}
    </View>
  );
}

/**
 * 촬영 화면 좌하단 미니맵. 조작은 막고 현재 위치만 따라간다.
 * 앞 구간 색을 보고 이미 찍힌 길인지 판단하는 용도라 범례·라벨은 없다 (D12).
 */
export function MiniMap({ roads, position, trail }: {
  roads: RoadSegment[];
  position: [number, number];
  trail: TrajectoryPoint[];
}) {
  const ref = useRef<MapView>(null);
  const [lat, lon] = position;

  useEffect(() => {
    ref.current?.animateCamera({ center: { latitude: lat, longitude: lon } }, { duration: 500 });
  }, [lat, lon]);

  return (
    <View pointerEvents="none" style={{ width: 120, height: 120, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#FFF6' }}>
      <MapView
        ref={ref}
        style={{ flex: 1 }}
        initialRegion={{ latitude: lat, longitude: lon, latitudeDelta: 0.004, longitudeDelta: 0.004 }}
        showsPointsOfInterests={false}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        toolbarEnabled={false}
      >
        {roads.map(r => (
          <Polyline key={r.road_id}
            coordinates={r.geometry.map(([latitude, longitude]) => ({ latitude, longitude }))}
            strokeColor={StatusColor[r.status]} strokeWidth={4} />
        ))}
        {trail.length > 1 && (
          <Polyline coordinates={trail.map(p => ({ latitude: p.lat, longitude: p.lon }))}
            strokeColor={Color.accent} strokeWidth={3} />
        )}
        {/* 기본 내 위치 점은 정확도 원까지 그려 작은 지도에서 너무 크다. 반경 15m ≈ 지름 8px */}
        <Circle center={{ latitude: lat, longitude: lon }} radius={15} fillColor={Color.accent} strokeColor="#fff" strokeWidth={2} />
      </MapView>
    </View>
  );
}

/**
 * 앨범 썸네일·영상 상세의 정적 궤적 지도. Android는 liteMode라 지도 엔진이 아니라 정적 비트맵 한 장이다.
 * iOS는 liteMode가 없어 진짜 지도가 뜬다 — 목록 쪽 windowSize로 동시에 뜨는 수를 줄인다.
 */
export function TrailThumb({ trail, color, style }: { trail: [number, number][]; color: string; style: ViewStyle }) {
  const lats = trail.map(p => p[0]), lons = trail.map(p => p[1]);
  const [minLat, maxLat, minLon, maxLon] = [Math.min(...lats), Math.max(...lats), Math.min(...lons), Math.max(...lons)];
  // 정지 클립은 범위가 0이라 최소 폭(약 200m)을 둔다. 1.4배는 선이 가장자리에 붙지 않게 하는 여백.
  const region = {
    latitude: (minLat + maxLat) / 2, longitude: (minLon + maxLon) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * 1.4, 0.002),
    longitudeDelta: Math.max((maxLon - minLon) * 1.4, 0.002),
  };

  // pointerEvents none: lite 지도를 탭하면 구글 지도 앱이 열린다. 탭은 목록 행이 받는다.
  return (
    <View pointerEvents="none" style={[{ borderRadius: 8, overflow: 'hidden' }, style]}>
      <MapView
        style={{ flex: 1 }}
        liteMode
        initialRegion={region}
        showsPointsOfInterests={false}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        toolbarEnabled={false}
      >
        <Polyline coordinates={trail.map(([latitude, longitude]) => ({ latitude, longitude }))}
          strokeColor={color} strokeWidth={3} />
      </MapView>
    </View>
  );
}
