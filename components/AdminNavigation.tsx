"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/admin/dashboard", label: "Dashboard", icon: "▦", exact: true },
  { href: "/admin/auction", label: "Buat lelang", icon: "+", exact: true },
  { href: "/admin/finance", label: "Keuangan", icon: "↗", exact: false },
];

export default function AdminNavigation() {
  const pathname = usePathname();

  return (
    <div className="admin-nav-wrap">
      <div className="admin-nav-inner">
        <div className="admin-nav-heading">
          <span className="admin-nav-mark" aria-hidden="true">T</span>
          <div>
            <div className="admin-nav-title">Workspace Admin</div>
            <div className="admin-nav-caption">TMD-WAR · OPERATIONS</div>
          </div>
        </div>
        <nav className="admin-nav-links" aria-label="Navigasi panel admin">
          {items.map((item) => {
            const active = item.exact
              ? pathname === item.href || (item.href === "/admin/auction" && pathname.startsWith("/admin/auction/"))
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`admin-nav-link ${active ? "is-active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                <span className="admin-nav-icon" aria-hidden="true">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <Link href="/" className="admin-nav-store">
          <span aria-hidden="true">↗</span> Lihat toko
        </Link>
      </div>
    </div>
  );
}
