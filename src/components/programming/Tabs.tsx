'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  { name: '小车源码库', href: '/programming/source-code' },
  { name: 'Python例程', href: '/programming/python-examples' },
  { name: '固件程序', href: '/programming/firmware' },
  { name: '下载管理', href: '/programming/downloads' },
];

export default function ProgrammingTabs() {
  const pathname = usePathname();

  return (
    <div className="flex gap-2 mb-4">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href;
        return (
          <Link
            key={tab.name}
            href={tab.href}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={{
              backgroundColor: isActive ? '#2386FF' : 'white',
              color: isActive ? 'white' : '#374151',
              border: isActive ? 'none' : '1px solid #D1D5DB',
            }}
          >
            {tab.name}
          </Link>
        );
      })}
    </div>
  );
}
