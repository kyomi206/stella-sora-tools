import { treaty } from '@elysiajs/eden';
import type { App } from './app';

export const getApiClient = () => {
  if (typeof window !== 'undefined') {
    return treaty<App>(window.location.origin);
  }
  return null;
};
