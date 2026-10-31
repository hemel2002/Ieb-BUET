import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Emoji, Reveal } from "@/components/motion";
import { RichText } from "@/components/RichText";
import { siteContent, SITE_CONTENT_KEYS } from "@/lib/candidates";

export const metadata: Metadata = { title: "About" };

export default async function AboutPage() {
  await connection();
  const content = await siteContent();
  const about = content[SITE_CONTENT_KEYS.about]?.trim();
  const vision = content[SITE_CONTENT_KEYS.vision]?.trim();

  return (
    <div className="container-site py-10 sm:py-12">
      <div className="max-w-[var(--container-prose)]">
        <Reveal immediate>
          <h1 className="title-page">About this site</h1>
          <p className="mt-4 text-[1.0625rem] text-ink-muted sm:text-[1.1875rem]">
            A single place to look up the BUET alumni contesting the Institution of Engineers, Bangladesh (IEB) Election
            2027-2028.
          </p>
        </Reveal>

        {vision && (
          <Reveal className="mt-10 sm:mt-12">
            <section className="border-l-4 border-accent pl-4 sm:pl-6" aria-labelledby="vision-heading">
              <h2 id="vision-heading" className="title-section">Our shared vision</h2>
              <RichText source={vision} className="mt-4" />
            </section>
          </Reveal>
        )}

        {about && (
          <Reveal className="mt-10 sm:mt-12">
            <section aria-labelledby="campaign-heading">
              <h2 id="campaign-heading" className="title-section">The campaign</h2>
              <RichText source={about} className="mt-4" />
            </section>
          </Reveal>
        )}

        <Reveal className="mt-10 sm:mt-12">
          <section aria-labelledby="info-heading">
            <h2 id="info-heading" className="title-section">Where the information comes from</h2>
            <p className="mt-4">
              Candidate names, contested posts, ballot numbers and IEB membership numbers are taken from the published
              candidate list and shown as printed. Where the list spells a name differently in different sections, the
              profile shows each spelling. Backgrounds, manifestos and photographs are added as candidates provide them.
              Nothing is filled in on a candidate’s behalf.
            </p>
          </section>
        </Reveal>

        <Reveal className="mt-10 sm:mt-12">
          <section aria-labelledby="comments-heading">
            <h2 id="comments-heading" className="title-section">
              How comments work <Emoji>💬</Emoji>
            </h2>
            <ul className="mt-4 list-disc space-y-2 pl-6 marker:text-brand">
              <li>Every comment is reviewed by an administrator before it appears. Nothing is published automatically.</li>
              <li>You can comment with your name or anonymously. Anonymous comments appear as “Anonymous” and no name is stored.</li>
              <li>Comments that are abusive, off-topic, or contain personal information about others are not published.</li>
              <li>Published comments show the date they were submitted.</li>
            </ul>
          </section>
        </Reveal>

        <Reveal className="mt-10 sm:mt-12">
          <Link href="/candidates" className="btn btn-primary">Explore candidates</Link>
        </Reveal>
      </div>
    </div>
  );
}
