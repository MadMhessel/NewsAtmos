import React from "react";
import "./globals.css";

// Removed next/font/google imports as they don't work in pure client-side environment

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className="font-sans bg-background text-foreground antialiased">
          {children}
      </body>
    </html>
  );
}