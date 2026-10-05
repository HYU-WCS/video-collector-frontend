import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, setRefreshToken } from '@/models/api';
import { clearToken, loadToken, saveToken } from '@/models/storage';
import { setSignedIn } from './session';
import type { User } from '@/models/types';

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

  // 서버 에러(ApiError)는 한국어 message를 그대로 보여준다. fetch 자체가 실패하면 영어 TypeError라 바꿔 쓴다.
  const enter = useCallback(async (call: () => Promise<{ refresh_token: string; user: User }>) => {
    setBusy(true); setError(null);
    try {
      const res = await call();
      await saveToken(res.refresh_token);
      setUser(res.user);
      setSignedIn(true);
      return true;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '서버에 연결할 수 없습니다');
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const login = useCallback((username: string, password: string) =>
    enter(() => source.login(username.trim(), password)), [enter]);

  // 서버 422는 "입력 형식이 올바르지 않습니다"뿐이라 무엇이 틀렸는지 모른다. 서버 규칙(Register 스키마)을 먼저 검사한다.
  const signup = useCallback((username: string, password: string, confirm: string) => {
    const u = username.trim();
    const invalid =
      !/^[A-Za-z0-9._-]{3,100}$/.test(u) ? '아이디는 영문·숫자·. _ - 로 3자 이상입니다'
      : password.length < 12 ? '비밀번호는 12자 이상입니다'
      : password !== confirm ? '비밀번호가 서로 다릅니다'
      : null;
    if (invalid) { setError(invalid); return Promise.resolve(false); }
    return enter(() => source.register(u, password));
  }, [enter]);

  // 서버에 refresh 토큰 폐기를 요청한다. 오프라인이라 실패해도 폰에서는 로그아웃된다 (api.logout이 에러를 삼킴).
  const logout = useCallback(async () => {
    setBusy(true);
    await source.logout();
    await clearToken();
    setUser(null);
    setSignedIn(false);
  }, []);

  return { user, booting, busy, error, login, signup, logout };
}
