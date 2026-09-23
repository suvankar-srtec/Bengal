import type { Metadata } from "next";
import "./globals.css";
import "./payment.css";

export const metadata: Metadata = {
  title: "Aalap Alochona · Bengal Business Council",
  description: "Register for Aalap Alochona on 29 September 2026. Meet, exchange ideas, and build meaningful connections with Bengal Business Council.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
