import { app } from '@/lib/api/app';

export const GET = (req: Request) => app.fetch(req);
export const POST = (req: Request) => app.fetch(req);
