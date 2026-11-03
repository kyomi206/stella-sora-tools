'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Swords, Heart, Users, ExternalLink, Sparkles, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Navbar() {
  const pathname = usePathname();

  const navItems = [
    { label: 'Home', href: '/' },
    { label: 'Team Builder', href: '/builder', icon: Swords, badge: 'Hot' },
    { label: 'Bond Calculator', href: '/bond', icon: Heart },
    { label: 'Events Roadmap', href: '/roadmap', icon: Calendar, badge: 'New' },
    { label: 'Trekkers', href: '/trekkers', icon: Users },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 frosted-panel">
      <div className="max-w-6xl mx-auto flex h-16 items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="size-8 rounded-lg bg-surface-elevated border border-border-subtle flex items-center justify-center overflow-hidden">
              <img src="/bastelina.png" alt="Bastelina" className="size-full object-contain" />
            </div>
            <span className="font-semibold tracking-tight text-base sm:text-lg leading-tight text-slate-900 group-hover:text-teal-600 transition-colors">
              Stella Sora Tools
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1 text-sm font-medium">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors relative',
                    isActive
                      ? 'bg-secondary text-primary font-semibold'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                  )}
                >
                  {Icon && <Icon className="size-4" />}
                  <span>{item.label}</span>
                  {item.badge && (
                    <span
                      className={cn(
                        'text-[10px] px-1.5 py-0.2 rounded-full font-bold uppercase tracking-wider',
                        item.badge === 'Hot'
                          ? 'bg-rose-500/20 text-rose-600 border border-rose-500/30'
                          : 'bg-emerald-500/20 text-emerald-600 border border-emerald-500/30'
                      )}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="https://stellasora.miraheze.org/wiki/Stella_Sora_Wiki"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2.5 py-1.5 rounded-md border border-border/60 hover:bg-secondary/50 transition-colors"
          >
            <span>Wiki</span>
            <ExternalLink className="size-3" />
          </a>

          <a
            href="https://github.com/Hiro420/StellaSoraData"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2.5 py-1.5 rounded-md border border-border/60 hover:bg-secondary/50 transition-colors"
          >
            <span>Data Repo</span>
            <ExternalLink className="size-3" />
          </a>
        </div>
      </div>

      {/* Mobile nav strip */}
      <div className="flex md:hidden items-center justify-around border-t border-border/20 py-2 px-2 bg-background/90 text-xs">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center gap-1 px-3 py-1 rounded transition-colors',
                isActive
                  ? 'text-sky-600 font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {Icon && <Icon className="size-4" />}
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </header>
  );
}
