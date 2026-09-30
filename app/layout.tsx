import type { Metadata } from "next";
import { Geist, Geist_Mono, Fraunces, Oswald } from "next/font/google";
import "./globals.css";
import "./lookbook.css";
import { SITE_URL } from "@/lib/site";
import { LookbookNav } from "@/components/LookbookNav";
import { Footer } from "@/components/Footer";
import { ToastHost } from "@/components/Toast";
import { CommandPalette } from "@/components/CommandPalette";
import { TutorialModal } from "@/components/TutorialModal";
import { WalkthroughTour } from "@/components/WalkthroughTour";
import { Providers } from "@/components/WalletButton";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["SOFT", "WONK", "opsz"],
  display: "swap",
});

const oswald = Oswald({
  variable: "--font-oswald",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Fidex — Institutional Risk Ratings for Circle Arc",
    template: "%s · Fidex",
  },
  description:
    "Risk is part of investing. It should be informed and calculated — before the deposit, not after the exploit. Live risk ratings for DeFi protocols and tokens native to Circle Arc.",
  openGraph: {
    title: "Fidex — Institutional Risk Ratings for Circle Arc",
    description:
      "A letter, a score, and a dated dossier. Free letter grade, paid full axis dossier for $0.01 USDC on Arc.",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} ${oswald.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-void text-paper">
        <Providers>
          <ToastHost />
          <CommandPalette />
          <TutorialModal />
          <WalkthroughTour />
          <LookbookNav />
          <main className="flex-1">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
