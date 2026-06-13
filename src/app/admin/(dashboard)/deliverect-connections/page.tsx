import Link from "next/link";
import { loadAdminDeliverectConnectionsPageData } from "@/lib/admin-deliverect-connections-data.server";
import { DeliverectConnectionsClient } from "./DeliverectConnectionsClient";

export default async function AdminDeliverectConnectionsPage() {
  const { vendors, registrations } = await loadAdminDeliverectConnectionsPageData();

  return (
    <div>
      <p className="text-sm text-oo-stone-gray">
        <Link href="/admin" className="hover:underline">
          Dashboard
        </Link>
        <span className="mx-1">/</span>
        <span className="text-oo-charcoal">Deliverect connections</span>
      </p>
      <h1 className="mt-2 text-xl font-semibold text-oo-charcoal">Deliverect connections</h1>
      <p className="mt-1 max-w-3xl text-sm text-oo-stone-gray">
        View vendor POS/Deliverect state, apply stored channel-registration payloads, manually reconnect reused
        staging channels, disconnect vendors safely, and trigger menu imports — without SQL or touching webhook
        idempotency records.
      </p>

      <div className="mt-6">
        <DeliverectConnectionsClient vendors={vendors} registrations={registrations} />
      </div>
    </div>
  );
}
