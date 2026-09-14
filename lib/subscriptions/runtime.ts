import { sqlite } from '@/lib/db';
import { encrypt, decrypt } from '@/lib/crypto';
import { createSubscriptionStore } from './store';
import { createSubscriptionLifecycle } from './lifecycle';
import { refreshCredential } from './oauth';
import { fetchQuota } from './quota';
import { fetchSubscriptionModels } from './models';

export const subscriptionStore = createSubscriptionStore(sqlite, {
  encrypt,
  decrypt,
});
export const subscriptionLifecycle = createSubscriptionLifecycle(
  subscriptionStore,
  {
    refresh: refreshCredential,
    quota: fetchQuota,
    models: fetchSubscriptionModels,
  }
);
