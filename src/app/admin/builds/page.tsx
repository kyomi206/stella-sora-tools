import type { Metadata } from 'next';
import { AdminBuildsClient } from './admin-builds-client';

export const metadata: Metadata = {
  title: 'Admin · Community Builds',
  description: 'Review, verify, edit, or moderate community builds.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminBuildsPage() {
  return <AdminBuildsClient />;
}
