import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

// latin-ext je nutný, jinak by se české diakritice dopisovaly náhradní glyfy.
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: "DataFirma – navrhni databázi své firmy",
  description:
    "Výuková aplikace pro informační systémy. Navrhni ER diagram své firmy a sleduj, jak jí v reálném čase protékají zákazníci.",
};

export const viewport: Viewport = {
  themeColor: "#12162a",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="cs"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="font-sans min-h-full flex flex-col">{children}</body>
    </html>
  );
}
