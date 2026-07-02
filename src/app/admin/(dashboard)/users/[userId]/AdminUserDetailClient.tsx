"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  ADMIN_NAV_LABELS,
  buildOrderAdminPath,
  buildPodAdminPath,
  buildPodDashboardPath,
  buildVendorAdminPath,
  buildVendorDashboardPath,
} from "@/lib/admin-entity-nav-links";
import { buildPodCustomerPath, buildVendorMenuCustomerPath } from "@/lib/customer-public-url";
import type { AdminUserDetailView } from "@/services/admin-user-detail.service";
import {
  adminAddPodAccessAction,
  adminAddVendorAccessAction,
  adminAttachVendorToPodAction,
  adminClearUserPhoneAction,
  adminDetachVendorFromPodAction,
  adminDisableUserAction,
  adminEnableUserAction,
  adminInvalidateUserSessionsAction,
  adminMarkEmailVerifiedAction,
  adminMarkPhoneVerifiedAction,
  adminRegenerateInviteLinkAction,
  adminRemovePodAccessAction,
  adminRemoveVendorAccessAction,
  adminRepairInviteAttachmentAction,
  adminResendInviteAction,
  adminRevokeEmailVerificationTokensAction,
  adminRevokeInviteAction,
  adminSendEmailVerificationAction,
  adminSendPasswordResetAction,
  adminDeleteUserAccountAction,
  adminTransferPodOwnershipAction,
  adminTransferVendorOwnershipAction,
} from "@/actions/admin-user.actions";
import { AdminEntityDeleteDangerZone } from "@/components/admin/AdminEntityDeleteDangerZone";

type Option = { id: string; name: string };

type Props = {
  detail: AdminUserDetailView;
  vendorOptions: Option[];
  podOptions: Option[];
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-oo-light-stone bg-oo-warm-white p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-oo-stone-gray">{title}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-x-2 text-sm">
      <span className="text-oo-stone-gray">{label}:</span>
      <span className="text-oo-charcoal">{value}</span>
    </div>
  );
}

function ActionMessage({ message, error }: { message: string | null; error: string | null }) {
  if (error) {
    return <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>;
  }
  if (message) {
    return (
      <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">{message}</p>
    );
  }
  return null;
}

function ReasonActionForm({
  label,
  description,
  confirmLabel,
  danger,
  disabled,
  disabledReason,
  onSubmit,
}: {
  label: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  onSubmit: (reason: string) => Promise<{ ok: boolean; message?: string; error?: string; inviteUrl?: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (disabled) {
    return (
      <div className="rounded-lg border border-dashed border-oo-light-stone px-3 py-2 text-sm text-oo-stone-gray">
        <p className="font-medium text-oo-charcoal">{label}</p>
        <p className="mt-1">{disabledReason ?? "Not available."}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-oo-light-stone px-3 py-2">
      <p className="text-sm font-medium text-oo-charcoal">{label}</p>
      <p className="mt-1 text-xs text-oo-stone-gray">{description}</p>
      {!open ? (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setMessage(null);
            setError(null);
            setInviteUrl(null);
          }}
          className={`mt-2 rounded-lg px-3 py-1.5 text-sm font-medium ${
            danger
              ? "bg-red-600 text-white hover:bg-red-700"
              : "border border-oo-light-stone bg-white text-oo-charcoal hover:bg-oo-light-stone/30"
          }`}
        >
          {confirmLabel}
        </button>
      ) : (
        <form
          className="mt-2 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            setMessage(null);
            setError(null);
            setInviteUrl(null);
            startTransition(async () => {
              const result = await onSubmit(reason);
              if (result.ok) {
                setMessage(result.message ?? "Done.");
                if (result.inviteUrl) setInviteUrl(result.inviteUrl);
                setOpen(false);
                setReason("");
              } else {
                setError(result.error ?? "Action failed.");
              }
            });
          }}
        >
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Admin reason (required, min 3 characters)"
            rows={2}
            className="w-full rounded-lg border border-oo-light-stone px-3 py-2 text-sm"
            required
            minLength={3}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={pending}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${
                danger ? "bg-red-600 text-white hover:bg-red-700" : "bg-brand text-white hover:bg-brand-hover"
              }`}
            >
              {pending ? "Working…" : "Confirm"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setOpen(false)}
              className="rounded-lg border border-oo-light-stone px-3 py-1.5 text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      <ActionMessage message={message} error={error} />
      {inviteUrl ? (
        <p className="mt-2 break-all text-xs text-oo-stone-gray">
          Invite link:{" "}
          <a href={inviteUrl} className="underline" target="_blank" rel="noreferrer">
            {inviteUrl}
          </a>
        </p>
      ) : null}
    </div>
  );
}

export function AdminUserDetailClient({ detail, vendorOptions, podOptions }: Props) {
  const router = useRouter();
  const userId = detail.user.id;
  const isDisabled = Boolean(detail.user.disabledAt);
  const isDeleted = Boolean(detail.user.deletedAt);

  const run = (fn: () => Promise<{ ok: true; message?: string; inviteUrl?: string } | { ok: false; error: string }>) =>
    fn().then((r) => {
      if (r.ok) router.refresh();
      return r;
    });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Section title="Account">
        <InfoRow label="Name" value={detail.user.name?.trim() || "—"} />
        <InfoRow label="Email" value={detail.user.email} />
        <InfoRow label="Phone" value={detail.user.phone ?? "—"} />
        <InfoRow label="Created" value={new Date(detail.user.createdAt).toLocaleString()} />
        <InfoRow label="Updated" value={new Date(detail.user.updatedAt).toLocaleString()} />
        <InfoRow
          label="Email verified"
          value={detail.user.emailVerified ? "Yes" : "No"}
        />
        {detail.user.emailVerifiedAt ? (
          <InfoRow
            label="Email verified at"
            value={new Date(detail.user.emailVerifiedAt).toLocaleString()}
          />
        ) : null}
        <InfoRow
          label="Last verification email"
          value={
            detail.user.emailVerificationLastSentAt
              ? new Date(detail.user.emailVerificationLastSentAt).toLocaleString()
              : "Never sent"
          }
        />
        <InfoRow
          label="Phone verified"
          value={detail.user.phoneVerified ? "Yes" : "No"}
        />
        <InfoRow label="Account status" value={isDeleted ? "Deleted" : isDisabled ? "Disabled" : "Active"} />
        {detail.user.deletedAt ? (
          <>
            <InfoRow label="Deleted at" value={new Date(detail.user.deletedAt).toLocaleString()} />
            {detail.user.deletedByEmail ? (
              <InfoRow label="Deleted by" value={detail.user.deletedByEmail} />
            ) : null}
          </>
        ) : null}
        <InfoRow label="Last login" value={detail.user.lastLoginLabel} />
        <InfoRow label="Auth" value={detail.user.authProviderLabel} />
        <InfoRow label="Platform admin" value={detail.user.isPlatformAdmin ? "Yes" : "No"} />
        <InfoRow label="Registration intent" value={detail.user.registrationIntent ?? "—"} />
        <InfoRow
          label="Needs role selection"
          value={detail.user.needsAccountRoleSelection ? "Yes" : "No"}
        />
        <InfoRow
          label="Customer profile"
          value={
            detail.customer.hasProfile || detail.customer.hasLinkedPhoneAccount
              ? "Linked"
              : "None"
          }
        />
      </Section>

      <Section title="Recovery actions">
        <ReasonActionForm
          label="Send password reset"
          description="Triggers the existing password reset email flow. Does not expose passwords or codes."
          confirmLabel="Send reset email"
          disabled={!detail.user.hasPassword}
          disabledReason="This account has no password login configured."
          onSubmit={(reason) => run(() => adminSendPasswordResetAction(userId, reason))}
        />
        <ReasonActionForm
          label="Force logout / invalidate sessions"
          description="Bumps session version so the user must sign in again on their next request."
          confirmLabel="Invalidate sessions"
          onSubmit={(reason) => run(() => adminInvalidateUserSessionsAction(userId, reason))}
        />
        {isDisabled ? (
          <ReasonActionForm
            label="Re-enable account"
            description="Allows the user to sign in again. Does not delete any data."
            confirmLabel="Re-enable user"
            onSubmit={(reason) => run(() => adminEnableUserAction(userId, reason))}
          />
        ) : (
          <ReasonActionForm
            label="Disable account"
            description="Blocks sign-in and invalidates active sessions. Does not delete data."
            confirmLabel="Disable user"
            danger
            onSubmit={(reason) => run(() => adminDisableUserAction(userId, reason))}
          />
        )}
        <ReasonActionForm
          label="Send verification email"
          description="Sends the standard email verification link. Rate limited like the user-facing resend flow."
          confirmLabel="Send verification email"
          disabled={detail.user.emailVerified || isDisabled}
          disabledReason={
            isDisabled
              ? "Disabled users cannot receive verification emails."
              : "Email is already verified."
          }
          onSubmit={(reason) => run(() => adminSendEmailVerificationAction(userId, reason))}
        />
        <ReasonActionForm
          label="Revoke verification tokens"
          description="Invalidates outstanding unused verification links for this user."
          confirmLabel="Revoke tokens"
          disabled={detail.user.emailVerified}
          disabledReason="No outstanding verification flow needed when email is verified."
          onSubmit={(reason) => run(() => adminRevokeEmailVerificationTokensAction(userId, reason))}
        />
        <ReasonActionForm
          label="Mark email verified"
          description="Admin override for email verification only. Does not bypass payment or compliance checks."
          confirmLabel="Mark email verified"
          disabled={detail.user.emailVerified}
          disabledReason="Email is already verified."
          onSubmit={(reason) => run(() => adminMarkEmailVerifiedAction(userId, reason))}
        />
        <ReasonActionForm
          label="Mark phone verified"
          description="Admin override when phone OTP flow failed. Does not grant SMS consent."
          confirmLabel="Mark phone verified"
          disabled={!detail.user.phone || detail.user.phoneVerified}
          disabledReason={!detail.user.phone ? "No phone on profile." : "Phone is already verified."}
          onSubmit={(reason) => run(() => adminMarkPhoneVerifiedAction(userId, reason))}
        />
        <ReasonActionForm
          label="Clear profile phone"
          description="Removes phone from customer profile. Does not automatically grant SMS consent."
          confirmLabel="Clear phone"
          disabled={!detail.user.phone}
          disabledReason="No phone stored on profile."
          onSubmit={(reason) => run(() => adminClearUserPhoneAction(userId, reason))}
        />
      </Section>

      <Section title="Vendors">
        {detail.vendors.length === 0 ? (
          <p className="text-sm text-oo-stone-gray">No vendor memberships.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {detail.vendors.map((v) => (
              <li key={v.vendorId} className="rounded-lg border border-oo-light-stone px-3 py-2">
                <p className="font-medium text-oo-charcoal">{v.vendorName}</p>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                  <Link href={buildVendorAdminPath(v.vendorId)} className="underline">
                    {ADMIN_NAV_LABELS.openVendorAdmin}
                  </Link>
                  <Link href={buildVendorDashboardPath(v.vendorId)} className="underline">
                    {ADMIN_NAV_LABELS.openVendorDashboard}
                  </Link>
                  {v.podSlug && v.vendorSlug ? (
                    <a
                      href={buildVendorMenuCustomerPath(v.podSlug, v.vendorSlug)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      {ADMIN_NAV_LABELS.openPublicPage}
                    </a>
                  ) : null}
                  {v.podId && v.podName ? (
                    <Link href={buildPodAdminPath(v.podId)} className="underline">
                      {ADMIN_NAV_LABELS.openPodAdmin}
                    </Link>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-oo-stone-gray">
                  Role: {v.role}
                  {v.podName ? ` · Pod: ${v.podName}` : " · Not attached to a pod"}
                </p>
                <div className="mt-2 space-y-2">
                  {v.podId ? (
                    <ReasonActionForm
                      label="Detach from pod"
                      description={`Remove ${v.vendorName} from pod ${v.podName}.`}
                      confirmLabel="Detach"
                      danger
                      onSubmit={(reason) =>
                        run(() =>
                          adminDetachVendorFromPodAction({
                            userId,
                            vendorId: v.vendorId,
                            podId: v.podId!,
                            reason,
                          })
                        )
                      }
                    />
                  ) : (
                    <VendorAttachForm
                      vendorId={v.vendorId}
                      vendorName={v.vendorName}
                      podOptions={podOptions}
                      onAttach={(podId, reason) =>
                        run(() =>
                          adminAttachVendorToPodAction({
                            userId,
                            vendorId: v.vendorId,
                            podId,
                            reason,
                          })
                        )
                      }
                    />
                  )}
                  {v.role !== "owner" ? (
                    <ReasonActionForm
                      label="Transfer vendor ownership"
                      description={`Make this user the owner of ${v.vendorName}.`}
                      confirmLabel="Transfer ownership"
                      onSubmit={(reason) =>
                        run(() =>
                          adminTransferVendorOwnershipAction({
                            userId,
                            vendorId: v.vendorId,
                            reason,
                          })
                        )
                      }
                    />
                  ) : null}
                  <ReasonActionForm
                    label="Remove vendor access"
                    description={`Remove this user's access to ${v.vendorName}.`}
                    confirmLabel="Remove access"
                    danger
                    onSubmit={(reason) =>
                      run(() =>
                        adminRemoveVendorAccessAction({
                          userId,
                          vendorId: v.vendorId,
                          reason,
                        })
                      )
                    }
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
        <AddVendorAccessForm
          vendorOptions={vendorOptions}
          onAdd={(vendorId, role, reason) =>
            run(() => adminAddVendorAccessAction({ userId, vendorId, role, reason }))
          }
        />
      </Section>

      <Section title="Pods">
        {detail.pods.length === 0 ? (
          <p className="text-sm text-oo-stone-gray">No pod memberships.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {detail.pods.map((p) => (
              <li key={p.podId} className="rounded-lg border border-oo-light-stone px-3 py-2">
                <p className="font-medium text-oo-charcoal">{p.podName}</p>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                  <Link href={buildPodAdminPath(p.podId)} className="underline">
                    {ADMIN_NAV_LABELS.openPodAdmin}
                  </Link>
                  <Link href={buildPodDashboardPath(p.podId)} className="underline">
                    {ADMIN_NAV_LABELS.openPodDashboard}
                  </Link>
                  <a href={buildPodCustomerPath(p.podSlug)} target="_blank" rel="noopener noreferrer" className="underline">
                    {ADMIN_NAV_LABELS.openPublicPage}
                  </a>
                </div>
                <p className="mt-1 text-xs text-oo-stone-gray">Role: {p.role}</p>
                <div className="mt-2 space-y-2">
                  {p.role !== "owner" ? (
                    <ReasonActionForm
                      label="Transfer pod ownership"
                      description={`Make this user the owner of ${p.podName}.`}
                      confirmLabel="Transfer ownership"
                      onSubmit={(reason) =>
                        run(() =>
                          adminTransferPodOwnershipAction({
                            userId,
                            podId: p.podId,
                            reason,
                          })
                        )
                      }
                    />
                  ) : null}
                  <ReasonActionForm
                    label="Remove pod access"
                    description={`Remove this user's access to ${p.podName}.`}
                    confirmLabel="Remove access"
                    danger
                    onSubmit={(reason) =>
                      run(() =>
                        adminRemovePodAccessAction({
                          userId,
                          podId: p.podId,
                          reason,
                        })
                      )
                    }
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
        <AddPodAccessForm
          podOptions={podOptions}
          onAdd={(podId, role, reason) =>
            run(() => adminAddPodAccessAction({ userId, podId, role, reason }))
          }
        />
      </Section>

      <Section title="Invites">
        {detail.invites.length === 0 ? (
          <p className="text-sm text-oo-stone-gray">No related invites.</p>
        ) : (
          <ul className="space-y-3 text-sm">
            {detail.invites.map((invite) => (
              <li
                key={invite.id}
                className={`rounded-lg border px-3 py-2 ${
                  invite.attachmentMissing ? "border-amber-400 bg-amber-50" : "border-oo-light-stone"
                }`}
              >
                <p className="font-medium">{invite.invitedEmail}</p>
                <p className="text-xs text-oo-stone-gray">
                  {invite.status} · Pod: {invite.podName}
                  {invite.vendorName ? ` · Vendor: ${invite.vendorName}` : ""}
                </p>
                <p className="text-xs text-oo-stone-gray">
                  Created {new Date(invite.createdAt).toLocaleString()}
                  {invite.createdByEmail ? ` by ${invite.createdByEmail}` : ""}
                </p>
                {invite.attachmentWarning ? (
                  <p className="mt-2 text-xs font-medium text-amber-900">{invite.attachmentWarning}</p>
                ) : null}
                <div className="mt-2 space-y-2">
                  {invite.status === "pending" ? (
                    <>
                      <ReasonActionForm
                        label="Resend invite"
                        description="Resends the invite email using the existing flow."
                        confirmLabel="Resend"
                        onSubmit={(reason) =>
                          run(() =>
                            adminResendInviteAction({
                              inviteId: invite.id,
                              podId: invite.podId,
                              reason,
                            })
                          )
                        }
                      />
                      <ReasonActionForm
                        label="Regenerate invite link"
                        description="Creates a new invite link. Previous link may stop working."
                        confirmLabel="Regenerate link"
                        onSubmit={(reason) =>
                          run(() =>
                            adminRegenerateInviteLinkAction({
                              inviteId: invite.id,
                              podId: invite.podId,
                              reason,
                            })
                          )
                        }
                      />
                      <ReasonActionForm
                        label="Revoke invite"
                        description="Marks invite as revoked. Recipient cannot accept it."
                        confirmLabel="Revoke"
                        danger
                        onSubmit={(reason) =>
                          run(() =>
                            adminRevokeInviteAction({
                              inviteId: invite.id,
                              podId: invite.podId,
                              reason,
                            })
                          )
                        }
                      />
                    </>
                  ) : null}
                  {invite.attachmentMissing ? (
                    <ReasonActionForm
                      label="Attach vendor to pod from invite"
                      description="Admin override: creates the missing pod/vendor relationship from this accepted invite."
                      confirmLabel="Repair attachment"
                      onSubmit={(reason) =>
                        run(() =>
                          adminRepairInviteAttachmentAction({
                            userId,
                            inviteId: invite.id,
                            reason,
                          })
                        )
                      }
                    />
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Recent orders">
        {detail.recentOrders.length === 0 ? (
          <p className="text-sm text-oo-stone-gray">No recent orders.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {detail.recentOrders.map((o) => (
              <li key={o.id}>
                <Link href={buildOrderAdminPath(o.id)} className="underline">
                  {ADMIN_NAV_LABELS.openOrderAdmin}
                </Link>
                <span className="text-oo-stone-gray">
                  {" "}
                  · {o.id.slice(0, 8)}… · {o.status} · ${(o.totalCents / 100).toFixed(2)} · {o.podName} ·{" "}
                  {new Date(o.createdAt).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Audit log">
        {detail.auditLogs.length === 0 ? (
          <p className="text-sm text-oo-stone-gray">No admin actions logged for this user yet.</p>
        ) : (
          <ul className="max-h-96 space-y-2 overflow-y-auto text-xs">
            {detail.auditLogs.map((log) => (
              <li key={log.id} className="rounded border border-oo-light-stone px-2 py-1.5">
                <p className="font-medium text-oo-charcoal">{log.actionType}</p>
                <p className="text-oo-stone-gray">
                  {new Date(log.createdAt).toLocaleString()}
                  {log.adminEmail ? ` · ${log.adminEmail}` : ""}
                </p>
                {log.reason ? <p className="text-oo-stone-gray">Reason: {log.reason}</p> : null}
                {log.oldValue || log.newValue ? (
                  <p className="break-all text-oo-stone-gray">
                    {log.oldValue ? `Old: ${log.oldValue}` : ""}
                    {log.oldValue && log.newValue ? " · " : ""}
                    {log.newValue ? `New: ${log.newValue}` : ""}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <AdminEntityDeleteDangerZone
        title="Deactivate account"
        description="The account will be disabled and anonymized. Login will be blocked. Order, payment, and business records are preserved where required."
        confirmLabel="Deactivate account"
        confirmationAlternatives={["DELETE", detail.user.email]}
        deletedAt={detail.user.deletedAt}
        deletedByEmail={detail.user.deletedByEmail}
        onSubmit={({ reason }) =>
          adminDeleteUserAccountAction(userId, reason).then((result) => {
            if (result.ok) router.refresh();
            return result;
          })
        }
      />
    </div>
  );
}

function VendorAttachForm({
  vendorId,
  vendorName,
  podOptions,
  onAttach,
}: {
  vendorId: string;
  vendorName: string;
  podOptions: Option[];
  onAttach: (podId: string, reason: string) => Promise<{ ok: boolean; message?: string; error?: string }>;
}) {
  const [podId, setPodId] = useState("");
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="rounded-lg border border-dashed border-oo-light-stone px-2 py-2"
      onSubmit={(e) => {
        e.preventDefault();
        setMessage(null);
        setError(null);
        startTransition(async () => {
          const result = await onAttach(podId, reason);
          if (result.ok) {
            setMessage(result.message ?? "Attached.");
            setReason("");
          } else {
            setError(result.error ?? "Failed.");
          }
        });
      }}
    >
      <p className="text-xs font-medium">Attach {vendorName} to pod</p>
      <select
        value={podId}
        onChange={(e) => setPodId(e.target.value)}
        className="mt-1 w-full rounded border border-oo-light-stone px-2 py-1 text-sm"
        required
      >
        <option value="">Select pod…</option>
        {podOptions.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Admin reason"
        rows={2}
        className="mt-1 w-full rounded border border-oo-light-stone px-2 py-1 text-sm"
        required
        minLength={3}
      />
      <button
        type="submit"
        disabled={pending || !podId}
        className="mt-1 rounded bg-brand px-2 py-1 text-xs text-white disabled:opacity-50"
      >
        Attach to pod
      </button>
      <ActionMessage message={message} error={error} />
    </form>
  );
}

function AddVendorAccessForm({
  vendorOptions,
  onAdd,
}: {
  vendorOptions: Option[];
  onAdd: (
    vendorId: string,
    role: "owner" | "staff",
    reason: string
  ) => Promise<{ ok: boolean; message?: string; error?: string }>;
}) {
  const [vendorId, setVendorId] = useState("");
  const [role, setRole] = useState<"owner" | "staff">("staff");
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="mt-2 rounded-lg border border-dashed border-oo-light-stone px-3 py-2"
      onSubmit={(e) => {
        e.preventDefault();
        setMessage(null);
        setError(null);
        startTransition(async () => {
          const result = await onAdd(vendorId, role, reason);
          if (result.ok) {
            setMessage(result.message ?? "Added.");
            setReason("");
          } else {
            setError(result.error ?? "Failed.");
          }
        });
      }}
    >
      <p className="text-sm font-medium">Add vendor access</p>
      <select
        value={vendorId}
        onChange={(e) => setVendorId(e.target.value)}
        className="mt-1 w-full rounded border border-oo-light-stone px-2 py-1 text-sm"
        required
      >
        <option value="">Select vendor…</option>
        {vendorOptions.map((v) => (
          <option key={v.id} value={v.id}>
            {v.name}
          </option>
        ))}
      </select>
      <select
        value={role}
        onChange={(e) => setRole(e.target.value as "owner" | "staff")}
        className="mt-1 w-full rounded border border-oo-light-stone px-2 py-1 text-sm"
      >
        <option value="staff">Staff</option>
        <option value="owner">Owner</option>
      </select>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Admin reason"
        rows={2}
        className="mt-1 w-full rounded border border-oo-light-stone px-2 py-1 text-sm"
        required
        minLength={3}
      />
      <button
        type="submit"
        disabled={pending || !vendorId}
        className="mt-1 rounded bg-brand px-3 py-1.5 text-sm text-white disabled:opacity-50"
      >
        Add access
      </button>
      <ActionMessage message={message} error={error} />
    </form>
  );
}

function AddPodAccessForm({
  podOptions,
  onAdd,
}: {
  podOptions: Option[];
  onAdd: (
    podId: string,
    role: "owner" | "manager",
    reason: string
  ) => Promise<{ ok: boolean; message?: string; error?: string }>;
}) {
  const [podId, setPodId] = useState("");
  const [role, setRole] = useState<"owner" | "manager">("manager");
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="mt-2 rounded-lg border border-dashed border-oo-light-stone px-3 py-2"
      onSubmit={(e) => {
        e.preventDefault();
        setMessage(null);
        setError(null);
        startTransition(async () => {
          const result = await onAdd(podId, role, reason);
          if (result.ok) {
            setMessage(result.message ?? "Added.");
            setReason("");
          } else {
            setError(result.error ?? "Failed.");
          }
        });
      }}
    >
      <p className="text-sm font-medium">Add pod access</p>
      <select
        value={podId}
        onChange={(e) => setPodId(e.target.value)}
        className="mt-1 w-full rounded border border-oo-light-stone px-2 py-1 text-sm"
        required
      >
        <option value="">Select pod…</option>
        {podOptions.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <select
        value={role}
        onChange={(e) => setRole(e.target.value as "owner" | "manager")}
        className="mt-1 w-full rounded border border-oo-light-stone px-2 py-1 text-sm"
      >
        <option value="manager">Manager</option>
        <option value="owner">Owner</option>
      </select>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Admin reason"
        rows={2}
        className="mt-1 w-full rounded border border-oo-light-stone px-2 py-1 text-sm"
        required
        minLength={3}
      />
      <button
        type="submit"
        disabled={pending || !podId}
        className="mt-1 rounded bg-brand px-3 py-1.5 text-sm text-white disabled:opacity-50"
      >
        Add access
      </button>
      <ActionMessage message={message} error={error} />
    </form>
  );
}
