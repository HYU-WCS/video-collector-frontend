import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Alert } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Network from 'expo-network';
import { queue, type QueueItem } from '@/models/db';
import { UPLOAD_ENABLED, isUploading, onQueueChange, processQueue } from '@/models/uploader';

const confirm = (title: string, message: string, ok: string) => new Promise<boolean>(resolve =>
  Alert.alert(title, message, [
    { text: '취소', style: 'cancel', onPress: () => resolve(false) },
    { text: ok, onPress: () => resolve(true) },
  ], { cancelable: true, onDismiss: () => resolve(false) }));

// 자동 업로드는 하지 않는다. 클립당 80~100MB라 수집가가 네트워크를 보고 직접 올린다 (D21).
export function useUploadQueue() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [pending, setPending] = useState(0);
  const [uploading, setUploading] = useState(isUploading());

  const refresh = useCallback(async () => {
    setItems(await queue.list());
    setPending(await queue.pendingCount());
  }, []);

  /** Wi-Fi면 바로, 모바일 데이터면 용량을 보여주고 확인받은 뒤 올린다 */
  const uploadNow = useCallback(async (onStart?: () => void) => {
    const net = await Network.getNetworkStateAsync();
    if (!net.isConnected || net.isInternetReachable === false) {
      Alert.alert('업로드', '인터넷에 연결되어 있지 않아요');
      return;
    }
    if (net.type !== Network.NetworkStateType.WIFI) {
      const waiting = (await queue.list()).filter(i => i.status === 'queued' || i.status === 'failed');
      const sizes = await Promise.all(waiting.map(i => FileSystem.getInfoAsync(i.video_path).then(f => (f.exists ? f.size : 0))));
      const mb = Math.round(sizes.reduce((a, b) => a + b, 0) / 1e6);
      if (!(await confirm('모바일 데이터 사용', `Wi-Fi가 아니에요. 약 ${mb}MB를 씁니다. 올릴까요?`, '올리기'))) return;
    }
    if (!UPLOAD_ENABLED) {
      Alert.alert('업로드', '서버 업로드는 아직 꺼져 있어요. 테스트 계정이 정해지면 켭니다.');
      return;
    }
    onStart?.();
    await processQueue();
  }, []);

  // 실패한 것도 대기와 같이 올린다 — 서버가 받은 곳부터 이어 간다
  const retry = useCallback(() => uploadNow(), [uploadNow]);

  // 업로드는 화면과 상관없이 돈다(앱이 다시 앞으로 오면 이어 가기도 한다). 진행을 구독해서 그린다
  useEffect(() => onQueueChange(() => { setUploading(isUploading()); void refresh(); }), [refresh]);
  // 촬영은 큐 알림을 보내지 않아서, 화면으로 돌아올 때마다 다시 읽는다
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  // 이 폰에서 찍은 거리. 서버 진척도에는 거리가 없어서(2026-10-30 확인) 로컬 큐로 센다
  const distance = useMemo(() => ({
    total_m: items.reduce((s, i) => s + i.distance_m, 0),
    uploaded_m: items.reduce((s, i) => s + (i.status === 'done' ? i.distance_m : 0), 0),
  }), [items]);

  return { items, pending, uploading, distance, refresh, uploadNow, retry };
}
