import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const FALLBACK_SUPABASE_URL = "https://gttrrgwbxuijcenagaha.supabase.co";

function getValidSupabaseUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();

  if (configuredUrl) {
    try {
      const parsedUrl = new URL(configuredUrl);
      if (parsedUrl.protocol === "https:" || parsedUrl.protocol === "http:") {
        return parsedUrl.origin;
      }
    } catch {
      // The environment variable may contain a key instead of a URL.
    }
  }

  return FALLBACK_SUPABASE_URL;
}

export function getSupabaseCredentials() {
  const url = getValidSupabaseUrl();
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    "placeholder-anon-key";

  return { url, key };
}

export async function createClient() {
  const cookieStore = await cookies();
  const { url, key } = getSupabaseCredentials();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components tidak selalu boleh menulis cookie.
          // Refresh session dapat ditangani oleh middleware.
        }
      },
    },
  });
}
