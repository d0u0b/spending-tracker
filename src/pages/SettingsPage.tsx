import { useLiveQuery } from 'dexie-react-hooks';
import { useRef, useState, type ReactNode } from 'react';
import { Segmented } from '../components/Segmented';
import { PageHeader } from '../components/ui';
import { clearAll, db, exportAll, importAll } from '../db/db';
import { loadDemoData } from '../lib/demoData';
import { todayStr } from '../lib/date';
import { themeStore, useTheme, type ThemeMode, type UpDown } from '../theme/theme';

export function SettingsPage() {
  const { mode, updown } = useTheme();
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState('');
  const accountCount = useLiveQuery(() => db.accounts.count(), []);

  async function doExport() {
    const json = await exportAll();
    const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `spending-tracker-backup-${todayStr()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setStatus('已匯出備份檔');
  }

  async function doImport(file: File) {
    try {
      const json = JSON.parse(await file.text());
      if (json?.app !== 'spending-tracker' || !json.data) throw new Error('格式不符');
      if (!confirm('匯入會覆蓋目前所有資料，確定繼續？')) return;
      await importAll(json);
      setStatus('匯入完成');
    } catch (e) {
      setStatus(`匯入失敗：${(e as Error).message}`);
    }
  }

  async function doDemo() {
    if (accountCount && !confirm('載入範例資料會清除目前所有資料，確定繼續？')) return;
    setStatus('產生範例資料中…');
    await loadDemoData();
    setStatus('已載入範例資料');
  }

  async function doClear() {
    if (!confirm('確定清除所有帳戶、記帳與歷史快照？此動作無法復原，建議先匯出備份。')) return;
    await clearAll();
    setStatus('已清除所有資料');
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="設定" />
      <div className="space-y-4">
        <Group title="外觀">
          <Row label="主題">
            <Segmented<ThemeMode>
              size="sm"
              value={mode}
              onChange={themeStore.setMode}
              options={[
                { value: 'system', label: '系統' },
                { value: 'light', label: '淺色' },
                { value: 'dark', label: '深色' },
              ]}
            />
          </Row>
          <Row label="漲跌顏色" hint={updown === 'tw' ? '台灣慣例' : '國際慣例'}>
            <Segmented<UpDown>
              size="sm"
              value={updown}
              onChange={themeStore.setUpDown}
              options={[
                { value: 'tw', label: '紅漲綠跌' },
                { value: 'us', label: '綠漲紅跌' },
              ]}
            />
          </Row>
        </Group>

        <Group title="資料" note="所有資料只存在這個瀏覽器的 IndexedDB，不會上傳。清除瀏覽器網站資料就會消失，請定期匯出備份。">
          <Row label="匯出備份" hint="下載 JSON 檔">
            <button className="btn h-9" onClick={doExport}>
              匯出
            </button>
          </Row>
          <Row label="匯入備份" hint="會覆蓋目前資料">
            <button className="btn h-9" onClick={() => fileRef.current?.click()}>
              選擇檔案
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) doImport(f);
                e.target.value = '';
              }}
            />
          </Row>
          <Row label="範例資料" hint="快速體驗各項功能">
            <button className="btn h-9" onClick={doDemo}>
              載入
            </button>
          </Row>
          <Row label="清除所有資料">
            <button className="btn btn-danger h-9" onClick={doClear}>
              清除
            </button>
          </Row>
          {status && <p className="px-5 pb-4 text-sm text-accent">{status}</p>}
        </Group>

        <Group title="報價來源">
          <p className="px-5 py-4 text-sm leading-relaxed text-fg-2">
            台股與美股報價來自鉅亨網，失敗時改用 TradingView；加密貨幣來自 Binance；匯率來自 ExchangeRate-API。
            皆為免金鑰的公開端點，非官方 API，報價可能延遲，僅供個人參考。盤中每分鐘最多更新一次，收盤後使用快取。
          </p>
        </Group>
      </div>
    </div>
  );
}

function Group({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 px-1 text-sm font-medium text-fg-2">{title}</h2>
      <div className="card divide-y divide-line overflow-hidden">{children}</div>
      {note && <p className="mt-2 px-1 text-xs leading-relaxed text-fg-3">{note}</p>}
    </section>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3.5">
      <div>
        <div className="text-[15px]">{label}</div>
        {hint && <div className="text-xs text-fg-3">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
