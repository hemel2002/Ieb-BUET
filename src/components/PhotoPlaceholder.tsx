/** Neutral head-and-shoulders silhouette in the site palette, shown when no photo exists or loading fails. */
export function PhotoPlaceholder({ label, className = "" }: { label: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 160 200"
      role="img"
      aria-label={label}
      preserveAspectRatio="xMidYMid slice"
      className={`block h-full w-full ${className}`}
    >
      <rect width="160" height="200" fill="var(--color-canvas)" />
      <circle cx="80" cy="78" r="30" fill="var(--color-line-strong)" />
      <path d="M22 200c0-38 26-64 58-64s58 26 58 64z" fill="var(--color-line-strong)" />
      <rect y="194" width="160" height="6" fill="var(--color-accent)" opacity="0.7" />
    </svg>
  );
}
