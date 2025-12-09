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
    const [saveToFile, setSaveToFile] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [isChecking, setIsChecking] = useState(false);

    // Keep local state in sync if context changes (optional, mostly for initial load)
    // But usually settings is where you EDIT it.

    const handleTest = async () => {
        setError('');
        setSuccessMsg('');
        setIsChecking(true);

        if (!formData.host.startsWith('http')) {
            setError('Host must start with http:// or https://');
            setIsChecking(false);
            return;
        }

        try {
            // We fetch 'nodes' instead of just 'version' so we can auto-detect the node name
            const res = await fetch('/api/proxmox/nodes', {
                headers: {
                    'x-proxmox-host': formData.host,
                    'x-proxmox-token': formData.token
                }
            });

            if (!res.ok) throw new Error('Connection failed. Check host and token.');

            const data = await res.json();
            const nodes = data.data;

            if (Array.isArray(nodes) && nodes.length > 0) {
                const firstNode = nodes[0].node;

                // Auto-fill node if empty or different (we prioritize the detected one)
                setFormData(prev => ({ ...prev, node: firstNode }));
                setSuccessMsg(`Connection successful! Connected to node: ${firstNode}`);
            } else {
                setSuccessMsg("Connection successful! (No nodes found?)");
            }

        } catch (err: any) {
            console.error(err);
            setError(err.message || "Connection failed");
        } finally {
            setIsChecking(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccessMsg('');
        setIsChecking(true);

        if (!formData.host.startsWith('http')) {
            setError('Host must start with http:// or https://');
            setIsChecking(false);
            return;
        }

        // We rely on the context's login, but we should probably ensure we have a node
        // If the user skipped Test, they might not have a node. 
        // Let's try to auto-detect on save too if node is missing.
        let nodeToSave = formData.node;

        if (!nodeToSave) {
            try {
                const res = await fetch('/api/proxmox/nodes', {
                    headers: {
                        'x-proxmox-host': formData.host,
                        'x-proxmox-token': formData.token
                    }
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.data?.[0]?.node) {
                        nodeToSave = data.data[0].node;
                        setFormData(prev => ({ ...prev, node: nodeToSave }));
                    }
                }
            } catch (e) {
                // Ignore, just try login with what we have
            }
        }

        const success = await login({ ...formData, node: nodeToSave }, saveToFile);

        if (success) {
            setSuccessMsg('Settings saved and connected!');
        } else {
            setError('Connection failed. Settings NOT saved.');
        }
        setIsChecking(false);
    };

    return (
        <div className="page-container max-w-4xl mx-auto">
            <header className="mb-10 text-center">
                <h1 className="heading-xl animate-fade-in">Settings</h1>
                <p className="text-secondary text-lg">Configure your Proxmox connection details.</p>
            </header>

            <form onSubmit={handleSave} className="animate-fade-in space-y-8" style={{ animationDelay: '0.1s' }}>

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
                            <label className="text-xs uppercase font-bold text-secondary tracking-wider mb-2 block">SSH Host</label>
                            <input
                                type="text"
                                className="input py-3 bg-opacity-50"
                                placeholder="192.168.1.100"
                                value={formData.sshHost || ''}
                                onChange={(e) => setFormData({ ...formData, sshHost: e.target.value })}
                            />
                        </div>
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

                {/* Save to File Option */}
                <div className="glass-panel p-6 flex items-center gap-4">
                    <input
                        type="checkbox"
                        id="saveToFile"
                        checked={saveToFile}
                        onChange={(e) => setSaveToFile(e.target.checked)}
                        className="w-5 h-5 rounded border-white/20 bg-black/20 text-primary focus:ring-primary cursor-pointer"
                    />
                    <label htmlFor="saveToFile" className="text-base text-secondary cursor-pointer m-0 normal-case flex-1">
                        <strong>Save configuration to server file?</strong>
                        <span className="block text-xs mt-1 opacity-70">
                            If checked, credentials will be saved to 'proxmox-config.json' on the server for auto-login.
                        </span>
                    </label>
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
                        onClick={handleTest}
                        className="btn btn-secondary flex-1 py-4 text-base"
                        disabled={isChecking}
                    >
                        {isChecking ? 'Testing Connection...' : 'Test Connection'}
                    </button>
                    <button
                        type="submit"
                        className="btn btn-primary flex-1 py-4 text-base shadow-lg hover:shadow-primary/40"
                        disabled={isChecking}
                    >
                        {isChecking ? 'Saving...' : 'Save Configuration'}
                    </button>
                </div>

            </form>
        </div>
    );
}
