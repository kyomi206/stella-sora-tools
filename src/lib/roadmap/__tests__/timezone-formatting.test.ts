import test from 'node:test';
import assert from 'node:assert';
import { ROADMAP_ITEMS } from '../../../data/roadmap.ts';

// Pure date formatting helper reproducing roadmap timeline logic
function formatDateRangeShort(startStr: string, endStr: string, timezone: 'server' | 'local' = 'server') {
  const s = new Date(startStr);
  const e = new Date(endStr);
  const tzOpt: Intl.DateTimeFormatOptions = timezone === 'server' ? { timeZone: 'America/Phoenix' } : {};
  const sm = s.toLocaleString('en-US', { month: 'short', ...tzOpt });
  const sd = s.toLocaleString('en-US', { day: 'numeric', ...tzOpt });
  const sy = s.toLocaleString('en-US', { year: 'numeric', ...tzOpt });
  const em = e.toLocaleString('en-US', { month: 'short', ...tzOpt });
  const ed = e.toLocaleString('en-US', { day: 'numeric', ...tzOpt });
  const ey = e.toLocaleString('en-US', { year: 'numeric', ...tzOpt });
  if (sy !== ey) {
    return `${sm} ${sd}, '${sy.slice(2)} – ${em} ${ed}, '${ey.slice(2)}`;
  }
  return `${sm} ${sd} – ${em} ${ed}`;
}

function formatMilestoneDate(dateStr: string, timezone: 'server' | 'local' = 'server') {
  const d = new Date(dateStr);
  const tzOpt: Intl.DateTimeFormatOptions = timezone === 'server' ? { timeZone: 'America/Phoenix' } : {};
  const datePart = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...tzOpt });
  const timePart = d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    ...tzOpt,
  });
  return `${datePart}, ${timePart}`;
}

test('formatDateRangeShort correctly formats server timezone (UTC-7)', () => {
  const chitose = formatDateRangeShort(
    '2025-10-19T13:00:00-07:00',
    '2025-11-10T12:59:59-07:00',
    'server'
  );
  assert.strictEqual(chitose, 'Oct 19 – Nov 10');

  const yearCrossing = formatDateRangeShort(
    '2025-12-22T13:00:00-07:00',
    '2026-01-12T12:59:59-07:00',
    'server'
  );
  assert.strictEqual(yearCrossing, "Dec 22, '25 – Jan 12, '26");
});

test('formatMilestoneDate strictly matches server milestone time in UTC-7', () => {
  const formatted = formatMilestoneDate('2025-11-24T02:00:00-07:00', 'server');
  assert.strictEqual(formatted, 'Nov 24, 02:00');
});

test('All roadmap items have valid ISO dates and format properly in UTC-7', () => {
  for (const item of ROADMAP_ITEMS) {
    assert.ok(item.startDate, `Item ${item.id} must have startDate`);
    assert.ok(item.endDate, `Item ${item.id} must have endDate`);
    const s = new Date(item.startDate);
    const e = new Date(item.endDate);
    assert.ok(!isNaN(s.getTime()), `Invalid startDate for ${item.id}`);
    assert.ok(!isNaN(e.getTime()), `Invalid endDate for ${item.id}`);
    assert.ok(e.getTime() >= s.getTime(), `endDate before startDate for ${item.id}`);

    const formattedServer = formatDateRangeShort(item.startDate, item.endDate, 'server');
    assert.ok(formattedServer.includes('–'), `Formatted server range must include dash: ${formattedServer}`);

    const formattedLocal = formatDateRangeShort(item.startDate, item.endDate, 'local');
    assert.ok(formattedLocal.includes('–'), `Formatted local range must include dash: ${formattedLocal}`);
  }
});
