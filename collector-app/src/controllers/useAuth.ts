import { useCallback, useEffect, useState } from 'react';
import { api, setRefreshToken } from '@/models/api';
import { mockApi } from '@/models/mockApi';
import { clearToken, loadToken, saveToken } from '@/models/storage';
import { setSignedIn } from './session';
import type { User } from '@/models/types';

// 로그인은 실제 서버. 회원가입은 서버 API가 없어 아직 mock (docs/04 확인 필요 1번).
const source = api;

// 현장에서 매번 로그인하는 건 고문이다. 토큰은 SecureStore에 남기고 앱 시작 시 복원한다.
export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [booting, setBooting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const t = await loadToken();
      if (t) setRefreshToken(t);
      setBooting(false);
    })();
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    setBusy(true); setError(null);
    try {
      const res = await source.login(username.trim(), password);
      await saveToken(res.refresh_token);
      setUser(res.user);
      setSignedIn(true);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : '서버에 연결할 수 없습니다');
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const signup = useCallback(async (username: string, password: string, confirm: string) => {
    if (password !== confirm) { setError('비밀번호가 서로 다릅니다'); return false; }
    setBusy(true); setError(null);
    try {
      const res = await mockApi.signup(username.trim(), password);
      await saveToken(res.refresh_token);
      setRefreshToken(res.refresh_token);
      setUser(res.user);
      setSignedIn(true);
      return true;
    } catch {
      setError('이미 있는 아이디이거나 서버에 연결할 수 없습니다');
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await source.logout();
    await clearToken();
    setUser(null);
    setSignedIn(false);
  }, []);

  return { user, booting, busy, error, login, signup, logout };
}
