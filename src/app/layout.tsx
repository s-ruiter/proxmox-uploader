import type { Metadata } from "next";
import { Inter } from "next/font/google"; // Use Inter as requested
import "./globals.css";
import Navbar from "@/components/Navbar";
import { AuthProvider } from "@/components/AuthContext";
import AuthGuard from "@/components/AuthGuard"; // We will create this next

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Proxmox Ctrl",
  description: "Modern Proxmox Cluster Management",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <AuthGuard>
            <div style={{ display: 'flex' }}>
              <Navbar />
              <main style={{
                marginLeft: '250px',
                width: 'calc(100% - 250px)',
                minHeight: '100vh',
                background: 'url(/bg.png) no-repeat center center fixed',
                backgroundSize: 'cover'
              }}>
                {children}
              </main>
            </div>
          </AuthGuard>
        </AuthProvider>
      </body>
    </html>
  );
}
