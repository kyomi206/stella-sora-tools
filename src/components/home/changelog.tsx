import { Tag, CheckCircle2, ChevronDown } from 'lucide-react';

export function Changelog() {
  const updates = [
    {
      version: 'v0.2.0',
      date: 'October 26, 2026',
      title: 'Minimal Redesign & Events Roadmap Update',
      changes: [
        'Streamlined navigation with dedicated, docked left sidebar and fluid canvas layout',
        'Calm warm-neutral design system replacing neon glows, gradient text, and nested borders',
        'Direct 3-row tabular Heartlink gift allocation optimizer with inline steppers',
        'Universal dark warm-slate Trekker card system across Team Builder, Encyclopedia, and Modals',
        'Authentic 2025–2026 Stella Sora Events Roadmap timeline spanning Launch to 1st Anniversary',
      ],
    },
    {
      version: 'v0.1.0',
      date: 'October 25, 2026',
      title: "Initial Release: Tyrant's Toolkit",
      changes: [
        'Team Builder & Build Maker with Vanguard, Versatile, and Support seats inspired by noyanoya',
        'Interactive Potentials selector with vestige frames and drag-and-drop customization',
        'One-click high-resolution Team Card image export',
        'Complete Heartlink & Bond Calculator with 1–99 affinity EXP curve from datamines',
        'Optimal Gift Box allocation engine & daily Outing bonus simulator',
        'Multilingual Trekker encyclopedia with element and role filters',
      ],
    },
  ];

  return (
    <details className="group game-card celestial-card">
      <summary className="flex items-center justify-between p-5 sm:p-6 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden rounded-xl focus-visible:ring-2 focus-visible:ring-amber-400">
        <div className="flex items-center gap-2">
          <Tag className="size-4 text-amber-600" aria-hidden="true" />
          <h2 className="text-base font-semibold text-slate-900">
            Changelog & Updates
          </h2>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="text-xs text-amber-700/90 font-mono bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
            v0.2.0
          </span>
          <ChevronDown
            className="size-4 text-slate-600 transition-transform duration-200 group-open:rotate-180"
            aria-hidden="true"
          />
        </div>
      </summary>

      <div className="px-5 sm:px-6 pb-5 sm:pb-6 pt-4 border-t border-border-subtle space-y-6">
        {updates.map((item) => (
          <div key={item.version} className="space-y-3 pb-4 border-b border-border-subtle last:border-b-0 last:pb-0">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-300">
                {item.version}
              </span>
              <span className="text-xs text-slate-500">{item.date}</span>
            </div>

            <h3 className="text-sm font-medium text-slate-900">
              {item.title}
            </h3>

            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600">
              {item.changes.map((change, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <CheckCircle2 className="size-3.5 text-slate-600 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{change}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </details>
  );
}
