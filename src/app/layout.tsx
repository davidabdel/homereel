import type { Metadata } from "next";
import { Anton, Archivo, Space_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import AdSenseInit from "@/components/AdSenseInit";

const anton = Anton({
  variable: "--font-anton",
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  display: "swap",
});

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  weight: ["400", "700"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "UnrealAdz — Make Ads Unignorable",
  description: "One product photo + one hook = hundreds of scroll-stopping UGC videos. No creators. No shipping. Rendered in minutes, not weeks.",
  icons: {
    icon: "/Images/logos/favicon-192.png",
    apple: "/Images/logos/favicon-192.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="google-adsense-account" content="ca-pub-3962710606150436" />
        <Script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3962710606150436"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
      </head>
      <body
        className={`${anton.variable} ${archivo.variable} ${spaceMono.variable} antialiased`}
      >
        <AuthProvider>
          {children}
        </AuthProvider>
        <AdSenseInit />
      </body>
    </html>
  );
}
