import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import { ConvexClientProvider } from "./ConvexProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/components/AuthProvider";
import { LocaleProvider } from "@/components/LocaleProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const inter = Inter({ subsets: ["latin", "latin-ext"] });

export const metadata: Metadata = {
  title: "Team Mission Control",
  description: "Team task management and approval dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ConvexAuthNextjsServerProvider>
      <html lang="en">
        <body className={inter.className}>
          <ErrorBoundary>
            <ConvexClientProvider>
              <ThemeProvider>
                <LocaleProvider>
                  <AuthProvider>
                    {children}
                  </AuthProvider>
                </LocaleProvider>
              </ThemeProvider>
            </ConvexClientProvider>
          </ErrorBoundary>
        </body>
      </html>
    </ConvexAuthNextjsServerProvider>
  );
}
