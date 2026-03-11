import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "Kripto Klasik - Cryptography Calculator",
  description:
    "Kalkulator kriptografi klasik dengan antarmuka Windows 7 Aero Glass.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
        />
      </head>
      <body className="win7-desktop text-slate-900 transition-colors duration-200 overflow-hidden font-sans">
        {/* Full-screen wrapper */}
        <div className="flex flex-col h-screen w-full overflow-hidden">

          {/* Main Workspace (Sidebar + Content) */}
          <div className="flex flex-1 overflow-hidden relative z-0">
            {/* Note: We will absolute position the windows later or just let them float here */}
            <Sidebar />

            {/* Content Area */}
            <div className="flex-1 flex flex-col h-full overflow-hidden p-2 sm:p-4 md:p-6 relative items-start justify-start">
              {children}
            </div>
          </div>



        </div>
      </body>
    </html>
  );
}

