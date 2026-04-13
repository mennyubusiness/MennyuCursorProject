import Link from "next/link";
import { prisma } from "@/lib/db";
import { ChannelRegistrationsClient, type ChannelRegistrationRow } from "./ChannelRegistrationsClient";

function payloadPreview(payload: unknown): Omit<ChannelRegistrationRow, "id" | "createdAtIso" | "eventId" | "processed" | "errorMessage"> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {
      payloadKeys: [],
      channelLinkId: null,
      channelLocationId: null,
      locationId: null,
      status: null,
      channelLinkName: null,
    };
  }
  const p = payload as Record<string, unknown>;
  const str = (k: string) => (typeof p[k] === "string" ? (p[k] as string) : null);
  return {
    payloadKeys: Object.keys(p).sort(),
    channelLinkId: str("channelLinkId"),
    channelLocationId: str("channelLocationId"),
    locationId: str("locationId"),
    status: str("status"),
    channelLinkName: str("channelLinkName"),
  };
}

export default async function AdminDeliverectChannelRegistrationsPage() {
  const events = await prisma.webhookEvent.findMany({
    where: { provider: "deliverect_channel_registration" },
    orderBy: { createdAt: "desc" },
    take: 75,
    select: {
      id: true,
      createdAt: true,
      eventId: true,
      processed: true,
      errorMessage: true,
      payload: true,
    },
  });

  const rows: ChannelRegistrationRow[] = events.map((e) => {
    const prev = payloadPreview(e.payload);
    return {
      id: e.id,
      createdAtIso: e.createdAt.toISOString(),
      eventId: e.eventId,
      processed: e.processed,
      errorMessage: e.errorMessage,
      ...prev,
    };
  });

  return (
    <div>
      <p className="text-sm text-stone-500">
        <Link href="/admin" className="hover:underline">
          Dashboard
        </Link>
        <span className="mx-1">/</span>
        <span className="text-stone-800">Channel registration</span>
      </p>
      <h1 className="mt-2 text-xl font-semibold text-stone-900">Channel registration</h1>
      <p className="mt-1 max-w-3xl text-sm text-stone-600">
        Inbound registrations from Deliverect (register / active / inactive). Rows highlight likely review items when
        Mennyu could not auto-map. Use <strong>Apply payload</strong> to attach a stored <code className="text-xs">channelLinkId</code>{" "}
        to a vendor after you confirm the correct restaurant.
      </p>

      <div className="mt-6">
        <ChannelRegistrationsClient rows={rows} />
      </div>
    </div>
  );
}
