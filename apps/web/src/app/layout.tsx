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

import { Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/context/AuthContext";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
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
      className={geistMono.variable}
    >
      <body className="antialiased font-sans">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
