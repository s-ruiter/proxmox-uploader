"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, CloudUpload, Settings, Globe } from 'lucide-react';
import clsx from 'clsx'; // Assuming clsx is installed or I'll implement a helper. A simpler approach is just template literals if clsx is missing, but I installed it via npm install axios swr lucide-react clsx (wait, did I install clsx? I ran `npm install axios swr lucide-react clsx`).

// Checking my previous run_command: "npm install axios swr lucide-react clsx". Yes I did.

const navItems = [
    { name: 'Cluster', href: '/', icon: LayoutDashboard },
    { name: 'Deploy', href: '/deploy', icon: CloudUpload },
    { name: 'Settings', href: '/settings', icon: Settings },
];

export default function Navbar() {
    const pathname = usePathname();

    return (
        <nav className="glass-panel" style={{
            position: 'fixed',
            top: 0,
            left: 0,
            height: '100vh',
            width: '250px',
            borderRadius: '0',
            borderLeft: 'none',
            borderTop: 'none',
            borderBottom: 'none',
            zIndex: 50,
            display: 'flex',
            flexDirection: 'column',
            padding: '2rem'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '3rem' }}>
                <div style={{
                    width: '40px',
                    height: '40px',
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/logo.png" alt="Proxmox Ctrl" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                </div>
                <span style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.5px' }}>Proxmox<span style={{ color: 'var(--primary)' }}>Ctrl</span></span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                                padding: '0.75rem 1rem',
                                borderRadius: 'var(--radius)',
                                color: isActive ? 'white' : 'var(--secondary)',
                                background: isActive ? 'var(--primary)' : 'transparent',
                                transition: 'all 0.2s',
                                fontWeight: isActive ? 600 : 500,
                                boxShadow: isActive ? '0 0 15px var(--primary-glow)' : 'none'
                            }}
                        >
                            <item.icon size={20} />
                            {item.name}
                        </Link>
                    );
                })}
            </div>

            <div style={{ marginTop: 'auto' }}>
                <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius)' }}>
                    <p style={{ fontSize: '0.75rem', color: 'var(--secondary)' }}>Status</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 8px var(--success)' }}></div>
                        <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>Connected</span>
                    </div>
                </div>
            </div>
        </nav>
    );
}
