import type { Metadata, Viewport } from "next";
import { Source_Sans_3, Source_Serif_4 } from "next/font/google";
import { MotionProvider } from "@/components/motion";
import "./globals.css";

const sans = Source_Sans_3({ subsets: ["latin"], variable: "--font-source-sans", display: "swap" });
const serif = Source_Serif_4({ subsets: ["latin"], variable: "--font-source-serif", display: "swap", weight: ["600"] });

export const metadata: Metadata = {
  title: { default: "BUETians in IEB Election | 2027-2028", template: "%s | BUETians in IEB Election" },
  description: "BUET alumni candidates in the Institution of Engineers, Bangladesh (IEB) Election 2027-2028: profiles, ballot numbers and manifestos.",
};

// viewport-fit=cover lets the page use the full screen on notched phones; the container pads for the safe areas.
export const viewport: Viewport = { themeColor: "#b71c1c", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: browser extensions (Grammarly, translators, dark-mode tools) add attributes to
    // <html> and <body> before React loads, which would otherwise log a hydration mismatch on those two elements.
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning className={`${sans.variable} ${serif.variable}`}>
      <body className="min-h-dvh" suppressHydrationWarning>
        {/* Entrance animations start hidden; without JavaScript they would never run, so show everything. */}
        <noscript>
          <style>{`[style*="opacity: 0"],[style*="opacity:0"]{opacity:1!important;transform:none!important}`}</style>
        </noscript>
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
