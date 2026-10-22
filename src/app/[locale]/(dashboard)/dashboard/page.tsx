import { getLocale } from "next-intl/server";
import { Suspense } from "react";
import { redirect } from "@/i18n/navigation";

// The videos page is the signed-in home. Sign-in and old links still land
// on /dashboard, so it sends them there.
export default function DashboardPage() {
  return (
    <Suspense>
      <DashboardRedirect />
    </Suspense>
  );
}

async function DashboardRedirect() {
  return redirect({ href: "/videos", locale: await getLocale() });
}
