"use client";

import { useState, useEffect } from 'react';
import { CloudUpload, HardDrive, Cpu, Zap, Archive } from 'lucide-react';

export default function Deploy() {
    const [file, setFile] = useState<File | null>(null);
    const [config, setConfig] = useState({
        vmid: '103',
        name: 'new-vm',
        memory: '2048',
        cores: '2',
        storage: 'local-lvm',
    });
    const [nodes, setNodes] = useState(['pve']);
    const [storages, setStorages] = useState(['local-lvm', 'local']);
    const [isDeploying, setIsDeploying] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    // Effect to load config and fetch available resources from API
    useEffect(() => {
        const credsStr = localStorage.getItem('proxmox_config');
        if (!credsStr) return;
        const creds = JSON.parse(credsStr);

        const fetchResources = async () => {
            try {
                // Storages
                const storageRes = await fetch(`/api/proxmox/nodes/${creds.node}/storage`, {
                    headers: { 'x-proxmox-host': creds.host, 'x-proxmox-token': creds.token }
                });
                if (storageRes.ok) {
                    const data = await storageRes.json();
                    const storageNames = data.data.filter((s: any) => s.active).map((s: any) => s.storage);
                    if (storageNames.length > 0) setStorages(storageNames);
                }

                // VMs for ID calculation
                const vmRes = await fetch(`/api/proxmox/nodes/${creds.node}/qemu`, {
                    headers: { 'x-proxmox-host': creds.host, 'x-proxmox-token': creds.token }
                });
                if (vmRes.ok) {
                    const data = await vmRes.json();
                    const ids = data.data.map((vm: any) => vm.vmid).map(Number);
                    if (ids.length > 0) {
                        const maxId = Math.max(...ids);
                        setConfig(prev => ({ ...prev, vmid: String(maxId + 1) }));
                    }
                }
            } catch (e) {
                console.error("Failed to fetch resources", e);
            }
        };

        fetchResources();
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleDeployClick = async (e: React.MouseEvent) => {
        e.preventDefault(); // In case it's inside a form tag, though button is type="button"
        if (!file) return alert('Please select a file');
        setShowConfirm(true);
    };

    const confirmDeploy = async () => {
        // Get creds
        const credsStr = localStorage.getItem('proxmox_config');
        if (!credsStr) return alert('Please configure settings first!');
        const creds = JSON.parse(credsStr);

        setIsDeploying(true);

        try {
            const formData = new FormData();
            formData.append('file', file!); // file is checked before opening modal
            formData.append('vmConfig', JSON.stringify({
                ...config,
                node: creds.node // Pass node from config
            }));

            const res = await fetch('/api/deploy', {
                method: 'POST',
                headers: {
                    'x-proxmox-host': creds.host,
                    'x-proxmox-token': creds.token,
                    'x-proxmox-node': creds.node,
                    'x-proxmox-ssh-host': creds.sshHost || '',
                    'x-proxmox-ssh-username': creds.sshUsername || '',
                    'x-proxmox-ssh-password': creds.sshPassword || ''
                },
                body: formData,
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Deployment failed');
            }

            alert('Success: ' + (data.message || 'VM Deployed'));
            setShowConfirm(false); // Close modal on success

        } catch (error: any) {
            alert('Error: ' + error.message);
        } finally {
            setIsDeploying(false);
        }
    };

    return (
        <div className="page-container">
            <header className="mb-8">
                <h1 className="heading-xl animate-fade-in">Deploy Virtual Machine</h1>
                <p className="text-secondary text-lg">Upload an image and provision a new instance.</p>
            </header>

            <div className="max-w-4xl mx-auto animate-fade-in" style={{ animationDelay: '0.1s' }}>
                <div className="space-y-8">

                    {/* File Upload Section */}
                    <div className="glass-panel p-8 group transition-all hover:bg-[rgba(15,23,42,0.6)]">
                        <h2 className="heading-lg flex items-center gap-3 mb-6">
                            <div className="p-2 bg-primary/10 rounded-lg text-primary">
                                <Archive size={24} />
                            </div>
                            <span className="bg-gradient-to-r from-white to-secondary bg-clip-text text-transparent">Image Source</span>
                        </h2>

                        <div className="border-2 border-dashed border-[rgba(99,102,241,0.2)] rounded-xl p-12 text-center transition-all duration-300 hover:border-primary hover:bg-[rgba(99,102,241,0.05)] relative group-hover:shadow-[0_0_30px_-5px_rgba(99,102,241,0.15)]">
                            <input
                                type="file"
                                onChange={handleFileChange}
                                accept=".qcow2,.img,.zip,.iso"
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            />
                            <div className="flex flex-col items-center gap-6 pointer-events-none">
                                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[rgba(99,102,241,0.2)] to-[rgba(59,130,246,0.1)] flex items-center justify-center shadow-inner ring-1 ring-white/10 group-hover:scale-110 transition-transform duration-300">
                                    <CloudUpload size={40} className="text-primary drop-shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
                                </div>
                                <div className="space-y-2">
                                    <p className="text-xl font-bold text-white group-hover:text-primary transition-colors">
                                        {file ? file.name : 'Click or drop VM image here'}
                                    </p>
                                    <p className="text-secondary text-sm font-medium tracking-wide">
                                        SUPPORTS .QCOW2, .ZIP, .ISO
                                    </p>
                                </div>
                                {file && (
                                    <div className="px-4 py-1.5 bg-success/20 text-success text-xs font-bold rounded-full border border-success/30 animate-fade-in">
                                        FILE SELECTED
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* VM Settings Form */}
                    <div className="glass-panel p-8">
                        <h2 className="heading-lg flex items-center gap-2">
                            <Zap className="text-warning" /> Instance Configuration
                        </h2>

                        <div className="grid grid-cols-2 gap-6 mb-8">
                            <div>
                                <label>VM ID</label>
                                <input
                                    type="number"
                                    className="input"
                                    value={config.vmid}
                                    onChange={(e) => setConfig({ ...config, vmid: e.target.value })}
                                />
                            </div>
                            <div>
                                <label>VM Name</label>
                                <input
                                    type="text"
                                    className="input"
                                    value={config.name}
                                    onChange={(e) => setConfig({ ...config, name: e.target.value })}
                                />
                            </div>

                            <div>
                                <label>Memory (MB)</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        className="input"
                                        value={config.memory}
                                        onChange={(e) => setConfig({ ...config, memory: e.target.value })}
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary text-sm">MB</span>
                                </div>
                            </div>

                            <div>
                                <label>CPU Cores</label>
                                <div className="relative">
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary">
                                        <Cpu size={16} />
                                    </div>
                                    <input
                                        type="number"
                                        className="input pl-10"
                                        value={config.cores}
                                        onChange={(e) => setConfig({ ...config, cores: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="col-span-2">
                                <label>Target Storage</label>
                                <div className="relative">
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary">
                                        <HardDrive size={16} />
                                    </div>
                                    <select
                                        className="input pl-10 appearance-none"
                                        value={config.storage}
                                        onChange={(e) => setConfig({ ...config, storage: e.target.value })}
                                    >
                                        {storages.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={handleDeployClick}
                            disabled={isDeploying || !file}
                            className={`btn btn-primary w-full py-4 text-lg ${isDeploying ? 'opacity-70 cursor-wait' : ''}`}
                        >
                            {isDeploying ? 'Deploying...' : 'Deploy VM'}
                        </button>
                    </div>

                </div>
            </div>

            {/* Confirmation Modal */}
            {showConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-[#0f172a] p-8 max-w-md w-full shadow-2xl border border-white/10 rounded-2xl relative">
                        <h3 className="heading-lg mb-4">Confirm Deployment</h3>
                        <p className="text-secondary mb-6">Are you sure you want to deploy this VM? Please review the details below.</p>

                        <div className="bg-white/5 rounded-xl p-6 mb-8 border border-white/5">
                            <div className="grid grid-cols-2 gap-y-3 text-sm">
                                <span className="text-secondary">Target Node</span>
                                <span className="font-mono font-bold text-right">{nodes[0] || 'pve'}</span>

                                <span className="text-secondary">VM ID</span>
                                <span className="font-mono font-bold text-right">{config.vmid}</span>

                                <span className="text-secondary">Name</span>
                                <span className="font-bold text-right truncate">{config.name}</span>
                            </div>

                            <div className="border-t border-white/10 my-3"></div>

                            <div className="flex justify-between items-center text-sm">
                                <span className="text-secondary">Specs</span>
                                <div className="text-right font-mono text-xs font-bold">
                                    {config.cores} Cores, {parseInt(config.memory) / 1024} GB RAM
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <button
                                onClick={() => setShowConfirm(false)}
                                className="btn btn-secondary flex-1"
                                disabled={isDeploying}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDeploy}
                                className="btn btn-primary flex-1"
                                disabled={isDeploying}
                            >
                                {isDeploying ? 'Deploying...' : 'Confirm & Deploy'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
