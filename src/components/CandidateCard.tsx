import Link from "next/link";
import { CandidatePhoto } from "./CandidatePhoto";

type Props = {
  slug: string;
  fullName: string;
  membershipNo: string | null;
  photoKey: string | null;
  ballotNo: string | null;
  /** Shown under the name when the card is not already under its position heading. */
  position?: string;
};

const cardClass =
  "group flex h-full rounded-[var(--radius-lg)] border border-line bg-surface shadow-[var(--shadow-card)] transition-[border-color,box-shadow] duration-[var(--dur-short)] hover:border-line-strong hover:shadow-[var(--shadow-lift)]";

/** Compact card for the directory: small portrait beside the ballot details. */
export function CandidateCard({ slug, fullName, membershipNo, photoKey, ballotNo, position }: Props) {
  return (
    <Link href={`/candidates/${slug}`} className={`${cardClass} gap-4 p-3`}>
      <CandidatePhoto photoKey={photoKey} name={fullName} sizes="80px" className="w-[4.5rem] shrink-0 rounded-[var(--radius-md)] sm:w-20" />
      <span className="flex min-w-0 flex-col justify-center gap-1.5">
        {ballotNo && <span className="ballot-no self-start">Ballot No. {ballotNo}</span>}
        <span className="font-semibold leading-snug text-ink [overflow-wrap:anywhere] group-hover:text-brand">{fullName}</span>
        {position && <span className="text-[0.9375rem] leading-snug text-ink-muted">{position}</span>}
        {membershipNo && <span className="tabular text-sm text-ink-muted">IEB membership {membershipNo}</span>}
      </span>
    </Link>
  );
}

/** Larger portrait card used for the homepage highlight. */
export function CandidatePortraitCard({ slug, fullName, membershipNo, photoKey, ballotNo, position }: Props) {
  return (
    <Link href={`/candidates/${slug}`} className={`${cardClass} flex-col overflow-hidden`}>
      <CandidatePhoto photoKey={photoKey} name={fullName} sizes="(min-width: 1024px) 260px, (min-width: 640px) 33vw, 50vw" />
      <span className="flex flex-1 flex-col gap-1.5 border-t border-line p-4">
        {ballotNo && <span className="ballot-no self-start">Ballot No. {ballotNo}</span>}
        <span className="font-semibold leading-snug [overflow-wrap:anywhere] group-hover:text-brand">{fullName}</span>
        {position && <span className="text-[0.9375rem] leading-snug text-ink-muted">{position}</span>}
        {membershipNo && <span className="tabular mt-auto pt-1 text-sm text-ink-muted">IEB membership {membershipNo}</span>}
      </span>
    </Link>
  );
}
