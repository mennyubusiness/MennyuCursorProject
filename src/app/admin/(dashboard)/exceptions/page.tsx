import { getAttentionItems } from "@/lib/admin-attention";
import { ExceptionList } from "./ExceptionList";

export default async function AdminExceptionsPage() {
  const items = await getAttentionItems();

  return (
    <div>
      <h1 className="text-xl font-semibold text-stone-900">Needs attention</h1>
      <p className="mt-1 text-sm text-stone-600">
        Work queue — open an order for the full action set (single place to resolve).
      </p>

      <ExceptionList initialItems={items} />
    </div>
  );
}
