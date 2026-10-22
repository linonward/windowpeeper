import { GuideRoute, guideMetadata } from "@/app/_lib/guide";

export const generateMetadata = guideMetadata("rumpelstiltskin-movie");

export default function Page() {
  return <GuideRoute guide="rumpelstiltskin-movie" />;
}
