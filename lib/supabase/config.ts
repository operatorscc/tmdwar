const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

export function getSupabaseCredentials() {
  const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    ""
  ).trim();

  if (!configuredUrl || !key || key === "placeholder-anon-key") {
    throw new Error(
      "Konfigurasi Supabase belum lengkap. Atur NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY atau NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY."
    );
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(configuredUrl);
  } catch {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL bukan URL yang valid.");
  }

  const isHttps = parsedUrl.protocol === "https:";
  const isLocalHttp =
    parsedUrl.protocol === "http:" && LOCAL_HOSTS.has(parsedUrl.hostname);

  if (!isHttps && !isLocalHttp) {
    throw new Error("URL Supabase harus menggunakan HTTPS, kecuali localhost saat pengembangan.");
  }

  return {
    url: parsedUrl.origin,
    key,
  };
}
