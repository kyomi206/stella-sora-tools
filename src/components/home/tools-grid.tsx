import Link from 'next/link';
import { Swords, Heart, Users, Disc, Calendar, Calculator, Layers } from 'lucide-react';

export function ToolsGrid() {
  const tools = [
    {
      title: 'Preset Visualizer',
      href: '/builder',
      icon: Swords,
      description:
        'Visualize your presets. Create presets for yourself, or to share with other players.',
    },
    {
      title: 'Affinity Calculator',
      href: '/bond',
      icon: Heart,
      description:
        'Calculate the affinity level you can get from giving gifts to your trekkers.',
    },
    {
      title: 'Resource Calculator',
      href: '/calculator',
      icon: Calculator,
      description:
        'Calculate required promotion materials, level-up exp, and skill upgrade costs for trekkers.',
    },
    {
      title: 'Events Roadmap',
      href: '/roadmap',
      icon: Calendar,
      description:
        'Interactive timeline tracking character banners, Boss Blitz, events, and more.',
    },
    {
      title: 'Trekker Encyclopedia',
      href: '/trekkers',
      icon: Users,
      description:
        "Browse every Trekker's combat role, skills, potentials, and affinity gifts.",
    },
    {
      title: 'Runic Disc Encyclopedia',
      href: '/discs',
      icon: Disc,
      description:
        'Browse all Runic Discs. Filter by element, tags, or Musical Notes and inspect Melody, Harmony, and Support skills.',
    },
    {
      title: 'Community Builds & Guides',
      href: '/builds',
      icon: Layers,
      description:
        'Browse community squad presets across all 6 elements with potential codes, F2P swaps, and investment math.',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {tools.map((tool, index) => {
        const Icon = tool.icon;
        const isLastOdd = index === tools.length - 1 && tools.length % 2 === 1;
        return (
          <Link
            key={tool.title}
            href={tool.href}
            className={`block group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded-xl ${
              isLastOdd ? 'md:col-span-2' : ''
            }`}
          >
            <div className="h-full p-5 game-card celestial-card hover:border-border-hover transition-colors duration-200 flex flex-col press-feedback">
              <div className="flex items-center gap-2.5 mb-2.5">
                <Icon className="size-4.5 shrink-0 text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors" aria-hidden="true" />
                <h3 className="text-base sm:text-lg font-semibold text-slate-900 group-hover:text-amber-800 transition-colors">
                  {tool.title}
                </h3>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                {tool.description}
              </p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
