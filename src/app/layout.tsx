import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/ui/AppShell";
import { getCurrentAppUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Mass Ministry — Mary Immaculate Catholic Church",
  description: "Liturgical ministry scheduling for Mary Immaculate Catholic Church",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const appUser = await getCurrentAppUser();

  return (
    // suppressHydrationWarning: /gameday sets the theme class on <html> before
    // React hydrates (see src/app/gameday/layout.tsx) to avoid a white flash.
    // Without this, React warns about the server/client attribute mismatch.
    <html lang="en" suppressHydrationWarning>
      <body>
        <AppShell appUser={appUser}>{children}</AppShell>
      </body>
    </html>
  );
}
