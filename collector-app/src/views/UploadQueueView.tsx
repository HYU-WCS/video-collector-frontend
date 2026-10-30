import { Pressable, Text, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { useUploadQueue } from '@/controllers/useUploadQueue';
import { Color, StatusColor } from '@/theme/colors';

export function UploadQueueView() {
  const { items, uploading, retry } = useUploadQueue();

  return (
    <Screen title="업로드">
      {uploading && (
        <View style={{ backgroundColor: Color.accent + '22', borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: Color.accent }}>업로드 중이에요</Text>
          <Text style={{ marginTop: 6, lineHeight: 20 }}>
            끝날 때까지 화면을 끄거나 다른 앱으로 나가지 마세요.{'\n'}나가면 업로드가 멈추고, 앱으로 돌아오면 이어서 올라가요.
          </Text>
        </View>
      )}
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
            {it.status === 'done' && (
              <Text style={{ fontSize: 12, color: Color.textMuted, marginTop: 6 }}>업로드 완료</Text>
            )}
            {it.status !== 'done' && (it.processing_status === 'uploaded' || it.processing_status === 'processing') && (
              <Text style={{ fontSize: 12, color: Color.textMuted, marginTop: 6 }}>서버에서 영상 확인 중 — 끝나면 폰에서 지워요</Text>
            )}
            {it.error && (
              <Text style={{ fontSize: 12, color: StatusColor.rejected, marginTop: 6 }}>
                {it.status === 'failed' ? `실패 · ${it.error}` : it.error}
              </Text>
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
