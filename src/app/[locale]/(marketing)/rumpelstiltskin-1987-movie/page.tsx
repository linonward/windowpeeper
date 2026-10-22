import { GuideRoute, guideMetadata } from "@/app/_lib/guide";

export const generateMetadata = guideMetadata("rumpelstiltskin-1987-movie");

export default function Page() {
  return <GuideRoute guide="rumpelstiltskin-1987-movie" />;
}
