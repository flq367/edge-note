import { and, desc, eq, isNotNull, like, or, sql } from "drizzle-orm";
import { ArrowLeft, RotateCcw, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Form, Link, useFetcher } from "react-router";
import { APP_CONFIG } from "~/config";
import { formatDate } from "~/lib/date";
import { AppBar } from "../components/ui/AppBar";
import { Button } from "../components/ui/Button";
import { useUI } from "../components/ui/UIProvider";
import { notes } from "../drizzle/schema";
import { getDB } from "../services/db.server";
import { requireAuth } from "../services/session.server";
import type { Route } from "./+types/trash";

export function meta() {
  return [{ title: `Recycle Bin - ${APP_CONFIG.name}` }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  await requireAuth(request, context.cloudflare.env);
  const db = getDB(context.cloudflare.env);
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() || "";

  const conditions = [isNotNull(notes.deletedAt)];
  if (q) {
    conditions.push(
      or(
        like(notes.title, `%${q}%`),
        like(notes.content, `%${q}%`)
      )!
    );
  }

  const result = await db
    .select({
      id: notes.id,
      title: notes.title,
      content: notes.content,
      deletedAt: notes.deletedAt,
      createdAt: notes.createdAt,
    })
    .from(notes)
    .where(and(...conditions))
    .orderBy(desc(notes.deletedAt));

  return {
    q,
    notes: result.map((note: any) => ({
      ...note,
      title: note.title || "Untitled",
      excerpt: note.content.replace(/[#*`]/g, "").slice(0, 180),
      deletedAt: note.deletedAt ? new Date(note.deletedAt).toISOString() : null,
      createdAt: note.createdAt ? new Date(note.createdAt).toISOString() : null,
    })),
  };
}

export async function action({ request, context }: Route.ActionArgs) {
  await requireAuth(request, context.cloudflare.env);
  const db = getDB(context.cloudflare.env);
  const formData = await request.formData();
  const intent = formData.get("intent");
  const id = Number(formData.get("id"));

  if (!Number.isInteger(id)) {
    return { success: false, error: "Invalid note ID" };
  }

  if (intent === "restore") {
    await db
      .update(notes)
      .set({ deletedAt: null, updatedAt: new Date() })
      .where(and(eq(notes.id, id), isNotNull(notes.deletedAt)));
    return { success: true, operation: "restore", id };
  }

  if (intent === "delete_forever") {
    await db
      .delete(notes)
      .where(and(eq(notes.id, id), isNotNull(notes.deletedAt)));
    return { success: true, operation: "delete_forever", id };
  }

  return { success: false, error: "Invalid action" };
}

export default function Trash({ loaderData }: Route.ComponentProps) {
  const fetcher = useFetcher<typeof action>();
  const { showModal, showSnackbar } = useUI();
  const [hiddenIds, setHiddenIds] = useState<Set<number>>(new Set());

  const visibleNotes = useMemo(
    () => loaderData.notes.filter((note) => !hiddenIds.has(note.id)),
    [loaderData.notes, hiddenIds]
  );

  const submitAction = (id: number, intent: "restore" | "delete_forever") => {
    const formData = new FormData();
    formData.append("id", String(id));
    formData.append("intent", intent);
    setHiddenIds((prev) => new Set(prev).add(id));
    fetcher.submit(formData, { method: "post" });
    showSnackbar(intent === "restore" ? "Note restored" : "Note permanently deleted");
  };

  const handleDeleteForever = (id: number, title: string) => {
    showModal({
      title: "Delete?",
      description: `“${title}” will be permanently deleted. This action cannot be undone.`,
      confirmText: "Delete",
      isDestructive: true,
      icon: <Trash2 className="w-6 h-6" />,
      onConfirm: () => submitAction(id, "delete_forever"),
    });
  };

  return (
    <div className="min-h-screen bg-background text-on-background">
      <AppBar
        className="sticky top-0 z-40 bg-background/85 backdrop-blur-xl border-b border-outline-variant/20"
        title={
          <div className="flex flex-col">
            <span className="font-semibold text-lg">Recycle Bin</span>
            <span className="text-xs text-on-surface-variant">
              {visibleNotes.length} items · Items are never deleted automatically
            </span>
          </div>
        }
        startAction={
          <Link to="/" viewTransition tabIndex={-1}>
            <Button variant="icon" icon={<ArrowLeft className="w-6 h-6" />} aria-label="Back" />
          </Link>
        }
      />

      <div className="max-w-7xl mx-auto p-4 md:p-6">
        <Form method="get" className="mb-5 relative max-w-xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-on-surface-variant" />
          <input
            type="search"
            name="q"
            defaultValue={loaderData.q}
            placeholder="Search recycle bin"
            className="w-full h-13 rounded-2xl bg-surface-container-high pl-12 pr-4 outline-none focus:ring-2 focus:ring-primary"
          />
        </Form>

        {visibleNotes.length === 0 ? (
          <div className="min-h-[55vh] flex flex-col items-center justify-center text-center px-6">
            <div className="size-20 rounded-full bg-surface-container-high flex items-center justify-center mb-5">
              <Trash2 className="w-9 h-9 text-on-surface-variant" />
            </div>
            <h2 className="text-xl font-semibold">Recycle bin is empty</h2>
            <p className="mt-2 text-on-surface-variant">Deleted notes will appear here and will not expire.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
            {visibleNotes.map((note) => (
              <article key={note.id} className="flex flex-col min-h-40 rounded-2xl bg-surface-container-high p-4 overflow-hidden">
                <h2 className="font-bold text-base line-clamp-1">{note.title}</h2>
                <p className="mt-2 text-sm leading-6 text-on-surface-variant line-clamp-2 grow">
                  {note.excerpt || "No additional text"}
                </p>
                <p className="mt-4 text-xs text-on-surface-variant">
                  Deleted {note.deletedAt ? formatDate(note.deletedAt) : "recently"}
                </p>
                <div className="mt-3 pt-3 border-t border-outline-variant/20 flex items-center justify-end gap-2">
                  <Button
                    variant="text"
                    onClick={() => submitAction(note.id, "restore")}
                    icon={<RotateCcw className="w-4 h-4" />}
                  >
                    Restore
                  </Button>
                  <Button
                    variant="text"
                    className="text-error hover:bg-error/10"
                    onClick={() => handleDeleteForever(note.id, note.title)}
                    icon={<Trash2 className="w-4 h-4" />}
                  >
                    Delete
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
