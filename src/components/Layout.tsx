'use client';

import Sidebar from '@/components/Sidebar';

interface LayoutProps {
  children: React.ReactNode;
  activeMenu?: string;
  className?: string;
}

export default function Layout({ children, activeMenu, className = '' }: LayoutProps) {
  return (
    <div className={`flex h-screen overflow-hidden ${className}`}>
      <Sidebar activeMenu={activeMenu} />
      <main className="flex-1 overflow-auto" style={{ backgroundColor: '#F5F7F9' }}>
        {children}
      </main>
    </div>
  );
}
