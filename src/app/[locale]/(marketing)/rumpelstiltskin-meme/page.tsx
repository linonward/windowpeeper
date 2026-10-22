import { GuideRoute, guideMetadata } from "@/app/_lib/guide";

export const generateMetadata = guideMetadata("rumpelstiltskin-meme");

export default function Page() {
  return <GuideRoute guide="rumpelstiltskin-meme" />;
}
