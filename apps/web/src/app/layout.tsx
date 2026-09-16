import type { Metadata } from "next";
import "@xyflow/react/dist/style.css";
import "katex/dist/katex.min.css";
import "highlight.js/styles/github-dark-dimmed.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "GraphMind — AI-Native Knowledge Workspace",
  description: "Graph-first workspace where conversations branch into structured knowledge maps.",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
};

import { Geist, Geist_Mono, Public_Sans } from "next/font/google";
import { AuthProvider } from "@/context/AuthContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const publicSans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${publicSans.variable}`}
    >
      <body className="antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
