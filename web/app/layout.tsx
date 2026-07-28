import type { Metadata } from "next";
import {
  Atkinson_Hyperlegible_Next,
  Atkinson_Hyperlegible_Mono,
} from "next/font/google";
import "./globals.css";

/*
 * Atkinson Hyperlegible is drawn by the Braille Institute to maximise character
 * distinction for low-vision readers. It is here for the one reason no other
 * face satisfies: PRODUCT.md's stated accessibility need is legibility at
 * projection distance in a badly lit room. See DESIGN.md § Typography.
 * The "Next" cut is used because it carries the 600 weight the scale needs.
 */
const atkinson = Atkinson_Hyperlegible_Next({
  subsets: ["latin"],
  variable: "--font-atkinson",
  display: "swap",
});

const atkinsonMono = Atkinson_Hyperlegible_Mono({
  subsets: ["latin"],
  variable: "--font-atkinson-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "amDash — the club's work, drawn",
  description:
    "amFOSS member activity, extracted from daily status mail. Dots are the work; each member is one unbroken thread.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${atkinson.variable} ${atkinsonMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
