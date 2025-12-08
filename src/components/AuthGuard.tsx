"use client";

import { useAuth } from './AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, isLoading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        if (!isLoading && !isAuthenticated && pathname !== '/login') {
            router.push('/login');
        }
    }, [isLoading, isAuthenticated, pathname, router]);

    if (pathname === '/login') {
        // If on login page, render children (which is the Login page content, but wait...)
        // Actually, RootLayout wraps everything including Navbar.
        // We don't want Navbar on login page usually.
        return (
            <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 100, background: 'var(--background)' }}>
                {children}
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen text-secondary">
                Loading...
            </div>
        );
    }

    if (!isAuthenticated) return null;

    return <>{children}</>;
}
