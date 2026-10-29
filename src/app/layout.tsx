import type { Metadata, Viewport } from "next";
import { Source_Sans_3, Source_Serif_4 } from "next/font/google";
import "./globals.css";

const sans = Source_Sans_3({ subsets: ["latin"], variable: "--font-source-sans", display: "swap" });
const serif = Source_Serif_4({ subsets: ["latin"], variable: "--font-source-serif", display: "swap", weight: ["600"] });

export const metadata: Metadata = {
  title: { default: "Vote 4 BUETian | IEB Election 2027-2028", template: "%s | Vote 4 BUETian" },
  description: "BUET alumni candidates in the Institution of Engineers, Bangladesh (IEB) Election 2027-2028: profiles, ballot numbers and manifestos.",
};

export const viewport: Viewport = { themeColor: "#b71c1c" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable}`}>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
