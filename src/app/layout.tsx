import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { getCurrentAppUser } from "@/lib/data/queries";

export const metadata: Metadata = {
  title: "PAYable — split expenses, stay square",
  description: "A private shared expense tracker for two people.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const currentUser = await getCurrentAppUser().catch(() => null);

  return (
    <html lang="en">
      <body>
        {currentUser && <Navbar currentUser={currentUser} />}
        <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      </body>
    </html>
  );
}
