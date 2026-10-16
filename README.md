# 資產記帳

個人記帳與資產追蹤 web app。液態玻璃（導覽層）＋ 極簡（內容層）設計，支援深色模式。

- **資產趨勢**：淨資產依日／月／年檢視，可切換「淨值＋每期變化」或「各類別堆疊」
- **資產類別**：現金、存款、股票、基金、期貨、加密貨幣、不動產、保險；負債含房貸、信貸、車貸、學貸、信用卡等
- **台灣金融機構**：內建銀行（含銀行代碼）、證券商、期貨商、投信、保險公司
- **即時報價**：台股／美股（鉅亨網，TradingView 備援）、加密貨幣（Binance），免 API key，含快取與 throttle
- **貸款攤還**：本息平均攤還推算每月應繳與剩餘本金
- **資料只存在瀏覽器**（IndexedDB），可匯出／匯入 JSON 備份

## 開發

```bash
npm install
npm run dev
```

## 技術

Vite · React 19 · TypeScript · Tailwind CSS 4 · Dexie (IndexedDB) · ECharts · React Router（HashRouter）

## 部署

push 到 `main` 後由 GitHub Actions 建置並部署到 GitHub Pages（`.github/workflows/deploy.yml`）。
第一次需要在 repo 的 **Settings → Pages → Source** 選擇 **GitHub Actions**。

## 專案結構

```
src/
  db/          Dexie schema、型別、預設機構與分類
  domain/      資產類別定義、估值、趨勢彙整、貸款攤還
  services/    報價（providers + 快取／throttle）、匯率
  hooks/       usePortfolio、useMarketData、useChartColors
  components/  AppShell（玻璃導覽）、Segmented、EChart
  pages/       總覽、帳戶、記帳、設定
  theme/       主題（系統／淺色／深色）與漲跌色
```

## 注意

報價端點皆非官方 API，可能延遲或改版，僅供個人參考。
