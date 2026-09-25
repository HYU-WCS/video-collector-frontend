import { Text, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { Color } from '@/theme/colors';

export function SettingsView() {
  return (
    <Screen title="설정">
      <Text style={{ color: Color.textMuted }}>자동 업로드 / Wi-Fi 전용 / 화질 / 저장공간 / 로그아웃</Text>
    </Screen>
  );
}
