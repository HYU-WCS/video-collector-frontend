import { FlatList, Pressable, Text, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { StatusBadge } from '@/components/StatusBadge';
import { useAlbum } from '@/controllers/useAlbum';
import { Color } from '@/theme/colors';

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
        ListEmptyComponent={!loading ? <Text style={{ color: Color.textMuted }}>아직 촬영한 영상이 없습니다</Text> : null}
        renderItem={({ item }) => (
          <Pressable onPress={() => navigation.navigate('VideoDetail', { id: item.video_id })}
            style={{ flexDirection: 'row', gap: 12, borderWidth: 1, borderColor: Color.border, borderRadius: 12, padding: 12 }}>
            {/* 썸네일은 서버가 만든 정적 이미지를 쓴다. 지도 컴포넌트를 목록에 띄우면 죽는다. */}
            <View style={{ width: 72, height: 72, borderRadius: 8, backgroundColor: Color.surface }} />
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
