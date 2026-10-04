import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Polyline } from 'react-native-maps';
import { useCoverage } from '@/controllers/useCoverage';
import { Color, StatusColor, StatusLabel } from '@/theme/colors';
import type { RoadSegment, TrajectoryPoint } from '@/models/types';

// 지도 SDK는 나중에 네이버로 교체한다. 그 교체 비용을 줄이려고 이 파일 밖으로 새어나가지 않게 둔다.
export function CoverageMapView({ navigation }: any) {
  const { roads, level, onRegionChange } = useCoverage();
  const [selected, setSelected] = useState<RoadSegment | null>(null);
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1 }}>
      <MapView
        style={{ flex: 1 }}
        initialRegion={{ latitude: 37.5503, longitude: 127.0731, latitudeDelta: 0.01, longitudeDelta: 0.01 }}
        showsUserLocation
        rotateEnabled={false}
        pitchEnabled={false}
        onMapReady={() => onRegionChange(
          { minLat: 37.5453, minLon: 127.0681, maxLat: 37.5553, maxLon: 127.0781 }, 16,
        )}
        onRegionChangeComplete={(r) => onRegionChange(
          { minLat: r.latitude - r.latitudeDelta / 2, minLon: r.longitude - r.longitudeDelta / 2,
            maxLat: r.latitude + r.latitudeDelta / 2, maxLon: r.longitude + r.longitudeDelta / 2 },
          Math.round(Math.log2(360 / r.longitudeDelta)),
        )}
      >
        {roads.map(r => (
          <Polyline
            key={r.road_id}
            coordinates={r.geometry.map(([latitude, longitude]) => ({ latitude, longitude }))}
            strokeColor={StatusColor[r.status]}
            strokeWidth={selected?.road_id === r.road_id ? 9 : 6}
            tappable
            onPress={() => setSelected(r)}
          />
        ))}
      </MapView>

      <Pressable onPress={() => navigation.goBack()} hitSlop={12}
        style={{ position: 'absolute', top: insets.top + 8, left: 12, backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: Color.border }}>
        <Text style={{ color: Color.text }}>← 뒤로</Text>
      </Pressable>

      <Legend />

      {selected && (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#fff', padding: 20, borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
          <Text style={{ fontSize: 16 }}>{selected.road_name}{selected.road_number ? ` #${selected.road_number}` : ''}</Text>
          <Text style={{ color: StatusColor[selected.status], marginTop: 4 }}>{StatusLabel[selected.status]}</Text>
          {selected.reject_reason && (
            <Text style={{ color: Color.textMuted, marginTop: 4 }}>반려 사유: {selected.reject_reason}</Text>
          )}
          {selected.status === 'rejected' && (
            <Text style={{ color: Color.textMuted, marginTop: 4 }}>누구든 다시 찍으면 됩니다</Text>
          )}
        </View>
      )}
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
    <View pointerEvents="none" style={{ width: 150, height: 150, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#FFF6' }}>
      <MapView
        ref={ref}
        style={{ flex: 1 }}
        initialRegion={{ latitude: lat, longitude: lon, latitudeDelta: 0.004, longitudeDelta: 0.004 }}
        showsUserLocation
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
