import { GuideRoute, guideMetadata } from "@/app/_lib/guide";

export const generateMetadata = guideMetadata("rumpelstiltskin-dance-scene");

export default function Page() {
  return <GuideRoute guide="rumpelstiltskin-dance-scene" />;
}
