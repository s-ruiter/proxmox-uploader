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
    login: (config: Omit<AuthState, 'isAuthenticated'>) => Promise<boolean>;
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
        // Check local storage on load
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

    const login = async (config: Omit<AuthState, 'isAuthenticated'>) => {
        const success = await testConnection(config);
        if (success) {
            localStorage.setItem('proxmox_config', JSON.stringify(config));
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
