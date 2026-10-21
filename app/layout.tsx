import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SIAP TANJAK | Pemerintah Provinsi Sumatera Selatan",
  description: "Sistem Informasi Alokasi Pendanaan Tanggung Jawab Sosial Korporasi Provinsi Sumatera Selatan.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className="antialiased">{children}</body>
    </html>
  );
}
