import type { Metadata } from "next";
import "./globals.css";
import "./payment.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_PUBLIC_URL || "https://bengal-bbc.vercel.app"),
  title: "Bengal Business Council",
  description: "Event registration and participant passes from Bengal Business Council.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Browser extensions may add body attributes (for example, cz-shortcut-listen) before hydration.
  return <html lang="en"><body suppressHydrationWarning>{children}</body></html>;
}
