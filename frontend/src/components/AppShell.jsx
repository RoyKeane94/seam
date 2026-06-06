import { Outlet } from 'react-router-dom';
import MarketingFooter from './MarketingFooter';

export default function AppShell() {
  return (
    <div className="page-shell">
      <div className="page-shell-body">
        <Outlet />
      </div>
      <MarketingFooter />
    </div>
  );
}
