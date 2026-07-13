import './admin-compact.css';
import AdminCompactController from './AdminCompactController';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin-page-shell">
      {children}
      <AdminCompactController />
    </div>
  );
}
