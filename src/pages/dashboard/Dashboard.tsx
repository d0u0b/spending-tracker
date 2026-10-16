import { useLiveQuery } from 'dexie-react-hooks';
import { RefreshCw } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { EChart } from '../../components/EChart';
import { Segmented } from '../../components/Segmented';
import { Change, ColorDot, EmptyState } from '../../components/ui';
import { db } from '../../db/db';
import { ASSET_CLASS_IDS, ASSET_CLASSES, type AssetClassId, type Side } from '../../domain/assetClasses';
import { buildTrend, GRANULARITY_META, type Granularity } from '../../domain/trend';
import { useChartColors } from '../../hooks/useChartColors';
import { usePortfolio } from '../../hooks/usePortfolio';
import { fmtMoney } from '../../lib/format';
import { loadDemoData } from '../../lib/demoData';
import { compositionOption, netWorthOption } from './trendOptions';

type View = 'net' | 'mix';

function usePersisted<T extends string>(key: string, initial: T) {
  const [v, setV] = useState<T>(() => {
    try {
      return (localStorage.getItem(key) as T) || initial;
    } catch {
      return initial;
    }
  });
  const set = (next: T) => {
    setV(next);
    try {
      localStorage.setItem(key, next);
    } catch {
      // 忽略
    }
  };
  return [v, set] as const;
}

export function Dashboard() {
  const { summary, refreshing, updatedAt, refresh } = usePortfolio();
  const snapshots = useLiveQuery(() => db.snapshots.toArray(), []);
  const [g, setG] = usePersisted<Granularity>('trend-granularity', 'month');
  const [view, setView] = usePersisted<View>('trend-view', 'net');
  const colors = useChartColors();

  const points = useMemo(() => (snapshots ? buildTrend(snapshots, g) : []), [snapshots, g]);
  const option = useMemo(
    () => (view === 'net' ? netWorthOption(points, colors) : compositionOption(points, colors)),
    [points, colors, view],
  );

  if (!summary || !snapshots) return null;

  if (!summary.accounts.length) {
    return (
      <EmptyState
        title="開始追蹤你的資產"
        body="新增存款、股票、貸款等帳戶後，這裡會顯示淨資產與每日、每月、每年的變化趨勢。資料只存在這個瀏覽器。"
        action={
          <>
            <Link to="/accounts/new" className="btn btn-primary">
              新增第一個帳戶
            </Link>
            <button className="btn" onClick={() => loadDemoData()}>
              載入範例資料
            </button>
          </>
        }
      />
    );
  }

  const meta = GRANULARITY_META[g];
  // 上一期期末（今天這一期之前的那個點）
  const prev = points.length >= 2 ? points[points.length - 2].snapshot : undefined;
  const netDelta = prev ? summary.net - prev.net : null;
  const netDeltaPct = prev && prev.net ? ((netDelta ?? 0) / Math.abs(prev.net)) * 100 : null;

  // 整個圖表區間的變化
  const first = points[0];
  const rangeBase = first ? first.snapshot.net - (first.delta ?? 0) : undefined;
  const rangeDelta = rangeBase != null ? summary.net - rangeBase : null;

  const dayChange = summary.accounts.flatMap((a) => a.holdings ?? []).reduce((s, h) => s + h.dayChange, 0);
  const hasHoldings = summary.accounts.some((a) => a.holdings?.length);

  return (
    <div className="space-y-4">
      {/* 淨資產 */}
      <section className="card p-6 md:p-8">
        <div className="flex items-center justify-between">
          <span className="text-sm text-fg-2">淨資產</span>
          <button
            onClick={refresh}
            className="flex items-center gap-1.5 text-xs text-fg-3 transition-colors hover:text-fg"
            title="重新整理報價"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            {updatedAt ? `報價 ${new Date(updatedAt).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}` : '更新報價'}
          </button>
        </div>
        <div className="num mt-1 text-4xl font-semibold tracking-tight md:text-5xl">
          <span className="mr-1 text-xl font-normal text-fg-3 md:text-2xl">NT$</span>
          {fmtMoney(summary.net)}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-fg-3">{meta.compareLabel}</span>
          <Change value={netDelta} pct={netDeltaPct} className="font-medium" />
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 border-t border-line pt-5 md:grid-cols-4">
          <Stat label="總資產" value={fmtMoney(summary.assets)} />
          <Stat label="總負債" value={fmtMoney(summary.liabilities)} />
          <Stat
            label="負債比"
            value={summary.assets ? `${((summary.liabilities / summary.assets) * 100).toFixed(1)}%` : '—'}
          />
          {hasHoldings && <Stat label="今日持股損益" value={<Change value={dayChange} />} />}
        </div>
      </section>

      {/* 趨勢 */}
      <section className="card p-4 md:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">資產趨勢</h2>
            <p className="mt-0.5 text-xs text-fg-3">
              近 {points.length} {g === 'day' ? '天' : g === 'month' ? '個月' : '年'}
              <Change value={rangeDelta} />
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Segmented
              ariaLabel="檢視"
              size="sm"
              value={view}
              onChange={setView}
              options={[
                { value: 'net', label: '淨值' },
                { value: 'mix', label: '組成' },
              ]}
            />
            <Segmented
              ariaLabel="時間單位"
              size="sm"
              value={g}
              onChange={setG}
              options={(['day', 'month', 'year'] as const).map((v) => ({ value: v, label: GRANULARITY_META[v].label }))}
            />
          </div>
        </div>
        {points.length > 1 ? (
          <EChart option={option} height={300} />
        ) : (
          <p className="py-16 text-center text-sm text-fg-3">每天開啟 app 會自動記錄一筆快照，累積兩期以上就會顯示趨勢。</p>
        )}
      </section>

      {/* 配置 */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Breakdown side="asset" title="資產配置" total={summary.assets} byClass={summary.byClass} prev={prev?.byClass} compareLabel={meta.compareLabel} />
        <Breakdown side="liability" title="負債" total={summary.liabilities} byClass={summary.byClass} prev={prev?.byClass} compareLabel={meta.compareLabel} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <div className="text-xs text-fg-3">{label}</div>
      <div className="num mt-0.5 font-medium">{value}</div>
    </div>
  );
}

function Breakdown({
  side,
  title,
  total,
  byClass,
  prev,
  compareLabel,
}: {
  side: Side;
  title: string;
  total: number;
  byClass: Partial<Record<AssetClassId, number>>;
  prev?: Partial<Record<AssetClassId, number>>;
  compareLabel: string;
}) {
  const rows = ASSET_CLASS_IDS.filter((id) => ASSET_CLASSES[id].side === side && (byClass[id] ?? 0) > 0)
    .map((id) => ({ id, value: byClass[id] ?? 0 }))
    .sort((a, b) => b.value - a.value);

  return (
    <section className="card p-5">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-semibold">{title}</h2>
        <span className="num text-sm text-fg-2">{fmtMoney(total)}</span>
      </div>

      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-fg-3">{side === 'liability' ? '沒有負債' : '尚無資產'}</p>
      ) : (
        <>
          {/* 比例條 */}
          <div className="mb-4 flex h-2.5 overflow-hidden rounded-full bg-line">
            {rows.map((r) => (
              <div key={r.id} style={{ width: `${(r.value / total) * 100}%`, background: ASSET_CLASSES[r.id].color }} />
            ))}
          </div>
          <ul className="space-y-0.5">
            {rows.map((r) => {
              const before = prev?.[r.id];
              const delta = before != null ? r.value - before : null;
              return (
                <li key={r.id}>
                  <Link
                    to={`/accounts#${r.id}`}
                    className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-surface-hover"
                  >
                    <ColorDot color={ASSET_CLASSES[r.id].color} />
                    <span className="min-w-0 flex-1 truncate text-sm whitespace-nowrap">{ASSET_CLASSES[r.id].label}</span>
                    <span className="num w-12 text-right text-xs text-fg-3">{((r.value / total) * 100).toFixed(1)}%</span>
                    <span className="num w-24 text-right text-sm font-medium">{fmtMoney(r.value)}</span>
                    <span className="hidden w-20 text-right text-xs sm:block" title={compareLabel}>
                      <Change value={delta} invert={side === 'liability'} />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
