export type FeedbackCategory = 'bug' | 'math' | 'feature' | 'other';
export type FeedbackStatus = 'open' | 'resolved';

export const FEEDBACK_CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  bug: 'Bug / UI',
  math: 'Math / Data',
  feature: 'Feature Idea',
  other: 'Other',
};

export const FEEDBACK_SITE_SECTIONS: ReadonlyArray<{
  value: string;
  label: string;
  prefix?: string;
}> = [
  { value: '', label: 'General / Whole Site' },
  { value: '/builder', label: 'Preset Visualizer', prefix: '/builder' },
  { value: '/builds', label: 'Community Builds', prefix: '/builds' },
  { value: '/damage', label: 'Damage Calculator', prefix: '/damage' },
  { value: '/bond', label: 'Affinity Calculator', prefix: '/bond' },
  { value: '/calculator', label: 'Resource Calculator', prefix: '/calculator' },
  { value: '/roadmap', label: 'Events Roadmap', prefix: '/roadmap' },
  { value: '/trekkers', label: 'Trekker Encyclopedia', prefix: '/trekkers' },
  { value: '/discs', label: 'Runic Discs', prefix: '/discs' },
];

const VALID_CATEGORIES = new Set<FeedbackCategory>([
  'bug',
  'math',
  'feature',
  'other',
]);

export interface ValidatedFeedbackInput {
  category: FeedbackCategory;
  pageContext: string | null;
  message: string;
  contact: string | null;
}

export type FeedbackValidationResult =
  | { ok: true; data: ValidatedFeedbackInput }
  | { ok: false; error: string };

function stripControlChars(input: string, preserveNewlines = false): string {
  if (preserveNewlines) {
    return input
      .replace(/\r\n?/g, '\n')
      .replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '')
      .replace(/\t/g, ' ');
  }
  return input.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ');
}

export function resolveFeedbackFromPath(raw: string | null | undefined): {
  sectionValue: string;
  exactPath: string | null;
} {
  if (!raw || typeof raw !== 'string') {
    return { sectionValue: '', exactPath: null };
  }

  const cleaned = raw.replace(/[\u0000-\u001F\u007F]/g, '').trim();
  const pathname = cleaned.split(/[?#]/)[0]?.trim() || '';

  if (!/^\/(?!\/)/.test(pathname) || pathname.includes('\\')) {
    return { sectionValue: '', exactPath: null };
  }

  if (
    pathname === '/feedback' ||
    pathname.startsWith('/feedback/') ||
    pathname === '/admin' ||
    pathname.startsWith('/admin/')
  ) {
    return { sectionValue: '', exactPath: null };
  }

  const safePath = pathname.slice(0, 120);

  let matchedValue = '';
  let longestPrefix = 0;
  for (const section of FEEDBACK_SITE_SECTIONS) {
    if (!section.prefix) continue;
    if (
      (safePath === section.prefix || safePath.startsWith(`${section.prefix}/`)) &&
      section.prefix.length > longestPrefix
    ) {
      longestPrefix = section.prefix.length;
      matchedValue = section.value;
    }
  }

  return {
    sectionValue: matchedValue,
    exactPath: safePath,
  };
}

export function validateFeedbackInput(raw: unknown): FeedbackValidationResult {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'Invalid request body.' };
  }

  const obj = raw as Record<string, unknown>;

  if (typeof obj.website === 'string' && obj.website.trim().length > 0) {
    return { ok: false, error: 'Invalid submission.' };
  }

  if (
    typeof obj.category !== 'string' ||
    !VALID_CATEGORIES.has(obj.category as FeedbackCategory)
  ) {
    return { ok: false, error: 'Please choose a valid feedback category.' };
  }
  const category = obj.category as FeedbackCategory;

  const message =
    typeof obj.message === 'string'
      ? stripControlChars(obj.message, true).trim()
      : '';
  if (message.length < 10) {
    return {
      ok: false,
      error: 'Please write at least 10 characters so we have enough detail.',
    };
  }
  if (message.length > 2000) {
    return {
      ok: false,
      error: 'Feedback details must be 2,000 characters or fewer.',
    };
  }

  let pageContext: string | null = null;
  if (obj.pageContext !== undefined && obj.pageContext !== null) {
    if (typeof obj.pageContext !== 'string') {
      return { ok: false, error: 'Invalid page context.' };
    }
    const cleanContext = stripControlChars(obj.pageContext, false).trim();
    if (cleanContext.length > 120) {
      return {
        ok: false,
        error: 'Page context must be 120 characters or fewer.',
      };
    }
    pageContext = cleanContext || null;
  }

  let contact: string | null = null;
  if (obj.contact !== undefined && obj.contact !== null) {
    if (typeof obj.contact !== 'string') {
      return { ok: false, error: 'Invalid contact info.' };
    }
    const cleanContact = stripControlChars(obj.contact, false).trim();
    if (cleanContact.length > 120) {
      return {
        ok: false,
        error: 'Contact info must be 120 characters or fewer.',
      };
    }
    contact = cleanContact || null;
  }

  return {
    ok: true,
    data: {
      category,
      pageContext,
      message,
      contact,
    },
  };
}

export function generateFeedbackId(nowMs: number = Date.now()): string {
  const safeMs = Number.isFinite(nowMs) && nowMs > 0 ? Math.floor(nowMs) : Date.now();
  const bytes = new Uint8Array(3);
  globalThis.crypto.getRandomValues(bytes);
  const rand = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `fb_${safeMs.toString(36)}_${rand}`;
}
