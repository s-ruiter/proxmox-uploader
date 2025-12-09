"use client";

import { useState } from 'react';
import { useAuth } from '@/components/AuthContext';
import { Server, User, Key, Globe } from 'lucide-react';

export default function Settings() {
    const { host, node, username, token, sshHost, sshUsername, sshPassword, login, testConnection } = useAuth();

    const [formData, setFormData] = useState({
        host: host || '',
        node: node || '',
        username: username || '',
        token: token || '',
        sshHost: sshHost || '',
        sshUsername: sshUsername || '',
        sshPassword: sshPassword || ''
    });
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [isChecking, setIsChecking] = useState(false);

    // Keep local state in sync if context changes (optional, mostly for initial load)
    // But usually settings is where you EDIT it.

    const handleTestAndSave = async (e: React.FormEvent | React.MouseEvent) => {
        e.preventDefault();
        setError('');
        setSuccessMsg('');
        setIsChecking(true);

        if (!formData.host.startsWith('http')) {
            setError('Host must start with http:// or https://');
            setIsChecking(false);
            return;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

        try {
            // 1. Test API Connection & Auto-detect Node
            const res = await fetch('/api/proxmox/nodes', {
                headers: {
                    'x-proxmox-host': formData.host,
                    'x-proxmox-token': formData.token
                },
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!res.ok) throw new Error('API Connection failed. Check Host URL and Token.');

            const data = await res.json();
            const nodes = data.data;
            let nodeToUse = formData.node;

            if (Array.isArray(nodes) && nodes.length > 0) {
                if (!nodeToUse || !nodes.find((n: any) => n.node === nodeToUse)) {
                    nodeToUse = nodes[0].node;
                    setFormData(prev => ({ ...prev, node: nodeToUse }));
                }
            }

            // 2. Test SSH Connection (if provided)
            let derivedSshHost = '';
            try {
                const url = new URL(formData.host);
                derivedSshHost = url.hostname;
            } catch (e) {
                // Should be caught by earlier validation, but just in case
            }

            if (derivedSshHost && formData.sshUsername && formData.sshPassword) {
                const sshRes = await fetch('/api/test-ssh', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        host: derivedSshHost,
                        username: formData.sshUsername,
                        password: formData.sshPassword
                    })
                });

                if (!sshRes.ok) {
                    const sshData = await sshRes.json();
                    throw new Error(`SSH Connection failed: ${sshData.error || 'Unknown error'}`);
                }
            }

            // 3. Save and Login (Only passes if tests succeeded)
            // We save the derived SSH host to the config so the backend knows what to connect to
            const success = await login({ ...formData, sshHost: derivedSshHost, node: nodeToUse }, true);

            if (success) {
                setSuccessMsg(`Connection successful! Configuration saved to server.`);
            } else {
                throw new Error('Verification failed during save.');
            }

        } catch (err: any) {
            console.error(err);
            if (err.name === 'AbortError') {
                setError('Connection timed out. Check Host URL.');
            } else {
                setError(err.message || "Connection failed");
            }
        } finally {
            clearTimeout(timeoutId);
            setIsChecking(false);
        }
    };

    return (
        <div className="page-container max-w-4xl mx-auto">
            <header className="mb-10 text-center">
                <h1 className="heading-xl animate-fade-in">Settings</h1>
                <p className="text-secondary text-lg">Configure your Proxmox connection details.</p>
            </header>

            <form className="animate-fade-in space-y-8" style={{ animationDelay: '0.1s' }}>

                {/* Connection Details Panel */}
                <div className="glass-panel p-8">
                    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-[rgba(255,255,255,0.05)]">
                        <Server className="text-primary" size={24} />
                        <div>
                            <h2 className="text-xl font-bold">Proxmox API Configuration</h2>
                            <p className="text-sm text-secondary">Required. Used for managing VMs and getting cluster status.</p>
                        </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-8">
                        <div className="md:col-span-2">
                            <label className="text-xs uppercase font-bold text-secondary tracking-wider mb-2 block">Proxmox Host URL</label>
                            <input
                                type="text"
                                className="input py-3 bg-opacity-50"
                                placeholder="https://192.168.1.100:8006"
                                value={formData.host}
                                onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                            />
                            <p className="text-xs text-secondary mt-2">Include protocol (https) and port (usually 8006)</p>
                        </div>

                        <div>
                            <label className="text-xs uppercase font-bold text-secondary tracking-wider mb-2 block">Node Name</label>
                            <input
                                type="text"
                                className="input py-3 bg-opacity-50"
                                placeholder="pve"
                                value={formData.node}
                                onChange={(e) => setFormData({ ...formData, node: e.target.value })}
                            />
                            <p className="text-xs text-secondary mt-2">Cluster node ID (auto-detected)</p>
                        </div>

                        <div>
                            <label className="text-xs uppercase font-bold text-secondary tracking-wider mb-2 block">API Token</label>
                            <input
                                type="text"
                                className="input py-3 bg-opacity-50"
                                placeholder="USER@pam!TOKENID=UUID"
                                value={formData.token}
                                onChange={(e) => setFormData({ ...formData, token: e.target.value })}
                                autoComplete="off"
                            />
                            <p className="text-xs text-secondary mt-2">Format: USER@pam!TOKENID=UUID</p>
                        </div>
                    </div>
                </div>

                {/* SSH Configuration Panel */}
                <div className="glass-panel p-8">
                    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-[rgba(255,255,255,0.05)]">
                        <div className="text-warning">
                            <div className="font-mono font-bold text-lg border border-current rounded px-2">{'>_'}</div>
                        </div>
                        <div>
                            <h2 className="text-xl font-bold">Proxmox SSH Configuration</h2>
                            <p className="text-sm text-secondary">Optional. Used for uploading large files (ISO/images) directly to the server.</p>
                        </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-8">

                        <div>
                            <label className="text-xs uppercase font-bold text-secondary tracking-wider mb-2 block">SSH Username</label>
                            <input
                                type="text"
                                className="input py-3 bg-opacity-50"
                                placeholder="root"
                                value={formData.sshUsername || ''}
                                onChange={(e) => setFormData({ ...formData, sshUsername: e.target.value })}
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="text-xs uppercase font-bold text-secondary tracking-wider mb-2 block">SSH Password</label>
                            <input
                                type="password"
                                className="input py-3 bg-opacity-50"
                                placeholder="••••••••"
                                value={formData.sshPassword || ''}
                                onChange={(e) => setFormData({ ...formData, sshPassword: e.target.value })}
                            />
                        </div>
                    </div>
                </div>

                {/* Status Messages */}
                {error && (
                    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-danger flex items-center justify-center font-medium animate-fade-in">
                        {error}
                    </div>
                )}

                {successMsg && (
                    <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl text-success flex items-center justify-center font-medium animate-fade-in">
                        {successMsg}
                    </div>
                )}

                {/* Actions */}
                <div className="flex gap-4 pt-4">
                    <button
                        type="button"
                        onClick={handleTestAndSave}
                        className="btn btn-primary flex-1 py-4 text-base shadow-lg hover:shadow-primary/40"
                        disabled={isChecking}
                    >
                        {isChecking ? 'Saving...' : 'Test connection and Save'}
                    </button>
                </div>

            </form>
        </div>
    );
}
