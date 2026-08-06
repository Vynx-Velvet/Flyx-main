import type { Metadata, Viewport } from "next";
import { Inter, Outfit } from "next/font/google";
import Sidebar from "@/components/layout/Sidebar";
import BottomTabs from "@/components/layout/BottomTabs";
import { AppProvider } from "./providers";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Flyx — Stream Free", template: "%s | Flyx" },
  description:
    "Privacy-first streaming platform. No ads, no tracking. Movies, TV, anime, and live sports.",
  applicationName: "Flyx",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#030307",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${outfit.variable}`}
      data-scroll-behavior="smooth"
    >
      <body className="min-h-screen font-sans antialiased">
        <AppProvider>
          <Sidebar />
          <div className="app-shell">
            {children}
          </div>
          <BottomTabs />
        </AppProvider>
      </body>
    </html>
  );
}
