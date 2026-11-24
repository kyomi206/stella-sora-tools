import type { NextRequest } from 'next/server';
import { GET as handleOgGet } from '@/lib/og-route';

export async function GET(request: NextRequest): Promise<Response> {
  return handleOgGet(request);
}
