"use client";

export function OrderAccessDenied({
  status,
  message,
}: {
  status: 401 | 403 | 404;
  message: string;
}) {
  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <h1 className="text-2xl font-semibold text-stone-900">
        {status === 404 ? "Order not found" : "Order access required"}
      </h1>
      <p className="mt-3 text-stone-600">{message}</p>
      <p className="mt-2 text-sm text-stone-500">
        Use the link from your order confirmation text message, or look up your orders with the phone
        number you used at checkout.
      </p>
      <a
        href="/orders"
        className="mt-6 inline-block rounded-lg bg-stone-900 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-800"
      >
        Look up my orders
      </a>
    </div>
  );
}
