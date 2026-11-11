'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { PanelLeft, ChevronRight, Sun, Moon } from 'lucide-react';
import { useSidebar } from '@/components/layout/sidebar-context';
import { useTheme } from '@/components/layout/theme-context';
import { cn } from '@/lib/utils';

interface BreadcrumbItem {
  name: string;
  href: string;
}

interface BreadcrumbConfig {
  category?: string;
  categoryHref?: string;
  items?: BreadcrumbItem[];
  name: string;
  href: string;
}

const ROUTE_BREADCRUMBS: Record<string, BreadcrumbConfig> = {
  '/': {
    name: 'Home',
    href: '/',
  },
  '/builder': {
    category: 'Gameplay Tools',
    categoryHref: '/',
    name: 'Preset Visualizer',
    href: '/builder',
  },
  '/builder/advanced': {
    category: 'Gameplay Tools',
    categoryHref: '/',
    items: [
      { name: 'Preset Visualizer', href: '/builder' },
    ],
    name: 'Advanced Visualizer',
    href: '/builder/advanced',
  },
  '/damage': {
    category: 'Gameplay Tools',
    categoryHref: '/',
    items: [
      { name: 'Preset Visualizer', href: '/builder' },
      { name: 'Advanced Visualizer', href: '/builder/advanced' },
    ],
    name: 'Damage Calculator',
    href: '/damage',
  },
  '/bond': {
    category: 'Gameplay Tools',
    categoryHref: '/',
    name: 'Affinity Calculator',
    href: '/bond',
  },
  '/calculator': {
    category: 'Gameplay Tools',
    categoryHref: '/',
    name: 'Resource Calculator',
    href: '/calculator',
  },
  '/roadmap': {
    category: 'Gameplay Tools',
    categoryHref: '/',
    name: 'Timeline Visualizer',
    href: '/roadmap',
  },
  '/trekkers': {
    category: 'Gameplay Tools',
    categoryHref: '/',
    name: 'Trekker Encyclopedia',
    href: '/trekkers',
  },
  '/credits': {
    name: 'Credits & Attributions',
    href: '/credits',
  },
};

function TopBarContent() {
  const pathname = usePathname();
  const { isCollapsed, toggleCollapsed, toggleMobileOpen } = useSidebar();
  const { toggleTheme } = useTheme();
  const [isHidden, setIsHidden] = useState(false);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY;
      if (currentY <= 16) {
        setIsHidden((prev) => (prev ? false : prev));
      } else if (currentY > lastScrollY.current + 6) {
        setIsHidden((prev) => (prev ? prev : true));
      } else if (currentY < lastScrollY.current - 6) {
        setIsHidden((prev) => (prev ? false : prev));
      }
      lastScrollY.current = currentY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  let currentBreadcrumb = ROUTE_BREADCRUMBS[pathname];

  if (!currentBreadcrumb && pathname.startsWith('/trekkers/')) {
    const rawName = pathname.replace('/trekkers/', '').replace(/\/+$/, '');
    if (rawName) {
      currentBreadcrumb = {
        category: 'Gameplay Tools',
        categoryHref: '/',
        items: [
          { name: 'Trekker Encyclopedia', href: '/trekkers' },
        ],
        name: decodeURIComponent(rawName),
        href: pathname,
      };
    }
  }

  if (!currentBreadcrumb) {
    currentBreadcrumb = {
      name: 'Stella Sora Tools',
      href: '/',
    };
  }

  const handleToggle = () => {
    // If mobile screen, toggle mobile drawer; if desktop, toggle collapse
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      toggleMobileOpen();
    } else {
      toggleCollapsed();
    }
  };

  return (
    <header
      className={cn(
        'sticky top-0 z-30 flex h-12 w-full items-center justify-between border-b border-border-subtle bg-surface-subtle/90 px-3 sm:px-4 backdrop-blur-md select-none transition-transform duration-200',
        isHidden && '-translate-y-full pointer-events-none'
      )}
    >
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
        {/* Mobile Brand Avatar (< md screens) */}
        <Link
          href="/"
          className="md:hidden flex items-center gap-2 shrink-0 press-feedback rounded-md focus-visible:ring-2 focus-visible:ring-amber-400"
          aria-label="Stella Sora Tools Home"
        >
          <div className="size-7 rounded-md bg-surface-elevated border border-amber-500/30 flex items-center justify-center overflow-hidden shrink-0">
            <img src="/bastelina.png" alt="Bastelina" width={28} height={28} className="size-full object-contain" />
          </div>
        </Link>

        {/* Collapse / Expand Toggle Button with tooltip text bubble */}
        <div className="relative group shrink-0">
          <button
            type="button"
            onClick={handleToggle}
            className="flex size-7 items-center justify-center rounded-md border border-border-hover bg-surface-hover text-slate-700 hover:text-slate-900 hover:border-amber-500/40 hover:bg-surface-elevated transition-colors cursor-pointer press-feedback focus-visible:ring-2 focus-visible:ring-amber-400"
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!isCollapsed}
          >
            <PanelLeft className="size-4" aria-hidden="true" />
          </button>

          {/* Text bubble (custom tooltip) */}
          <div className="pointer-events-none absolute left-0 sm:left-full top-full sm:top-1/2 sm:-translate-y-1/2 mt-2 sm:mt-0 sm:ml-2.5 z-50 whitespace-nowrap rounded-md bg-surface-elevated px-2.5 py-1 text-xs font-medium text-slate-800 border border-border-hover shadow-lg opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
            {isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            {/* Left triangle pointer for desktop */}
            <div className="hidden sm:block absolute -left-1 top-1/2 -translate-y-1/2 size-2 rotate-45 border-l border-b border-border-hover bg-surface-elevated" />
          </div>
        </div>

        {/* Vertical divider */}
        <div className="h-4 w-px bg-border shrink-0" />

        {/* Breadcrumb Navigation - Clickable */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm min-w-0 truncate">
          {currentBreadcrumb.category && (
            <>
              <Link
                href={currentBreadcrumb.categoryHref || '/'}
                className="hidden sm:inline font-medium text-slate-600 hover:text-slate-800 transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 rounded shrink-0"
              >
                {currentBreadcrumb.category}
              </Link>

              <ChevronRight className="hidden sm:inline size-3.5 text-slate-500 shrink-0" aria-hidden="true" />
            </>
          )}

          {currentBreadcrumb.items?.map((item) => (
            <div key={item.href} className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <Link
                href={item.href}
                className="font-medium text-slate-600 hover:text-slate-800 transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 rounded shrink-0"
              >
                {item.name}
              </Link>

              <ChevronRight className="size-3.5 text-slate-500 shrink-0" aria-hidden="true" />
            </div>
          ))}

          <Link
            href={currentBreadcrumb.href}
            className="font-semibold text-slate-900 hover:text-amber-700 transition-colors tracking-tight focus-visible:ring-2 focus-visible:ring-amber-400 rounded truncate"
          >
            {currentBreadcrumb.name}
          </Link>
        </nav>
      </div>

      {/* Theme Toggle */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={toggleTheme}
          className="flex size-7 items-center justify-center rounded-md border border-border-hover bg-surface-hover text-slate-700 hover:text-slate-900 hover:border-amber-500/40 hover:bg-surface-elevated transition-colors cursor-pointer press-feedback focus-visible:ring-2 focus-visible:ring-amber-400"
          aria-label="Toggle color theme"
          title="Toggle color theme"
        >
          <Sun className="hidden size-4 dark:block" aria-hidden="true" />
          <Moon className="size-4 dark:hidden" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}

export function TopBar() {
  return (
    <Suspense
      fallback={
        <header className="sticky top-0 z-30 flex h-12 w-full items-center justify-between border-b border-border-subtle bg-surface-subtle/90 px-3 sm:px-4 backdrop-blur-md select-none">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <span className="font-semibold text-slate-900 tracking-tight text-xs sm:text-sm">
              Stella Sora Tools
            </span>
          </div>
        </header>
      }
    >
      <TopBarContent />
    </Suspense>
  );
}

