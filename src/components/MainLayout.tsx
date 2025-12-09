"use client";

import { usePathname } from 'next/navigation';
import Navbar from './Navbar';

export default function MainLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isLoginPage = pathname === '/connect';

    if (isLoginPage) {
        return (
            <main className="min-h-screen w-full">
                {children}
            </main>
        );
    }

    return (
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
    );
}
