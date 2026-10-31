import { connection } from "next/server";
import { BallotBrowser } from "@/components/BallotBrowser";
import { ballot } from "@/lib/candidates";

export default async function HomePage() {
  await connection();
  const groups = (await ballot())
    .map((g) => ({ ...g, positions: g.positions.filter((p) => p.entries.length > 0) }))
    .filter((g) => g.positions.length > 0);

  return (
    <div className="container-site py-12 md:py-16">
      <BallotBrowser groups={groups} />
    </div>
  );
}
