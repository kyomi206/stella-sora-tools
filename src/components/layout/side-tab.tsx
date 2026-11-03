'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Swords,
  Heart,
  Users,
  Calendar,
  Menu,
  X,
  Calculator,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSidebar } from '@/components/layout/sidebar-context';

export function SideTab() {
  const pathname = usePathname();
  const { isCollapsed, isMobileOpen, setIsMobileOpen } = useSidebar();

  // Close mobile drawer on route change
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname, setIsMobileOpen]);

  const gameplayTools = [
    {
      name: 'Preset Visualizer',
      href: '/builder',
      icon: Swords,
      iconColor: 'text-rose-600',
    },
    {
      name: 'Affinity Calculator',
      href: '/bond',
      icon: Heart,
      iconColor: 'text-purple-600',
    },
    {
      name: 'Resource Calculator',
      href: '/calculator',
      icon: Calculator,
      iconColor: 'text-amber-600',
    },
    {
      name: 'Events Roadmap',
      href: '/roadmap',
      icon: Calendar,
      iconColor: 'text-sky-600',
    },
    {
      name: 'Trekker Encyclopedia',
      href: '/trekkers',
      icon: Users,
      iconColor: 'text-emerald-600',
    },
  ];

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isMobileOpen && (
        <button
          type="button"
          aria-label="Close navigation menu"
          className="md:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm w-full h-full border-0 cursor-default"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Main Sidebar (Docked on desktop, drawer on mobile) */}
      <aside
        aria-label="Tools Navigation Sidebar"
        className={cn(
          'game-gradient-bg border-r border-border-subtle select-none z-40 flex flex-col',
          // Desktop styles: static in flex flow, sticky to viewport height
          'hidden md:flex md:shrink-0 md:h-screen md:sticky md:top-0',
          isCollapsed ? 'md:w-14' : 'md:w-60',
          // Mobile styles: fixed slide-over drawer below TopBar (h-12)
          isMobileOpen && '!flex fixed left-0 top-12 bottom-0 w-64 shadow-2xl z-50'
        )}
      >
        {/* Brand Header */}
        <div
          className={cn(
            'flex items-center border-b border-border-subtle h-12 px-3 shrink-0',
            isCollapsed ? 'justify-center' : 'justify-start'
          )}
        >
          <div className="relative group">
            <Link
              href="/"
              aria-label={isCollapsed ? 'Stella Sora Tools' : undefined}
              className="flex items-center gap-2.5 overflow-hidden press-feedback rounded-md focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <div className="size-7 rounded-md bg-surface-elevated border border-amber-500/30 shadow-xs flex items-center justify-center overflow-hidden shrink-0">
                <img src="/bastelina.png" alt="Bastelina" width={28} height={28} className="size-full object-contain" />
              </div>
              {!isCollapsed && (
                <span className="font-bold text-sm tracking-tight text-slate-900 leading-tight truncate">
                  Stella Sora Tools
                </span>
              )}
            </Link>
            {isCollapsed && (
              <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2.5 z-50 whitespace-nowrap rounded-md bg-surface-elevated px-2.5 py-1 text-xs font-medium text-slate-800 border border-border-hover shadow-lg opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
                Stella Sora Tools
                <div className="absolute -left-1 top-1/2 -translate-y-1/2 size-2 rotate-45 border-l border-b border-border-hover bg-surface-elevated" />
              </div>
            )}
          </div>
        </div>

        {/* Scrollable Navigation Body */}
        <div className="flex-1 overflow-y-auto py-3 px-2 flex flex-col gap-4 overflow-x-hidden">
          {/* 1. Overview */}
          <div>
            <div className="relative group">
              <Link
                href="/"
                aria-label={isCollapsed ? 'Home' : undefined}
                className={cn(
                  'flex items-center rounded-lg transition-colors text-sm press-feedback focus-visible:ring-2 focus-visible:ring-amber-400',
                  isCollapsed ? 'size-10 mx-auto justify-center' : 'px-3 py-2 gap-3',
                  pathname === '/'
                    ? 'bg-surface-elevated text-slate-900 font-medium border-l-2 border-amber-400 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-surface-hover'
                )}
              >
                <Home
                  className={cn(
                    'size-4 shrink-0 transition-colors',
                    pathname === '/' ? 'text-amber-600' : 'text-slate-600 group-hover:text-amber-700'
                  )}
                  aria-hidden="true"
                />
                {!isCollapsed && <span className="truncate">Home</span>}
              </Link>
              {isCollapsed && (
                <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2.5 z-50 whitespace-nowrap rounded-md bg-surface-elevated px-2.5 py-1 text-xs font-medium text-slate-800 border border-border-hover shadow-lg opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
                  Home
                  <div className="absolute -left-1 top-1/2 -translate-y-1/2 size-2 rotate-45 border-l border-b border-border-hover bg-surface-elevated" />
                </div>
              )}
            </div>
          </div>

          {/* 2. Gameplay Tools */}
          <div>
            {!isCollapsed ? (
              <div className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Tools
              </div>
            ) : (
              <div className="w-5 h-px bg-border-subtle mx-auto my-1" />
            )}

            <div className="flex flex-col gap-0.5">
              {gameplayTools.map((tool) => {
                const isActive =
                  pathname === tool.href ||
                  (tool.href !== '/' && pathname.startsWith(tool.href + '/'));
                const Icon = tool.icon;

                return (
                  <div key={tool.href} className="relative group">
                    <Link
                      href={tool.href}
                      aria-label={isCollapsed ? tool.name : undefined}
                      className={cn(
                        'flex items-center rounded-lg transition-colors text-sm press-feedback focus-visible:ring-2 focus-visible:ring-amber-400',
                        isCollapsed ? 'size-10 mx-auto justify-center' : 'px-3 py-2 gap-3',
                        isActive
                          ? 'bg-surface-elevated text-slate-900 font-medium border-l-2 border-amber-400 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-surface-hover'
                      )}
                    >
                      <Icon
                        className={cn(
                          'size-4 shrink-0 transition-colors',
                          isActive ? tool.iconColor : 'text-slate-600 group-hover:text-slate-800'
                        )}
                        aria-hidden="true"
                      />
                      {!isCollapsed && <span className="truncate">{tool.name}</span>}
                    </Link>
                    {isCollapsed && (
                      <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2.5 z-50 whitespace-nowrap rounded-md bg-surface-elevated px-2.5 py-1 text-xs font-medium text-slate-800 border border-border-hover shadow-lg opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
                        {tool.name}
                        <div className="absolute -left-1 top-1/2 -translate-y-1/2 size-2 rotate-45 border-l border-b border-border-hover bg-surface-elevated" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
