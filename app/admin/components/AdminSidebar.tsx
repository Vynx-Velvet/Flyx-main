'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    Users,
    Film,
    Activity,
    Settings,
    LogOut,
    Map,
    History,
    BarChart3
} from 'lucide-react';

export default function AdminSidebar() {
    const pathname = usePathname();

    const menuItems = [
        { icon: LayoutDashboard, label: 'Overview', href: '/admin' },
        { icon: BarChart3, label: 'Analytics', href: '/admin/analytics' },
        { icon: Users, label: 'Users', href: '/admin/users' },
        { icon: Film, label: 'Content', href: '/admin/content' },
        { icon: Map, label: 'Geographic', href: '/admin/geographic' },
        { icon: History, label: 'Sessions', href: '/admin/sessions' },
        { icon: Activity, label: 'Real-time', href: '/admin/live' },
        { icon: Settings, label: 'Settings', href: '/admin/settings' },
    ];

    return (
        <aside style={{
            width: '260px',
            height: '100vh',
            background: 'rgba(15, 23, 42, 0.6)',
            borderRight: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            flexDirection: 'column',
            padding: '24px',
            backdropFilter: 'blur(20px)',
            position: 'fixed',
            left: 0,
            top: 0,
            zIndex: 50
        }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '40px',
                padding: '0 12px'
            }}>
                <div style={{
                    width: '32px',
                    height: '32px',
                    background: 'linear-gradient(135deg, #7877c6 0%, #9333ea 100%)',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold',
                    color: 'white'
                }}>F</div>
                <span style={{ fontSize: '20px', fontWeight: '700', color: '#f8fafc' }}>Flyx Admin</span>
            </div>

            <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {menuItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                padding: '12px 16px',
                                borderRadius: '12px',
                                color: isActive ? '#fff' : '#94a3b8',
                                background: isActive ? 'rgba(120, 119, 198, 0.2)' : 'transparent',
                                textDecoration: 'none',
                                fontSize: '14px',
                                fontWeight: '500',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            <item.icon size={20} color={isActive ? '#fff' : '#94a3b8'} />
                            {item.label}
                        </Link>
                    );
                })}
            </nav>

            <button style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                borderRadius: '12px',
                color: '#ef4444',
                background: 'rgba(239, 68, 68, 0.1)',
                border: 'none',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                marginTop: 'auto'
            }}>
                <LogOut size={20} />
                Sign Out
            </button>
        </aside>
    );
}
