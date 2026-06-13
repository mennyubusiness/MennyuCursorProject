import { redirect } from "next/navigation";

/** Legacy route — consolidated into Deliverect connections hub. */
export default function AdminDeliverectChannelRegistrationsRedirect() {
  redirect("/admin/deliverect-connections#registrations");
}
