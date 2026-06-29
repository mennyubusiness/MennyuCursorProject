import Link from "next/link";
import {
  ADMIN_NAV_LABELS,
  buildOrderAdminPath,
  buildPodAdminPath,
  buildPodDashboardPath,
  buildUserAdminPath,
  buildVendorAdminPath,
  buildVendorDashboardPath,
} from "@/lib/admin-entity-nav-links";
import { buildPodCustomerPath, buildVendorMenuCustomerPath } from "@/lib/customer-public-url";

function AdminNavPill({
  href,
  label,
  external,
}: {
  href: string;
  label: string;
  external?: boolean;
}) {
  const className =
    "inline-flex items-center rounded-lg border border-oo-light-stone bg-white px-3 py-1.5 text-sm font-medium text-oo-charcoal shadow-sm transition hover:bg-oo-cream";
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {label}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {label}
    </Link>
  );
}

function ContextNavSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-amber-200/80 bg-amber-50/60 p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-oo-stone-gray">{title}</h2>
      <div className="mt-3 space-y-4">{children}</div>
    </section>
  );
}

function LinkGroup({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-sm font-medium text-oo-charcoal">{heading}</p>
      <div className="mt-2 flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

type VendorPodRow = {
  podId: string;
  podName: string;
  podSlug: string;
  publicPath: string;
};

type VendorOwnerRow = {
  userId: string;
  email: string;
  role: string;
};

type VendorOrderRow = {
  id: string;
};

export function AdminVendorContextNav({
  vendorId,
  vendorName,
  publicPathPreview,
  pods,
  owners,
  recentOrders,
}: {
  vendorId: string;
  vendorName: string;
  publicPathPreview: string;
  pods: VendorPodRow[];
  owners: VendorOwnerRow[];
  recentOrders: VendorOrderRow[];
}) {
  const primaryPublicPath = publicPathPreview.startsWith("/") ? publicPathPreview : null;

  return (
    <ContextNavSection title="Related navigation">
      <LinkGroup heading={vendorName}>
        <AdminNavPill
          href={buildVendorDashboardPath(vendorId)}
          label={ADMIN_NAV_LABELS.openVendorDashboard}
        />
        {primaryPublicPath ? (
          <AdminNavPill href={primaryPublicPath} label={ADMIN_NAV_LABELS.openPublicPage} external />
        ) : null}
      </LinkGroup>

      {owners.length > 0 ? (
        <LinkGroup heading="Users">
          {owners.map((o) => (
            <AdminNavPill
              key={o.userId}
              href={buildUserAdminPath(o.userId)}
              label={`${ADMIN_NAV_LABELS.openUserAdmin} (${o.email})`}
            />
          ))}
        </LinkGroup>
      ) : null}

      {pods.length > 0 ? (
        <LinkGroup heading="Pods">
          {pods.map((p) => (
            <span key={p.podId} className="inline-flex flex-wrap gap-2">
              <AdminNavPill href={buildPodAdminPath(p.podId)} label={`${ADMIN_NAV_LABELS.openPodAdmin} (${p.podName})`} />
              <AdminNavPill
                href={buildPodDashboardPath(p.podId)}
                label={`${ADMIN_NAV_LABELS.openPodDashboard} (${p.podName})`}
              />
              <AdminNavPill href={p.publicPath} label={`${ADMIN_NAV_LABELS.openPublicPage} (${p.podName})`} external />
            </span>
          ))}
        </LinkGroup>
      ) : null}

      {recentOrders.length > 0 ? (
        <LinkGroup heading="Recent orders">
          {recentOrders.slice(0, 5).map((o) => (
            <AdminNavPill
              key={o.id}
              href={buildOrderAdminPath(o.id)}
              label={`${ADMIN_NAV_LABELS.openOrderAdmin} (${o.id.slice(0, 8)}…)`}
            />
          ))}
        </LinkGroup>
      ) : null}
    </ContextNavSection>
  );
}

type PodOwnerRow = {
  userId: string;
  email: string;
};

type PodVendorRow = {
  vendorId: string;
  vendorName: string;
  vendorSlug: string;
};

type PodOrderRow = {
  id: string;
};

export function AdminPodContextNav({
  podId,
  podName,
  podSlug,
  publicPath,
  owners,
  vendors,
  recentOrders,
}: {
  podId: string;
  podName: string;
  podSlug: string;
  publicPath: string;
  owners: PodOwnerRow[];
  vendors: PodVendorRow[];
  recentOrders: PodOrderRow[];
}) {
  return (
    <ContextNavSection title="Related navigation">
      <LinkGroup heading={podName}>
        <AdminNavPill href={buildPodDashboardPath(podId)} label={ADMIN_NAV_LABELS.openPodDashboard} />
        <AdminNavPill href={publicPath} label={ADMIN_NAV_LABELS.openPublicPage} external />
        <AdminNavPill href="/admin/users" label="Open user search (invites)" />
      </LinkGroup>

      {owners.length > 0 ? (
        <LinkGroup heading="Pod owners">
          {owners.map((o) => (
            <AdminNavPill
              key={o.userId}
              href={buildUserAdminPath(o.userId)}
              label={`${ADMIN_NAV_LABELS.openUserAdmin} (${o.email})`}
            />
          ))}
        </LinkGroup>
      ) : null}

      {vendors.length > 0 ? (
        <LinkGroup heading="Vendors">
          {vendors.map((v) => (
            <span key={v.vendorId} className="inline-flex flex-wrap gap-2">
              <AdminNavPill
                href={buildVendorAdminPath(v.vendorId)}
                label={`${ADMIN_NAV_LABELS.openVendorAdmin} (${v.vendorName})`}
              />
              <AdminNavPill
                href={buildVendorDashboardPath(v.vendorId)}
                label={`${ADMIN_NAV_LABELS.openVendorDashboard} (${v.vendorName})`}
              />
              <AdminNavPill
                href={buildVendorMenuCustomerPath(podSlug, v.vendorSlug)}
                label={`${ADMIN_NAV_LABELS.openPublicPage} (${v.vendorName})`}
                external
              />
            </span>
          ))}
        </LinkGroup>
      ) : null}

      {recentOrders.length > 0 ? (
        <LinkGroup heading="Recent orders">
          {recentOrders.slice(0, 5).map((o) => (
            <AdminNavPill
              key={o.id}
              href={buildOrderAdminPath(o.id)}
              label={`${ADMIN_NAV_LABELS.openOrderAdmin} (${o.id.slice(0, 8)}…)`}
            />
          ))}
        </LinkGroup>
      ) : null}
    </ContextNavSection>
  );
}

type UserVendorRow = {
  vendorId: string;
  vendorName: string;
  vendorSlug: string | null;
  podId: string | null;
  podName: string | null;
  podSlug: string | null;
};

type UserPodRow = {
  podId: string;
  podName: string;
  podSlug: string;
};

export function AdminUserContextNav({
  vendors,
  pods,
}: {
  vendors: UserVendorRow[];
  pods: UserPodRow[];
}) {
  if (vendors.length === 0 && pods.length === 0) return null;

  return (
    <ContextNavSection title="Related navigation">
      {vendors.length > 0 ? (
        <LinkGroup heading="Vendor access">
          {vendors.map((v) => (
            <span key={v.vendorId} className="inline-flex flex-wrap gap-2">
              <AdminNavPill
                href={buildVendorAdminPath(v.vendorId)}
                label={`${ADMIN_NAV_LABELS.openVendorAdmin} (${v.vendorName})`}
              />
              <AdminNavPill
                href={buildVendorDashboardPath(v.vendorId)}
                label={`${ADMIN_NAV_LABELS.openVendorDashboard} (${v.vendorName})`}
              />
              {v.podSlug && v.vendorSlug ? (
                <AdminNavPill
                  href={buildVendorMenuCustomerPath(v.podSlug, v.vendorSlug)}
                  label={`${ADMIN_NAV_LABELS.openPublicPage} (${v.vendorName})`}
                  external
                />
              ) : null}
              {v.podId && v.podName ? (
                <AdminNavPill
                  href={buildPodAdminPath(v.podId)}
                  label={`${ADMIN_NAV_LABELS.openPodAdmin} (${v.podName})`}
                />
              ) : null}
            </span>
          ))}
        </LinkGroup>
      ) : null}

      {pods.length > 0 ? (
        <LinkGroup heading="Pod access">
          {pods.map((p) => (
            <span key={p.podId} className="inline-flex flex-wrap gap-2">
              <AdminNavPill
                href={buildPodAdminPath(p.podId)}
                label={`${ADMIN_NAV_LABELS.openPodAdmin} (${p.podName})`}
              />
              <AdminNavPill
                href={buildPodDashboardPath(p.podId)}
                label={`${ADMIN_NAV_LABELS.openPodDashboard} (${p.podName})`}
              />
              <AdminNavPill
                href={buildPodCustomerPath(p.podSlug)}
                label={`${ADMIN_NAV_LABELS.openPublicPage} (${p.podName})`}
                external
              />
            </span>
          ))}
        </LinkGroup>
      ) : null}
    </ContextNavSection>
  );
}
