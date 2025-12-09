"use client";

import { useAuth } from '@/components/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Server, User, Key, Globe } from 'lucide-react';

export default function Login() {
    const { login, testConnection, isAuthenticated } = useAuth();
    const router = useRouter();

    const [formData, setFormData] = useState({
        host: '',
        node: 'pve',
        username: 'root@pam',
        token: '',
        sshHost: '',
        sshUsername: '',
        sshPassword: ''
    });
    const [saveToFile, setSaveToFile] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [isChecking, setIsChecking] = useState(false);

    useEffect(() => {
        if (isAuthenticated) {
            router.push('/');
        }
    }, [isAuthenticated, router]);

    const handleTest = async (e: React.MouseEvent) => {
        e.preventDefault();
        setError('');
        setSuccessMsg('');
        setIsChecking(true);

        if (!formData.host.startsWith('http')) {
            setError('Host must start with http:// or https://');
            setIsChecking(false);
            return;
        }

        const success = await testConnection(formData);
        if (success) {
            setSuccessMsg("Connection successful! You can now connect.");
        } else {
            setError("Test failed. Check host and credentials.");
        }
        setIsChecking(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccessMsg('');
        setIsChecking(true);

        // Basic validation
        if (!formData.host.startsWith('http')) {
            setError('Host must start with http:// or https://');
            setIsChecking(false);
            return;
        }

        const success = await login(formData, saveToFile);

        if (success) {
            router.push('/');
        } else {
            setError('Connection failed. Please check your Host URL and Token.');
        }
        setIsChecking(false);
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'url(/bg.png) no-repeat center center fixed', backgroundSize: 'cover' }}>
            <div className="glass-panel w-full max-w-lg p-8 animate-fade-in relative overflow-hidden my-8">
                {/* Decorative background orb - reduced opacity for new bg */}
                <div className="absolute -top-20 -right-20 w-40 h-40 bg-primary opacity-10 blur-3xl rounded-full pointer-events-none"></div>

                <div className="text-center mb-8 relative z-10">
                    <div className="mx-auto w-24 h-24 flex items-center justify-center mb-4">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
                    </div>
                    <h1 className="text-2xl font-bold">Proxmox VM Uploader</h1>
                    <p className="text-secondary mt-2">Connect to your cluster</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
                    <div>
                        <label className="text-xs uppercase font-bold tracking-wider text-secondary">Host URL</label>
                        <div className="relative">
                            <Server className="absolute left-3 top-3 text-secondary" size={16} />
                            <input
                                type="text"
                                className="input pl-10"
                                placeholder="https://192.168.1.50:8006"
                                value={formData.host}
                                onChange={e => setFormData({ ...formData, host: e.target.value })}
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-xs uppercase font-bold tracking-wider text-secondary">Node Name</label>
                        <div className="relative">
                            <div className="absolute left-3 top-3 text-secondary font-mono text-xs">ID</div>
                            <input
                                type="text"
                                className="input pl-10"
                                placeholder="pve"
                                value={formData.node}
                                onChange={e => setFormData({ ...formData, node: e.target.value })}
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-xs uppercase font-bold tracking-wider text-secondary">Username</label>
                        <div className="relative">
                            <User className="absolute left-3 top-3 text-secondary" size={16} />
                            <input
                                type="text"
                                className="input pl-10"
                                placeholder="root@pam"
                                value={formData.username}
                                onChange={e => setFormData({ ...formData, username: e.target.value })}
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-xs uppercase font-bold tracking-wider text-secondary">API Token</label>
                        <div className="relative">
                            <Key className="absolute left-3 top-3 text-secondary" size={16} />
                            <input
                                type="text"
                                className="input pl-10"
                                placeholder="user@pam!tokenid=uuid"
                                value={formData.token}
                                onChange={e => setFormData({ ...formData, token: e.target.value })}
                                required
                                autoComplete="off"
                            />
                        </div>
                        <p className="text-[10px] text-secondary mt-1">
                            Create at: Datacenter &gt; Permissions &gt; API Tokens
                        </p>
                    </div>

                    <div className="pt-4 border-t border-white/10">
                        <label className="text-xs uppercase font-bold tracking-wider text-secondary mb-3">SSH Configuration (Optional)</label>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <input
                                    type="text"
                                    className="input"
                                    placeholder="SSH Host (IP)"
                                    value={formData.sshHost}
                                    onChange={e => setFormData({ ...formData, sshHost: e.target.value })}
                                />
                            </div>
                            <div>
                                <input
                                    type="text"
                                    className="input"
                                    placeholder="SSH User (root)"
                                    value={formData.sshUsername}
                                    onChange={e => setFormData({ ...formData, sshUsername: e.target.value })}
                                />
                            </div>
                            <div className="col-span-2">
                                <input
                                    type="password"
                                    className="input"
                                    placeholder="SSH Password"
                                    value={formData.sshPassword}
                                    onChange={e => setFormData({ ...formData, sshPassword: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                        <input
                            type="checkbox"
                            id="saveToFile"
                            checked={saveToFile}
                            onChange={(e) => setSaveToFile(e.target.checked)}
                            className="w-4 h-4 rounded border-white/20 bg-black/20 text-primary focus:ring-primary"
                        />
                        <label htmlFor="saveToFile" className="text-sm text-secondary cursor-pointer m-0 normal-case">
                            Save credentials to server config file
                        </label>
                    </div>

                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-danger text-sm text-center">
                            {error}
                        </div>
                    )}

                    {successMsg && (
                        <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-success text-sm text-center">
                            {successMsg}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <button
                            type="button"
                            onClick={handleTest}
                            className="btn btn-secondary w-full justify-center"
                            disabled={isChecking}
                        >
                            Test Connection
                        </button>
                        <button
                            type="submit"
                            className="btn btn-primary w-full justify-center"
                            disabled={isChecking}
                        >
                            {isChecking ? '...' : 'Connect'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
