import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { Segmented } from '../../components/Segmented';
import { Field } from '../../components/ui';
import { db } from '../../db/db';
import type { TxnKind } from '../../db/types';
import { todayStr } from '../../lib/date';

/** 可以拿來付款／收款的帳戶類別 */
const PAYABLE = new Set(['cash', 'deposit', 'creditCard']);

export function TransactionForm() {
  const navigate = useNavigate();
  const categories = useLiveQuery(() => db.categories.orderBy('id').toArray(), []);
  const accounts = useLiveQuery(() => db.accounts.where('archived').equals(0).toArray(), []);

  const [kind, setKind] = useState<TxnKind>('expense');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState<number>();
  const [date, setDate] = useState(todayStr());
  const [accountId, setAccountId] = useState<number | ''>('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const cats = (categories ?? []).filter((c) => c.kind === kind).sort((a, b) => a.order - b.order);
  const payable = (accounts ?? []).filter((a) => PAYABLE.has(a.assetClass));

  async function submit(e: FormEvent, again = false) {
    e.preventDefault();
    const n = Number(amount);
    if (!(n > 0)) {
      setError('請輸入金額');
      return;
    }
    await db.transactions.add({
      date,
      kind,
      amount: n,
      categoryId: categoryId ?? cats[0]?.id,
      accountId: accountId === '' ? undefined : accountId,
      note: note.trim() || undefined,
      createdAt: Date.now(),
    });
    if (again) {
      setAmount('');
      setNote('');
    } else {
      navigate('/transactions');
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-lg">
      <Link to="/transactions" className="mb-3 inline-flex items-center gap-1 text-sm text-fg-2 hover:text-fg">
        <ArrowLeft size={16} /> 返回
      </Link>

      <div className="card space-y-5 p-5 md:p-6">
        <div className="flex justify-center">
          <Segmented
            ariaLabel="收支"
            value={kind}
            onChange={(k) => {
              setKind(k);
              setCategoryId(undefined);
            }}
            options={[
              { value: 'expense', label: '支出' },
              { value: 'income', label: '收入' },
            ]}
          />
        </div>

        <div className="text-center">
          <input
            autoFocus
            className="num w-full bg-transparent text-center text-5xl font-semibold tracking-tight outline-none placeholder:text-fg-3"
            inputMode="decimal"
            placeholder="0"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setError('');
            }}
            aria-label="金額"
          />
          {error && <p className="mt-2 text-sm text-danger">{error}</p>}
        </div>

        <div>
          <span className="label">分類</span>
          <div className="flex flex-wrap gap-2">
            {cats.map((c) => (
              <button type="button" key={c.id} className="chip" data-active={(categoryId ?? cats[0]?.id) === c.id} onClick={() => setCategoryId(c.id)}>
                {c.name}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="日期">
            <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="帳戶（選填）">
            <select className="input" value={accountId} onChange={(e) => setAccountId(e.target.value ? Number(e.target.value) : '')}>
              <option value="">不指定</option>
              {payable.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="備註">
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="午餐、加油" />
        </Field>

        <div className="flex gap-2">
          <button type="button" className="btn flex-1" onClick={(e) => submit(e, true)}>
            儲存並再記一筆
          </button>
          <button type="submit" className="btn btn-primary flex-1">
            儲存
          </button>
        </div>
      </div>
    </form>
  );
}
