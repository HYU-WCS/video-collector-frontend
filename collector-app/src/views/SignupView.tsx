import { useState } from 'react';
import { Text } from 'react-native';
import { AuthScreen, Field, SubmitButton, SwitchLink } from '@/components/AuthForm';
import { useAuth } from '@/controllers/useAuth';
import { Color } from '@/theme/colors';

// 인증 없이 아이디·비밀번호만. 가입하면 바로 로그인 상태가 되어 메인으로 간다.
export function SignupView({ navigation }: any) {
  const { signup, busy, error } = useAuth();
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');

  return (
    <AuthScreen>
      <Text style={{ fontSize: 24, fontWeight: '500', color: Color.text }}>회원가입</Text>
      <Text style={{ color: Color.textMuted, marginBottom: 24 }}>아이디와 비밀번호만 정하면 바로 시작합니다</Text>
      <Field label="아이디" value={id} onChangeText={setId} placeholder="영문·숫자 3자 이상" />
      <Field label="비밀번호" value={pw} onChangeText={setPw} secret placeholder="12자 이상" />
      <Field label="비밀번호 확인" value={confirm} onChangeText={setConfirm} secret />
      {error ? <Text style={{ color: Color.danger, fontSize: 13 }}>{error}</Text> : null}
      <SubmitButton label="가입하고 시작하기" busy={busy} onPress={() => signup(id, pw, confirm)} />
      <SwitchLink question="이미 계정이 있나요?" action="로그인" onPress={() => navigation.goBack()} />
      <Text style={{ color: Color.textMuted, fontSize: 12, textAlign: 'center', marginTop: 24 }}>이메일·휴대폰 인증 없이 가입됩니다</Text>
    </AuthScreen>
  );
}
