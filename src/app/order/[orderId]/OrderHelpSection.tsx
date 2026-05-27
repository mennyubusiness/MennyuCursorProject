"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CUSTOMER_SUPPORT_ISSUE_TYPES,
  customerSupportIssueTypeLabel,
} from "@/domain/order-support-issue";

type SupportIssue = {
  id: string;
  issueType: string;
  status: string;
  statusMessage: string;
  vendorOrderId: string | null;
  orderLineItemId: string | null;
  customerMessage: string | null;
  createdAt: string;
};

type VendorOrderOption = {
  id: string;
  vendorName: string;
  lineItems: Array<{ id: string; name: string }>;
};

export function OrderHelpSection({
  orderId,
  vendorOrders,
}: {
  orderId: string;
  vendorOrders: VendorOrderOption[];
}) {
  const [issues, setIssues] = useState<SupportIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [issueType, setIssueType] = useState<string>("other");
  const [scope, setScope] = useState<"order" | "vendor" | "item">("order");
  const [vendorOrderId, setVendorOrderId] = useState<string>("");
  const [orderLineItemId, setOrderLineItemId] = useState<string>("");
  const [message, setMessage] = useState("");

  const loadIssues = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/order/${orderId}/issues`);
      if (res.ok) {
        const data = await res.json();
        setIssues(data.issues ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void loadIssues();
  }, [loadIssues]);

  const selectedVo = vendorOrders.find((v) => v.id === vendorOrderId);
  const lineOptions = selectedVo?.lineItems ?? [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        issueType,
        customerMessage: message.trim() || null,
      };
      if (scope === "vendor" && vendorOrderId) body.vendorOrderId = vendorOrderId;
      if (scope === "item" && orderLineItemId) {
        body.orderLineItemId = orderLineItemId;
        if (vendorOrderId) body.vendorOrderId = vendorOrderId;
      }

      const res = await fetch(`/api/order/${orderId}/issues`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not submit your issue. Please try again.");
        return;
      }
      setSuccess(data.message ?? "We received your issue and our team will review it.");
      setMessage("");
      await loadIssues();
    } finally {
      setSubmitting(false);
    }
  }

  const openIssues = issues.filter(
    (i) => !["resolved", "dismissed", "RESOLVED"].includes(i.status)
  );

  return (
    <section
      className="mt-8 rounded-xl border border-stone-200 bg-white p-5 shadow-sm"
      aria-label="Order help"
    >
      <h2 className="text-lg font-semibold text-stone-900">Need help with this order?</h2>
      <p className="mt-1 text-sm text-stone-600">
        Tell us what went wrong. Our team will review your report — this does not automatically
        change your order or payment.
      </p>

      {loading ? (
        <p className="mt-4 text-sm text-stone-500">Loading…</p>
      ) : openIssues.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {openIssues.map((issue) => (
            <li
              key={issue.id}
              className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-800"
            >
              <span className="font-medium">{customerSupportIssueTypeLabel(issue.issueType)}</span>
              <span className="text-stone-500"> · </span>
              <span>{issue.statusMessage}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {success && (
        <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {success}
        </p>
      )}
      {error && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
          {error}
        </p>
      )}

      <form onSubmit={(e) => void handleSubmit(e)} className="mt-4 space-y-4">
        <div>
          <label htmlFor="issue-type" className="block text-sm font-medium text-stone-800">
            What happened?
          </label>
          <select
            id="issue-type"
            className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
            value={issueType}
            onChange={(e) => setIssueType(e.target.value)}
          >
            {CUSTOMER_SUPPORT_ISSUE_TYPES.map((t) => (
              <option key={t} value={t}>
                {customerSupportIssueTypeLabel(t)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <span className="block text-sm font-medium text-stone-800">Affected area</span>
          <div className="mt-2 flex flex-wrap gap-3 text-sm">
            <label className="inline-flex items-center gap-1.5">
              <input
                type="radio"
                name="scope"
                checked={scope === "order"}
                onChange={() => setScope("order")}
              />
              Whole order
            </label>
            {vendorOrders.length > 0 && (
              <label className="inline-flex items-center gap-1.5">
                <input
                  type="radio"
                  name="scope"
                  checked={scope === "vendor"}
                  onChange={() => setScope("vendor")}
                />
                Specific vendor
              </label>
            )}
            {vendorOrders.some((v) => v.lineItems.length > 0) && (
              <label className="inline-flex items-center gap-1.5">
                <input
                  type="radio"
                  name="scope"
                  checked={scope === "item"}
                  onChange={() => setScope("item")}
                />
                Specific item
              </label>
            )}
          </div>
        </div>

        {(scope === "vendor" || scope === "item") && (
          <div>
            <label htmlFor="vendor-order" className="block text-sm font-medium text-stone-800">
              Vendor
            </label>
            <select
              id="vendor-order"
              required
              className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
              value={vendorOrderId}
              onChange={(e) => {
                setVendorOrderId(e.target.value);
                setOrderLineItemId("");
              }}
            >
              <option value="">Select vendor…</option>
              {vendorOrders.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.vendorName}
                </option>
              ))}
            </select>
          </div>
        )}

        {scope === "item" && (
          <div>
            <label htmlFor="line-item" className="block text-sm font-medium text-stone-800">
              Item
            </label>
            <select
              id="line-item"
              required
              className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
              value={orderLineItemId}
              onChange={(e) => setOrderLineItemId(e.target.value)}
              disabled={!vendorOrderId}
            >
              <option value="">Select item…</option>
              {lineOptions.map((line) => (
                <option key={line.id} value={line.id}>
                  {line.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label htmlFor="issue-message" className="block text-sm font-medium text-stone-800">
            Details (optional)
          </label>
          <textarea
            id="issue-message"
            className="mt-1 w-full min-h-[80px] rounded-md border border-stone-300 px-3 py-2 text-sm"
            maxLength={2000}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Anything else we should know?"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Submit issue"}
        </button>
      </form>
    </section>
  );
}
