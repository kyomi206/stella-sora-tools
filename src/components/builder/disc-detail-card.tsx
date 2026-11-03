'use client';

import { useMemo, useState } from 'react';
import type { NoteName, SSDisc, SSDiscSecondarySkill } from '@/types';
import {
  NOTE_BY_NAME,
  formatDiscSkillSegments,
  getDiscSkillIconUrl,
  getNoteIconUrl,
} from '@/data/notes';
import { ChevronLeft, ChevronRight, Disc, Heart, Sword } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Hover card for the Runic Disc picker, styled after the in-game disc detail
 * window: pale blue panel, teal section ribbons, white skill plates, amber stat
 * values and per-tier harmony requirements. Colours come from the `disc-card`
 * CSS variables so the card has a proper dark counterpart.
 */

const INK = 'text-[var(--dc-ink)]';
const BODY = 'text-[var(--dc-body)]';
const PLATE = 'rounded-lg border border-[var(--dc-plate-border)] bg-[var(--dc-plate)]';

interface DiscDetailCardProps {
  disc: SSDisc;
  slotKind: 'main' | 'support';
}

function cleanEffectType(value: string): string {
  return value.replace(/ELEMENTTYPE_:/gi, '').replace(/\s+/g, ' ').trim();
}

function secondaryStatEntry(stats: Record<string, number | string>) {
  return (
    Object.entries(stats).find(([key]) => key !== 'ATK' && key !== 'HP') ??
    Object.entries(stats).find(([key]) => key === 'HP')
  );
}

function formatStatValue(value: number | string | undefined): string {
  if (value === undefined || value === null) return '—';
  return typeof value === 'number' ? value.toLocaleString('en-US') : String(value);
}

function SectionBanner({ label }: { label: string }) {
  return (
    <div
      className="mb-1.5 flex h-7 w-full items-center bg-[var(--dc-ribbon)] pl-3 pr-5"
      style={{ clipPath: 'polygon(0 0, 100% 0, calc(100% - 14px) 100%, 0 100%)' }}
    >
      <span className="text-[13.5px] font-bold tracking-wide text-white">{label}</span>
    </div>
  );
}

function SkillDescription({
  desc,
  params,
  level,
}: {
  desc: string;
  params: string;
  level: number;
}) {
  const segments = useMemo(
    () => formatDiscSkillSegments(desc, params, level),
    [desc, params, level]
  );

  return (
    <p className={cn('mt-1.5 whitespace-pre-line text-[13px] leading-[1.5]', BODY)}>
      {segments.map((segment, index) =>
        segment.kind === 'value' ? (
          <span key={index} className="font-bold text-[var(--dc-value)]">
            {segment.text}
          </span>
        ) : segment.kind === 'term' ? (
          <span key={index} className="font-semibold text-[var(--dc-term)]">
            {segment.text}
          </span>
        ) : (
          <span key={index}>{segment.text}</span>
        )
      )}
    </p>
  );
}

function RequirementList({ requirement }: { requirement: Record<string, number> }) {
  const rows = Object.entries(requirement || {});
  if (rows.length === 0) return null;

  return (
    <div className="mt-2">
      <div className={cn('mb-1 text-[12.5px] font-bold', INK)}>Activation Requirements:</div>
      <div className="space-y-1">
        {rows.map(([noteName, need]) => {
          const meta = NOTE_BY_NAME[noteName as NoteName];
          return (
            <div
              key={noteName}
              className="flex items-center gap-2 rounded-md bg-[var(--dc-row)] px-2 py-1"
            >
              {meta && (
                <img
                  src={getNoteIconUrl(meta.id)}
                  alt=""
                  className="size-5 shrink-0 object-contain"
                />
              )}
              <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[var(--dc-row-ink)]">
                {meta?.name || noteName}
              </span>
              <span className={cn('shrink-0 text-[13px] font-bold tabular-nums', INK)}>
                ≥{need}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TierPager({
  tier,
  maxTier,
  onChange,
  label,
}: {
  tier: number;
  maxTier: number;
  onChange: (next: number) => void;
  label: string;
}) {
  return (
    <div className="flex shrink-0 items-center gap-0.5 rounded-full bg-[var(--dc-pager)] p-0.5">
      <button
        type="button"
        aria-label={`${label}: previous tier`}
        disabled={tier <= 1}
        onClick={() => onChange(Math.max(1, tier - 1))}
        className="flex size-5 items-center justify-center rounded-full text-[var(--dc-pager-ink)] transition-colors hover:bg-[var(--dc-pager-hover)] disabled:cursor-default disabled:opacity-40 cursor-pointer"
      >
        <ChevronLeft className="size-3.5" />
      </button>
      <span
        className={cn('min-w-4 px-1 text-center text-[12px] font-bold tabular-nums', INK)}
        title={`Tier ${tier} of ${maxTier}`}
      >
        {tier}
      </span>
      <button
        type="button"
        aria-label={`${label}: next tier`}
        disabled={tier >= maxTier}
        onClick={() => onChange(Math.min(maxTier, tier + 1))}
        className="flex size-5 items-center justify-center rounded-full text-[var(--dc-pager-strong)] transition-colors hover:bg-[var(--dc-pager-hover)] disabled:cursor-default disabled:opacity-30 cursor-pointer"
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}

function SkillNamePlate({
  icon,
  name,
  children,
}: {
  icon: string;
  name: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="disc-icon-tile flex size-9 shrink-0 items-center justify-center rounded-md">
        <img src={icon} alt="" className="size-7 object-contain" />
      </span>
      <span className={cn('min-w-0 flex-1 text-[16px] font-bold leading-tight', INK)}>
        {name}
      </span>
      {children}
    </div>
  );
}

function MelodySkill({ disc }: { disc: SSDisc }) {
  const skill = disc.mainSkill;
  if (!skill) return null;

  return (
    <div className={cn(PLATE, 'p-2.5')}>
      <SkillNamePlate icon={getDiscSkillIconUrl(skill.icon)} name={skill.name}>
        <span
          className="flex size-7 shrink-0 items-center justify-center rounded-full border border-[var(--dc-violet-border)] bg-[var(--dc-violet-bg)]"
          title="Melody skill"
        >
          <Disc className="size-4 text-[var(--dc-violet-ink)]" />
        </span>
      </SkillNamePlate>
      <SkillDescription desc={skill.desc} params={skill.params} level={1} />
    </div>
  );
}

function HarmonySkillCard({ skill }: { skill: SSDiscSecondarySkill }) {
  const maxTier = Math.max(1, Math.min(5, skill.requirements?.length || 5));
  const [tier, setTier] = useState(1);

  return (
    <div className={cn(PLATE, 'p-2.5')}>
      <SkillNamePlate icon={getDiscSkillIconUrl(skill.icon)} name={skill.name}>
        <TierPager
          tier={tier}
          maxTier={maxTier}
          onChange={setTier}
          label={`${skill.name} tier`}
        />
      </SkillNamePlate>
      <SkillDescription desc={skill.desc} params={skill.params} level={tier} />
      <RequirementList requirement={skill.requirements?.[tier - 1] || {}} />
    </div>
  );
}

/** Tier-less harmony skill plate: level comes from the caller (e.g. the notes collected in a build). */
export function HarmonySkillDetail({
  skill,
  level,
}: {
  skill: SSDiscSecondarySkill;
  level: number;
}) {
  const tier = Math.max(1, Math.min(5, level || 1));

  return (
    <div className={cn(PLATE, 'p-2.5')}>
      <SkillNamePlate icon={getDiscSkillIconUrl(skill.icon)} name={skill.name} />
      <SkillDescription desc={skill.desc} params={skill.params} level={tier} />
      <RequirementList requirement={skill.requirements?.[tier - 1] || {}} />
    </div>
  );
}

function StatPill({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-1.5 rounded-full border-[1.5px] border-[var(--dc-pill-border)] bg-[var(--dc-pill-bg)] py-0.5 pl-0.5 pr-2.5">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--dc-pill-badge)] text-white">
        {icon}
      </span>
      <span className={cn('min-w-0 flex-1 truncate text-[13px] font-bold', INK)}>{label}</span>
      <span className={cn('shrink-0 text-[13px] font-bold tabular-nums', INK)}>{value}</span>
    </div>
  );
}

function BaseStatsSection({ disc }: { disc: SSDisc }) {
  const stats = disc.stats.lv90 || disc.stats.lv80 || {};
  const effectTypes = useMemo(() => {
    const all = [
      ...(disc.mainSkill?.effectType || []),
      ...(disc.secondarySkill1?.effectType || []),
      ...(disc.secondarySkill2?.effectType || []),
    ];
    return Array.from(new Set(all.map(cleanEffectType))).filter(Boolean);
  }, [disc]);

  return (
    <>
      <SectionBanner label="Base Stats" />
      <div className={cn(PLATE, 'p-2.5')}>
        <div className={cn('text-[12.5px] font-bold', INK)}>Lv 90 max</div>
        <div className="mt-1.5 space-y-1">
          {Object.entries(stats).map(([key, value]) => (
            <div
              key={key}
              className="flex items-center gap-2 rounded-md bg-[var(--dc-row)] px-2 py-1 text-[13px]"
            >
              <span className="min-w-0 flex-1 truncate font-semibold text-[var(--dc-row-ink)]">
                {key}
              </span>
              <span className={cn('shrink-0 font-bold tabular-nums', INK)}>
                {formatStatValue(value)}
              </span>
            </div>
          ))}
        </div>

        {effectTypes.length > 0 && (
          <>
            <div className={cn('mt-2.5 text-[12.5px] font-bold', INK)}>Effect Types</div>
            <div className="mt-1 flex flex-wrap gap-1">
              {effectTypes.map((type) => (
                <span
                  key={type}
                  className="rounded bg-[var(--dc-chip)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--dc-chip-ink)]"
                >
                  {type}
                </span>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}

function StartingNotesSection({ disc }: { disc: SSDisc }) {
  const notes = disc.supportNote?.[disc.supportNote.length - 1] || {};
  const rows = Object.entries(notes);
  if (rows.length === 0) return null;

  return (
    <div className="mt-3">
      <SectionBanner label="Starting Notes" />
      <div className={cn(PLATE, 'p-2.5')}>
        <p className={cn('mb-1.5 text-[13px] leading-relaxed', BODY)}>
          Grants these Musical Notes at max promotion.
        </p>
        <div className="space-y-1">
          {rows.map(([noteName, count]) => {
            const meta = NOTE_BY_NAME[noteName as NoteName];
            return (
              <div
                key={noteName}
                className="flex items-center gap-2 rounded-md bg-[var(--dc-row)] px-2 py-1"
              >
                {meta && (
                  <img
                    src={getNoteIconUrl(meta.id)}
                    alt=""
                    className="size-5 shrink-0 object-contain"
                  />
                )}
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[var(--dc-row-ink)]">
                  {meta?.name || noteName}
                </span>
                <span className={cn('shrink-0 text-[13px] font-bold tabular-nums', INK)}>
                  +{count}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function DiscDetailCard({ disc, slotKind }: DiscDetailCardProps) {
  const tabs = useMemo(() => {
    const tags = disc.tag || [];
    const withSkills = tags.includes('Skills') ? tags : ['Skills', ...tags];
    return withSkills.slice(0, 3);
  }, [disc.tag]);
  const [activeTab, setActiveTab] = useState('Skills');

  const stats = disc.stats.lv90 || disc.stats.lv80 || {};
  const secondaryStat = secondaryStatEntry(stats);

  return (
    <div className="disc-card max-h-[calc(100vh-40px)] w-full select-none overflow-y-auto overscroll-contain rounded-xl border border-[var(--dc-panel-border)] bg-[var(--dc-panel)] text-[var(--dc-ink)] shadow-[var(--dc-shadow)] scrollbar-thin">
      <div className="px-3.5 pb-3 pt-3">
        <h3 className={cn('text-[19px] font-extrabold leading-tight tracking-tight', INK)}>
          {disc.name}
        </h3>

        <div className="mt-2 flex items-center gap-2">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--dc-emblem-bg)] ring-1 ring-[var(--dc-emblem-ring)]">
            {disc.element !== 'None' ? (
              <img
                src={`/ss-element/${disc.element}.webp`}
                alt={disc.element}
                className="size-6 object-contain"
              />
            ) : (
              <Disc className="size-5 text-[#e7b98a]" />
            )}
          </span>

          <div role="tablist" aria-label={`${disc.name} categories`} className="flex flex-1 gap-1">
            {tabs.map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={activeTab === tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'rounded-[3px] px-2.5 py-1 text-[13px] font-bold transition-colors cursor-pointer',
                  activeTab === tab
                    ? 'bg-[var(--dc-tab-active)] text-[var(--dc-ink)] shadow-[0_1px_2px_rgba(0,0,0,0.25)]'
                    : 'bg-[var(--dc-tab)] text-[var(--dc-tab-ink)] hover:bg-[var(--dc-tab-hover)]'
                )}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-2.5 grid grid-cols-2 gap-2">
          <StatPill
            icon={<Sword className="size-3.5" />}
            label="Base ATK"
            value={formatStatValue(stats.ATK)}
          />
          <StatPill
            icon={
              secondaryStat?.[0] === 'HP' ? (
                <Heart className="size-3.5 fill-current" />
              ) : disc.element !== 'None' ? (
                <img
                  src={`/ss-element/${disc.element}.webp`}
                  alt=""
                  className="size-4 object-contain drop-shadow"
                />
              ) : (
                <Disc className="size-3.5" />
              )
            }
            label={secondaryStat?.[0] || 'Bonus'}
            value={formatStatValue(secondaryStat?.[1])}
          />
        </div>
      </div>

      <div className="border-t border-[var(--dc-divider)] px-2.5 pb-3 pt-1">
        {activeTab !== 'Skills' ? (
          <BaseStatsSection disc={disc} />
        ) : (
          <>
            <div className="mt-2 first:mt-1">
              <SectionBanner label="Melody Skill" />
            </div>
            <MelodySkill disc={disc} />

            {(disc.secondarySkill1 || disc.secondarySkill2) && (
              <>
                <div className="mt-3">
                  <SectionBanner label="Harmony Skill" />
                </div>
                {slotKind === 'support' && (
                  <p className="mb-1.5 text-[11.5px] font-medium text-[var(--dc-muted)]">
                    Inactive while equipped in a Support slot.
                  </p>
                )}
                <div className="space-y-2">
                  {disc.secondarySkill1 && (
                    <HarmonySkillCard
                      key={disc.secondarySkill1.id}
                      skill={disc.secondarySkill1}
                    />
                  )}
                  {disc.secondarySkill2 && (
                    <HarmonySkillCard
                      key={disc.secondarySkill2.id}
                      skill={disc.secondarySkill2}
                    />
                  )}
                </div>
              </>
            )}

            {slotKind === 'support' && <StartingNotesSection disc={disc} />}
          </>
        )}
      </div>
    </div>
  );
}
