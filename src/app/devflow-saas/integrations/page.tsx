import { getCurrentUser, getCurrentOrg } from "../lib/auth";
import {
  getWebhooksByOrgId,
  getWebhookDeliveries,
  type WebhookDelivery,
} from "../lib/webhooks";
import { IntegrationsClient } from "./IntegrationsClient";

export default async function IntegrationsPage() {
  const [currentUser, currentOrg] = await Promise.all([
    getCurrentUser(),
    getCurrentOrg(),
  ]);

  const webhooks = getWebhooksByOrgId(currentOrg.id);

  // Fetch recent deliveries per webhook
  const deliveriesByWebhookId: Record<string, readonly WebhookDelivery[]> = {};
  for (const hook of webhooks) {
    deliveriesByWebhookId[hook.id] = getWebhookDeliveries(hook.id, 10);
  }

  return (
    <IntegrationsClient
      webhooks={webhooks}
      deliveriesByWebhookId={deliveriesByWebhookId}
      currentUser={currentUser}
      currentOrg={currentOrg}
    />
  );
}
