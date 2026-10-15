import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseCredentials } from "@/lib/supabase/config";

export { getSupabaseCredentials } from "@/lib/supabase/config";

export function createClient() {
  const { url, key } = getSupabaseCredentials();
  return createBrowserClient(url, key);
}
