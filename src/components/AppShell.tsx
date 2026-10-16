import { Home, Monitor, Moon, Plus, ReceiptText, Settings, Sun, Wallet } from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router';
import { themeStore, useTheme, type ThemeMode } from '../theme/theme';

const NAV = [
  { to: '/', label: '總覽', icon: Home },
  { to: '/transactions', label: '記帳', icon: ReceiptText },
  { to: '/accounts', label: '帳戶', icon: Wallet },
  { to: '/settings', label: '設定', icon: Settings },
];

const NEXT_MODE: Record<ThemeMode, ThemeMode> = { system: 'light', light: 'dark', dark: 'system' };
const MODE_ICON = { system: Monitor, light: Sun, dark: Moon };
const MODE_LABEL = { system: '跟隨系統', light: '淺色', dark: '深色' };

function ThemeButton() {
  const { mode } = useTheme();
  const Icon = MODE_ICON[mode];
  return (
    <button
      onClick={() => themeStore.setMode(NEXT_MODE[mode])}
      className="grid size-9 place-items-center rounded-full text-fg-2 transition-colors hover:text-fg"
      aria-label={`主題：${MODE_LABEL[mode]}，點擊切換`}
      title={`主題：${MODE_LABEL[mode]}`}
    >
      <Icon size={18} />
    </button>
  );
}

export function AppShell() {
  const navigate = useNavigate();

  return (
    <div className="min-h-dvh">
      {/* 桌面：底部浮動膠囊導覽 */}
      <header className="pointer-events-none fixed inset-x-0 bottom-6 z-40 hidden justify-center md:flex">
        <nav className="glass pointer-events-auto flex items-center gap-1 rounded-full p-1.5">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition-colors ${
                  isActive ? 'text-fg [background:var(--glass-active)]' : 'text-fg-2 hover:text-fg'
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
          <span className="mx-1 h-5 w-px bg-line" />
          <ThemeButton />
          <button
            onClick={() => navigate('/transactions/new')}
            className="ml-1 flex h-9 items-center gap-1 rounded-full bg-fg px-4 text-sm font-medium text-bg transition-opacity hover:opacity-85"
          >
            <Plus size={16} />
            記一筆
          </button>
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-4 pt-6 pb-32 md:px-6 md:pt-10">
        <Outlet />
      </main>

      {/* 手機：底部浮動 tab bar ＋ 新增按鈕 */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:hidden">
        <nav className="glass flex h-16 flex-1 items-center justify-around rounded-full px-1.5">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex h-13 flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-[11px] font-medium transition-colors ${
                  isActive ? 'text-fg [background:var(--glass-active)]' : 'text-fg-2'
                }`
              }
            >
              <Icon size={20} />
              {label}
            </NavLink>
          ))}
        </nav>
        <button
          onClick={() => navigate('/transactions/new')}
          className="glass grid size-16 shrink-0 place-items-center rounded-full"
          aria-label="記一筆"
        >
          <Plus size={26} />
        </button>
      </div>
    </div>
  );
}
