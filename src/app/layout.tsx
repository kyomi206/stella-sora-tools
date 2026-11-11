import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Analytics } from '@vercel/analytics/next';
import { SidebarProvider } from '@/components/layout/sidebar-context';
import { ThemeProvider } from '@/components/layout/theme-context';
import { SideTab } from '@/components/layout/side-tab';
import { TopBar } from '@/components/layout/top-bar';
import { Footer } from '@/components/layout/footer';

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0c0e12' },
  ],
  colorScheme: 'light dark',
};

export const metadata: Metadata = {
  title: 'Stella Sora Tools',
  description:
    'A minimal fan companion for Stella Sora with Team Building, Heartlink/Bond Calculator, Events Roadmap, and Trekker Encyclopedia.',
  icons: {
    icon: '/bastelina.png',
  },
};

const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('ss_theme');if(t==='dark'){document.documentElement.classList.add('dark');document.documentElement.style.colorScheme='dark';}}catch(e){}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col md:flex-row game-gradient-bg text-slate-900 font-sans selection:bg-cyan-500/20 selection:text-cyan-800">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:bg-amber-500 focus:text-slate-950 focus:font-semibold focus:rounded-md focus:shadow-lg focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2"
        >
          Skip to content
        </a>
        <ThemeProvider>
          <SidebarProvider>
            <SideTab />
            <div className="flex-1 min-w-0 flex flex-col min-h-screen">
              <TopBar />
              <main id="main-content" className="flex-1 w-full bg-transparent" tabIndex={-1}>
                {children}
              </main>
              <Footer />
            </div>
          </SidebarProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
