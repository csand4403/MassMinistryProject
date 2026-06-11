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
    <html lang="en">
      <body>
        <AppShell appUser={appUser}>{children}</AppShell>
      </body>
    </html>
  );
}
