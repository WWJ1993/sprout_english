import { createClient } from '@supabase/supabase-js'

// 「记住我」决定会话落在 localStorage 还是 sessionStorage。
// 记住 → localStorage（关浏览器仍在）；不记住 → sessionStorage（关标签页即失效）。
const REMEMBER_KEY = '__wbAuthRemember'

export function setRemember(v: boolean) {
  window.localStorage.setItem(REMEMBER_KEY, v ? '1' : '0')
}

export function getRemember(): boolean {
  return window.localStorage.getItem(REMEMBER_KEY) === '1'
}

const authStorage = {
  getItem(key: string) {
    return window.localStorage.getItem(key) ?? window.sessionStorage.getItem(key)
  },
  setItem(key: string, value: string) {
    const target = getRemember() ? window.localStorage : window.sessionStorage
    target.setItem(key, value)
  },
  removeItem(key: string) {
    window.localStorage.removeItem(key)
    window.sessionStorage.removeItem(key)
  },
}

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string,
  {
    auth: {
      storage: authStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    db: { schema: 'public' },
  }
)
