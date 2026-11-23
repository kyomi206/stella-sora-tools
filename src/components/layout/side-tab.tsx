'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Swords,
  Heart,
  Users,
  Disc,
  Calendar,
  Calculator,
  Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSidebar } from '@/components/layout/sidebar-context';
import { useOverlayExit } from '@/lib/use-overlay-exit';

export function SideTab() {
  const pathname = usePathname();
  const { isCollapsed, isMobileOpen, setIsMobileOpen } = useSidebar();

  const { requestClose: handleCloseMobile, isClosing: isMobileClosing } = useOverlayExit(
    () => setIsMobileOpen(false),
    isMobileOpen,
    180
  );

  // Close mobile drawer on route change
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname, setIsMobileOpen]);

  // Close mobile drawer on Escape key
  useEffect(() => {
    if (!isMobileOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCloseMobile();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileOpen, handleCloseMobile]);

  const gameplayTools = [
    {
      name: 'Preset Visualizer',
      href: '/builder',
      icon: Swords,
    },
    {
      name: 'Community Builds',
      href: '/builds',
      icon: Layers,
    },
    {
      name: 'Affinity Calculator',
      href: '/bond',
      icon: Heart,
    },
    {
      name: 'Resource Calculator',
      href: '/calculator',
      icon: Calculator,
    },
    {
      name: 'Events Roadmap',
      href: '/roadmap',
      icon: Calendar,
    },
    {
      name: 'Trekker Encyclopedia',
      href: '/trekkers',
      icon: Users,
    },
    {
      name: 'Runic Discs',
      href: '/discs',
      icon: Disc,
    },
  ];

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {(isMobileOpen || isMobileClosing) && (
        <button
          type="button"
          aria-label="Close navigation menu"
          className={cn(
            'md:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm w-full h-full border-0 cursor-default',
            isMobileClosing ? 'backdrop-exit' : 'overlay-backdrop'
          )}
          onClick={handleCloseMobile}
        />
      )}

      {/* Main Sidebar (Docked on desktop, drawer on mobile) */}
      <aside
        aria-label="Tools Navigation Sidebar"
        className={cn(
          'border-r border-border-subtle select-none z-40 flex flex-col rail-collapse',
          // Desktop styles: static in flex flow, sticky to viewport height
          'hidden md:flex md:shrink-0 md:h-dvh md:sticky md:top-0',
          isCollapsed ? 'md:w-14' : 'md:w-60',
          // Mobile styles: fixed slide-over drawer below TopBar (h-12)
          (isMobileOpen || isMobileClosing) && [
            'game-gradient-bg !flex fixed left-0 top-12 bottom-0 w-64 shadow-2xl z-50',
            isMobileClosing ? 'sidebar-mobile-exit' : 'sidebar-mobile-enter'
          ]
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
              aria-label="Stella Sora Tools"
              className="flex items-center gap-2.5 overflow-hidden press-feedback rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <div className="size-7 rounded-md bg-surface-elevated border border-amber-500/30 shadow-xs flex items-center justify-center overflow-hidden shrink-0">
                <img src="/bastelina.png" alt="Bastelina" width={28} height={28} className="size-full object-contain" />
              </div>
              <span
                className={cn(
                  'font-bold text-sm tracking-tight text-slate-900 leading-tight rail-label',
                  isCollapsed ? 'rail-label-collapsed' : 'rail-label-expanded'
                )}
              >
                Stella Sora Tools
              </span>
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
                aria-label="Home"
                onClick={() => { if (isMobileOpen) handleCloseMobile(); }}
                className={cn(
                  'flex items-center rounded-lg transition-colors text-sm press-feedback focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 h-10 px-2.5 gap-3',
                  pathname === '/'
                    ? 'bg-surface-elevated text-slate-900 dark:text-white font-semibold border border-border-subtle'
                    : 'text-slate-600 hover:text-slate-900 focus-visible:text-slate-900 hover:bg-surface-hover focus-visible:bg-surface-hover border border-transparent'
                )}
              >
                <Home className="size-4 shrink-0" aria-hidden="true" />
                <span
                  className={cn(
                    'rail-label',
                    isCollapsed ? 'rail-label-collapsed' : 'rail-label-expanded'
                  )}
                >
                  Home
                </span>
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
            <div className="h-5 flex items-center px-2.5 mb-1 overflow-hidden">
              <span
                className={cn(
                  'text-xs font-medium text-slate-500 dark:text-slate-400 rail-label',
                  isCollapsed ? 'rail-label-collapsed' : 'rail-label-expanded'
                )}
              >
                Tools
              </span>
              <div
                className={cn(
                  'w-5 h-px bg-border-subtle mx-auto transition-opacity duration-200',
                  isCollapsed ? 'opacity-100' : 'opacity-0 hidden'
                )}
              />
            </div>

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
                      aria-label={tool.name}
                      onClick={() => { if (isMobileOpen) handleCloseMobile(); }}
                      className={cn(
                        'flex items-center rounded-lg transition-colors text-sm press-feedback focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 h-10 px-2.5 gap-3',
                        isActive
                          ? 'bg-surface-elevated text-slate-900 dark:text-white font-semibold border border-border-subtle'
                          : 'text-slate-600 hover:text-slate-900 focus-visible:text-slate-900 hover:bg-surface-hover focus-visible:bg-surface-hover border border-transparent'
                      )}
                    >
                      <Icon className="size-4 shrink-0" aria-hidden="true" />
                      <span
                        className={cn(
                          'rail-label',
                          isCollapsed ? 'rail-label-collapsed' : 'rail-label-expanded'
                        )}
                      >
                        {tool.name}
                      </span>
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
