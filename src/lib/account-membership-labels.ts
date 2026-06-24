/** Human-readable membership role labels for account hub UI. */
export function formatAccountMembershipRole(role: string): string {
  switch (role) {
    case "owner":
      return "Owner";
    case "staff":
      return "Staff";
    case "manager":
      return "Manager";
    default:
      return role
        .split("_")
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
  }
}
