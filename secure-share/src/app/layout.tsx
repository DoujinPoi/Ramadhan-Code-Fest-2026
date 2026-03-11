import type { Metadata } from "next";
import { Merriweather, Merriweather_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const merriweather = Merriweather({
  variable: "--font-merriweather",
  subsets: ["latin"],
  weight: ["300", "400", "700", "900"],
});

const merriweatherSans = Merriweather_Sans({
  variable: "--font-merriweather-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "SecureShare - Zero-Knowledge File Sharing",
  description: "Secure file sharing with end-to-end encryption. Files are encrypted in your browser and self-destruct after download or expiry.",
  keywords: ["SecureShare", "encryption", "file sharing", "zero-knowledge", "AES-256", "secure transfer"],
  authors: [{ name: "SecureShare Team" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "SecureShare - Zero-Knowledge File Sharing",
    description: "Secure file sharing with end-to-end encryption",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Bootstrap Icons CDN */}
        <link 
          rel="stylesheet" 
          href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" 
        />
      </head>
      <body
        className={`${merriweather.variable} ${merriweatherSans.variable} ${jetbrainsMono.variable} antialiased bg-background text-foreground font-serif`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
