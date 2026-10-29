import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { RichText } from "@/components/RichText";
import { siteContent, SITE_CONTENT_KEYS } from "@/lib/candidates";

export const metadata: Metadata = { title: "About" };

export default async function AboutPage() {
  await connection();
  const about = (await siteContent())[SITE_CONTENT_KEYS.about]?.trim();

  return (
    <div className="container-site py-12">
      <div className="max-w-[var(--container-prose)]">
        <h1 className="text-[2.25rem] sm:text-[2.75rem]">About this site</h1>
        <p className="mt-4 text-[1.1875rem] text-ink-muted">
          A single place to look up the BUET alumni contesting the Institution of Engineers, Bangladesh (IEB) Election
          2027-2028.
        </p>

        {about && (
          <section className="mt-12" aria-labelledby="campaign-heading">
            <h2 id="campaign-heading" className="text-[1.5rem]">The campaign</h2>
            <RichText source={about} className="mt-4" />
          </section>
        )}

        <section className="mt-12" aria-labelledby="info-heading">
          <h2 id="info-heading" className="text-[1.5rem]">Where the information comes from</h2>
          <p className="mt-4">
            Candidate names, contested posts, ballot numbers and IEB membership numbers are taken from the published
            candidate list and shown as printed. Where the list spells a name differently in different sections, the
            profile shows each spelling. Backgrounds, manifestos and photographs are added as candidates provide them.
            Nothing is filled in on a candidate’s behalf.
          </p>
        </section>

        <section className="mt-12" aria-labelledby="comments-heading">
          <h2 id="comments-heading" className="text-[1.5rem]">How comments work</h2>
          <ul className="mt-4 list-disc space-y-2 pl-6 marker:text-brand">
            <li>Every comment is reviewed by an administrator before it appears. Nothing is published automatically.</li>
            <li>You can comment with your name or anonymously. Anonymous comments appear as “Anonymous” and no name is stored.</li>
            <li>Comments that are abusive, off-topic, or contain personal information about others are not published.</li>
            <li>Published comments show the date they were submitted.</li>
          </ul>
        </section>

        <div className="mt-12">
          <Link href="/candidates" className="btn btn-primary">Explore candidates</Link>
        </div>
      </div>
    </div>
  );
}
