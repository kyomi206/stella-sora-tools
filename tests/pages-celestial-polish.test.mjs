import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('Builder, Roadmap, Trekkers, and Credits use celestial-card and semantic border tokens', () => {
  const builder = fs.readFileSync('src/app/builder/page.tsx', 'utf8');
  const roadmap = fs.readFileSync('src/app/roadmap/page.tsx', 'utf8');
  const roadmapTimeline = fs.readFileSync('src/components/roadmap/roadmap-timeline.tsx', 'utf8');
  const trekkers = fs.readFileSync('src/app/trekkers/page.tsx', 'utf8');
  const credits = fs.readFileSync('src/app/credits/page.tsx', 'utf8');

  assert.ok(!builder.includes('border-[#23293a]'), 'Builder buttons must use semantic border tokens instead of raw hex');
  assert.ok(!roadmap.includes('border-[#1a202c]'), 'Roadmap header and pills must use semantic border tokens instead of raw hex');
  assert.ok(roadmapTimeline.includes('isolate z-10'), 'RoadmapTimeline viewport must isolate stacking context below TopBar (z-30)');
  assert.ok(
    (roadmapTimeline.includes('--roadmap-scroll') && roadmapTimeline.includes('stickyOffset')) ||
    (roadmapTimeline.includes('sticky') && roadmapTimeline.includes('CARD_STICKY_INSET')),
    'RoadmapTimeline must sticky-follow bar content and month headers'
  );
  assert.ok(
    (roadmapTimeline.includes('contentWidthMapRef') && roadmapTimeline.includes('width - measuredContentWidth')) ||
    (roadmapTimeline.includes('overflow-clip') && roadmapTimeline.includes('sticky')),
    'RoadmapTimeline must clamp sticky offset so text and images do not go out of bounds'
  );
  assert.ok(roadmapTimeline.includes('menuitemcheckbox') && !roadmapTimeline.includes('All Categories ('), 'RoadmapTimeline must use a single Categories dropdown menu instead of separate category pills');
  assert.ok(!roadmapTimeline.includes('Bottom Legend & Status Bar') && !roadmapTimeline.includes('Current Time:'), 'RoadmapTimeline must not render the bottom legend/status bar');
  assert.ok(trekkers.includes('celestial-card'), 'Trekkers filter bar must use celestial-card');
  assert.ok(credits.includes('celestial-card'), 'Credits panels must use celestial-card');
});
