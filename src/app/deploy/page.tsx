"use client";

import { useState, useEffect, useRef } from 'react';
import { CloudUpload, HardDrive, Cpu, Zap, Archive, Terminal, CheckCircle, XCircle, Loader2, ArrowDown, ArrowUp } from 'lucide-react';
import axios from 'axios';
import confetti from 'canvas-confetti';
import { useAuth } from '@/components/AuthContext';

export default function Deploy() {
    const { host, token, node, sshHost, sshUsername, sshPassword, isAuthenticated } = useAuth();

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

    // Status State
    const [status, setStatus] = useState<'idle' | 'uploading' | 'configuring_disks' | 'deploying' | 'success' | 'error'>('idle');
    const [uploadProgress, setUploadProgress] = useState(0);
    const [deployLogs, setDeployLogs] = useState<string[]>([]);
    const [errorMessage, setErrorMessage] = useState('');
    const [showConfirm, setShowConfirm] = useState(false);

    // Disk Mapping
    const [uploadedFileId, setUploadedFileId] = useState<string | null>(null);
    const [detectedDisks, setDetectedDisks] = useState<{ name: string, size: number }[]>([]);

    const logsEndRef = useRef<HTMLDivElement>(null);

    // Helper for bytes
    const formatBytes = (bytes: number, decimals = 2) => {
        if (!+bytes) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
    }

    // Scroll logs to bottom and triggering confetti
    useEffect(() => {
        if (logsEndRef.current) {
            logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
        if (status === 'success') {
            confetti({
                particleCount: 150,
                spread: 70,
                origin: { y: 0.6 }
            });
        }
    }, [deployLogs, status]);

    // Effect to load config and fetch available resources from API
    useEffect(() => {
        if (!isAuthenticated || !host || !token || !node) return;

        const fetchResources = async () => {
            try {
                // Storages
                const storageRes = await fetch(`/api/proxmox/nodes/${node}/storage`, {
                    headers: { 'x-proxmox-host': host, 'x-proxmox-token': token }
                });
                if (storageRes.ok) {
                    const data = await storageRes.json();
                    const storageNames = data.data.filter((s: any) => s.active).map((s: any) => s.storage);
                    if (storageNames.length > 0) setStorages(storageNames);
                }

                // VMs for ID calculation
                const vmRes = await fetch(`/api/proxmox/nodes/${node}/qemu`, {
                    headers: { 'x-proxmox-host': host, 'x-proxmox-token': token }
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
    }, [isAuthenticated, host, token, node]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleDeployClick = async (e: React.MouseEvent) => {
        e.preventDefault();
        if (!file) return alert('Please select a file');
        setShowConfirm(true);
    };

    const handleUploadAndPrepare = async () => {
        if (!isAuthenticated || !host || !token) return alert('Please configure settings first!');

        setShowConfirm(false);
        setStatus('uploading');
        setUploadProgress(0);
        setDeployLogs([]);
        setErrorMessage('');
        setUploadedFileId(null);
        setDetectedDisks([]);

        try {
            // 1. Upload File
            const formData = new FormData();
            formData.append('file', file!);

            const uploadRes = await axios.post('/api/upload', formData, {
                onUploadProgress: (progressEvent) => {
                    const total = progressEvent.total || 1;
                    const percent = Math.round((progressEvent.loaded * 100) / total);
                    setUploadProgress(percent);
                }
            });

            if (!uploadRes.data.success) throw new Error(uploadRes.data.error || 'Upload failed');

            setUploadedFileId(uploadRes.data.fileId);
            const disks = uploadRes.data.detectedFiles || [];

            if (disks.length > 1) {
                // If multiple disks found, pause for configuration
                setDetectedDisks(disks);
                setStatus('configuring_disks');
            } else {
                // If single disk, proceed directly
                startDeployment(uploadRes.data.fileId, disks);
            }

        } catch (error: any) {
            console.error(error);
            setErrorMessage(error.message || 'Upload failed');
            setStatus('error');
        }
    };

    const moveDisk = (index: number, direction: 'up' | 'down') => {
        const newDisks = [...detectedDisks];
        if (direction === 'up' && index > 0) {
            [newDisks[index], newDisks[index - 1]] = [newDisks[index - 1], newDisks[index]];
        } else if (direction === 'down' && index < newDisks.length - 1) {
            [newDisks[index], newDisks[index + 1]] = [newDisks[index + 1], newDisks[index]];
        }
        setDetectedDisks(newDisks);
    };

    const startDeployment = async (fileId: string, disks: { name: string, size: number }[]) => {
        if (!isAuthenticated) return alert('Configuration lost, please reload');

        setStatus('deploying');

        try {
            const response = await fetch('/api/deploy', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-proxmox-host': host,
                    'x-proxmox-token': token,
                    'x-proxmox-node': node,
                    'x-proxmox-ssh-host': sshHost || '',
                    'x-proxmox-ssh-username': sshUsername || '',
                    'x-proxmox-ssh-password': sshPassword || ''
                },
                body: JSON.stringify({
                    fileId,
                    diskOrder: disks.map(d => d.name), // Pass just the names
                    vmConfig: {
                        ...config,
                        node: node
                    }
                }),
            });

            if (!response.body) throw new Error("No response body from deployment stream");

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.substring(6));
                            if (data.type === 'log') {
                                setDeployLogs(prev => [...prev, data.message]);
                            } else if (data.type === 'error') {
                                throw new Error(data.message);
                            } else if (data.type === 'done') {
                                setStatus('success');
                            }
                        } catch (e: any) {
                            if (line.includes('"type":"error"')) {
                                setErrorMessage('Stream Error');
                                setStatus('error');
                            }
                        }
                    }
                }
            }
        } catch (error: any) {
            console.error(error);
            setErrorMessage(error.message || 'Deployment error');
            setStatus('error');
        }
    };

    const resetState = () => {
        setStatus('idle');
        setUploadProgress(0);
        setDeployLogs([]);
        setErrorMessage('');
        setUploadedFileId(null);
        setDetectedDisks([]);
    }

    return (
        <div className="page-container relative">
            <header className="mb-8 text-center">
                <h1 className="heading-xl animate-fade-in">Deploy Virtual Machine</h1>
                <p className="text-white text-lg">Upload an image and provision a new instance.</p>
            </header>

            <div className={`max-w-4xl mx-auto transition-all duration-500 ${status !== 'idle' ? 'opacity-50 pointer-events-none blur-sm' : 'opacity-100'}`}>
                {/* Main Content (File Upload + Config) - Same as before */}
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
                            disabled={!file}
                            className={`btn btn-primary w-full py-4 text-lg`}
                        >
                            Deploy VM
                        </button>
                    </div>

                </div>
            </div>

            {/* Progress Overly for Uploading/Deploying */}
            {status !== 'idle' && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
                    <div className="bg-[#0f172a] p-8 max-w-2xl w-full shadow-2xl border border-white/10 rounded-2xl flex flex-col gap-6 max-h-[80vh]">

                        {/* Header based on status */}
                        <div className="flex items-center justify-between">
                            <h3 className="heading-lg flex items-center gap-3">
                                {status === 'uploading' && <><CloudUpload className="animate-bounce text-primary" /> Uploading Image...</>}
                                {status === 'configuring_disks' && <><HardDrive className="text-info" /> Disk Configuration</>}
                                {status === 'deploying' && <><Loader2 className="animate-spin text-warning" /> Deploying VM...</>}
                                {status === 'success' && <><CheckCircle className="text-success" /> Deployment Successful</>}
                                {status === 'error' && <><XCircle className="text-error" /> Deployment Failed</>}
                            </h3>
                            {status === 'success' || status === 'error' ? (
                                <button onClick={resetState} className="btn btn-secondary text-sm">Close</button>
                            ) : null}
                        </div>

                        {/* Upload Progress Bar */}
                        {status === 'uploading' && (
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-secondary">Uploading to server...</span>
                                    <span className="font-mono font-bold">{uploadProgress}%</span>
                                </div>
                                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-primary transition-all duration-300 ease-out"
                                        style={{ width: `${uploadProgress}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Disk Configuration (Reorder) */}
                        {status === 'configuring_disks' && (
                            <div className="space-y-4">
                                <p className="text-secondary text-sm">We detected multiple disk images. Please arrange them in the desired order (Top = scsi0/Boot).</p>
                                <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar p-1">
                                    {detectedDisks.map((disk, idx) => (
                                        <div key={disk.name} className="flex items-center justify-between bg-white/5 p-3 rounded-lg border border-white/5">
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <div className="px-2 py-1 bg-primary/20 text-primary text-xs font-mono rounded shrink-0">
                                                    scsi{idx}
                                                </div>
                                                <div className="flex flex-col overflow-hidden">
                                                    <span className="font-mono text-sm truncate" title={disk.name}>{disk.name}</span>
                                                    <span className="text-xs text-secondary">{formatBytes(disk.size)}</span>
                                                </div>
                                            </div>
                                            <div className="flex gap-1 shrink-0">
                                                <button
                                                    onClick={() => moveDisk(idx, 'up')}
                                                    disabled={idx === 0}
                                                    className="p-1 hover:bg-white/10 rounded disabled:opacity-30"
                                                >
                                                    <ArrowUp size={16} />
                                                </button>
                                                <button
                                                    onClick={() => moveDisk(idx, 'down')}
                                                    disabled={idx === detectedDisks.length - 1}
                                                    className="p-1 hover:bg-white/10 rounded disabled:opacity-30"
                                                >
                                                    <ArrowDown size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <button
                                    onClick={() => startDeployment(uploadedFileId!, detectedDisks)}
                                    className="btn btn-primary w-full mt-4"
                                >
                                    Confirm Order & Deploy
                                </button>
                            </div>
                        )}

                        {/* Logs Terminal */}
                        {(status === 'deploying' || status === 'success' || status === 'error') && (
                            <div className="flex-1 min-h-[300px] bg-black/50 rounded-xl border border-white/10 p-4 font-mono text-sm overflow-hidden flex flex-col">
                                <div className="flex items-center gap-2 text-secondary mb-3 border-b border-white/5 pb-2">
                                    <Terminal size={14} />
                                    <span>Deployment Log</span>
                                </div>
                                <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar pr-2">
                                    {deployLogs.map((log, i) => (
                                        <div key={i} className="text-slate-300 break-words animate-fade-in">
                                            <span className="text-white/20 mr-2">$</span>
                                            {log}
                                        </div>
                                    ))}
                                    {status === 'error' && (
                                        <div className="text-error font-bold mt-2">Error: {errorMessage}</div>
                                    )}
                                    <div ref={logsEndRef} />
                                </div>
                            </div>
                        )}

                    </div>
                </div>
            )}

            {/* Confirmation Modal */}
            {showConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-[#0f172a] p-8 max-w-md w-full shadow-2xl border border-white/10 rounded-2xl relative">
                        <h3 className="heading-lg mb-4">Confirm Deployment</h3>
                        <p className="text-secondary mb-6">Are you sure you want to deploy this VM? Please review the details below.</p>

                        <div className="bg-white/5 rounded-xl p-6 mb-8 border border-white/5">
                            <div className="grid grid-cols-2 gap-y-3 text-sm">
                                <span className="text-secondary">VM ID</span>
                                <span className="font-mono font-bold text-left">{config.vmid}</span>

                                <span className="text-secondary">Name</span>
                                <span className="font-bold text-left truncate">{config.name}</span>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <button
                                onClick={() => setShowConfirm(false)}
                                className="btn btn-secondary flex-1"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleUploadAndPrepare}
                                className="btn btn-primary flex-1"
                            >
                                Upload & Configure
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
