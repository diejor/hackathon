'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/games', label: 'Train' },
  { href: '/campaign', label: 'Profile' },
  { href: '/coach', label: 'Coach' },
];

export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-semibold tracking-tight text-slate-900 ${className}`}>
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-7 w-7 flex-none">
        <path d="M12 2.5 4 5.5v6.2c0 4.7 3.3 8.6 8 9.8 4.7-1.2 8-5.1 8-9.8V5.5l-8-3Z" fill="#4f46e5" />
        <path d="M8.2 12.6a5.3 5.3 0 0 1 7.6 0M9.9 14.4a2.8 2.8 0 0 1 4.2 0" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" fill="none" />
        <circle cx="12" cy="16.4" r="1.1" fill="#fff" />
      </svg>
      Safe Signal
    </span>
  );
}

export default function SiteHeader() {
  const path = usePathname() ?? '/';
  return (
    <header className="site-header sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-md items-center justify-between gap-2 px-4">
        <Link href="/" aria-label="Safe Signal home" className="-ml-1 rounded-lg px-1 py-1">
          <Wordmark className="text-[17px]" />
        </Link>
        <nav aria-label="Main" className="flex items-center gap-1">
          {NAV.map(item => {
            const active = path === item.href || path.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-10 items-center rounded-lg px-3 text-[15px] font-medium transition-colors ${active ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
