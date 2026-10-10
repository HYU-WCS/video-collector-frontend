import { Image, ImageSourcePropType, Pressable, Text, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { exportTrajectories } from '@/controllers/devExport';
import { useRejectNotice } from '@/controllers/useRejectNotice';
import { useUploadQueue } from '@/controllers/useUploadQueue';
import { mockProgress } from '@/models/mockApi';
import { Color, StatusColor } from '@/theme/colors';

export function HomeView({ navigation }: any) {
  const { pending } = useUploadQueue();
  const notice = useRejectNotice();
  const p = mockProgress;

  return (
    <Screen title="영상 수집" right={
      <Pressable onPress={() => navigation.navigate('Settings')} hitSlop={12}>
        <Text style={{ color: Color.textMuted }}>설정</Text>
      </Pressable>
    }>
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
        <Tile label="지도" caption="얼마나 했는지 보기" icon={require('../../assets/icons/map.png')} onPress={() => navigation.navigate('Map')} />
        <Tile label="촬영" caption="영상 수집" icon={require('../../assets/icons/camera.png')} onPress={() => navigation.navigate('Record')} />
      </View>
      <Pressable onPress={() => navigation.navigate('Album')}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 16, borderWidth: 1, borderColor: Color.border, borderRadius: 12, padding: 20, marginTop: 12 }}>
        <Image source={require('../../assets/icons/album.png')} style={{ width: 48, height: 48 }} />
        <View>
          <Text style={{ fontSize: 16 }}>앨범 리스트</Text>
          <Text style={{ color: Color.textMuted, fontSize: 13, marginTop: 4 }}>찍은 데이터 확인</Text>
        </View>
      </Pressable>
      {__DEV__ && (
        <Pressable onPress={async () => { if (!(await exportTrajectories())) alert('저장된 궤적이 없어요'); }}
          style={{ padding: 12, marginTop: 12 }}>
          <Text style={{ color: Color.textMuted, fontSize: 13, textAlign: 'center' }}>[개발] 궤적 내보내기</Text>
        </Pressable>
      )}
    </Screen>
  );
}

function Tile({ label, caption, icon, onPress }: { label: string; caption: string; icon: ImageSourcePropType; onPress: () => void }) {
  return (
    <Pressable onPress={onPress}
      style={{ flex: 1, aspectRatio: 1, borderWidth: 1, borderColor: Color.border, borderRadius: 12, padding: 16, justifyContent: 'flex-end' }}>
      {/* 글자는 아래에 붙여 두고, 아이콘은 남는 위쪽 공간 가운데에 */}
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Image source={icon} style={{ width: 72, height: 72 }} />
      </View>
      <Text style={{ fontSize: 18 }}>{label}</Text>
      <Text style={{ color: Color.textMuted, fontSize: 13, marginTop: 4 }}>{caption}</Text>
    </Pressable>
  );
}
