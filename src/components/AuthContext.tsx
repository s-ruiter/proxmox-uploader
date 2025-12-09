"use client";

import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

interface AuthState {
    host: string;
    node: string;
    username: string;
    token: string;
    sshHost?: string;
    sshUsername?: string;
    sshPassword?: string;
    isAuthenticated: boolean;
}

interface AuthContextType extends AuthState {
    login: (config: Omit<AuthState, 'isAuthenticated'>, saveToServer?: boolean) => Promise<boolean>;
    logout: () => void;
    testConnection: (config: Omit<AuthState, 'isAuthenticated'>) => Promise<boolean>;
    isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({
    host: '', node: '', username: '', token: '', isAuthenticated: false,
    sshHost: '', sshUsername: '', sshPassword: '',
    login: async () => false, logout: () => { }, testConnection: async () => false, isLoading: true
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [auth, setAuth] = useState<AuthState>({
        host: '', node: '', username: '', token: '', isAuthenticated: false,
        sshHost: '', sshUsername: '', sshPassword: ''
    });
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        const initAuth = async () => {
            // 1. Try server-side config first (more persistent)
            try {
                const res = await fetch('/api/config');
                if (res.ok) {
                    const data = await res.json();
                    if (data.success && data.config && data.config.host && data.config.token) {
                        setAuth({ ...data.config, isAuthenticated: true });
                        setIsLoading(false);
                        return;
                    }
                }
            } catch (e) {
                console.error("Failed to fetch server config", e);
            }

            // 2. Fallback to local storage
            const saved = localStorage.getItem('proxmox_config');
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    if (parsed.host && parsed.token) {
                        setAuth({ ...parsed, isAuthenticated: true });
                    }
                } catch (e) {
                    localStorage.removeItem('proxmox_config');
                }
            }
            setIsLoading(false);
        };

        initAuth();
    }, []);

    const testConnection = async (config: Omit<AuthState, 'isAuthenticated'>) => {
        try {
            const testUrl = '/api/proxmox/version';
            const res = await fetch(testUrl, {
                headers: {
                    'x-proxmox-host': config.host,
                    'x-proxmox-token': config.token
                }
            });

            if (!res.ok) throw new Error('Connection failed');
            const data = await res.json();
            if (!data.data) throw new Error('Invalid API response');
            return true;
        } catch (error) {
            console.error("Connection test failed", error);
            return false;
        }
    };

    const login = async (config: Omit<AuthState, 'isAuthenticated'>, saveToServer?: boolean) => {
        const success = await testConnection(config);
        if (success) {
            // localStorage.setItem('proxmox_config', JSON.stringify(config)); // REMOVED per user request

            if (saveToServer) {
                try {
                    await fetch('/api/config', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(config)
                    });
                } catch (e) {
                    console.error("Failed to save config to server", e);
                }
            }

            setAuth({ ...config, isAuthenticated: true });
            return true;
        }
        return false;
    };

    const logout = () => {
        localStorage.removeItem('proxmox_config');
        setAuth({ host: '', node: '', username: '', token: '', isAuthenticated: false, sshHost: '', sshUsername: '', sshPassword: '' });
        router.push('/login');
    };

    return (
        <AuthContext.Provider value={{ ...auth, login, logout, testConnection, isLoading }}>
            {children}
        </AuthContext.Provider>
    );
}
