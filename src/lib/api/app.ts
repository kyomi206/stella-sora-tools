import { Elysia, t } from 'elysia';
import {
  getSyncedCharacters,
  getSyncedPotentials,
  getSyncedRoadmap,
  triggerDataSync,
} from '../sync-engine.ts';

export const app = new Elysia({ prefix: '/api' })
  .get('/health', () => ({
    status: 'ok',
    timestamp: Date.now(),
  }), {
    response: t.Object({
      status: t.String(),
      timestamp: t.Number(),
    })
  })
  .get('/data/characters', async () => {
    return await getSyncedCharacters();
  })
  .get('/data/roadmap', async () => {
    return await getSyncedRoadmap();
  })
  .get('/data/potentials', async () => {
    return await getSyncedPotentials();
  })
  .post('/sync', async ({ headers, set }) => {
    const auth = headers['authorization'];
    const secret = process.env.SYNC_SECRET;
    if (!secret || auth !== `Bearer ${secret}`) {
      set.status = 401;
      return { error: 'Unauthorized' };
    }
    return await triggerDataSync({ force: true });
  });

export type App = typeof app;
