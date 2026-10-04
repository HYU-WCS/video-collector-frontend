import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useEvent } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Screen } from '@/components/Screen';
import { StatusBadge } from '@/components/StatusBadge';
import { useVideoDetail } from '@/controllers/useVideoDetail';
import { TrailThumb } from '@/views/MapView';
import { Color, StatusColor } from '@/theme/colors';

const frame = { aspectRatio: 16 / 9, backgroundColor: '#000', borderRadius: 8, overflow: 'hidden' as const };

export function VideoDetailView({ route }: any) {
  const { video, uri, sideways, trail, error, loading } = useVideoDetail(route.params.id);
  if (!video) {
    return <Screen title="영상">{loading ? <ActivityIndicator /> : <Text>찾을 수 없습니다</Text>}</Screen>;
  }

  return (
    <Screen title={video.video_name}>
      {uri ? <Player uri={uri} sideways={sideways} /> : (
        <View style={[frame, { alignItems: 'center', justifyContent: 'center' }]}>
          {error ? <Text style={{ color: '#fff', padding: 16 }}>{error}</Text> : <ActivityIndicator color="#fff" />}
        </View>
      )}
      {/* 정적 궤적 지도. 지도 탭 시 해당 t로 점프하는 건 2차. */}
      {trail && trail.length > 1
        ? <TrailThumb trail={trail} color={StatusColor[video.review]} style={{ height: 180, marginTop: 12 }} />
        : <View style={{ height: 180, backgroundColor: Color.surface, borderRadius: 8, marginTop: 12 }} />}

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

/**
 * sideways: 세로로 저장된 가로 영상. 박스를 가로세로 바꿔 놓고 -90° 돌려 16:9 칸을 채운다.
 * 기본 컨트롤은 플레이어 뷰 안에 그려져 같이 눕는다 — 숨기고 회전 밖에 재생/정지·전체화면만 따로 얹는다.
 */
function Player({ uri, sideways }: { uri: string; sideways: boolean }) {
  const player = useVideoPlayer(uri);
  const ref = useRef<VideoView>(null);
  const [w, setW] = useState(0);
  const [full, setFull] = useState(false);
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  const h = (w * 9) / 16;
  const rotated = { position: 'absolute' as const, width: h, height: w, left: (w - h) / 2, top: (h - w) / 2,
    transform: [{ rotate: '-90deg' }] };

  // 컨트롤 없이 전체화면에 들어가면 닫을 방법이 없다. 컨트롤을 켠 다음 렌더에서 들어간다.
  useEffect(() => { if (full) void ref.current?.enterFullscreen(); }, [full]);

  return (
    <View style={frame} onLayout={e => setW(e.nativeEvent.layout.width)}>
      <VideoView ref={ref} player={player} style={sideways && w ? rotated : { flex: 1 }} contentFit="contain"
        nativeControls={!sideways || full} onFullscreenExit={() => setFull(false)} />
      {sideways && !full && (
        <Pressable onPress={() => (isPlaying ? player.pause() : player.play())}
          style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
          {!isPlaying && <Text style={{ color: '#fff', fontSize: 36, opacity: 0.85 }}>▶</Text>}
          <Pressable onPress={() => setFull(true)} hitSlop={12} style={{ position: 'absolute', right: 10, bottom: 8 }}>
            <Text style={{ color: '#fff', fontSize: 22, opacity: 0.85 }}>⤢</Text>
          </Pressable>
        </Pressable>
      )}
    </View>
  );
}

const Row = ({ label, value }: { label: string; value: string }) => (
  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
    <Text style={{ color: Color.textMuted }}>{label}</Text>
    <Text>{value}</Text>
  </View>
);
