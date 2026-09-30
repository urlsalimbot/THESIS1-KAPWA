import { useAuth } from '../lib/auth-context';
import { CoordinatorReferralListPage } from './CoordinatorReferralListPage';
import { ReferralReviewPage } from './ReferralReviewPage';

/**
 * One `/referrals` entry point for the three roles that take part in the
 * MSWDO <-> barangay referral flow. The two directions are different jobs and
 * the server already gates them that way:
 *
 *   coordinator       POST /referrals  — send only. Their view is the referrals
 *                                      they sent and the status of each.
 *   admin,            GET  /referrals  — the MSWDO queue, plus
 *   social_worker     PATCH /:id/accept, /:id/decline — accept and process.
 *
 * This is deliberately NOT the retired inter-agency referral inbox: that
 * lifecycle is gone and nothing here calls the inter-agency-referrals module.
 * (9fa73f5 removed the old /referrals page because it bundled the IAR inbox
 * with this flow and dropped both together.)
 */
export function ReferralsPage() {
  const { user } = useAuth();
  if (user?.role === 'coordinator') return <CoordinatorReferralListPage />;
  return <ReferralReviewPage />;
}
