import { toAbsoluteUrl } from '../seo.ts';
import { FEEDBACK_CATEGORY_LABELS, type FeedbackCategory } from './validation.ts';

export interface DiscordFeedbackPayload {
  id: string;
  category: FeedbackCategory;
  pageContext: string | null;
  message: string;
  contact: string | null;
}

const MAX_EMBED_MESSAGE_LENGTH = 950;

export function buildDiscordFeedbackEmbed(
  payload: DiscordFeedbackPayload
): Record<string, unknown> {
  const adminUrl = toAbsoluteUrl('/admin/feedback');
  const categoryLabel = FEEDBACK_CATEGORY_LABELS[payload.category] || payload.category;
  const detailsValue =
    payload.message.length > MAX_EMBED_MESSAGE_LENGTH
      ? `${payload.message.slice(0, MAX_EMBED_MESSAGE_LENGTH)}…`
      : payload.message;

  return {
    title: `New Feedback · ${categoryLabel}`,
    url: adminUrl,
    color: 0xf59e0b,
    fields: [
      { name: 'Category', value: categoryLabel, inline: true },
      { name: 'Where', value: payload.pageContext || 'General', inline: true },
      { name: 'Contact', value: payload.contact || 'Anonymous', inline: true },
      { name: 'Details', value: detailsValue, inline: false },
      {
        name: 'Inbox',
        value: `[Open /admin/feedback](${adminUrl})`,
        inline: false,
      },
    ],
    timestamp: new Date().toISOString(),
  };
}

export async function notifyDiscordFeedbackSubmitted(
  payload: DiscordFeedbackPayload
): Promise<void> {
  // Never fall back to DISCORD_BUILD_WEBHOOK_URL; feedback may include private contact info.
  const webhookUrl = process.env.DISCORD_FEEDBACK_WEBHOOK_URL?.trim();
  if (!webhookUrl) return;

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [buildDiscordFeedbackEmbed(payload)],
      }),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) {
      console.warn('Discord feedback webhook returned non-OK status:', res.status);
    }
  } catch (err) {
    console.warn('Discord feedback webhook notification failed:', err);
  }
}
