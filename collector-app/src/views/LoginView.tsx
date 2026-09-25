import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { useAuth } from '@/controllers/useAuth';
import { Color } from '@/theme/colors';

export function LoginView() {
  const { login, busy, error } = useAuth();
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');

  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: 'center', gap: 12 }}>
        <Text style={{ fontSize: 24, fontWeight: '500', marginBottom: 24, color: Color.text }}>영상 수집</Text>
        <Text style={{ color: Color.textMuted }}>아이디</Text>
        <TextInput value={id} onChangeText={setId} autoCapitalize="none"
          style={{ borderWidth: 1, borderColor: Color.border, borderRadius: 8, padding: 12 }} />
        <Text style={{ color: Color.textMuted }}>비밀번호</Text>
        <TextInput value={pw} onChangeText={setPw} secureTextEntry
          style={{ borderWidth: 1, borderColor: Color.border, borderRadius: 8, padding: 12 }} />
        {error ? <Text style={{ color: Color.danger, fontSize: 13 }}>{error}</Text> : null}
        <Pressable onPress={() => login(id, pw)} disabled={busy}
          style={{ backgroundColor: Color.accent, borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 8 }}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '500' }}>로그인</Text>}
        </Pressable>
      </View>
    </Screen>
  );
}
