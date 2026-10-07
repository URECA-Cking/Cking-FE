import { useCallback, useEffect, useMemo, useState } from 'react'
import ThemeContext from './themeContext.js'

// index.html의 인라인 스크립트와 같은 키를 쓴다. 그 스크립트가 첫 렌더 전에 저장된 모드를 적용해 새로고침 때 화면이 깜빡이지 않는다.
const STORAGE_KEY = 'cking.theme'

// 인라인 스크립트가 실행되지 않았거나 캐시된 옛 index.html이 열려도 저장된 값을 따르도록 저장소를 직접 읽는다.
function readStoredTheme() {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark'
  } catch {
    return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'
  }
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme)
  document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', theme)
}

/**
 * 화면 모드(다크/일반). 기본은 다크이고, 사용자가 고른 값은 localStorage에 저장해 다음 접속에도 유지한다.
 * 색은 <html data-theme>에 따라 index.css의 CSS 변수가 바뀌며 적용된다.
 */
export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(readStoredTheme)

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  // 다른 탭에서 모드를 바꾸면 이 탭도 따라 바뀐다(storage 이벤트는 값을 쓴 탭 자신에게는 오지 않는다).
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === STORAGE_KEY) setThemeState(e.newValue === 'light' ? 'light' : 'dark')
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const setTheme = useCallback((next) => {
    const value = next === 'light' ? 'light' : 'dark'
    setThemeState(value)
    try {
      localStorage.setItem(STORAGE_KEY, value)
    } catch {
      // 저장소를 쓸 수 없는 환경(사생활 보호 모드 등)에서도 이번 접속 동안은 모드가 바뀐다.
    }
  }, [])

  const toggleTheme = useCallback(() => setTheme(theme === 'dark' ? 'light' : 'dark'), [theme, setTheme])

  const value = useMemo(
    () => ({ theme, isDark: theme === 'dark', setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
