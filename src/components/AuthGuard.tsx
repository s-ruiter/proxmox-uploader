"use client";

import { useAuth } from './AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, isLoading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        if (!isLoading && !isAuthenticated && pathname !== '/connect') {
            router.push('/connect');
        }
    }, [isLoading, isAuthenticated, pathname, router]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen text-secondary">
                Loading...
            </div>
        );
    }

    if (!isAuthenticated && pathname !== '/connect') return null;

    return <>{children}</>;
}
