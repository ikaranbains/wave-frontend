import { Bricolage_Grotesque, Nunito } from "next/font/google";
import { InstallPrompt } from "../components/InstallPrompt";
import { NetworkStatusBanner } from "../components/NetworkStatusBanner";
import { PwaRegistrar } from "../components/PwaRegistrar";
import "./globals.css";

const nunito = Nunito({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

// Bricolage carries the personality in headings; it is too characterful for the
// 11-13px UI text the chat shell is mostly made of.
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
});

export const metadata = {
  title: {
    default: "Wave — Your people, a tap away.",
    template: "%s | Wave",
  },
  description:
    "A quiet little place for the handful of people you actually want to hear from. Messages, photos, voice notes, and calls — nothing else.",
  applicationName: "Wave",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Wave",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/wave-192.png", sizes: "192x192", type: "image/png" },
      { url: "/wave-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "Wave — Your people, a tap away.",
    description:
      "A quiet little place for the handful of people you actually want to hear from. Messages, photos, voice notes, and calls — nothing else.",
    siteName: "Wave",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Wave — Your people, a tap away.",
    description:
      "A quiet little place for the handful of people you actually want to hear from. Messages, photos, voice notes, and calls — nothing else.",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  // Keep the composer above the on-screen keyboard instead of letting it scroll away.
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8f9fa" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1220" },
  ],
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="light" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${nunito.variable} ${bricolage.variable} antialiased h-dvh flex overflow-hidden overscroll-none`}
      >
        {children}
        <NetworkStatusBanner />
        <InstallPrompt />
        <PwaRegistrar />
      </body>
    </html>
  );
}
