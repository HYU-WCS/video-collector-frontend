import { ActivityIndicator, Pressable, Text } from 'react-native';
import { Screen } from '@/components/Screen';
import { useAuth } from '@/controllers/useAuth';
import { Color } from '@/theme/colors';

export function SettingsView() {
  const { logout, busy } = useAuth();

  return (
    <Screen title="설정">
      <Text style={{ color: Color.textMuted }}>Wi-Fi 전용 / 화질 / 저장공간</Text>
      <Pressable onPress={logout} disabled={busy}
        style={{ borderWidth: 1, borderColor: Color.border, borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 24 }}>
        {busy ? <ActivityIndicator /> : <Text style={{ color: Color.danger }}>로그아웃</Text>}
      </Pressable>
    </Screen>
  );
}
