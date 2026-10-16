import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronRight, Plus } from 'lucide-react';
import { useEffect } from 'react';
import { Link, useLocation } from 'react-router';
import { Change, ColorDot, EmptyState, PageHeader } from '../../components/ui';
import { db } from '../../db/db';
import type { Institution } from '../../db/types';
import { ASSET_CLASS_IDS, ASSET_CLASSES, subtypeLabel, type Side } from '../../domain/assetClasses';
import type { AccountValue } from '../../domain/valuation';
import { usePortfolio } from '../../hooks/usePortfolio';
import { fmtMoney, fmtNumber } from '../../lib/format';

export function AccountsPage() {
  const { summary } = usePortfolio();
  const institutions = useLiveQuery(() => db.institutions.toArray(), []);
  const { hash } = useLocation();

  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [hash, summary?.accounts.length]);

  if (!summary || !institutions) return null;
  const instMap = new Map(institutions.map((i) => [i.id!, i]));

  const add = (
    <Link to="/accounts/new" className="btn btn-primary">
      <Plus size={16} />
      新增帳戶
    </Link>
  );

  if (!summary.accounts.length) {
    return (
      <>
        <PageHeader title="帳戶" />
        <EmptyState title="還沒有帳戶" body="存款、證券戶、基金、貸款、不動產都可以建立成帳戶來追蹤。" action={add} />
      </>
    );
  }

  return (
    <>
      <PageHeader title="帳戶" subtitle={`共 ${summary.accounts.length} 個帳戶`} actions={add} />
      <div className="space-y-8">
        <SideSection side="asset" title="資產" total={summary.assets} accounts={summary.accounts} instMap={instMap} />
        <SideSection side="liability" title="負債" total={summary.liabilities} accounts={summary.accounts} instMap={instMap} />
      </div>
    </>
  );
}

function SideSection({
  side,
  title,
  total,
  accounts,
  instMap,
}: {
  side: Side;
  title: string;
  total: number;
  accounts: AccountValue[];
  instMap: Map<number, Institution>;
}) {
  const groups = ASSET_CLASS_IDS.filter((id) => ASSET_CLASSES[id].side === side)
    .map((id) => ({ id, items: accounts.filter((a) => a.account.assetClass === id) }))
    .filter((g) => g.items.length);
  if (!groups.length) return null;

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between px-1">
        <h2 className="text-sm font-medium text-fg-2">{title}</h2>
        <span className="num text-sm text-fg-2">{fmtMoney(total)}</span>
      </div>
      <div className="space-y-3">
        {groups.map(({ id, items }) => {
          const def = ASSET_CLASSES[id];
          const sum = items.reduce((s, a) => s + a.value, 0);
          return (
            <div key={id} id={id} className="card scroll-mt-24 overflow-hidden">
              <div className="flex items-center gap-2 border-b border-line px-5 py-3">
                <ColorDot color={def.color} />
                <span className="flex-1 font-medium">{def.label}</span>
                <span className="num font-medium">{fmtMoney(sum)}</span>
              </div>
              <ul className="divide-y divide-line">
                {items.map((av) => (
                  <AccountRow key={av.account.id} av={av} inst={instMap.get(av.account.institutionId ?? -1)} />
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function AccountRow({ av, inst }: { av: AccountValue; inst?: Institution }) {
  const { account } = av;
  const meta = [inst?.shortName, subtypeLabel(account.assetClass, account.subtype)].filter(Boolean).join(' · ');
  const dayChange = av.holdings?.reduce((s, h) => s + h.dayChange, 0);

  return (
    <li>
      <Link to={`/accounts/${account.id}`} className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-surface-hover">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px]">{account.name}</div>
          <div className="truncate text-xs text-fg-3">{meta}</div>
        </div>
        <div className="text-right">
          <div className="num text-[15px] font-medium">{fmtMoney(av.value)}</div>
          {account.currency !== 'TWD' && av.native != null && (
            <div className="num text-xs text-fg-3">
              {account.currency} {fmtNumber(av.native)}
            </div>
          )}
          {dayChange != null && dayChange !== 0 && (
            <div className="text-xs">
              今日 <Change value={dayChange} />
            </div>
          )}
        </div>
        <ChevronRight size={16} className="text-fg-3" />
      </Link>
    </li>
  );
}
