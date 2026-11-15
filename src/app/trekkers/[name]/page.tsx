import { Suspense } from 'react';
import charactersData from '@/data/characters.json';
import TrekkerDetailClient from './trekker-detail-client';

/**
 * Generate static paths for all 41 Trekkers in the local dataset.
 * Supports canonical English names, URL-encoded names, and numeric IDs.
 */
export function generateStaticParams() {
  const list = Object.values(charactersData);
  const params: { name: string }[] = [];
  for (const c of list) {
    params.push({ name: c.name.EN });
    if (c.name.EN.includes(' ')) {
      params.push({ name: encodeURIComponent(c.name.EN) });
    }
    params.push({ name: String(c.id) });
  }
  return params;
}

interface TrekkerPageProps {
  params: Promise<{ name: string }>;
}

async function TrekkerPageContent({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;

  return <TrekkerDetailClient name={name} />;
}

export default function TrekkerPage(props: TrekkerPageProps) {
  return (
    <Suspense
      fallback={
        <div className="max-w-6xl mx-auto px-4 py-8 text-center">
          <div className="game-card celestial-card p-8 inline-block max-w-sm w-full animate-pulse">
            <div className="size-12 rounded-full bg-surface-elevated border border-border-subtle mx-auto mb-3" />
            <div className="h-5 bg-surface-elevated border border-border-subtle rounded w-32 mx-auto mb-2" />
            <div className="h-3 bg-surface-elevated border border-border-subtle rounded w-48 mx-auto" />
          </div>
        </div>
      }
    >
      <TrekkerPageContent params={props.params} />
      {/* 
        Companion Quick Action Navigation contracts:
        - /builder?char=${char.id}
        - /damage?char=${char.id}
        - /bond?char=${char.id}
        - https://stellasora.miraheze.org/wiki/${name}
        Offline Data Stores:
        - @/data/character-combat.json
        - @/data/potentials-db.json
      */}
    </Suspense>
  );
}
