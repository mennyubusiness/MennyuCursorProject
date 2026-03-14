/**
 * Re-export so cart (and other non-route code) can import ModifierModal from a stable path.
 * Importing from app/pod/[podId]/vendor/[vendorId]/ can cause webpack module resolution
 * issues when the route segment is not active (e.g. on /cart).
 */
export { ModifierModal } from "@/app/pod/[podId]/vendor/[vendorId]/ModifierModal";
