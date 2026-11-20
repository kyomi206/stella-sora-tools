import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Analytics } from '@vercel/analytics/next';
import { SidebarProvider } from '@/components/layout/sidebar-context';
import { ThemeProvider } from '@/components/layout/theme-context';
import { SideTab } from '@/components/layout/side-tab';
import { TopBar } from '@/components/layout/top-bar';
import { Footer } from '@/components/layout/footer';
import { getSiteUrl } from '@/lib/site-url';
import {
  DEFAULT_OG_ALT,
  DEFAULT_OG_HEIGHT,
  DEFAULT_OG_IMAGE,
  DEFAULT_OG_WIDTH,
  SITE_NAME,
} from '@/lib/seo';

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0c0e12' },
  ],
  colorScheme: 'light dark',
};

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  applicationName: SITE_NAME,
  title: {
    default: 'KiyoStella — Stella Sora Tools, Squad Builder & Encyclopedia',
    template: '%s | kiyostella',
  },
  description:
    'KiyoStella is a Stella Sora web companion featuring a Squad & Preset Visualizer, Affinity Gift Calculator, Resource Calculator, Events Roadmap, Trekker Encyclopedia, and Runic Disc Encyclopedia.',
  icons: {
    icon: '/bastelina.png',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: SITE_NAME,
    url: '/',
    title: 'KiyoStella — Stella Sora Tools, Squad Builder & Encyclopedia',
    description:
      'KiyoStella is a Stella Sora web companion featuring a Squad & Preset Visualizer, Affinity Gift Calculator, Resource Calculator, Events Roadmap, Trekker Encyclopedia, and Runic Disc Encyclopedia.',
    images: [
      {
        url: DEFAULT_OG_IMAGE,
        width: DEFAULT_OG_WIDTH,
        height: DEFAULT_OG_HEIGHT,
        alt: DEFAULT_OG_ALT,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'KiyoStella — Stella Sora Tools, Squad Builder & Encyclopedia',
    description:
      'KiyoStella is a Stella Sora web companion featuring a Squad & Preset Visualizer, Affinity Gift Calculator, Resource Calculator, Events Roadmap, Trekker Encyclopedia, and Runic Disc Encyclopedia.',
    images: [DEFAULT_OG_IMAGE],
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
