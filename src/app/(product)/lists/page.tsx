"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Copy,
  Download,
  Folder,
  FolderPlus,
  Pencil,
  Search,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { ExportDialog } from "@/components/product/export-dialog";
import {
  Button,
  EmptyState,
  Field,
  InlineNotice,
  PageHeader,
  StatusBadge,
  Surface,
  cx,
} from "@/components/product/ui";
import { requestOrFallback } from "@/lib/demo/client";
import {
  listFromApi,
  prospectFromApi,
  type ApiProspect,
} from "@/lib/demo/adapters";
import { prospects as demoProspects, savedFolders } from "@/lib/demo/data";
import type { Prospect, SavedFolder } from "@/lib/demo/types";

type ListDetailResponse = {
  data?: {
    id?: string;
    resultIds?: string[];
    items?: Array<
      ApiProspect | Prospect | { id?: string; result?: ApiProspect | null }
    >;
  };
};

function isCompleteProspect(value: ApiProspect | Prospect): value is Prospect {
  return (
    (value.mode === "b2b" || value.mode === "b2c") &&
    "intent" in value &&
    "channel" in value &&
    Array.isArray(value.reasons)
  );
}

export default function ListsPage() {
  const [folders, setFolders] = useState<SavedFolder[]>([]);
  const [activeId, setActiveId] = useState("");
  const [records, setRecords] = useState<Prospect[]>([]);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [moveTarget, setMoveTarget] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loadingLists, setLoadingLists] = useState(true);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [busy, setBusy] = useState(false);
  const active = folders.find((folder) => folder.id === activeId);
  const visibleRecords = useMemo(
    () =>
      records.filter((prospect) =>
        `${prospect.name} ${prospect.company} ${prospect.title}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [query, records],
  );

  useEffect(() => {
    let mounted = true;
    requestOrFallback<{ data?: unknown[] }>("/api/lists", {
      data: savedFolders,
    })
      .then(({ data, source }) => {
        if (!mounted) return;
        const rows = Array.isArray(data.data)
          ? data.data.map((item) =>
              "prospectIds" in (item as object)
                ? (item as SavedFolder)
                : listFromApi(item as Parameters<typeof listFromApi>[0]),
            )
          : source === "demo"
            ? savedFolders
            : [];
        setFolders(rows);
        setActiveId(rows[0]?.id ?? "");
      })
      .catch((loadError) => {
        if (mounted)
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Saved lists could not be loaded.",
          );
      })
      .finally(() => {
        if (mounted) setLoadingLists(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!activeId) {
      setRecords([]);
      return;
    }
    let mounted = true;
    setLoadingRecords(true);
    setError("");
    const fallbackFolder = savedFolders.find(
      (folder) => folder.id === activeId,
    );
    const fallbackItems = fallbackFolder
      ? demoProspects.filter((item) =>
          fallbackFolder.prospectIds.includes(item.id),
        )
      : [];
    requestOrFallback<ListDetailResponse>(
      `/api/lists/${encodeURIComponent(activeId)}`,
      {
        data: {
          id: activeId,
          resultIds: fallbackFolder?.prospectIds ?? [],
          items: fallbackItems,
        },
      },
    )
      .then(({ data }) => {
        if (!mounted) return;
        const detail = data.data;
        const parsed = (detail?.items ?? []).flatMap((item) => {
          const candidate: ApiProspect | Prospect | null | undefined =
            "result" in item ? item.result : item;
          if (!candidate) return [];
          return [
            isCompleteProspect(candidate)
              ? candidate
              : prospectFromApi(
                  candidate,
                  candidate.mode === "B2C" ? "b2c" : "b2b",
                ),
          ];
        });
        setRecords(parsed);
        const resultIds = detail?.resultIds ?? parsed.map((item) => item.id);
        setFolders((current) =>
          current.map((folder) =>
            folder.id === activeId
              ? {
                  ...folder,
                  prospectIds: resultIds,
                  count: parsed.length || resultIds.length,
                }
              : folder,
          ),
        );
      })
      .catch((loadError) => {
        if (mounted) {
          setRecords([]);
          setError(
            loadError instanceof Error
              ? loadError.message
              : "This list could not be loaded.",
          );
        }
      })
      .finally(() => {
        if (mounted) setLoadingRecords(false);
      });
    return () => {
      mounted = false;
    };
  }, [activeId]);

  const runMutation = async (action: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (mutationError) {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "The list action could not be completed.",
      );
    } finally {
      setBusy(false);
    }
  };

  const createList = () =>
    runMutation(async () => {
      const name = newName.trim();
      if (!name) return;
      const { data } = await requestOrFallback<{ data?: { id?: string } }>(
        "/api/lists",
        { data: { id: `list-${Date.now()}` } },
        {
          method: "POST",
          body: JSON.stringify({
            name,
            description: "Saved prospect list",
            resultIds: [],
          }),
        },
      );
      const id = data.data?.id;
      if (!id)
        throw new Error("The server did not return the new list identifier.");
      const folder: SavedFolder = {
        id,
        name,
        description: "Saved prospect list",
        count: 0,
        updatedAt: "Just now",
        shared: false,
        prospectIds: [],
      };
      setFolders((current) => [folder, ...current]);
      setActiveId(id);
      setNewName("");
      setCreating(false);
      setNotice(`Created ${name}`);
    });

  const rename = () =>
    runMutation(async () => {
      if (!active || !editName.trim()) return;
      await requestOrFallback(
        `/api/lists/${encodeURIComponent(active.id)}`,
        { data: { ok: true } },
        { method: "PATCH", body: JSON.stringify({ name: editName.trim() }) },
      );
      setFolders((current) =>
        current.map((folder) =>
          folder.id === active.id
            ? { ...folder, name: editName.trim(), updatedAt: "Just now" }
            : folder,
        ),
      );
      setEditing(false);
      setNotice("List renamed");
    });

  const duplicate = () =>
    runMutation(async () => {
      if (!active) return;
      const { data } = await requestOrFallback<{ data?: { id?: string } }>(
        "/api/lists",
        { data: { id: `list-${Date.now()}` } },
        {
          method: "POST",
          body: JSON.stringify({
            name: `${active.name} copy`,
            description: active.description,
            resultIds: active.prospectIds,
          }),
        },
      );
      const id = data.data?.id;
      if (!id)
        throw new Error(
          "The server did not return the duplicated list identifier.",
        );
      const copy = {
        ...active,
        id,
        name: `${active.name} copy`,
        shared: false,
        updatedAt: "Just now",
      };
      setFolders((current) => [copy, ...current]);
      setActiveId(copy.id);
      setNotice("List duplicated");
    });

  const remove = () =>
    runMutation(async () => {
      if (!active) return;
      await requestOrFallback(
        `/api/lists/${encodeURIComponent(active.id)}`,
        { data: { ok: true } },
        { method: "DELETE" },
      );
      const remaining = folders.filter((folder) => folder.id !== active.id);
      setFolders(remaining);
      setActiveId(remaining[0]?.id ?? "");
      setDeleteConfirm(false);
      setNotice(
        `${active.name} deleted; its prospects remain in their original searches`,
      );
    });

  const move = () =>
    runMutation(async () => {
      if (!active || !moveTarget || !selected.size) return;
      const movedIds = [...selected];
      await Promise.all([
        requestOrFallback(
          `/api/lists/${encodeURIComponent(active.id)}`,
          { data: { ok: true } },
          {
            method: "PATCH",
            body: JSON.stringify({ removeResultIds: movedIds }),
          },
        ),
        requestOrFallback(
          `/api/lists/${encodeURIComponent(moveTarget)}`,
          { data: { ok: true } },
          { method: "PATCH", body: JSON.stringify({ addResultIds: movedIds }) },
        ),
      ]);
      setRecords((current) => current.filter((item) => !selected.has(item.id)));
      setFolders((current) =>
        current.map((folder) =>
          folder.id === active.id
            ? {
                ...folder,
                prospectIds: folder.prospectIds.filter(
                  (id) => !selected.has(id),
                ),
                count: Math.max(0, folder.count - selected.size),
              }
            : folder.id === moveTarget
              ? {
                  ...folder,
                  count: folder.count + selected.size,
                  updatedAt: "Just now",
                }
              : folder,
        ),
      );
      setNotice(
        `Moved ${selected.size} prospect${selected.size === 1 ? "" : "s"}`,
      );
      setSelected(new Set());
      setMoveTarget("");
    });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Saved lists"
        description="Organize reviewed prospects into focused lists and export only the records you need."
        action={
          <Button onClick={() => setCreating(true)}>
            <FolderPlus className="size-4" />
            New list
          </Button>
        }
      />
      {notice ? (
        <div
          role="status"
          className="flex min-h-11 items-center gap-3 rounded-lg bg-emerald-50 px-3 text-xs text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
        >
          <Check className="size-3.5" />
          <span className="flex-1">{notice}</span>
          <button
            onClick={() => setNotice("")}
            aria-label="Dismiss message"
            className="flex size-9 items-center justify-center rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : null}
      {error ? (
        <InlineNotice title="List action failed" tone="danger">
          <p>{error}</p>
        </InlineNotice>
      ) : null}
      {creating ? (
        <Surface className="p-4">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void createList();
            }}
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <Field
              autoFocus
              label="List name"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder="e.g. Q4 enterprise shortlist"
              className="flex-1"
            />
            <div className="flex gap-2">
              <Button type="submit" loading={busy}>
                Create list
              </Button>
              <Button
                variant="ghost"
                type="button"
                onClick={() => setCreating(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Surface>
      ) : null}

      <div className="grid min-h-[640px] overflow-hidden rounded-xl border border-zinc-200 bg-white lg:grid-cols-[18rem_minmax(0,1fr)] dark:border-zinc-800 dark:bg-zinc-950">
        <aside className="border-b border-zinc-200 bg-zinc-50 p-3 lg:border-b-0 lg:border-r dark:border-zinc-800 dark:bg-zinc-900/50">
          <div className="flex items-center justify-between px-2 py-2">
            <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Lists
            </p>
            <span className="tabular-nums text-[11px] text-zinc-500">
              {folders.length}
            </span>
          </div>
          <nav aria-label="Saved lists" className="mt-1 space-y-1">
            {folders.map((folder) => (
              <button
                key={folder.id}
                onClick={() => {
                  setActiveId(folder.id);
                  setSelected(new Set());
                  setDeleteConfirm(false);
                }}
                aria-current={folder.id === activeId ? "page" : undefined}
                className={cx(
                  "flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 dark:focus-visible:ring-blue-400",
                  folder.id === activeId
                    ? "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300"
                    : "text-zinc-700 hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-800",
                )}
              >
                <Folder className="size-4 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {folder.name}
                  </span>
                  <span
                    className={cx(
                      "mt-0.5 block text-[11px]",
                      folder.id === activeId
                        ? "text-blue-700 dark:text-blue-300"
                        : "text-zinc-500",
                    )}
                  >
                    {folder.count} prospects · {folder.updatedAt}
                  </span>
                </span>
              </button>
            ))}
          </nav>
        </aside>
        <section className="min-w-0">
          {loadingLists ? (
            <EmptyState
              icon={<Folder className="size-5" />}
              title="Loading saved lists"
              description="Fetching workspace lists and their current counts."
            />
          ) : active ? (
            <>
              <div className="border-b border-zinc-200 p-5 dark:border-zinc-800">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    {editing ? (
                      <form
                        onSubmit={(event) => {
                          event.preventDefault();
                          void rename();
                        }}
                        className="flex max-w-md items-end gap-2"
                      >
                        <Field
                          autoFocus
                          label="List name"
                          value={editName}
                          onChange={(event) => setEditName(event.target.value)}
                          className="flex-1"
                        />
                        <Button size="sm" type="submit" loading={busy}>
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          type="button"
                          onClick={() => setEditing(false)}
                        >
                          Cancel
                        </Button>
                      </form>
                    ) : (
                      <>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-lg font-semibold tracking-[-0.02em] text-zinc-950 dark:text-white">
                            {active.name}
                          </h2>
                          <StatusBadge>Private</StatusBadge>
                        </div>
                        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                          {active.description}
                        </p>
                      </>
                    )}
                  </div>
                  {!editing ? (
                    <div className="flex flex-wrap gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditName(active.name);
                          setEditing(true);
                        }}
                      >
                        <Pencil className="size-3.5" />
                        Rename
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        loading={busy}
                        onClick={() => void duplicate()}
                      >
                        <Copy className="size-3.5" />
                        Duplicate
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDeleteConfirm(true)}
                      >
                        <Trash2 className="size-3.5" />
                        Delete
                      </Button>
                    </div>
                  ) : null}
                </div>
                {deleteConfirm ? (
                  <div className="mt-4 flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800 sm:flex-row sm:items-center dark:border-red-900 dark:bg-red-950 dark:text-red-300">
                    <span className="flex-1">
                      Delete “{active.name}”? Prospects stay in their original
                      searches, but this list cannot be restored.
                    </span>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="danger"
                        loading={busy}
                        onClick={() => void remove()}
                      >
                        Delete list
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDeleteConfirm(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="flex flex-col gap-3 border-b border-zinc-200 p-4 sm:flex-row sm:items-center dark:border-zinc-800">
                <label className="relative block min-w-0 flex-1">
                  <span className="sr-only">Search this list</span>
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search this list…"
                    className="min-h-11 w-full rounded-lg border border-zinc-300 bg-white pl-9 pr-3 text-sm outline-none focus:border-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:focus:border-white"
                  />
                </label>
                <Button
                  variant="secondary"
                  disabled={!records.length}
                  onClick={() => setExportOpen(true)}
                >
                  <Download className="size-4" />
                  Export list
                </Button>
              </div>
              {selected.size ? (
                <div className="flex flex-col gap-3 bg-zinc-950 px-4 py-3 text-white sm:flex-row sm:items-center dark:bg-zinc-100 dark:text-zinc-950">
                  <span className="text-sm font-medium">
                    {selected.size} selected
                  </span>
                  <div className="flex flex-1 gap-2 sm:justify-end">
                    <label className="sr-only" htmlFor="move-target">
                      Move selected to
                    </label>
                    <select
                      id="move-target"
                      value={moveTarget}
                      onChange={(event) => setMoveTarget(event.target.value)}
                      className="min-h-9 min-w-0 rounded-lg bg-white px-3 text-xs text-zinc-950 outline-none dark:bg-zinc-950 dark:text-white"
                    >
                      <option value="">Move to…</option>
                      {folders
                        .filter((folder) => folder.id !== active.id)
                        .map((folder) => (
                          <option key={folder.id} value={folder.id}>
                            {folder.name}
                          </option>
                        ))}
                    </select>
                    <Button
                      size="sm"
                      className="bg-white text-zinc-950 hover:bg-zinc-100 dark:bg-zinc-950 dark:text-white"
                      loading={busy}
                      disabled={!moveTarget}
                      onClick={() => void move()}
                    >
                      Move
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-zinc-300 dark:text-zinc-700"
                      onClick={() => setSelected(new Set())}
                    >
                      Clear
                    </Button>
                  </div>
                </div>
              ) : null}
              {loadingRecords ? (
                <EmptyState
                  icon={<UserPlus className="size-5" />}
                  title="Loading list records"
                  description="Fetching the current masked prospect details."
                />
              ) : visibleRecords.length ? (
                <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {visibleRecords.map((prospect) => (
                    <article
                      key={prospect.id}
                      className="flex min-h-[4.75rem] items-center gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(prospect.id)}
                        onChange={(event) => {
                          const next = new Set(selected);
                          if (event.target.checked) next.add(prospect.id);
                          else next.delete(prospect.id);
                          setSelected(next);
                        }}
                        aria-label={`Select ${prospect.name}`}
                        className="size-4 accent-zinc-950 dark:accent-white"
                      />
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-xs font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                        {prospect.name
                          .split(" ")
                          .map((part) => part[0])
                          .slice(0, 2)
                          .join("")}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-zinc-950 dark:text-white">
                          {prospect.name}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-zinc-500">
                          {prospect.title} · {prospect.company}
                        </p>
                      </div>
                      <span className="tabular-nums text-sm font-semibold">
                        {prospect.score}
                      </span>
                      <StatusBadge
                        tone={
                          prospect.status === "Verified" ? "success" : "neutral"
                        }
                      >
                        {prospect.status}
                      </StatusBadge>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={<UserPlus className="size-5" />}
                  title={query ? "No records match" : "No prospects here yet"}
                  description={
                    query
                      ? "Clear the search to see all records in this list."
                      : "Add reviewed prospects from any search result. Source evidence remains attached to the original record."
                  }
                  action={
                    <Button onClick={() => window.location.assign("/search")}>
                      Find prospects
                    </Button>
                  }
                />
              )}
            </>
          ) : (
            <EmptyState
              icon={<Folder className="size-5" />}
              title="Create your first list"
              description="Use lists to organize reviewed prospects by campaign, territory, or priority."
              action={
                creating ? null : (
                  <Button onClick={() => setCreating(true)}>Create list</Button>
                )
              }
            />
          )}
        </section>
      </div>
      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        selectedCount={selected.size || records.length}
        selectedIds={
          selected.size ? [...selected] : records.map((record) => record.id)
        }
        listId={active?.id}
        consumerData={records.some((record) => record.mode === "b2c")}
      />
    </div>
  );
}
