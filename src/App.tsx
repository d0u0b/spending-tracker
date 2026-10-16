import { HashRouter, Route, Routes } from 'react-router';
import { AppShell } from './components/AppShell';
import { GlassDefs } from './components/GlassDefs';
import { AccountDetail } from './pages/accounts/AccountDetail';
import { AccountForm } from './pages/accounts/AccountForm';
import { AccountsPage } from './pages/accounts/AccountsPage';
import { Dashboard } from './pages/dashboard/Dashboard';
import { SettingsPage } from './pages/SettingsPage';
import { TransactionForm } from './pages/transactions/TransactionForm';
import { TransactionsPage } from './pages/transactions/TransactionsPage';

// GitHub Pages 沒有 SPA fallback，用 HashRouter 避免重新整理時 404
export function App() {
  return (
    <HashRouter>
      <GlassDefs />
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Dashboard />} />
          <Route path="accounts" element={<AccountsPage />} />
          <Route path="accounts/new" element={<AccountForm />} />
          <Route path="accounts/:id" element={<AccountDetail />} />
          <Route path="accounts/:id/edit" element={<AccountForm />} />
          <Route path="transactions" element={<TransactionsPage />} />
          <Route path="transactions/new" element={<TransactionForm />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
