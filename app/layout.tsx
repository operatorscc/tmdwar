import type { Metadata, Viewport } from "next";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";
import { Navbar, type NavUser } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { PostHogAnalytics } from "./PostHogAnalytics";

export const metadata: Metadata = {
  title: "TMD-WAR — Platform Lelang Online & House of Curated Auctions",
  description: "Temukan barang pilihan berkualitas, pantau pergerakan harga real-time, dan ajukan penawaran terbaik di platform lelang TMD-WAR.",
  keywords: ["lelang online", "auction", "bid war", "tmd-war", "lelang indonesia"],
  openGraph: {
    title: "TMD-WAR — Platform Lelang Online",
    description: "Temukan barang pilihan berkualitas dan ikuti lelang online aman dan transparan.",
    type: "website",
    locale: "id_ID",
  },
};

export const viewport: Viewport = {
  themeColor: "#0A0B0D",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let navUser: NavUser | null = null;

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, role")
        .eq("id", user.id)
        .maybeSingle();

      navUser = {
        id: user.id,
        email: user.email,
        displayName: profile?.display_name || user.user_metadata?.full_name || user.user_metadata?.name,
        role: profile?.role || "bidder",
      };
    }
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      "digest" in err &&
      (err as { digest?: string }).digest === "DYNAMIC_SERVER_USAGE"
    ) {
      throw err;
    }
  }

  return (
    <html lang="id">
      <body>
        <PostHogAnalytics />
        <Navbar user={navUser} />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
