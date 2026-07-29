import { sql } from "drizzle-orm";
import { Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useFetcher, useSearchParams, useSubmit } from "react-router";
import { APP_CONFIG } from "~/config";
import { HomeHeader } from "../components/HomeHeader";
import { type Note } from "../components/NoteCard";
import { NoteList } from "../components/NoteList";
import { SelectionToolbar } from "../components/SelectionToolbar";
import { Button } from "../components/ui/Button";
import { useUI } from "../components/ui/UIProvider";
import { notes } from "../drizzle/schema";
import { useSelectionMode } from "../hooks/useSelection";
import { getDB } from "../services/db.server";
import { getNotesList } from "../services/notes.server";
import { requireAuth } from "../services/session.server";
import type { Route } from "./+types/home";

export function meta({ }: Route.MetaArgs) {
  return [
    { title: APP_CONFIG.name },
    { name: "description", content: APP_CONFIG.description },
  ];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  await requireAuth(request, context.cloudflare.env);
  const db = getDB(context.cloudflare.env);
  const url = new URL(request.url);
  const q = url.searchParams.get("q");
  const privacy = url.searchParams.get("privacy") || "all";
  const offset = parseInt(url.searchParams.get("offset") || "0", 10);
  const limit = 24;

  const notesResult = await getNotesList(db, { q, privacy, offset, limit });
  return {
    notes: notesResult.notes,
    totalNotes: notesResult.totalNotes,
    q: q || "",
    privacy,
    hasMore: notesResult.hasMore,
    nextOffset: notesResult.nextOffset
  };
}

export async function action({ request, context }: Route.ActionArgs) {
  await requireAuth(request, context.cloudflare.env);
  const formData = await request.formData();
  const intent = formData.get("intent");
  const db = getDB(context.cloudflare.env);
  const ids = formData.getAll("id");
  const numberIds = ids
    .map(id => parseInt(id as string, 10))
    .filter(id => !Number.isNaN(id));

  if (intent === "delete_batch") {
    if (numberIds.length > 0) {
      await db.update(notes).set({ deletedAt: new Date(), isPinned: false, isPublic: false }).where(
        sql`id IN (SELECT value FROM json_each(${JSON.stringify(numberIds)}))`
      );
    }
    return { success: true, operation: "delete", affectedCount: numberIds.length };
  }

  if (intent === "pin_batch" || intent === "unpin_batch") {
    if (numberIds.length > 0) {
      await db
        .update(notes)
        .set({ isPinned: intent === "pin_batch" })
        .where(
          sql`id IN (SELECT value FROM json_each(${JSON.stringify(numberIds)}))`
        );
    }
    return {
      success: true,
      operation: intent === "pin_batch" ? "pin" : "unpin",
      affectedCount: numberIds.length
    };
  }

  return { error: "Invalid intent" };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const submit = useSubmit();
  const fetcher = useFetcher<{
    success?: boolean;
    operation?: "delete" | "pin" | "unpin";
    affectedCount?: number;
  }>();
  const containerRef = useRef<HTMLDivElement>(null);

  const [notesList, setNotesList] = useState<Note[]>(loaderData.notes);
  const [hasMore, setHasMore] = useState(loaderData.hasMore);
  const [nextOffset, setNextOffset] = useState(loaderData.nextOffset);

  useEffect(() => {
    setNotesList(loaderData.notes);
    setHasMore(loaderData.hasMore);
    setNextOffset(loaderData.nextOffset);
  }, [loaderData.notes, loaderData.hasMore, loaderData.nextOffset]);

  const handleLoadMore = useCallback((newBatch: Note[], serverHasMore: boolean, serverNextOffset: number) => {
    setNotesList((prev) => {
      const existingIds = new Set(prev.map(n => n.id.toString()));
      const uniqueNewNotes = newBatch.filter((n: Note) => !existingIds.has(n.id.toString()));
      return [...prev, ...uniqueNewNotes];
    });
    setHasMore(serverHasMore);
    setNextOffset(serverNextOffset);
  }, []);

  const selection = useSelectionMode({
    items: notesList,
    containerRef,
    getItemId: (note) => note.id.toString(),
  });

  const { isSelectionMode, selectedIds, clearSelection, selectAll } = selection;

  const allSelectedPinned = useMemo(() => {
    if (selectedIds.size === 0) return false;
    return notesList
      .filter(note => selectedIds.has(note.id.toString()))
      .every(note => note.isPinned);
  }, [notesList, selectedIds]);

  const [q, setQ] = useState(loaderData.q || "");
  const [privacy, setPrivacy] = useState(loaderData.privacy);

  useEffect(() => {
    if (q === loaderData.q) return;
    const timer = setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      if (q) params.set("q", q);
      else params.delete("q");
      params.delete("offset");
      submit(params, { replace: true });
    }, 300);
    return () => clearTimeout(timer);
  }, [q, submit, loaderData.q]);

  useEffect(() => {
    if (privacy === loaderData.privacy) return;
    const params = new URLSearchParams(window.location.search);
    if (privacy && privacy !== "all") params.set("privacy", privacy);
    else params.delete("privacy");
    params.delete("offset");
    submit(params, { replace: true });
  }, [privacy, submit, loaderData.privacy]);

  const { showSnackbar, showModal } = useUI();
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (!fetcher.data?.success) return;

    if (fetcher.data.operation === "pin") {
      showSnackbar("Notes pinned successfully");
    } else if (fetcher.data.operation === "unpin") {
      showSnackbar("Notes unpinned successfully");
    } else if (fetcher.data.operation === "delete") {
      showSnackbar("Notes moved to recycle bin");
    }
  }, [fetcher.data, showSnackbar]);

  useEffect(() => {
    if (searchParams.has("deleted")) {
      showSnackbar("Note moved to recycle bin");
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete("deleted");
        return next;
      }, { replace: true });
    }
  }, [searchParams, showSnackbar, setSearchParams]);

  const handleTogglePin = () => {
    if (selectedIds.size === 0) return;

    const shouldPin = !allSelectedPinned;
    const formData = new FormData();
    formData.append("intent", shouldPin ? "pin_batch" : "unpin_batch");
    selectedIds.forEach(id => formData.append("id", id));

    const selectedIdSet = new Set(selectedIds);
    setNotesList(prev => prev
      .map(note => selectedIdSet.has(note.id.toString())
        ? { ...note, isPinned: shouldPin }
        : note)
      .sort((a, b) => {
        if (a.isPinned !== b.isPinned) {
          return Number(b.isPinned) - Number(a.isPinned);
        }
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      })
    );

    fetcher.submit(formData, { method: "post" });
    clearSelection();
  };

  const handleDelete = () => {
    showModal({
      title: `Delete ${selectedIds.size} notes?`,
      description: `Move these ${selectedIds.size} notes to the recycle bin? They will remain there until you restore or permanently delete them.`,
      confirmText: "Move to recycle bin",
      isDestructive: true,
      icon: <Trash2 className="w-6 h-6" />,
      onConfirm: () => {
        const formData = new FormData();
        formData.append("intent", "delete_batch");
        selectedIds.forEach(id => formData.append("id", id));
        fetcher.submit(formData, { method: "post" });
        clearSelection();
      }
    });
  };

  return (
    <div className="flex flex-col h-screen bg-background text-on-background overflow-hidden" style={{ viewTransitionName: "home-page" }}>
      <div className="relative h-18 md:h-16 shrink-0 z-50">
        <HomeHeader
          isVisible={!isSelectionMode}
          totalNotes={loaderData.totalNotes}
          q={q}
          onSearchChange={(e) => setQ(e.target.value)}
          onSearchClear={() => setQ("")}
        />
        <SelectionToolbar
          isVisible={isSelectionMode}
          selectedCount={selectedIds.size}
          allSelectedPinned={allSelectedPinned}
          onClear={clearSelection}
          onSelectAll={selectAll}
          onTogglePin={handleTogglePin}
          onDelete={handleDelete}
        />
      </div>
      <div className="flex-1 w-full overflow-hidden flex flex-col relative">
        <NoteList
          notes={notesList}
          hasMore={hasMore}
          nextOffset={nextOffset}
          containerRef={containerRef}
          selection={selection}
          onDelete={handleDelete}
          onLoadMore={handleLoadMore}
        >
          <HomeHeader.Filters
            q={q}
            onSearchChange={(e) => setQ(e.target.value)}
            onSearchClear={() => setQ("")}
            privacy={privacy}
            onPrivacyChange={setPrivacy}
          />
        </NoteList>
      </div>
      {!isSelectionMode && (
        <Link to="/new" className="fixed bottom-7 right-7 z-40 md:hidden">
          <Button
            variant="filled"
            className="h-16 w-16 rounded-2xl bg-primary-container text-on-primary-container shadow-md flex items-center justify-center p-0"
            icon={<Plus className="w-8 h-8" />}
          />
        </Link>
      )}
    </div>
  );
}
