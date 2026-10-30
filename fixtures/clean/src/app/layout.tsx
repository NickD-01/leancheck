import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { OnlineBadge } from "@/components/online-badge";

export const metadata: Metadata = {
  title: "Projects",
  description: "Track projects and their open tasks",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="nl">
      <body>
        <header>
          <Link href="/">Projects</Link>
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/projects/new">New project</Link>
          <OnlineBadge />
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
