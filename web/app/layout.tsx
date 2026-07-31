/*
  THESIS: A dark operations workspace where exactly one thing glows. The roster
  refuses the log-table default: members are notched cards on a calm near-black
  canvas, and the single lime accent is spent only on the one item that matters
  right now.

  OWN-WORLD: Near-black #0C0C0E canvas, soft #1A1B1E cards with 24px radius and
  corner notches holding circular actions, pill chips and filters, one white
  inverted material for overlays, lime #C9F158 as the only accent. Archivo,
  wide-set for display.

  STORY: A member opens the roster; the hero tallies and the one lime card say
  who reported today. They click a card for the full evidence trail.

  FIRST VIEWPORT: Wordmark + pipeline pill top; hero numerals (active/silent/
  inactive); filter pill rows; notched member-card grid.

  FORM: Reference-pinned CRM workspace world, committed in DESIGN.md.
*/

import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
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
    <html lang="en" className={`${archivo.variable} h-full`}>
      <body className="min-h-full flex flex-col font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
