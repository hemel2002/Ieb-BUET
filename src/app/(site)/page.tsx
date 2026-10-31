import { connection } from "next/server";
import { BallotBrowser } from "@/components/BallotBrowser";
import { FeedbackCta } from "@/components/FeedbackCta";
import { ballot } from "@/lib/candidates";

export default async function HomePage() {
  await connection();
  const groups = (await ballot())
    .map((g) => ({ ...g, positions: g.positions.filter((p) => p.entries.length > 0) }))
    .filter((g) => g.positions.length > 0);

  return (
    <div className="container-site pb-12 pt-5 sm:pt-7 md:pb-16 md:pt-9">
      <BallotBrowser groups={groups} />
      <FeedbackCta />
    </div>
  );
}
