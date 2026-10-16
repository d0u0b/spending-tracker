import { useSyncExternalStore } from 'react';

export type ThemeMode = 'system' | 'light' | 'dark';
export type UpDown = 'tw' | 'us';

interface ThemeState {
  mode: ThemeMode;
  resolved: 'light' | 'dark';
  updown: UpDown;
}

const media = matchMedia('(prefers-color-scheme: dark)');
const listeners = new Set<() => void>();

function read<T extends string>(key: string, fallback: T): T {
  try {
    return (localStorage.getItem(key) as T) || fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // 忽略，僅失去偏好記憶
  }
}

function resolve(mode: ThemeMode): 'light' | 'dark' {
  return mode === 'dark' || (mode === 'system' && media.matches) ? 'dark' : 'light';
}

let state: ThemeState = (() => {
  const mode = read<ThemeMode>('theme-mode', 'system');
  return { mode, resolved: resolve(mode), updown: read<UpDown>('updown', 'tw') };
})();

function apply() {
  const el = document.documentElement;
  el.dataset.theme = state.resolved;
  el.dataset.updown = state.updown;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', state.resolved === 'dark' ? '#09090d' : '#f4f4f7');
}

function emit(next: Partial<ThemeState>) {
  state = { ...state, ...next };
  apply();
  listeners.forEach((l) => l());
}

media.addEventListener('change', () => {
  if (state.mode === 'system') emit({ resolved: resolve('system') });
});

apply();

export const themeStore = {
  get: () => state,
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  setMode(mode: ThemeMode) {
    write('theme-mode', mode);
    emit({ mode, resolved: resolve(mode) });
  },
  setUpDown(updown: UpDown) {
    write('updown', updown);
    emit({ updown });
  },
};

export function useTheme() {
  return useSyncExternalStore(themeStore.subscribe, themeStore.get);
}

/** 讀取目前主題下的 CSS 變數值，給 ECharts 這類需要實際色碼的地方使用 */
export function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
