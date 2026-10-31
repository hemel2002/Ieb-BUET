import { approvedCommentsBySlug, toCommentJson } from "@/lib/comments";

// Approved comments for one candidate, polled by the profile page so new comments appear without a reload.
// Only what the page already shows publicly. A few seconds of shared caching keeps a traffic spike off the database.
export async function GET(_req: Request, ctx: RouteContext<"/api/candidates/[slug]/comments">) {
  const { slug } = await ctx.params;
  const comments = (await approvedCommentsBySlug(slug)).map(toCommentJson);
  return Response.json(
    { comments },
    { headers: { "Cache-Control": "public, s-maxage=5, stale-while-revalidate=15", "X-Content-Type-Options": "nosniff" } },
  );
}
