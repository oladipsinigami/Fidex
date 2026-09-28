import type { Metadata } from "next";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import "./globals.css";
import { SITE_URL } from "@/lib/site";
import { Nav } from "@/components/Nav";
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

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "ArcGrade — Ratings for USDC allocation",
    template: "%s · ArcGrade",
  },
  description:
    "Risk is part of investing. It should be informed and calculated — before the deposit, not after the exploit. Live risk ratings for DeFi protocols and tokens native to Circle Arc.",
  openGraph: {
    title: "ArcGrade — Ratings for USDC allocation",
    description:
      "A letter, a score, and a dated dossier. Free letter grade, paid full axis dossier for $0.01 USDC on Arc.",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-void text-paper">
        <Providers>
          <ToastHost />
          <CommandPalette />
          <TutorialModal />
          <WalkthroughTour />
          <Nav />
          <main className="flex-1">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}

