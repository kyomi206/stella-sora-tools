import { toAbsoluteUrl } from '../seo.ts';
import type { ElementType } from '../../types/index.ts';

export interface DiscordBuildPayload {
  id: string;
  title: string;
  authorName: string;
  element: ElementType;
  trekkerNames: string[];
}

export async function notifyDiscordBuildPublished(
  payload: DiscordBuildPayload
): Promise<void> {
  const webhookUrl = process.env.DISCORD_BUILD_WEBHOOK_URL?.trim();
  if (!webhookUrl) return;

  const buildUrl = toAbsoluteUrl(`/builds/${encodeURIComponent(payload.id)}`);
  const adminUrl = toAbsoluteUrl('/admin/builds');
  const squadText =
    payload.trekkerNames.length > 0 ? payload.trekkerNames.join(' · ') : 'Custom Squad';

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [
          {
            title: `New Community Build: ${payload.title}`,
            url: buildUrl,
            color: 0xf59e0b,
            fields: [
              { name: 'Author', value: payload.authorName || 'Anonymous', inline: true },
              { name: 'Element', value: payload.element, inline: true },
              { name: 'Trekkers', value: squadText, inline: false },
              {
                name: 'Links',
                value: `[View Build](${buildUrl}) · [Admin Review](${adminUrl})`,
                inline: false,
              },
            ],
            timestamp: new Date().toISOString(),
          },
        ],
      }),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) {
      console.warn('Discord webhook returned non-OK status:', res.status);
    }
  } catch (err) {
    console.warn('Discord webhook notification failed:', err);
  }
}
