/**
 * Minimal, safe text formatting for biographies and manifestos. Admins write plain text:
 *   ## Heading           -> section heading
 *   - item / * item      -> bullet list
 *   1. item              -> numbered list
 *   blank line           -> new paragraph
 * The result is plain data rendered by <RichText>; no HTML is ever interpreted.
 */
export type Block =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; ordered: boolean; items: string[] };

export function parseRichText(source: string | null | undefined): Block[] {
  if (!source?.trim()) return [];
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flush = () => {
    if (paragraph.length) blocks.push({ type: "paragraph", text: paragraph.join("\n") });
    if (list) blocks.push({ type: "list", ...list });
    paragraph = [];
    list = null;
  };

  for (const raw of source.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trim();
    const heading = /^#{1,3}\s+(.+)$/.exec(line);
    const bullet = /^[-*•]\s+(.+)$/.exec(line);
    const numbered = /^\d+[.)]\s+(.+)$/.exec(line);
    if (!line) flush();
    else if (heading) {
      flush();
      blocks.push({ type: "heading", text: heading[1] });
    } else if (bullet || numbered) {
      const ordered = Boolean(numbered);
      if (paragraph.length || (list && list.ordered !== ordered)) flush();
      list ??= { ordered, items: [] };
      list.items.push((bullet ?? numbered)![1]);
    } else if (list) {
      // A continuation line belongs to the previous list item.
      list.items[list.items.length - 1] += ` ${line}`;
    } else paragraph.push(line);
  }
  flush();
  return blocks;
}
