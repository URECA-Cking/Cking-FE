import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const STORAGE_KEY = 'cking.demoUser';
const UserContext = createContext(null);

function readStoredUser() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
}

// 실제 인증/세션 시스템이 아직 없는 백엔드 상황에 맞춘 임시 "데모 사용자" 컨텍스트.
// GET /api/users로 받아온 가상 사용자 중 하나를 선택해 localStorage에 유지하고,
// 이후 모든 API 호출에 userId로 실어 보낸다.
export function UserProvider({ children }) {
  const [user, setUser] = useState(() => readStoredUser());

  const selectUser = useCallback((nextUser) => {
    setUser(nextUser);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextUser));
    } catch {
      // localStorage 사용 불가 환경에서도 앱은 계속 동작해야 하므로 무시한다.
    }
  }, []);

  const clearUser = useCallback(() => {
    setUser(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  const value = useMemo(() => ({ user, selectUser, clearUser }), [user, selectUser, clearUser]);

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) {
    throw new Error('useUser는 UserProvider 내부에서만 사용할 수 있습니다.');
  }
  return ctx;
}
