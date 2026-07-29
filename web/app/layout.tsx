/*
  THESIS: The club's daily self-reporting ritual is a boot log; the roster is the system state.
  This surface refuses the card grid and opts for a dense tabular log — readable vertically,
  with status tokens forming a phosphor stripe that tells the club's health story at a glance.

  OWN-WORLD: Deep terminal slate #0B0E14, three phosphor tones (green/amber/red) for operational
  status, Commit Mono throughout. No decorative color. Rows not cards.

  STORY: A lead opens the roster, the phosphor column tells them who is quiet in seconds.
  They click a name to see the full evidence trail.

  FIRST VIEWPORT: Full-width table, column-header strip at top, filter chips above.
  Status column forms a visible vertical stripe. Member names are the primary landmark.

  FORM: dmesg/POST log — candidate 7 of the grounded list; seed key 9bcfdea6.
*/

import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-commit-mono",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "amDash",
  description: "amFOSS member activity dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${jetbrainsMono.variable} h-full`}>
      <body className="min-h-full flex flex-col font-mono antialiased">
        {children}
      </body>
    </html>
  );
}
