const money = new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 2 });

export function fmtMoney(n: number): string {
  return money.format(Math.round(n));
}

export function fmtNumber(n: number, digits = 2): string {
  return digits === 2 ? decimal.format(n) : n.toLocaleString('zh-TW', { maximumFractionDigits: digits });
}

export function fmtSigned(n: number): string {
  const s = fmtMoney(Math.abs(n));
  return n > 0 ? `+${s}` : n < 0 ? `-${s}` : s;
}

export function fmtPct(n: number | null | undefined, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return '—';
  const s = Math.abs(n).toFixed(digits);
  return n > 0 ? `+${s}%` : n < 0 ? `-${s}%` : `${s}%`;
}

/** 圖表軸用：12,345,678 → 1,234.6萬；2.3億 */
export function fmtCompact(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e8) return `${sign}${(abs / 1e8).toFixed(abs >= 1e9 ? 1 : 2)}億`;
  if (abs >= 1e4) return `${sign}${decimal.format(Math.round(abs / 1e3) / 10)}萬`;
  return `${sign}${money.format(abs)}`;
}

/** 依漲跌回傳 Tailwind 色彩 class（跟隨紅漲綠跌設定） */
export function trendClass(n: number | null | undefined): string {
  if (!n) return 'text-fg-2';
  return n > 0 ? 'text-up' : 'text-down';
}
