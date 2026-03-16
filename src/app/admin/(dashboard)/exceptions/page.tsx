import { getAttentionItems } from "@/lib/admin-attention";
import { isRoutingRetryAvailable } from "@/lib/routing-availability";
import { ExceptionList } from "./ExceptionList";

export default async function AdminExceptionsPage() {
  const items = await getAttentionItems();
  const routingAvailable = isRoutingRetryAvailable();

  return (
    <div>
      <h1 className="text-xl font-semibold text-stone-900">Needs attention</h1>
      <p className="mt-1 text-sm text-stone-600">
        Which vendor orders are broken, and how to resolve them. Use the actions below or view full order details.
      </p>

      <ExceptionList initialItems={items} routingAvailable={routingAvailable} />
    </div>
  );
}
