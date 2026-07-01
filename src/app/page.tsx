import { headers } from "next/headers";

import { auth } from "@/auth";
import { HomeHero } from "@/components/home/HomeHero";
import { HomeJoinGroupSection } from "@/components/home/HomeJoinGroupSection";
import { HomeMarketingSections } from "@/components/home/HomeMarketingSections";
import { HomePendingOnboardingBanner } from "@/components/home/HomePendingOnboardingBanner";
import { getCustomerSessionFromRequest } from "@/lib/customer-session";

export default async function HomePage() {
  const headersList = await headers();
  const [session, customerSession] = await Promise.all([
    auth(),
    getCustomerSessionFromRequest(headersList),
  ]);

  const isSignedIn = Boolean(session?.user?.id);

  return (
    <div className="w-full">
      {session?.user?.id ? (
        <HomePendingOnboardingBanner userId={session.user.id} />
      ) : null}
      <HomeHero />
      <HomeMarketingSections />
      {isSignedIn ? (
        <HomeJoinGroupSection customerAccountId={customerSession?.customerAccountId ?? null} />
      ) : null}
    </div>
  );
}
