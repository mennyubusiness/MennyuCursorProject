import { AccountSessionActions } from "./AccountSessionActions";
import {
  accountHubCardClass,
  accountHubMutedClass,
  accountHubSectionTitleClass,
} from "./account-hub-styles";

export function AccountSignOutSection() {
  return (
    <section className={accountHubCardClass}>
      <h2 className={accountHubSectionTitleClass}>Sign out</h2>
      <p className={`mt-1 ${accountHubMutedClass}`}>
        End your email sign-in session on this device. This does not delete your account.
      </p>
      <div className="mt-4">
        <AccountSessionActions />
      </div>
    </section>
  );
}
