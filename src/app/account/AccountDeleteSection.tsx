import { EntityDeleteDangerZone } from "@/components/entity-deletion/EntityDeleteDangerZone";

export function AccountDeleteSection() {
  return (
    <EntityDeleteDangerZone
      title="Delete account"
      description="Deleting your account will remove your access to Open Order. Some order, payment, and business records may be retained where required for operations, accounting, fraud prevention, or legal compliance."
      entityLabel="your account"
      deleteUrl="/api/account/delete"
      redirectTo="/"
    />
  );
}
