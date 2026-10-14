import type { ReactNode } from "react";
import AdminNavigation from "@/components/AdminNavigation";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="admin-workspace">
      <AdminNavigation />
      <div className="admin-content">{children}</div>
    </div>
  );
}
