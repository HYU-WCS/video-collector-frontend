import { Text, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { StatusBadge } from '@/components/StatusBadge';
import { mockVideos } from '@/models/mockApi';
import { Color } from '@/theme/colors';

export function VideoDetailView({ route }: any) {
  const video = mockVideos.find(v => v.video_id === route.params.id);
  if (!video) return <Screen title="영상"><Text>찾을 수 없습니다</Text></Screen>;

  return (
    <Screen title={video.video_name}>
      {/* TODO: expo-video 플레이어 */}
      <View style={{ aspectRatio: 16 / 9, backgroundColor: '#000', borderRadius: 8 }} />
      {/* TODO: 궤적 지도 — 정적. 지도 탭 시 해당 t로 점프하는 건 2차. */}
      <View style={{ height: 180, backgroundColor: Color.surface, borderRadius: 8, marginTop: 12 }} />

      <View style={{ marginTop: 16, gap: 8 }}>
        <Row label="촬영일시" value={video.upload_date.slice(0, 16).replace('T', ' ')} />
        <Row label="길이" value={`${video.duration_sec}초`} />
        <Row label="거리" value={`${video.distance_m}m`} />
        <View style={{ marginTop: 8 }}><StatusBadge status={video.review} superseded={video.superseded} /></View>
        {video.reject_reason && !video.superseded && (
          <Text style={{ color: Color.danger, marginTop: 4 }}>사유: {video.reject_reason}</Text>
        )}
      </View>
    </Screen>
  );
}

const Row = ({ label, value }: { label: string; value: string }) => (
  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
    <Text style={{ color: Color.textMuted }}>{label}</Text>
    <Text>{value}</Text>
  </View>
);
