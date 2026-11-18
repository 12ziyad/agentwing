import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const spaceGrotesk = localFont({
  src: "./fonts/space-grotesk.woff2",
  variable: "--font-space-grotesk",
  weight: "300 700",
  display: "swap",
});

const jetbrainsMono = localFont({
  src: "./fonts/jetbrains-mono.woff2",
  variable: "--font-jetbrains-mono",
  weight: "100 800",
  display: "swap",
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  metadataBase: new URL("https://agentwing.gpmai.dev"),
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
      <body className="h-full bg-background text-foreground">{children}</body>
    </html>
  );
}
