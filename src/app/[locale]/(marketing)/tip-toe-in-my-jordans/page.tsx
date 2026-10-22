import { GuideRoute, guideMetadata } from "@/app/_lib/guide";

export const generateMetadata = guideMetadata("tip-toe-in-my-jordans");

export default function Page() {
  return <GuideRoute guide="tip-toe-in-my-jordans" />;
}
