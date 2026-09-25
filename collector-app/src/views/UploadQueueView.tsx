import { Pressable, Text, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { useUploadQueue } from '@/controllers/useUploadQueue';
import { Color, StatusColor } from '@/theme/colors';

export function UploadQueueView() {
  const { items, retry } = useUploadQueue();

  return (
    <Screen title="업로드">
      {items.length === 0 && <Text style={{ color: Color.textMuted }}>대기 중인 업로드가 없습니다</Text>}
      <View style={{ gap: 12 }}>
        {items.map(it => (
          <View key={it.local_id} style={{ borderWidth: 1, borderColor: Color.border, borderRadius: 12, padding: 12 }}>
            <Text style={{ fontWeight: '500' }}>{it.local_id}</Text>
            <Text style={{ fontSize: 12, color: Color.textMuted, marginTop: 4 }}>
              {it.duration_sec}초 · {it.distance_m}m
            </Text>
            {it.status === 'uploading' && (
              <View style={{ height: 3, backgroundColor: Color.border, borderRadius: 2, marginTop: 8 }}>
                <View style={{ height: 3, width: `${Math.round(it.progress * 100)}%`, backgroundColor: Color.accent, borderRadius: 2 }} />
              </View>
            )}
            {it.status === 'failed' && (
              <Text style={{ fontSize: 12, color: StatusColor.rejected, marginTop: 6 }}>실패 · {it.error}</Text>
            )}
          </View>
        ))}
      </View>
      {items.some(i => i.status === 'failed') && (
        <Pressable onPress={retry} style={{ borderWidth: 1, borderColor: Color.border, borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 16 }}>
          <Text>전체 재시도</Text>
        </Pressable>
      )}
    </Screen>
  );
}
