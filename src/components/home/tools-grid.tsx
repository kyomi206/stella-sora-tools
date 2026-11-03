import Link from 'next/link';
import { Swords, Heart, Users, Calendar, Calculator } from 'lucide-react';

export function ToolsGrid() {
  const tools = [
    {
      title: 'Preset Visualizer',
      href: '/builder',
      icon: Swords,
      iconStyle: 'text-rose-600',
      description:
        'Visualize your presets. Create presets for yourself, or to share with other players.',
    },
    {
      title: 'Affinity Calculator',
      href: '/bond',
      icon: Heart,
      iconStyle: 'text-purple-700',
      description:
        'Calculate the affinity level you can get from giving gifts to your trekkers.',
    },
    {
      title: 'Resource Calculator',
      href: '/calculator',
      icon: Calculator,
      iconStyle: 'text-amber-700',
      description:
        'Calculate required promotion materials, level-up exp, and skill upgrade costs for trekkers.',
    },
    {
      title: 'Events Roadmap & Schedule',
      href: '/roadmap',
      icon: Calendar,
      iconStyle: 'text-sky-700',
      description:
        'Interactive timeline tracking character banners, Boss Blitz, events, and more.',
    },
    {
      title: 'Trekker Encyclopedia',
      href: '/trekkers',
      icon: Users,
      iconStyle: 'text-emerald-700',
      description:
        "Explore trekkers' profiles. Search for a specific trekker and view their combat roles, potentials lists, elements…",
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
            className={`block group focus-visible:ring-2 focus-visible:ring-amber-400 rounded-xl ${
              isLastOdd ? 'md:col-span-2' : ''
            }`}
          >
            <div className="h-full p-5 game-card celestial-card hover:border-border-hover transition-colors duration-300 flex flex-col press-feedback">
              <div className="flex items-center gap-2.5 mb-2.5">
                <Icon className={`size-5 shrink-0 transition-transform group-hover:scale-105 ${tool.iconStyle}`} aria-hidden="true" />
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
