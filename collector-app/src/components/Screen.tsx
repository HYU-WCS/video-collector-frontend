import type { ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Color } from '@/theme/colors';

export function Screen({ title, children, scroll = true }: { title?: string; children: ReactNode; scroll?: boolean }) {
  const Body = scroll ? ScrollView : View;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Color.bg }}>
      {title ? (
        <View style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Color.border }}>
          <Text style={{ fontSize: 17, fontWeight: '500', color: Color.text }}>{title}</Text>
        </View>
      ) : null}
      <Body style={{ flex: 1 }} contentContainerStyle={scroll ? { padding: 16 } : undefined}>
        {children}
      </Body>
    </SafeAreaView>
  );
}
