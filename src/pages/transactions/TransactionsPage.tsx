import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { EmptyState, PageHeader } from '../../components/ui';
import { db } from '../../db/db';
import type { Transaction } from '../../db/types';
import { parseDate } from '../../lib/date';
import { fmtMoney } from '../../lib/format';

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

export function TransactionsPage() {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const prefix = `${month.y}-${String(month.m + 1).padStart(2, '0')}`;

  const txns = useLiveQuery(
    () => db.transactions.where('date').between(`${prefix}-01`, `${prefix}-31`, true, true).reverse().sortBy('date'),
    [prefix],
  );
  const categories = useLiveQuery(() => db.categories.toArray(), []);
  const accounts = useLiveQuery(() => db.accounts.toArray(), []);

  const catMap = useMemo(() => new Map((categories ?? []).map((c) => [c.id!, c.name])), [categories]);
  const accMap = useMemo(() => new Map((accounts ?? []).map((a) => [a.id!, a.name])), [accounts]);

  const totals = useMemo(() => {
    const t = { expense: 0, income: 0, byCat: new Map<string, number>() };
    for (const x of txns ?? []) {
      t[x.kind] += x.amount;
      if (x.kind === 'expense') {
        const name = catMap.get(x.categoryId ?? -1) ?? '未分類';
        t.byCat.set(name, (t.byCat.get(name) ?? 0) + x.amount);
      }
    }
    return t;
  }, [txns, catMap]);

  const byDay = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const x of txns ?? []) map.set(x.date, [...(map.get(x.date) ?? []), x]);
    return [...map.entries()];
  }, [txns]);

  const shift = (n: number) =>
    setMonth(({ y, m }) => {
      const d = new Date(y, m + n, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });

  const topCats = [...totals.byCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);

  return (
    <>
      <PageHeader
        title="記帳"
        actions={
          <Link to="/transactions/new" className="btn btn-primary">
            <Plus size={16} /> 記一筆
          </Link>
        }
      />

      <div className="mb-4 flex items-center justify-center gap-2">
        <button className="btn size-9 p-0" onClick={() => shift(-1)} aria-label="上個月">
          <ChevronLeft size={16} />
        </button>
        <span className="num w-28 text-center font-medium">
          {month.y} 年 {month.m + 1} 月
        </span>
        <button className="btn size-9 p-0" onClick={() => shift(1)} aria-label="下個月">
          <ChevronRight size={16} />
        </button>
      </div>

      <section className="card mb-4 p-5">
        <div className="grid grid-cols-3 gap-3 text-center">
          <Sum label="支出" value={totals.expense} />
          <Sum label="收入" value={totals.income} />
          <Sum label="結餘" value={totals.income - totals.expense} />
        </div>
        {topCats.length > 0 && (
          <div className="mt-5 space-y-2 border-t border-line pt-4">
            {topCats.map(([name, v]) => (
              <div key={name} className="flex items-center gap-3 text-sm">
                <span className="w-16 shrink-0 text-fg-2">{name}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-line">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${(v / totals.expense) * 100}%` }} />
                </div>
                <span className="num w-20 text-right">{fmtMoney(v)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {byDay.length === 0 ? (
        <EmptyState title="這個月還沒有紀錄" body="點「記一筆」開始記帳。" />
      ) : (
        <div className="space-y-3">
          {byDay.map(([date, items]) => {
            const d = parseDate(date);
            const dayExpense = items.filter((x) => x.kind === 'expense').reduce((s, x) => s + x.amount, 0);
            return (
              <section key={date} className="card overflow-hidden">
                <div className="flex justify-between border-b border-line px-5 py-2.5 text-xs text-fg-2">
                  <span>
                    {d.getMonth() + 1}/{d.getDate()}（{WEEKDAYS[d.getDay()]}）
                  </span>
                  {dayExpense > 0 && <span className="num">支出 {fmtMoney(dayExpense)}</span>}
                </div>
                <ul className="divide-y divide-line">
                  {items.map((x) => (
                    <li key={x.id} className="group flex items-center gap-3 px-5 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-[15px]">{catMap.get(x.categoryId ?? -1) ?? '未分類'}</div>
                        <div className="truncate text-xs text-fg-3">{[x.note, accMap.get(x.accountId ?? -1)].filter(Boolean).join(' · ')}</div>
                      </div>
                      <span className={`num font-medium ${x.kind === 'income' ? 'text-accent' : ''}`}>
                        {x.kind === 'income' ? '+' : '-'}
                        {fmtMoney(x.amount)}
                      </span>
                      <button
                        onClick={() => db.transactions.delete(x.id!)}
                        className="text-fg-3 transition-opacity hover:text-danger pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100"
                        aria-label="刪除"
                      >
                        <X size={15} />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}

function Sum({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-xs text-fg-3">{label}</div>
      <div className="num mt-1 text-lg font-semibold">{fmtMoney(value)}</div>
    </div>
  );
}
