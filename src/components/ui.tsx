import type { ReactNode } from 'react';
import { fmtPct, fmtSigned, trendClass } from '../lib/format';

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-fg-2">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

/** 漲跌金額＋百分比，顏色跟隨紅漲綠跌設定；invert 用於負債（增加是壞事） */
export function Change({
  value,
  pct,
  invert = false,
  className = '',
}: {
  value: number | null;
  pct?: number | null;
  invert?: boolean;
  className?: string;
}) {
  if (value == null) return <span className={`text-fg-3 ${className}`}>—</span>;
  return (
    <span className={`num ${trendClass(invert ? -value : value)} ${className}`}>
      {fmtSigned(value)}
      {pct !== undefined && <span className="ml-1 opacity-80">({fmtPct(pct)})</span>}
    </span>
  );
}

export function ColorDot({ color }: { color: string }) {
  return <span className="inline-block size-2.5 shrink-0 rounded-full" style={{ background: color }} />;
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-14 text-center">
      <p className="text-lg font-medium">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-fg-2">{body}</p>
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-fg-3">{hint}</span>}
    </label>
  );
}
