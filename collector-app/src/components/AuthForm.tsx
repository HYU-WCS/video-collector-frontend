import { useState, type ReactNode } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Color } from '@/theme/colors';

// 로그인·회원가입 화면 공통. 키보드가 올라와도 입력칸과 버튼이 가려지지 않게 스크롤된다.
export function AuthScreen({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Color.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 16, gap: 12 }}
          keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** secret이면 비밀번호 칸 — 오른쪽에 보기/숨기기 */
export function Field({ label, value, onChangeText, secret, placeholder }: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  secret?: boolean;
  placeholder?: string;
}) {
  const [shown, setShown] = useState(false);
  return (
    <>
      <Text style={{ color: Color.textMuted }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: Color.border, borderRadius: 8 }}>
        <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder}
          autoCapitalize="none" autoCorrect={false} secureTextEntry={secret && !shown}
          style={{ flex: 1, padding: 12, color: Color.text }} />
        {secret && (
          <Pressable onPress={() => setShown(s => !s)} hitSlop={8} style={{ paddingHorizontal: 12 }}>
            <Text style={{ color: Color.textMuted, fontSize: 13 }}>{shown ? '숨기기' : '보기'}</Text>
          </Pressable>
        )}
      </View>
    </>
  );
}

export function SubmitButton({ label, busy, onPress }: { label: string; busy: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={busy}
      style={{ backgroundColor: Color.accent, borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 8 }}>
      {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '500' }}>{label}</Text>}
    </Pressable>
  );
}

/** "계정이 없나요? 회원가입" 같은 아래쪽 링크 */
export function SwitchLink({ question, action, onPress }: { question: string; action: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={{ alignSelf: 'center', marginTop: 4 }}>
      <Text style={{ color: Color.textMuted }}>{question} <Text style={{ color: Color.accent }}>{action}</Text></Text>
    </Pressable>
  );
}
