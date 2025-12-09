"use client";

import useSWR from 'swr';
import Link from 'next/link';
import { useAuth } from '@/components/AuthContext';

interface VM {
  vmid: number;
  name: string;
  status: string;
  maxmem: number;
  cpus: number;
}

const fetcher = (url: string, headers: any) => fetch(url, { headers }).then(r => {
  if (!r.ok) throw new Error('API Error: ' + r.statusText);
  return r.json();
});

export default function Home() {
  const { host, token, node, logout } = useAuth();

  // Use SWR only if we have auth
  const shouldFetch = !!host && !!token;

  const { data: vmData, error, isLoading } = useSWR(
    shouldFetch ? `/api/proxmox/nodes/${node}/qemu` : null,
    (url) => fetcher(url, {
      'x-proxmox-host': host,
      'x-proxmox-token': token
    }),
    {
      shouldRetryOnError: false,
      onError: (err) => {
        if (err.message.includes('401') || err.message.includes('Unauthorized')) {
          // Optional: could auto-logout here, but for now just show error
          console.log("Auth failed");
        }
      }
    }
  );

  const vms: VM[] = (vmData?.data || []).sort((a: VM, b: VM) => a.vmid - b.vmid);
  const running = vms.filter(v => v.status === 'running').length;

  // Determine precise status
  let statusText = 'Connected';
  let statusColor = 'bg-success shadow-green-500';

  if (!shouldFetch) {
    statusText = 'No Credentials';
    statusColor = 'bg-warning shadow-yellow-500';
  } else if (isLoading) {
    statusText = 'Connecting...';
    statusColor = 'bg-blue-500 shadow-blue-500 animate-pulse';
  } else if (error) {
    statusText = 'Connection Error';
    statusColor = 'bg-danger shadow-red-500';
  }

  return (
    <div className="page-container">
      <header className="mb-8 text-center">
        <h1 className="heading-xl animate-fade-in">Host Overview</h1>
      </header>

      <div className="glass-panel p-6 animate-fade-in" style={{ animationDelay: '0.2s' }}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="heading-lg mb-0 flex items-center gap-3">
            Virtual Machines{' '}
            <span className="text-base font-normal text-secondary bg-white/5 px-2 py-1 rounded-md">
              ({vms.length} total, {running} running)
            </span>
          </h2>
          <Link href="/deploy" className="btn btn-primary">
            + Deploy New VM
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--card-border)' }}>
                <th className="text-left py-4 px-4 text-secondary font-medium w-[80px]">ID</th>
                <th className="text-left py-4 px-4 text-secondary font-medium">Name</th>
                <th className="text-left py-4 px-4 text-secondary font-medium w-[150px]">Status</th>
                <th className="text-left py-4 px-4 text-secondary font-medium w-[150px]">Memory</th>
                <th className="text-left py-4 px-4 text-secondary font-medium w-[120px]">Cores</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} className="py-8 text-center text-secondary">Loading VMs...</td></tr>
              ) : vms.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-secondary">
                    {error ? 'Failed to load VMs' : 'No VMs found on this node.'}
                  </td>
                </tr>
              ) : (
                vms.map((vm) => (
                  <tr key={vm.vmid} style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.05)' }}>
                    <td className="py-4 px-4 font-mono text-sm text-secondary truncate">{vm.vmid}</td>
                    <td className="py-4 px-4 font-bold truncate">{vm.name}</td>
                    <td className="py-4 px-4 text-left">
                      <span style={{
                        display: 'inline-block',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '99px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        background: vm.status === 'running' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(100, 116, 139, 0.1)',
                        color: vm.status === 'running' ? 'var(--success)' : 'var(--secondary)',
                        border: `1px solid ${vm.status === 'running' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(100, 116, 139, 0.2)'}`,
                      }}>
                        {vm.status}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-left text-secondary font-mono text-sm">
                      {vm.maxmem ? (vm.maxmem / 1024 / 1024 / 1024).toFixed(1) + ' GB' : '-'}
                    </td>
                    <td className="py-4 px-4 text-left text-secondary font-mono text-sm">{vm.cpus} vCores</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
