import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { useAuth } from '@/controllers/useAuth';
import { useRoadSync } from '@/controllers/useRoadSync';
import { Color } from '@/theme/colors';

const time = (ms: number | null) => (ms ? new Date(ms).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' }) : '아직 없음');

export function SettingsView() {
  const { logout, busy } = useAuth();
  const roads = useRoadSync();

  return (
    <Screen title="설정">
      <Text style={{ color: Color.textMuted }}>Wi-Fi 전용 / 화질 / 저장공간</Text>

      <View style={{ marginTop: 24, gap: 4 }}>
        <Text style={{ fontWeight: '500', color: Color.text }}>도로 정보</Text>
        <Text style={{ fontSize: 13, color: Color.textMuted }}>
          {roads.ready ? `${roads.count.toLocaleString()}개` : '처음 받는 중'} · 마지막 동기화 {time(roads.lastSuccessAt)}
        </Text>
        {roads.error && <Text style={{ fontSize: 13, color: Color.danger }}>오류 · {roads.error}</Text>}
        <Pressable onPress={roads.refresh} disabled={roads.syncing}
          style={{ borderWidth: 1, borderColor: Color.border, borderRadius: 8, padding: 12, alignItems: 'center', marginTop: 8 }}>
          {roads.syncing ? <ActivityIndicator /> : <Text style={{ color: Color.text }}>지금 새로고침</Text>}
        </Pressable>
      </View>

      <Pressable onPress={logout} disabled={busy}
        style={{ borderWidth: 1, borderColor: Color.border, borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 24 }}>
        {busy ? <ActivityIndicator /> : <Text style={{ color: Color.danger }}>로그아웃</Text>}
      </Pressable>
    </Screen>
  );
}
