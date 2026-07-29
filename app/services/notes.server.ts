import { and, count, desc, eq, isNull, like, or, sql } from "drizzle-orm";
import { notes } from "../drizzle/schema";

/**
 * Convert Markdown source into compact plain text for note cards.
 *
 * The card remains lightweight while displaying the content itself instead
 * of Markdown markers such as "#", "-", "```", "**" and link syntax.
 */
function markdownToPlainText(markdown: string | null | undefined): string {
  if (!markdown) return "";

  return markdown
    // Remove fenced-code markers while retaining the code itself.
    .replace(/^[ \t]*```[^\n]*$/gm, "")
    .replace(/^[ \t]*~~~[^\n]*$/gm, "")

    // Images: retain alt text. Links: retain visible link text.
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\[[^\]]*\]/g, "$1")

    // Remove reference-link definitions.
    .replace(/^[ \t]*\[[^\]]+\]:\s+\S+.*$/gm, "")

    // Remove headings and blockquote markers.
    .replace(/^[ \t]{0,3}#{1,6}[ \t]+/gm, "")
    .replace(/^[ \t]{0,3}>[ \t]?/gm, "")

    // Remove unordered/ordered/task-list markers.
    .replace(/^[ \t]*[-+*][ \t]+\[[ xX]\][ \t]+/gm, "")
    .replace(/^[ \t]*[-+*][ \t]+/gm, "")
    .replace(/^[ \t]*\d+[.)][ \t]+/gm, "")

    // Remove horizontal rules.
    .replace(/^[ \t]*([-*_][ \t]*){3,}$/gm, "")

    // Remove inline emphasis, strike-through and inline-code markers.
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/~~(.*?)~~/g, "$1")
    .replace(/`([^`]+)`/g, "$1")

    // Remove basic HTML tags that may occur in Markdown.
    .replace(/<[^>]+>/g, "")

    // Decode the common entities most likely to appear in notes.
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")

    // Collapse line breaks and repeated whitespace for a compact card.
    .replace(/\r\n?/g, "\n")
    .replace(/\n+/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

export async function getNotesList(
  db: any,
  {
    q,
    privacy,
    offset = 0,
    limit = 24,
  }: {
    q?: string | null;
    privacy?: string | null;
    offset?: number;
    limit?: number;
  }
) {
  let query = db
    .select({
      id: notes.id,
      title: notes.title,
      createdAt: notes.createdAt,
      slug: notes.slug,
      isPublic: notes.isPublic,
      isPinned: notes.isPinned,
      // Fetch a little more source text because Markdown markers are removed
      // before the final card excerpt is truncated.
      excerpt: sql<string>`SUBSTR(${notes.content}, 1, 600)`,
    })
    .from(notes)
    .$dynamic();

  let countQuery = db.select({ value: count() }).from(notes).$dynamic();
  const conditions = [isNull(notes.deletedAt)];

  if (q) {
    conditions.push(
      or(
        like(notes.title, `%${q}%`),
        like(notes.content, `%${q}%`),
        like(notes.slug, `%${q}%`)
      )!
    );
  }

  if (privacy === "public") {
    conditions.push(eq(notes.isPublic, true));
  } else if (privacy === "private") {
    conditions.push(eq(notes.isPublic, false));
  }

  const combined = conditions.length > 1 ? and(...conditions) : conditions[0];
  query = query.where(combined!);
  countQuery = countQuery.where(combined!);

  const [resultNotes, totalCountResult] = await Promise.all([
    query
      .orderBy(desc(notes.isPinned), desc(notes.createdAt))
      .limit(limit)
      .offset(offset),
    countQuery,
  ]);

  const totalNotes = totalCountResult[0]?.value || 0;
  const hasMore = offset + resultNotes.length < totalNotes;

  const formattedNotes = resultNotes.map((n: any) => ({
    id: n.id,
    title: n.title || "Untitled",
    excerpt: markdownToPlainText(n.excerpt).slice(0, 240),
    date: n.createdAt
      ? new Date(n.createdAt).toISOString()
      : new Date().toISOString(),
    slug: n.slug,
    isPublic: !!n.isPublic,
    isPinned: !!n.isPinned,
  }));

  return {
    notes: formattedNotes,
    totalNotes,
    hasMore,
    nextOffset: offset + resultNotes.length,
  };
}
