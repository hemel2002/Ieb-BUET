import { parseRichText } from "@/lib/rich-text";

/** Renders admin-entered text as headings, paragraphs and lists. Content is always escaped by React. */
export function RichText({ source, className = "" }: { source: string | null | undefined; className?: string }) {
  const blocks = parseRichText(source);
  return (
    <div className={`prose-block max-w-[var(--container-prose)] text-[1.0625rem] leading-relaxed ${className}`}>
      {blocks.map((b, i) => {
        if (b.type === "heading") {
          return (
            <h4 key={i} className="mb-2 mt-6 font-sans text-[1.0625rem] font-semibold first:mt-0">
              {b.text}
            </h4>
          );
        }
        if (b.type === "list") {
          const Tag = b.ordered ? "ol" : "ul";
          return (
            <Tag key={i} className={`space-y-1.5 pl-6 ${b.ordered ? "list-decimal" : "list-disc marker:text-brand"}`}>
              {b.items.map((item, j) => (
                <li key={j}>{item}</li>
              ))}
            </Tag>
          );
        }
        return (
          <p key={i} className="whitespace-pre-line">
            {b.text}
          </p>
        );
      })}
    </div>
  );
}
