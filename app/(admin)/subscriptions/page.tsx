import { PROVIDER_PRESETS } from '@/lib/presets';
import { buildSubscriptionCatalog } from '@/lib/subscriptions/catalog';
import SubscriptionsClient from './subscriptions-client';
export default function SubscriptionsPage() {
  return (
    <SubscriptionsClient catalog={buildSubscriptionCatalog(PROVIDER_PRESETS)} />
  );
}
