import type { Metadata } from "next";
import { Oswald, Public_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const oswald = Oswald({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-display" });
const publicSans = Public_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-body" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Dover Tigers S&C",
  description: "Dover Tigers Football strength & conditioning tracker",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        className={`${oswald.variable} ${publicSans.variable} ${plexMono.variable} font-body min-h-screen`}
      >
        {children}
      </body>
    </html>
  );
}
