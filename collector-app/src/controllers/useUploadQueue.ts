import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Network from 'expo-network';
import { queue, type QueueItem } from '@/models/db';
import { UPLOAD_ENABLED, processQueue, retryFailed } from '@/models/uploader';

const confirm = (title: string, message: string, ok: string) => new Promise<boolean>(resolve =>
  Alert.alert(title, message, [
    { text: '취소', style: 'cancel', onPress: () => resolve(false) },
    { text: ok, onPress: () => resolve(true) },
  ], { cancelable: true, onDismiss: () => resolve(false) }));

// 자동 업로드는 하지 않는다. 클립당 80~100MB라 수집가가 네트워크를 보고 직접 올린다 (D21).
export function useUploadQueue() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [pending, setPending] = useState(0);
  const [uploading, setUploading] = useState(false);

  const refresh = useCallback(async () => {
    setItems(await queue.list());
    setPending(await queue.pendingCount());
  }, []);

  /** Wi-Fi면 바로, 모바일 데이터면 용량을 보여주고 확인받은 뒤 올린다 */
  const uploadNow = useCallback(async () => {
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
    setUploading(true);
    try {
      await processQueue(() => void refresh());
    } finally {
      setUploading(false);
      await refresh();
    }
  }, [refresh]);

  // 예전엔 상태만 되돌리고 자동 업로드에 맡겼다. 이제 자동이 없으니 바로 올린다
  const retry = useCallback(async () => {
    await retryFailed();
    await uploadNow();
  }, [uploadNow]);

  useEffect(() => { void refresh(); }, [refresh]);

  return { items, pending, uploading, refresh, uploadNow, retry };
}
