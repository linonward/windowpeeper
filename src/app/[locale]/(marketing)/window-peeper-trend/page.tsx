import { GuideRoute, guideMetadata } from "@/app/_lib/guide";

export const generateMetadata = guideMetadata("window-peeper-trend");

export default function Page() {
  return <GuideRoute guide="window-peeper-trend" />;
}
