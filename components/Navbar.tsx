"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export interface NavUser {
  id: string;
  email?: string;
  displayName?: string;
  role?: string;
}

interface NavbarProps {
  user: NavUser | null;
}

export function Navbar({ user }: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  const closeDrawer = () => setMobileOpen(false);

  return (
    <header className="navbar-root">
      <div className="app-container navbar-inner">
        {/* Brand */}
        <Link href="/" className="brand-group" onClick={closeDrawer} aria-label="TMD-WAR Beranda">
          <div className="brand-icon">T</div>
          <div className="brand-text">
            <span className="brand-title">
              TMD<span>•</span>WAR
            </span>
            <span className="brand-sub">AUCTION HOUSE</span>
          </div>
        </Link>

        {/* Desktop Links */}
        <nav className="nav-links" aria-label="Navigasi Utama">
          <Link
            href="/"
            className={`nav-link ${pathname === "/" ? "active" : ""}`}
          >
            Beranda
          </Link>
          <Link
            href="/#katalog"
            className="nav-link"
          >
            Katalog Lelang
          </Link>
          <Link
            href="/#panduan"
            className="nav-link"
          >
            Cara Kerja
          </Link>
          {user && (
            <Link
              href="/akun"
              className={`nav-link ${pathname === "/akun" ? "active" : ""}`}
            >
              Akun Saya
            </Link>
          )}
        </nav>

        {/* Desktop Actions */}
        <div className="nav-actions">
          {user ? (
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Link
                href="/akun"
                className="btn-secondary"
                style={{ padding: "8px 14px", fontSize: 12 }}
              >
                <span style={{ maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {user.displayName || user.email || "Peserta"}
                </span>
                {user.role === "admin" && (
                  <span style={{ fontSize: 9, padding: "2px 5px", background: "var(--gold)", color: "var(--text-inverse)", borderRadius: 3, fontWeight: 800 }}>
                    ADMIN
                  </span>
                )}
              </Link>
              <form action="/auth/signout" method="post" style={{ margin: 0 }}>
                <button
                  type="submit"
                  className="btn-secondary"
                  style={{ padding: "8px 12px", fontSize: 12 }}
                  aria-label="Keluar dari akun"
                >
                  Keluar
                </button>
              </form>
            </div>
          ) : (
            <Link
              href="/login"
              className="btn-primary"
            >
              Masuk / Daftar
            </Link>
          )}

          {/* Mobile Toggle Button */}
          <button
            type="button"
            className="mobile-nav-toggle"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label={mobileOpen ? "Tutup Menu" : "Buka Menu"}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="6" x2="20" y2="6" />
                <line x1="4" y1="18" x2="20" y2="18" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="mobile-drawer" role="dialog" aria-modal="true" aria-label="Menu Navigasi Mobile">
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Link
                href="/"
                onClick={closeDrawer}
                className="nav-link"
                style={{ fontSize: 16, padding: "8px 0" }}
              >
                Beranda
              </Link>
              <Link
                href="/#katalog"
                onClick={closeDrawer}
                className="nav-link"
                style={{ fontSize: 16, padding: "8px 0" }}
              >
                Katalog Lelang
              </Link>
              <Link
                href="/#panduan"
                onClick={closeDrawer}
                className="nav-link"
                style={{ fontSize: 16, padding: "8px 0" }}
              >
                Cara Kerja
              </Link>
              {user && (
                <Link
                  href="/akun"
                  onClick={closeDrawer}
                  className="nav-link"
                  style={{ fontSize: 16, padding: "8px 0" }}
                >
                  Akun Saya ({user.displayName || user.email})
                </Link>
              )}
            </div>

            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 20 }}>
              {user ? (
                <form action="/auth/signout" method="post">
                  <button
                    type="submit"
                    className="btn-secondary"
                    style={{ width: "100%", justifyContent: "center" }}
                  >
                    Keluar dari Akun
                  </button>
                </form>
              ) : (
                <Link
                  href="/login"
                  onClick={closeDrawer}
                  className="btn-primary"
                  style={{ width: "100%", justifyContent: "center" }}
                >
                  Masuk dengan Facebook
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
