import { GuideRoute, guideMetadata } from "@/app/_lib/guide";

export const generateMetadata = guideMetadata("who-is-rumpelstiltskin");

export default function Page() {
  return <GuideRoute guide="who-is-rumpelstiltskin" />;
}
