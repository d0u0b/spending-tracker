import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Field, PageHeader } from '../../components/ui';
import { db } from '../../db/db';
import { INSTITUTION_TYPE_LABELS } from '../../db/seed';
import type { Account, LoanTerms } from '../../db/types';
import { ASSET_CLASS_IDS, ASSET_CLASSES, CURRENCIES, subtypeLabel, type AssetClassId } from '../../domain/assetClasses';
import { monthlyPayment, remainingPrincipal } from '../../domain/loan';
import { todayStr } from '../../lib/date';
import { fmtMoney } from '../../lib/format';

const EMPTY_LOAN = { principal: '', annualRate: '', termMonths: '', startDate: '' };

export function AccountForm() {
  const { id } = useParams();
  const editingId = id ? Number(id) : undefined;
  const navigate = useNavigate();
  const institutions = useLiveQuery(() => db.institutions.toArray(), []);
  const existing = useLiveQuery(() => (editingId ? db.accounts.get(editingId) : undefined), [editingId]);

  const [cls, setCls] = useState<AssetClassId>('deposit');
  const [subtype, setSubtype] = useState('demand');
  const [institutionId, setInstitutionId] = useState<number | ''>('');
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('TWD');
  const [balance, setBalance] = useState('');
  const [note, setNote] = useState('');
  const [loan, setLoan] = useState(EMPTY_LOAN);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!existing) return;
    setCls(existing.assetClass);
    setSubtype(existing.subtype);
    setInstitutionId(existing.institutionId ?? '');
    setName(existing.name);
    setCurrency(existing.currency);
    setNote(existing.note ?? '');
    if (existing.loan) {
      const l = existing.loan;
      setLoan({ principal: String(l.principal), annualRate: String(l.annualRate), termMonths: String(l.termMonths), startDate: l.startDate });
    }
  }, [existing]);

  const def = ASSET_CLASSES[cls];
  const instOptions = useMemo(
    () =>
      (def.institutionTypes as readonly string[]).map((type) => ({
        type,
        items: (institutions ?? []).filter((i) => i.type === type),
      })),
    [def, institutions],
  );
  const inst = institutions?.find((i) => i.id === institutionId);
  const suggestedName = [inst?.shortName, subtypeLabel(cls, subtype)].filter(Boolean).join(' ');

  const loanTerms: LoanTerms | null =
    Number(loan.principal) > 0 && Number(loan.termMonths) > 0 && loan.startDate
      ? { principal: Number(loan.principal), annualRate: Number(loan.annualRate) || 0, termMonths: Number(loan.termMonths), startDate: loan.startDate }
      : null;

  function pickClass(next: AssetClassId) {
    setCls(next);
    setSubtype(Object.keys(ASSET_CLASSES[next].subtypes)[0]);
    setInstitutionId('');
    setError('');
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (def.mode === 'balance' && !editingId && balance !== '' && !Number.isFinite(Number(balance))) {
      setError('請輸入有效的金額');
      return;
    }
    const data: Omit<Account, 'id' | 'createdAt' | 'archived'> = {
      name: name.trim() || suggestedName || def.label,
      assetClass: cls,
      subtype,
      institutionId: institutionId === '' ? undefined : institutionId,
      currency: def.mode === 'holdings' ? 'TWD' : currency,
      note: note.trim() || undefined,
      loan: cls === 'loan' && loanTerms ? loanTerms : undefined,
    };

    if (editingId) {
      await db.accounts.update(editingId, data);
      navigate(`/accounts/${editingId}`);
      return;
    }
    const newId = (await db.accounts.add({ ...data, archived: 0, createdAt: Date.now() })) as number;
    if (def.mode === 'balance' && balance !== '') {
      await db.balances.add({ accountId: newId, date: todayStr(), amount: Number(balance) });
    }
    navigate(`/accounts/${newId}`, { replace: true });
  }

  if (!institutions || (editingId && !existing)) return null;

  return (
    <form onSubmit={submit} className="mx-auto max-w-2xl">
      <Link to={editingId ? `/accounts/${editingId}` : '/accounts'} className="mb-3 inline-flex items-center gap-1 text-sm text-fg-2 hover:text-fg">
        <ArrowLeft size={16} /> 返回
      </Link>
      <PageHeader title={editingId ? '編輯帳戶' : '新增帳戶'} />

      <div className="card space-y-6 p-5 md:p-6">
        {(['asset', 'liability'] as const).map((side) => (
          <div key={side}>
            <span className="label">{side === 'asset' ? '資產類別' : '負債類別'}</span>
            <div className="flex flex-wrap gap-2">
              {ASSET_CLASS_IDS.filter((c) => ASSET_CLASSES[c].side === side).map((c) => (
                <button type="button" key={c} className="chip" data-active={c === cls} onClick={() => pickClass(c)} disabled={!!editingId && c !== cls}>
                  {ASSET_CLASSES[c].label}
                </button>
              ))}
            </div>
          </div>
        ))}

        <div>
          <span className="label">細項</span>
          <div className="flex flex-wrap gap-2">
            {Object.entries(def.subtypes).map(([k, label]) => (
              <button type="button" key={k} className="chip" data-active={k === subtype} onClick={() => setSubtype(k)}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {instOptions.length > 0 && (
            <Field label="金融機構">
              <select className="input" value={institutionId} onChange={(e) => setInstitutionId(e.target.value ? Number(e.target.value) : '')}>
                <option value="">不指定</option>
                {instOptions.map((g) => (
                  <optgroup key={g.type} label={INSTITUTION_TYPE_LABELS[g.type as keyof typeof INSTITUTION_TYPE_LABELS]}>
                    {g.items.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.code ? `${i.code} ` : ''}
                        {i.shortName}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </Field>
          )}
          <Field label="帳戶名稱">
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={suggestedName || def.label} />
          </Field>
          {def.mode === 'balance' && (
            <Field label="幣別">
              <select className="input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {CURRENCIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
          )}
          {def.mode === 'balance' && !editingId && (
            <Field label={def.side === 'liability' ? '目前欠款' : '目前餘額'} hint={def.side === 'liability' ? '填正數，代表還欠多少' : undefined}>
              <input
                className="input num"
                inputMode="decimal"
                value={balance}
                onChange={(e) => {
                  setBalance(e.target.value);
                  setError('');
                }}
                placeholder="0"
              />
            </Field>
          )}
        </div>

        {def.mode === 'holdings' && !editingId && <p className="text-sm text-fg-2">建立後可在帳戶頁面新增持股，市值會依即時報價計算。</p>}

        {cls === 'loan' && (
          <div className="rounded-2xl border border-line p-4">
            <p className="mb-3 text-sm font-medium">貸款條件（選填，用來推算剩餘本金）</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="原始本金">
                <input className="input num" inputMode="decimal" value={loan.principal} onChange={(e) => setLoan({ ...loan, principal: e.target.value })} />
              </Field>
              <Field label="年利率 (%)">
                <input className="input num" inputMode="decimal" value={loan.annualRate} onChange={(e) => setLoan({ ...loan, annualRate: e.target.value })} placeholder="2.185" />
              </Field>
              <Field label="期數（月）">
                <input className="input num" inputMode="numeric" value={loan.termMonths} onChange={(e) => setLoan({ ...loan, termMonths: e.target.value })} placeholder="360" />
              </Field>
              <Field label="撥款日">
                <input className="input" type="date" value={loan.startDate} onChange={(e) => setLoan({ ...loan, startDate: e.target.value })} />
              </Field>
            </div>
            {loanTerms && (
              <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                <span>
                  每月應繳 <b className="num">{fmtMoney(monthlyPayment(loanTerms))}</b>
                </span>
                <span>
                  推算剩餘本金 <b className="num">{fmtMoney(remainingPrincipal(loanTerms))}</b>
                </span>
                {!editingId && (
                  <button type="button" className="text-accent" onClick={() => setBalance(String(Math.round(remainingPrincipal(loanTerms))))}>
                    帶入目前欠款
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        <Field label="備註">
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="帳號末四碼、用途等" />
        </Field>

        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="submit" className="btn btn-primary">
            {editingId ? '儲存' : '建立帳戶'}
          </button>
        </div>
      </div>
    </form>
  );
}
