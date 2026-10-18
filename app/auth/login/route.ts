import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseCredentials } from "@/lib/supabase/config";
import { getSafeRedirect } from "@/lib/auction";

type OAuthProvider = "google" | "facebook";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const providerValue = requestUrl.searchParams.get("provider");
  const provider: OAuthProvider | null =
    providerValue === "google" || providerValue === "facebook"
      ? providerValue
      : null;

  if (!provider) {
    return NextResponse.redirect(
      new URL("/login?error=oauth_start_failed", requestUrl.origin),
    );
  }

  const safeNext = getSafeRedirect(requestUrl.searchParams.get("next"), "/");
  const redirectTo = new URL("/auth/callback", requestUrl.origin);
  redirectTo.searchParams.set("next", safeNext);

  const { url, key } = getSupabaseCredentials();
  const cookiesToSet = new Map<
    string,
    { name: string; value: string; options: Record<string, unknown> }
  >();

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookies) {
        cookies.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          cookiesToSet.set(name, {
            name,
            value,
            options: options as Record<string, unknown>,
          });
        });
      },
    },
  });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: redirectTo.toString(),
      ...(provider === "facebook" ? { scopes: "email" } : {}),
    },
  });

  if (error || !data.url) {
    console.error("[OAuth start] Failed:", {
      provider,
      message: error?.message ?? "Provider authorization URL was not returned",
      status: error?.status,
    });
    return NextResponse.redirect(
      new URL("/login?error=oauth_start_failed", requestUrl.origin),
    );
  }

  const response = NextResponse.redirect(data.url);
  for (const cookie of cookiesToSet.values()) {
    response.cookies.set(
      cookie.name,
      cookie.value,
      cookie.options as Parameters<typeof response.cookies.set>[2],
    );
  }

  return response;
}
