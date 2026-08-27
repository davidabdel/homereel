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
  title: "HomeReel — Listing films from photos you already have",
  description: "Upload the photos from a listing you already have. Every photo becomes a moving shot, joined into one film. Nothing on screen that isn't in the house.",
  icons: {
    icon: "/icon.png",
    apple: "/icon.png",
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
