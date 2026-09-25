import { Pressable, Text, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { useRejectNotice } from '@/controllers/useRejectNotice';
import { useUploadQueue } from '@/controllers/useUploadQueue';
import { mockProgress } from '@/models/mockApi';
import { Color, StatusColor } from '@/theme/colors';

export function HomeView({ navigation }: any) {
  const { pending } = useUploadQueue();
  const notice = useRejectNotice();
  const p = mockProgress;

  return (
    <Screen title="영상 수집">
      <View style={{ backgroundColor: Color.surface, borderRadius: 16, padding: 20, marginBottom: 16 }}>
        <Text style={{ fontSize: 18 }}>{(p.my_distance_m / 1000).toFixed(1)}km 촬영했어요!</Text>
        <Text style={{ color: Color.textMuted, marginTop: 6 }}>
          확정 {(p.confirmed_distance_m / 1000).toFixed(1)}km · 검수중 {(p.pending_distance_m / 1000).toFixed(1)}km
        </Text>
      </View>

      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
        {pending > 0 && (
          <Pressable onPress={() => navigation.navigate('UploadQueue')}
            style={{ backgroundColor: StatusColor.pending + '22', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 }}>
            <Text style={{ color: StatusColor.pending, fontSize: 13 }}>업로드 대기 {pending}건</Text>
          </Pressable>
        )}
        {notice.items.length > 0 && (
          <Pressable onPress={() => { void notice.dismiss(); navigation.navigate('Album', { filter: 'rejected' }); }}
            style={{ backgroundColor: StatusColor.rejected + '22', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 }}>
            <Text style={{ color: StatusColor.rejected, fontSize: 13 }}>
              반려 {notice.items.length}건 · {notice.items[0].reject_reason}
            </Text>
          </Pressable>
        )}
      </View>

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Tile label="지도" caption="얼마나 했는지 보기" onPress={() => navigation.navigate('Map')} />
        <Tile label="촬영" caption="영상 수집" onPress={() => navigation.navigate('Record')} />
      </View>
      <Pressable onPress={() => navigation.navigate('Album')}
        style={{ borderWidth: 1, borderColor: Color.border, borderRadius: 12, padding: 20, marginTop: 12 }}>
        <Text style={{ fontSize: 16 }}>앨범 리스트</Text>
        <Text style={{ color: Color.textMuted, fontSize: 13, marginTop: 4 }}>찍은 데이터 확인</Text>
      </Pressable>
    </Screen>
  );
}

function Tile({ label, caption, onPress }: { label: string; caption: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress}
      style={{ flex: 1, aspectRatio: 1, borderWidth: 1, borderColor: Color.border, borderRadius: 12, padding: 16, justifyContent: 'flex-end' }}>
      <Text style={{ fontSize: 18 }}>{label}</Text>
      <Text style={{ color: Color.textMuted, fontSize: 13, marginTop: 4 }}>{caption}</Text>
    </Pressable>
  );
}
