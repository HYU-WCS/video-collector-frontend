import { useSyncExternalStore } from 'react';

// 로그인 여부는 App(네비게이션 분기)과 로그인·가입 화면이 같이 봐야 한다.
// useAuth는 화면마다 따로 생기는 훅이라, 이 값만 모듈 하나에 두고 구독한다.
let signedIn = false;
const listeners = new Set<() => void>();

export function setSignedIn(v: boolean) {
  signedIn = v;
  listeners.forEach(l => l());
}

export function useSignedIn() {
  return useSyncExternalStore(
    l => { listeners.add(l); return () => { listeners.delete(l); }; },
    () => signedIn,
  );
}
