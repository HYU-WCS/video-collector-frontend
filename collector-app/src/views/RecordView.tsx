import { useEffect, useRef, useState } from 'react';
import { Alert, AppState, Linking, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ScreenOrientation from 'expo-screen-orientation';
import { StatusBar } from 'expo-status-bar';
import { usePreventRemove } from '@react-navigation/native';
import { useRecorder } from '@/controllers/useRecorder';
import { useNearbyRoads } from '@/controllers/useCoverage';
import { MiniMap } from '@/views/MapView';
import { Color, StatusColor } from '@/theme/colors';

// 촬영 화면만 가로로 고정한다. 도로 폭을 넓게 담고, 모든 클립의 화면비를 통일하기 위해서다 (D17).
// 회전을 따라가게 두면 세로·가로 클립이 섞여 검수와 데이터 품질이 들쭉날쭉해진다.
export function RecordView({ navigation }: any) {
  const [perm, requestPerm, getPerm] = useCameraPermissions();
  const cam = useRef<CameraView>(null);
  const rec = useRecorder();
  const nearby = useNearbyRoads(rec.position);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [steps, setSteps] = useState('');   // [실험용] 직접 센 걸음 수
  const [leaving, setLeaving] = useState(false);
  const insets = useSafeAreaInsets();
  const top = Math.max(insets.top, 12);

  // 닫기 버튼만 숨기면 iOS 스와이프·안드로이드 뒤로가기로 나가져 영상이 큐에 안 들어가고 사라진다.
  usePreventRemove(rec.recording, () => Alert.alert('촬영 중에는 나갈 수 없어요', '정지 버튼을 누른 뒤 저장하거나 폐기하세요.'));
  // 저장·폐기 직후 바로 goBack하면 recording=false가 아직 반영 전이라 위 차단에 걸린다. 렌더가 끝난 뒤 나간다.
  useEffect(() => { if (leaving) navigation.goBack(); }, [leaving]);

  useEffect(() => {
    void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    return () => { void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP); };
  }, []);

  // 화면에 들어오면 버튼 없이 바로 시스템 권한 창을 띄운다. 처음 한 번만 —
  // 안드로이드는 첫 거부 뒤에도 다시 물을 수 있어서, 조건을 canAskAgain으로 두면 거부하자마자 창이 또 뜬다.
  useEffect(() => {
    if (perm?.status === 'undetermined') void requestPerm();
  }, [perm?.status]);

  // 설정 앱에서 허용하고 돌아오면 다시 읽는다. 훅은 마운트 때만 상태를 읽기 때문.
  useEffect(() => {
    const s = AppState.addEventListener('change', st => { if (st === 'active') void getPerm(); });
    return () => s.remove();
  }, []);

  if (!perm?.granted) {
    // 한 번 거부하면(안드로이드는 두 번) OS가 권한 창을 다시 띄워주지 않는다. 설정 앱으로 보낸다.
    const blocked = perm && !perm.canAskAgain;
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Pressable onPress={blocked ? () => Linking.openSettings() : requestPerm}>
          <Text>{blocked ? '설정에서 카메라 허용하기' : '카메라 권한 허용하기'}</Text>
        </Pressable>
      </View>
    );
  }

  const onPress = async () => {
    if (!rec.recording) {
      setError(null);
      rec.start();
      try {
        const video = await cam.current?.recordAsync();
        if (video?.uri) { setSteps(''); setConfirming(video.uri); }
      } catch (e: any) {
        // 녹화가 시작조차 안 되면 recording 상태가 남아 버튼이 멈춘다. 되돌리고 이유를 보여준다.
        await rec.finish('', false);
        setError(e?.message ?? '녹화를 시작할 수 없습니다');
      }
    } else {
      cam.current?.stopRecording();
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {/* 소리는 담지 않는다 — 도로 데이터에 불필요하고 행인 대화가 녹음된다. 마이크 권한도 필요 없어진다. */}
      {/* 뷰를 영상과 같은 16:9로 맞춘다. flex: 1이면 미리보기가 화면을 채우려고 위아래를 잘라 실제 녹화보다 좁게 보인다. */}
      {/* iOS는 녹화 시작 순간의 기기 방향으로 영상 방향을 정한다. 세로 고정을 켜 두면 늘 portrait로 읽혀
          가로로 찍어도 영상이 90° 누운 세로 영상이 된다. 가속도계로 실제 방향을 읽게 한다. */}
      <CameraView ref={cam} style={{ height: '100%', aspectRatio: 16 / 9, alignSelf: 'center' }} facing="back" mode="video" mute
        responsiveOrientationWhenOrientationLocked />
      <StatusBar hidden />

      {/* 녹화 중엔 나가지 못하게 숨긴다. 끊으려면 정지 → 폐기. */}
      {!rec.recording && (
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}
          style={{ position: 'absolute', top, left: insets.left + 16, backgroundColor: '#000A', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6 }}>
          <Text style={{ color: '#fff' }}>닫기</Text>
        </Pressable>
      )}

      {/* 상단 — 거리를 주로 보여준다. 100m 단위로 끊어 찍기 때문. */}
      <View style={{ position: 'absolute', top, alignSelf: 'center', backgroundColor: '#000A', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6 }}>
        <Text style={{ color: '#fff' }}>
          {rec.recording ? `${fmt(rec.elapsed)} · ` : ''}{Math.round(rec.distance)}m / 100m
        </Text>
        {__DEV__ && (
          <Text style={{ color: '#FFD', fontSize: 11, textAlign: 'center' }}>
            [진단] GPS 수신 {rec.diag.fixes}회 · 마지막 {rec.diag.lastFixAgo ?? '-'}초 전 · ±{Math.round(rec.accuracy ?? 0)}m · 재구독 {rec.diag.resubs}회
          </Text>
        )}
      </View>

      {/* GPS는 문제 있을 때만 드러낸다 */}
      {rec.gps !== 'good' && (
        <View style={{ position: 'absolute', top, right: insets.right + 16, backgroundColor: '#000A', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 }}>
          <Text style={{ color: rec.gps === 'weak' ? StatusColor.pending : StatusColor.rejected, fontSize: 12 }}>
            {rec.gps === 'weak' ? `GPS ${Math.round(rec.accuracy ?? 0)}m` : 'GPS 없음'}
          </Text>
        </View>
      )}

      {/* 위치 권한이 없으면 궤적을 못 남기므로 녹화 버튼이 막힌다. 이유와 해결 버튼을 보여준다. */}
      {rec.locPerm !== 'ok' && (
        <Pressable onPress={rec.locPerm === 'blocked' ? () => Linking.openSettings() : rec.askLocation}
          style={{ position: 'absolute', top: '50%', alignSelf: 'center', marginTop: -20, backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 }}>
          <Text>{rec.locPerm === 'blocked' ? '설정에서 위치 허용하기' : '위치 권한 허용하기'}</Text>
        </Pressable>
      )}

      {error && (
        <View style={{ position: 'absolute', top: top + 40, alignSelf: 'center', maxWidth: 480, backgroundColor: '#000C', borderRadius: 8, padding: 10 }}>
          <Text style={{ color: StatusColor.rejected, fontSize: 13 }}>{error}</Text>
        </View>
      )}

      {/* 좌하단 미니맵 — 첫 위치가 잡힌 뒤에만 뜬다 */}
      {rec.position && (
        <View style={{ position: 'absolute', left: insets.left + 16, bottom: Math.max(insets.bottom, 16) }}>
          <MiniMap roads={nearby} position={rec.position} trail={rec.trail} />
        </View>
      )}

      {/* 녹화 전 GPS 안정 대기 — 버튼 바로 옆에 이유와 남은 시간을 보여준다 */}
      {!rec.recording && !rec.ready && rec.gps !== 'none' && (
        <View style={{ position: 'absolute', right: insets.right + 24, top: '50%', marginTop: 44, width: 120, marginRight: -24, alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 12, textAlign: 'center', backgroundColor: '#000A', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3 }}>
            GPS 잡는 중 ±{Math.round(rec.accuracy ?? 0)}m{'\n'}최대 {rec.readyWaitLeft}초
          </Text>
        </View>
      )}

      <Pressable onPress={onPress} disabled={!rec.canRecord && !rec.recording}
        // 가로로 쥐었을 때 오른손 엄지 자리 — 우측 중앙
        style={{ position: 'absolute', right: insets.right + 24, top: '50%', marginTop: -36, width: 72, height: 72, borderRadius: 36, borderWidth: 4, borderColor: '#fff',
                 backgroundColor: rec.recording ? StatusColor.rejected : 'transparent', opacity: rec.canRecord || rec.recording ? 1 : 0.4 }} />

      {confirming && (
        <ConfirmSheet
          onSave={async () => { await rec.finish(confirming, true, Number(steps) || undefined); setConfirming(null); setLeaving(true); }}
          onRetake={async () => { await rec.finish(confirming, false); setConfirming(null); }}
          onDiscard={async () => { await rec.finish(confirming, false); setConfirming(null); setLeaving(true); }}
        />
      )}

      {/* [실험용] 거리 정확도 검증 — 직접 센 걸음 수를 궤적에 같이 저장한다. 시트는 키보드에 가려지므로 위에 띄운다. */}
      {__DEV__ && confirming && (
        <View style={{ position: 'absolute', top, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 }}>
          <Text>[실험] 걸음 수</Text>
          <TextInput value={steps} onChangeText={t => setSteps(t.replace(/[^0-9]/g, ''))} placeholder="예: 140"
            keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric'} returnKeyType="done"
            style={{ minWidth: 80, borderBottomWidth: 1, borderColor: '#999', paddingVertical: 4, fontSize: 16 }} />
        </View>
      )}
    </View>
  );
}

function ConfirmSheet({ onSave, onRetake, onDiscard }: Record<string, () => void>) {
  return (
    <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#fff', padding: 20, borderTopLeftRadius: 16, borderTopRightRadius: 16, gap: 8 }}>
      {/* 시트가 떠 있는 동안에도 궤적은 계속 쌓인다(거리 로직은 그대로 둔다). 걸으면 거리가 늘어나므로 멈춰 세운다. */}
      <Text style={{ fontSize: 20, fontWeight: '700', color: Color.danger, textAlign: 'center' }}>그 자리에 멈춰 서 주세요</Text>
      <Text style={{ fontSize: 13, color: Color.textMuted, marginBottom: 4, textAlign: 'center' }}>저장이나 폐기를 누를 때까지 걷지 마세요</Text>
      <Text style={{ fontSize: 16, marginBottom: 8, textAlign: 'center' }}>촬영을 마칠까요?</Text>
      <Pressable onPress={onSave}><Text style={{ padding: 12, textAlign: 'center' }}>저장</Text></Pressable>
      <Pressable onPress={onRetake}><Text style={{ padding: 12, textAlign: 'center' }}>다시 찍기</Text></Pressable>
      <Pressable onPress={onDiscard}><Text style={{ padding: 12, textAlign: 'center', color: StatusColor.rejected }}>폐기</Text></Pressable>
    </View>
  );
}

const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
