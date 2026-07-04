import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "Acme SDK Docs",
  description: "Documentation for the Acme SDK — a Footfall capture test rig.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <a href="/" className="brand">
            Acme SDK
          </a>
          <nav>
            <a href="/docs/intro">Intro</a>
            <a href="/docs/guide">Guide</a>
            <a href="/docs/interactive">Playground</a>
            <a href="/docs/private">API keys</a>
          </nav>
        </header>
        <main className="content">{children}</main>
        <footer className="site-footer">Acme SDK — a fictional project for testing.</footer>
      </body>
    </html>
  );
}
