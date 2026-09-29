import type { Metadata } from "next";
import "./globals.css";
import "./payment.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_PUBLIC_URL || "https://bengal-bbc.vercel.app"),
  title: "Aalap Alochona · Bengal Business Council",
  description: "Event registration and participant passes from Bengal Business Council.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
