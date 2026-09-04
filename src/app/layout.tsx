import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { BottomNav } from "@/components/BottomNav";
import { getCurrentAppUser } from "@/lib/data/queries";

export const metadata: Metadata = {
  title: "PAYable — split expenses, stay square",
  description: "A private shared expense tracker for two people.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "PAYable",
  },
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  formatDetection: {
    // Stop iOS Safari from auto-linking/underlining things that look like
    // phone numbers in transaction descriptions and notes.
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  // Lets the app draw under the iPhone notch/Dynamic Island and home
  // indicator; safe-area padding in globals.css keeps content clear of them.
  viewportFit: "cover",
  themeColor: "#1B2A3A",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const currentUser = await getCurrentAppUser().catch(() => null);

  return (
    <html lang="en">
      <body>
        {currentUser && <Navbar currentUser={currentUser} />}
        <main
          className={`mx-auto max-w-5xl px-4 pt-6 sm:px-6 sm:py-8 ${
            currentUser ? "pb-24 sm:pb-8" : "pb-6"
          }`}
        >
          {children}
        </main>
        {currentUser && <BottomNav />}
      </body>
    </html>
  );
}
