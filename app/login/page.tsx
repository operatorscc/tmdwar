"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { getSafeRedirect } from "@/lib/auction";

type OAuthProvider = "facebook" | "google";

function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [loadingProvider, setLoadingProvider] = useState<OAuthProvider | null>(null);

  const searchParams = useSearchParams();

  const nextParam = searchParams.get("next");
  const errorParam = searchParams.get("error");
  const safeNext = getSafeRedirect(nextParam, "/");

  function handleOAuthLogin(provider: OAuthProvider) {
    setError(null);
    setLoadingProvider(provider);

    const loginUrl = new URL("/auth/login", window.location.origin);
    loginUrl.searchParams.set("provider", provider);
    loginUrl.searchParams.set("next", safeNext);
    window.location.assign(loginUrl.toString());
  }

  const isLoading = loadingProvider !== null;

  return (
    <div
      className="card-framer"
      style={{
        maxWidth: 480,
        margin: "0 auto",
        padding: "clamp(28px, 5vw, 44px)",
        border: "1px solid var(--border-hover)",
        boxShadow:
          "0 24px 60px rgba(0, 0, 0, 0.6), 0 0 1px var(--gold)",
      }}
    >
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 48,
            height: 48,
            backgroundColor: "var(--gold)",
            color: "var(--text-inverse)",
            fontSize: 24,
            fontWeight: 900,
            borderRadius: "var(--radius-sm)",
            marginBottom: 16,
            boxShadow: "0 0 24px var(--gold-glow)",
          }}
        >
          T
        </div>

        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.2em",
            color: "var(--gold)",
            textTransform: "uppercase",
          }}
        >
          OTORISASI PESERTA LELANG
        </div>

        <h1
          style={{
            fontSize: 28,
            fontWeight: 900,
            letterSpacing: "-0.04em",
            marginTop: 8,
          }}
        >
          Masuk ke TMD-WAR
        </h1>

        <p
          style={{
            fontSize: 13,
            color: "var(--text-secondary)",
            marginTop: 8,
            lineHeight: 1.6,
          }}
        >
          Akses akun resmi untuk mengajukan penawaran lot lelang
          secara sah dan aman.
        </p>
      </div>

      {(error || errorParam) && (
        <div
          className="alert-error"
          role="alert"
          style={{ marginBottom: 20 }}
        >
          {error ||
            (errorParam === "oauth_callback_failed"
              ? "Login gagal saat verifikasi callback. Silakan coba kembali."
              : errorParam === "oauth_start_failed"
                ? "Tidak dapat memulai login. Periksa konfigurasi OAuth dan coba kembali."
                : errorParam)}
        </div>
      )}

      <div style={{ display: "grid", gap: 12 }}>
        <button
          type="button"
          onClick={() => handleOAuthLogin("google")}
          disabled={isLoading}
          className="btn-secondary"
          style={{
            width: "100%",
            padding: "14px 20px",
            fontSize: 14,
            fontWeight: 800,
            backgroundColor: "#ffffff",
            color: "#202124",
            border: "1px solid #dadce0",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            opacity: isLoading ? 0.7 : 1,
            cursor: isLoading ? "wait" : "pointer",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" />
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.74 7.18l7.73 6C44.43 37.95 46.98 31.75 46.98 24.55Z" />
            <path fill="#FBBC05" d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.13.76-4.59l-7.98-6.19A23.9 23.9 0 0 0 0 24c0 3.87.93 7.52 2.56 10.78l7.97-6.19Z" />
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.14 1.44-4.89 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z" />
          </svg>
          <span>
            {loadingProvider === "google"
              ? "Menghubungkan ke Google..."
              : "Lanjutkan dengan Google"}
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleOAuthLogin("facebook")}
          disabled={isLoading}
          className="btn-primary"
          style={{
            width: "100%",
            padding: "14px 20px",
            fontSize: 14,
            fontWeight: 800,
            backgroundColor: "#1877F2",
            color: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            opacity: isLoading ? 0.7 : 1,
            cursor: isLoading ? "wait" : "pointer",
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
          </svg>
          <span>
            {loadingProvider === "facebook"
              ? "Menghubungkan ke Facebook..."
              : "Lanjutkan dengan Facebook"}
          </span>
        </button>
      </div>

      <div
        style={{
          marginTop: 24,
          borderTop: "1px solid var(--border)",
          paddingTop: 18,
          textAlign: "center",
        }}
      >
        <p
          style={{
            fontSize: 11.5,
            color: "var(--text-muted)",
            lineHeight: 1.6,
          }}
        >
          Dengan melanjutkan, Anda menyetujui tata tertib lelang
          TMD-WAR. Penawaran yang diajukan adalah sah dan mengikat.
        </p>

        <div style={{ marginTop: 16 }}>
          <Link
            href="/"
            className="btn-secondary"
            style={{ fontSize: 12, padding: "8px 14px" }}
          >
            ← Kembali ke Beranda
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div
      className="app-container"
      style={{ padding: "clamp(48px, 8vw, 84px) 0" }}
    >
      <Suspense
        fallback={
          <div
            className="card-framer"
            style={{
              maxWidth: 480,
              margin: "0 auto",
              padding: 48,
              textAlign: "center",
            }}
          >
            <div
              style={{
                color: "var(--gold)",
                fontSize: 14,
                fontWeight: 700,
              }}
            >
              Memuat formulir otentikasi...
            </div>
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
