import { FlatList, Image, Pressable, Text, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { StatusBadge } from '@/components/StatusBadge';
import { useAlbum } from '@/controllers/useAlbum';
import { TrailThumb } from '@/views/MapView';
import { Color, StatusColor } from '@/theme/colors';

const THUMB = 72;
const blank = { width: THUMB, height: THUMB, borderRadius: 8, backgroundColor: Color.surface };

export function AlbumView({ navigation }: any) {
  const { items, loading, loadMore } = useAlbum();

  return (
    <Screen title="앨범" scroll={false}>
      <FlatList
        data={items}
        keyExtractor={v => String(v.video_id)}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        windowSize={5}   // 행마다 지도가 있다. 기본 21화면치를 들고 있으면 iOS에서 지도가 수십 개 뜬다
        ListEmptyComponent={!loading ? <Text style={{ color: Color.textMuted }}>아직 촬영한 영상이 없습니다</Text> : null}
        renderItem={({ item }) => (
          <Pressable onPress={() => navigation.navigate('VideoDetail', { id: item.video_id })}
            style={{ flexDirection: 'row', gap: 12, borderWidth: 1, borderColor: Color.border, borderRadius: 12, padding: 12 }}>
            {/* 궤적·첫 프레임 모두 이 폰에 남은 파일에서 온다. 없으면 회색 칸. */}
            {item.trail && item.trail.length > 1
              ? <TrailThumb trail={item.trail} color={StatusColor[item.review]} style={{ width: THUMB, height: THUMB }} />
              : <View style={blank} />}
            {item.thumb
              ? <Image source={{ uri: item.thumb }} style={[blank, item.thumbSideways && { transform: [{ rotate: '-90deg' }] }]} />
              : <View style={blank} />}
            <View style={{ flex: 1, justifyContent: 'center', gap: 4 }}>
              <Text style={{ fontWeight: '500' }}>{item.video_name}</Text>
              <Text style={{ fontSize: 12, color: Color.textMuted }}>
                {item.upload_date.slice(2, 16).replace('T', ' ')} · {item.duration_sec}초 · {item.distance_m}m
              </Text>
              <StatusBadge status={item.review} superseded={item.superseded} />
            </View>
          </Pressable>
        )}
      />
    </Screen>
  );
}
