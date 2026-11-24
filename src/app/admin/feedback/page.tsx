import type { Metadata } from 'next';
import { AdminFeedbackClient } from './admin-feedback-client';

export const metadata: Metadata = {
  title: 'Admin · Feedback Inbox',
  description: 'Review and resolve private site feedback.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminFeedbackPage() {
  return <AdminFeedbackClient />;
}
