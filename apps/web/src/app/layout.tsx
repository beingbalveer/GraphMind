import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GraphMind — AI-Native Knowledge Workspace",
  description: "Graph-first workspace where conversations branch into structured knowledge maps.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
