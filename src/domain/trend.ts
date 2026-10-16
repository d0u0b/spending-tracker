import type { Snapshot } from '../db/types';
import { addDays, monthEnd, parseDate, todayStr } from '../lib/date';

export type Granularity = 'day' | 'month' | 'year';

export interface TrendPoint {
  /** 區間結束日 */
  date: string;
  label: string;
  snapshot: Snapshot;
  /** 與前一期的淨值差；沒有前一期資料時為 null */
  delta: number | null;
  deltaPct: number | null;
}

export const GRANULARITY_META: Record<Granularity, { label: string; compareLabel: string; periods: number }> = {
  day: { label: '日', compareLabel: '較昨日', periods: 30 },
  month: { label: '月', compareLabel: '較上月底', periods: 12 },
  year: { label: '年', compareLabel: '較去年底', periods: 10 },
};

/** 產生各期的結束日，最後一期是今天（尚未結束的期間以今天為準） */
function periodEnds(g: Granularity, count: number, today: string): string[] {
  const t = parseDate(today);
  const ends: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    if (g === 'day') ends.push(addDays(today, -i));
    else if (g === 'month') ends.push(i === 0 ? today : monthEnd(t.getFullYear(), t.getMonth() - i));
    else ends.push(i === 0 ? today : `${t.getFullYear() - i}-12-31`);
  }
  return ends;
}

function labelOf(g: Granularity, date: string): string {
  const [y, m, d] = date.split('-');
  if (g === 'day') return `${Number(m)}/${Number(d)}`;
  if (g === 'month') return `${y}/${m}`;
  return y;
}

/**
 * 把每日快照整理成日／月／年序列。
 * 某天沒有快照時沿用之前最近一筆（沒開 app 的日子資產視為不變）。
 */
export function buildTrend(snapshots: Snapshot[], g: Granularity, today = todayStr()): TrendPoint[] {
  if (!snapshots.length) return [];
  const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
  const first = sorted[0].date;

  let count = GRANULARITY_META[g].periods;
  if (g === 'year') count = Math.max(1, parseDate(today).getFullYear() - parseDate(first).getFullYear() + 1);

  // 多算一期，讓第一個點也有「較前期」的變化
  const ends = periodEnds(g, count + 1, today);

  let idx = 0;
  let current: Snapshot | undefined;
  const values = ends.map((end) => {
    while (idx < sorted.length && sorted[idx].date <= end) current = sorted[idx++];
    return current;
  });

  const points: TrendPoint[] = [];
  for (let i = 1; i < ends.length; i++) {
    const snap = values[i];
    if (!snap) continue;
    const prev = values[i - 1];
    const delta = prev ? snap.net - prev.net : null;
    points.push({
      date: ends[i],
      label: labelOf(g, ends[i]),
      snapshot: snap,
      delta,
      deltaPct: prev && delta != null && prev.net !== 0 ? (delta / Math.abs(prev.net)) * 100 : null,
    });
  }
  return points;
}
