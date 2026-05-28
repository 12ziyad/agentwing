import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "AgentWing - Guarded execution for AI agents",
  description: "AgentWing checks and routes AI-agent execution before tools run: policy decisions, approvals, sandbox routing, restore points, logs, and audit receipts.",
  icons: {
    icon: "/agentwing-icon.png",
    shortcut: "/agentwing-icon.png",
    apple: "/agentwing-icon.png",
  },
  openGraph: {
    title: "AgentWing - Guarded execution for AI agents",
    description: "AgentWing checks and routes AI-agent execution before tools run: policy decisions, approvals, sandbox routing, restore points, logs, and audit receipts.",
    images: [{ url: "/agentwing-icon.png", width: 256, height: 256 }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="h-full bg-[#05070d] text-slate-100">{children}</body>
    </html>
  );
}
