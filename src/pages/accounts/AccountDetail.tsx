import { useLiveQuery } from 'dexie-react-hooks';
import { Archive, ArrowLeft, Pencil, Trash2, X } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { EChart } from '../../components/EChart';
import { Change, ColorDot, Field } from '../../components/ui';
import { db } from '../../db/db';
import type { Account } from '../../db/types';
import { ASSET_CLASSES, subtypeLabel } from '../../domain/assetClasses';
import { monthlyPayment, remainingPrincipal } from '../../domain/loan';
import type { AccountValue, HoldingValue } from '../../domain/valuation';
import { useChartColors, withAlpha } from '../../hooks/useChartColors';
import { usePortfolio } from '../../hooks/usePortfolio';
import { todayStr } from '../../lib/date';
import { fmtCompact, fmtMoney, fmtNumber, fmtPct } from '../../lib/format';

export function AccountDetail() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const { summary } = usePortfolio();
  const account = useLiveQuery(() => db.accounts.get(id), [id]);
  const institution = useLiveQuery(() => (account?.institutionId ? db.institutions.get(account.institutionId) : undefined), [account?.institutionId]);

  if (account === undefined || !summary) return null;
  if (!account) return <p className="text-fg-2">找不到這個帳戶。</p>;

  const def = ASSET_CLASSES[account.assetClass];
  const av = summary.accounts.find((a) => a.account.id === id);

  async function archive() {
    await db.accounts.update(id, { archived: 1 });
    navigate('/accounts');
  }

  async function remove() {
    if (!confirm(`確定刪除「${account!.name}」？此帳戶的餘額紀錄與持股會一併刪除，無法復原。`)) return;
    await db.transaction('rw', db.accounts, db.balances, db.holdings, async () => {
      await db.balances.where('accountId').equals(id).delete();
      await db.holdings.where('accountId').equals(id).delete();
      await db.accounts.delete(id);
    });
    navigate('/accounts');
  }

  return (
    <div className="space-y-4">
      <Link to={`/accounts#${account.assetClass}`} className="inline-flex items-center gap-1 text-sm text-fg-2 hover:text-fg">
        <ArrowLeft size={16} /> 帳戶
      </Link>

      <section className="card p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm text-fg-2">
              <ColorDot color={def.color} />
              {def.label} · {subtypeLabel(account.assetClass, account.subtype)}
              {institution && ` · ${institution.shortName}`}
            </div>
            <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight">{account.name}</h1>
          </div>
          <div className="flex shrink-0 gap-1">
            <Link to={`/accounts/${id}/edit`} className="btn size-10 p-0" aria-label="編輯">
              <Pencil size={16} />
            </Link>
            <button className="btn size-10 p-0" onClick={archive} aria-label="封存" title="封存（不再計入總額）">
              <Archive size={16} />
            </button>
            <button className="btn btn-danger size-10 p-0" onClick={remove} aria-label="刪除">
              <Trash2 size={16} />
            </button>
          </div>
        </div>
        <div className="num mt-4 text-4xl font-semibold tracking-tight">
          <span className="mr-1 text-lg font-normal text-fg-3">NT$</span>
          {fmtMoney(av?.value ?? 0)}
        </div>
        {account.currency !== 'TWD' && av?.native != null && (
          <div className="num mt-1 text-sm text-fg-2">
            {account.currency} {fmtNumber(av.native)}
          </div>
        )}
        {account.note && <p className="mt-3 text-sm text-fg-2">{account.note}</p>}
      </section>

      {account.loan && <LoanCard account={account} />}
      {def.mode === 'balance' ? <BalanceSection account={account} /> : <HoldingsSection account={account} av={av} />}
    </div>
  );
}

function LoanCard({ account }: { account: Account }) {
  const loan = account.loan!;
  const remaining = remainingPrincipal(loan);
  const paidPct = ((loan.principal - remaining) / loan.principal) * 100;

  async function applySchedule() {
    await db.balances.add({ accountId: account.id!, date: todayStr(), amount: Math.round(remaining) });
  }

  return (
    <section className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">貸款資訊</h2>
        <button className="btn h-8 px-3 text-xs" onClick={applySchedule}>
          以攤還表更新餘額
        </button>
      </div>
      <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
        <Info label="原始本金" value={fmtMoney(loan.principal)} />
        <Info label="年利率" value={`${loan.annualRate}%`} />
        <Info label="每月應繳" value={fmtMoney(monthlyPayment(loan))} />
        <Info label="期數" value={`${loan.termMonths} 個月`} />
      </div>
      <div className="mt-4">
        <div className="mb-1 flex justify-between text-xs text-fg-2">
          <span>已還 {paidPct.toFixed(1)}%</span>
          <span className="num">推算剩餘 {fmtMoney(remaining)}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-line">
          <div className="h-full rounded-full bg-accent" style={{ width: `${paidPct}%` }} />
        </div>
      </div>
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-fg-3">{label}</div>
      <div className="num mt-0.5 font-medium">{value}</div>
    </div>
  );
}

function BalanceSection({ account }: { account: Account }) {
  const entries = useLiveQuery(() => db.balances.where('accountId').equals(account.id!).sortBy('date'), [account.id]);
  const [date, setDate] = useState(todayStr());
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const colors = useChartColors();
  const isLiability = ASSET_CLASSES[account.assetClass].side === 'liability';

  const option = useMemo(() => {
    if (!entries || entries.length < 2) return null;
    return {
      grid: { left: 4, right: 8, top: 10, bottom: 4 },
      tooltip: { trigger: 'axis', valueFormatter: (v: number) => fmtMoney(v) },
      xAxis: { type: 'time', axisLabel: { color: colors.text3, fontSize: 11 }, axisLine: { lineStyle: { color: colors.line } } },
      yAxis: { type: 'value', scale: true, axisLabel: { color: colors.text3, fontSize: 11, formatter: fmtCompact }, splitLine: { lineStyle: { color: colors.line, type: 'dashed' } } },
      series: [
        {
          type: 'line',
          step: 'end',
          data: entries.map((e) => [e.date, e.amount]),
          lineStyle: { color: colors.accent, width: 2 },
          itemStyle: { color: colors.accent },
          areaStyle: { color: withAlpha(colors.accent, 0.12) },
        },
      ],
    };
  }, [entries, colors]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const n = Number(amount);
    if (amount === '' || !Number.isFinite(n)) {
      setError('請輸入金額');
      return;
    }
    await db.balances.add({ accountId: account.id!, date, amount: n });
    setAmount('');
  }

  if (!entries) return null;
  const desc = [...entries].reverse();

  return (
    <section className="card p-5">
      <h2 className="mb-4 font-semibold">{isLiability ? '欠款紀錄' : '餘額紀錄'}</h2>
      <form onSubmit={submit} className="mb-5 flex flex-wrap items-end gap-3">
        <div className="w-40">
          <Field label="日期">
            <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} max={todayStr()} />
          </Field>
        </div>
        <div className="min-w-40 flex-1">
          <Field label={`${isLiability ? '欠款' : '餘額'}（${account.currency}）`}>
            <input
              className="input num"
              inputMode="decimal"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setError('');
              }}
            />
          </Field>
        </div>
        <button className="btn btn-primary h-11">更新</button>
        {error && <p className="w-full text-sm text-danger">{error}</p>}
      </form>

      {option && <EChart option={option} height={180} className="mb-4" />}

      <ul className="divide-y divide-line text-sm">
        {desc.map((e, i) => {
          const prev = desc[i + 1];
          return (
            <li key={e.id} className="group flex items-center gap-3 py-2.5">
              <span className="w-24 text-fg-2">{e.date}</span>
              <span className="num flex-1 text-right font-medium">{fmtNumber(e.amount)}</span>
              <span className="w-28 text-right text-xs">{prev && <Change value={e.amount - prev.amount} invert={isLiability} />}</span>
              <button onClick={() => db.balances.delete(e.id!)} className="text-fg-3 transition-opacity hover:text-danger pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100" aria-label="刪除紀錄">
                <X size={15} />
              </button>
            </li>
          );
        })}
        {!desc.length && <li className="py-6 text-center text-fg-3">尚無紀錄</li>}
      </ul>
    </section>
  );
}

const MARKETS = [
  { value: 'TW', label: '台股', placeholder: '2330' },
  { value: 'US', label: '美股', placeholder: 'AAPL' },
  { value: 'CRYPTO', label: '加密貨幣', placeholder: 'BTC' },
] as const;

function HoldingsSection({ account, av }: { account: Account; av?: AccountValue }) {
  const defaultMarket = account.assetClass === 'crypto' ? 'CRYPTO' : account.subtype === 'us' ? 'US' : 'TW';
  const [market, setMarket] = useState<string>(defaultMarket);
  const [code, setCode] = useState('');
  const [qty, setQty] = useState('');
  const [cost, setCost] = useState('');
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    const quantity = Number(qty);
    if (!code.trim()) return setError('請輸入代號');
    if (!(quantity > 0)) return setError('請輸入持有數量');
    await db.holdings.add({
      accountId: account.id!,
      symbol: `${market}:${code.trim().toUpperCase()}`,
      quantity,
      avgCost: cost === '' ? undefined : Number(cost),
    });
    setCode('');
    setQty('');
    setCost('');
    setError('');
  }

  const holdings = [...(av?.holdings ?? [])].sort((a, b) => b.value - a.value);
  const totalPnl = holdings.reduce((s, h) => s + (h.pnl ?? 0), 0);

  return (
    <section className="card p-5">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="font-semibold">持有部位</h2>
        {holdings.length > 0 && (
          <span className="text-sm">
            未實現損益 <Change value={totalPnl} />
          </span>
        )}
      </div>

      <div className="-mx-5 overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="text-xs text-fg-3">
            <tr className="border-b border-line">
              <th className="px-5 py-2 text-left font-normal">標的</th>
              <th className="px-2 py-2 text-right font-normal">數量</th>
              <th className="px-2 py-2 text-right font-normal">現價</th>
              <th className="px-2 py-2 text-right font-normal">今日</th>
              <th className="px-2 py-2 text-right font-normal">市值（台幣）</th>
              <th className="px-2 py-2 text-right font-normal">損益</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {holdings.map((h) => (
              <HoldingRow key={h.holding.id} h={h} />
            ))}
            {!holdings.length && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-fg-3">
                  尚無持股
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <form onSubmit={submit} className="mt-5 grid grid-cols-2 gap-3 border-t border-line pt-5 sm:grid-cols-[auto_1fr_1fr_1fr_auto] sm:items-end">
        <Field label="市場">
          <select className="input" value={market} onChange={(e) => setMarket(e.target.value)}>
            {MARKETS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="代號">
          <input className="input uppercase" value={code} onChange={(e) => setCode(e.target.value)} placeholder={MARKETS.find((m) => m.value === market)?.placeholder} />
        </Field>
        <Field label="數量（股）">
          <input className="input num" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} />
        </Field>
        <Field label="平均成本（選填）">
          <input className="input num" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} />
        </Field>
        <button className="btn btn-primary col-span-2 h-11 sm:col-span-1">新增</button>
        {error && <p className="col-span-full text-sm text-danger">{error}</p>}
      </form>
    </section>
  );
}

function HoldingRow({ h }: { h: HoldingValue }) {
  const { holding, quote } = h;
  const [, code] = holding.symbol.split(':');
  return (
    <tr className="group">
      <td className="px-5 py-3">
        <div className="font-medium">{code}</div>
        <div className="max-w-40 truncate text-xs text-fg-3">{quote?.name ?? holding.name ?? (quote ? '' : '尚無報價，以成本估算')}</div>
      </td>
      <td className="num px-2 text-right">{fmtNumber(holding.quantity, 4)}</td>
      <td className="num px-2 text-right">{fmtNumber(h.price)}</td>
      <td className="px-2 text-right text-xs">
        {quote ? <span className={quote.change > 0 ? 'text-up' : quote.change < 0 ? 'text-down' : 'text-fg-2'}>{fmtPct(quote.changePct)}</span> : '—'}
      </td>
      <td className="num px-2 text-right font-medium">{fmtMoney(h.value)}</td>
      <td className="px-2 text-right text-xs">{h.pnl != null ? <Change value={h.pnl} /> : '—'}</td>
      <td className="pr-3 text-right">
        <button onClick={() => db.holdings.delete(holding.id!)} className="text-fg-3 transition-opacity hover:text-danger pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100" aria-label="刪除持股">
          <X size={15} />
        </button>
      </td>
    </tr>
  );
}
