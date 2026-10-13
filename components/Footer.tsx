import Link from "next/link";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer-root">
      <div className="app-container footer-inner">
        <div className="footer-top">
          <div className="footer-brand">
            <div className="brand-group" style={{ pointerEvents: "none" }}>
              <div className="brand-icon">T</div>
              <div className="brand-text">
                <span className="brand-title">
                  TMD<span>•</span>WAR
                </span>
                <span className="brand-sub">AUCTION HOUSE</span>
              </div>
            </div>
            <p>
              Platform lelang online kurasi barang pilihan dengan transparansi harga dan keamanan penawaran berbasis database row-level lock.
            </p>
          </div>

          <div className="footer-links">
            <Link href="/" className="footer-link">Beranda</Link>
            <Link href="/#katalog" className="footer-link">Katalog</Link>
            <Link href="/#panduan" className="footer-link">Cara Kerja</Link>
            <Link href="/akun" className="footer-link">Akun</Link>
            <Link href="/login" className="footer-link">Masuk</Link>
          </div>
        </div>

        <div className="footer-bottom">
          <div>
            © {currentYear} TMD-WAR. Hak cipta dilindungi. Versi Starter MVP.
          </div>
          <div style={{ color: "var(--text-muted)" }}>
            Integrasi pembayaran otomatis dan escrow akan hadir pada rilis berikutnya.
          </div>
        </div>
      </div>
    </footer>
  );
}
