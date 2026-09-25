import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as ScreenOrientation from 'expo-screen-orientation';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Navigation } from '@/navigation';
import { getDb } from '@/models/db';
import { clearToken, ensureDirs, loadToken, saveToken } from '@/models/storage';
import { onSessionExpired, onTokenRotated, setRefreshToken } from '@/models/api';
import { setSignedIn, useSignedIn } from '@/controllers/session';

export default function App() {
  const [ready, setReady] = useState(false);
  const signedIn = useSignedIn();

  useEffect(() => {
    // 촬영 화면만 가로, 나머지는 세로 고정 (D17). app.json은 가로를 허용해야 해서 default로 두고 여기서 잠근다.
    void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    // refresh 토큰은 갱신마다 바뀐다. 바뀐 값을 저장하고, 갱신까지 실패하면 로그인 화면으로.
    onTokenRotated(t => void (t ? saveToken(t) : clearToken()));
    onSessionExpired(() => setSignedIn(false));
    (async () => {
      await Promise.all([getDb(), ensureDirs()]);
      const t = await loadToken();
      if (t) { setRefreshToken(t); setSignedIn(true); }
      setReady(true);
    })();
  }, []);

  if (!ready) return null;
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Navigation signedIn={signedIn} />
    </SafeAreaProvider>
  );
}
