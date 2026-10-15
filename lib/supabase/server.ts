import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseCredentials } from "@/lib/supabase/config";

export { getSupabaseCredentials } from "@/lib/supabase/config";

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
