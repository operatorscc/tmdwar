
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSafeRedirect } from "@/lib/auction";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const requestedNext = searchParams.get("next");
  const safeNext = getSafeRedirect(requestedNext, "/");

  if (code) {
    try {
      const supabase = await createClient();
      const { error } =
        await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        console.error("[OAuth callback] Exchange failed:", {
          message: error.message,
          status: error.status,
        });
      } else {
        return NextResponse.redirect(
          new URL(safeNext, origin)
        );
      }
    } catch (err) {
      console.error(
        "[OAuth callback] Unexpected failure:",
        err instanceof Error ? err.message : "Unknown error"
      );
    }
  } else {
    console.error(
      "[OAuth callback] Missing authorization code"
    );
  }

  return NextResponse.redirect(
    new URL("/login?error=oauth_callback_failed", origin)
  );
}
