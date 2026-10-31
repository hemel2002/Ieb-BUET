import type { Metadata } from "next";
import { connection } from "next/server";
import { CandidateDirectory } from "@/components/CandidateDirectory";
import { Reveal } from "@/components/motion";
import { ballot } from "@/lib/candidates";

export const metadata: Metadata = { title: "Candidates" };

export default async function CandidatesPage({ searchParams }: PageProps<"/candidates">) {
  await connection();
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.slice(0, 100) : "";
  const position = typeof params.position === "string" ? params.position : "";
  const groups = await ballot();

  return (
    <div className="container-site pb-10 pt-5 sm:pb-12 sm:pt-8">
      <Reveal immediate>
        <h1 className="title-page">Candidates</h1>
        <p className="mt-3 max-w-[var(--container-prose)] text-ink-muted">
          Candidates are listed by ballot section and post, in ballot-number order. Several candidates contest more than
          one post and appear under each. Type in the search box to filter instantly.
        </p>
      </Reveal>
      {/* Filtering happens in the browser as you type; q and position only seed the first render (and the no-JS form). */}
      <CandidateDirectory groups={groups} initialQuery={q} initialPosition={position} />
    </div>
  );
}
