import { PageWrapper } from '../../components/layout/PageWrapper';
import { RewardsDashboard } from '../../components/rewards/RewardsDashboard';

export function RewardsPage() {
  return (
    <PageWrapper>
      <div className="page-shell">
        <RewardsDashboard />
      </div>
    </PageWrapper>
  );
}
