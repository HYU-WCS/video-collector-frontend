import { useState } from 'react';
import { Text } from 'react-native';
import { AuthScreen, Field, SubmitButton, SwitchLink } from '@/components/AuthForm';
import { useAuth } from '@/controllers/useAuth';
import { Color } from '@/theme/colors';

export function LoginView({ navigation }: any) {
  const { login, busy, error } = useAuth();
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');

  return (
    <AuthScreen>
      <Text style={{ fontSize: 24, fontWeight: '500', marginBottom: 24, color: Color.text }}>영상 수집</Text>
      <Field label="아이디" value={id} onChangeText={setId} />
      <Field label="비밀번호" value={pw} onChangeText={setPw} secret />
      {error ? <Text style={{ color: Color.danger, fontSize: 13 }}>{error}</Text> : null}
      <SubmitButton label="로그인" busy={busy} onPress={() => login(id, pw)} />
      <SwitchLink question="계정이 없나요?" action="회원가입" onPress={() => navigation.navigate('Signup')} />
      <Text style={{ color: Color.textMuted, fontSize: 12, textAlign: 'center', marginTop: 24 }}>자동 로그인됩니다</Text>
    </AuthScreen>
  );
}
