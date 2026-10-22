import { GuideRoute, guideMetadata } from "@/app/_lib/guide";

export const generateMetadata = guideMetadata("how-to-make-rumpelstiltskin-video");

export default function Page() {
  return <GuideRoute guide="how-to-make-rumpelstiltskin-video" />;
}
