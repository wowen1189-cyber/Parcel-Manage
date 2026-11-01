"use client";

import { useState, useTransition, type ReactNode } from "react";
import { SortableList, SortHandle } from "@/components/sortable";
import { buttonClass } from "@/components/ui";
import type { TileLayout } from "@/lib/dashboard-tiles";

type SaveLayout = (value: { order: string[]; wide: string[]; hidden: string[] } | null) => Promise<{ ok?: boolean; error?: string }>;

// Dashboard tiles each person can rearrange: drag (or ↑ ↓) to move, half or full width, hide, reset.
export function DashboardGrid({ layout, tiles, saveLayout }: { layout: TileLayout[]; tiles: Record<string, ReactNode>; saveLayout: SaveLayout }) {
  const [editing, setEditing] = useState<TileLayout[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const persist = (value: Parameters<SaveLayout>[0]) =>
    startTransition(async () => {
      const res = await saveLayout(value);
      if (res.error) setError(res.error);
      else {
        setEditing(null);
        setError(null);
      }
    });

  if (editing) {
    return (
      <div>
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-[var(--radius-card)] border border-accent bg-accent-softer px-4 py-3">
          <p className="mr-auto text-sm font-semibold text-accent-deep">Drag tiles (or use the arrows) to move them. Choose half or full width, or hide a tile.</p>
          <button
            type="button"
            disabled={pending}
            className={buttonClass("primary", true)}
            onClick={() => persist({ order: editing.map((t) => t.id), wide: editing.filter((t) => t.wide).map((t) => t.id), hidden: editing.filter((t) => t.hidden).map((t) => t.id) })}
          >
            {pending ? "Saving…" : "Save layout"}
          </button>
          <button type="button" className={buttonClass("ghost", true)} onClick={() => setEditing(null)}>
            Cancel
          </button>
          <button type="button" disabled={pending} className={buttonClass("ghost", true)} onClick={() => persist(null)}>
            Reset
          </button>
        </div>
        {error && <p className="mb-3 text-sm font-medium text-danger">{error}</p>}
        <SortableList
          as="div"
          items={editing}
          getKey={(t) => t.id}
          onChange={setEditing}
          className="grid gap-4 lg:grid-cols-2"
          itemClassName={(t) => (t.wide ? "lg:col-span-2" : undefined)}
          render={(t, controls) => (
            <div className={`rounded-[var(--radius-card)] border-2 border-dashed ${t.hidden ? "border-line opacity-50" : "border-accent/40"} bg-surface`}>
              <div className="flex flex-wrap items-center gap-2 px-4 py-3">
                <SortHandle label={t.title} controls={controls} />
                <p className="mr-auto font-semibold">{t.title}</p>
                <div className="flex rounded-[9px] bg-surface-sunk p-0.5 text-[12px] font-semibold" role="group" aria-label={`${t.title} width`}>
                  {(["half", "full"] as const).map((w) => (
                    <button
                      key={w}
                      type="button"
                      aria-pressed={(w === "full") === t.wide}
                      onClick={() => setEditing(editing.map((x) => (x.id === t.id ? { ...x, wide: w === "full" } : x)))}
                      className={`min-h-8 rounded-[7px] px-2.5 ${(w === "full") === t.wide ? "bg-surface shadow-sm" : "text-muted"}`}
                    >
                      {w === "half" ? "Half" : "Full"}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setEditing(editing.map((x) => (x.id === t.id ? { ...x, hidden: !x.hidden } : x)))}
                  className="min-h-8 rounded-[7px] px-2.5 text-[12px] font-semibold text-muted hover:bg-surface-sunk"
                >
                  {t.hidden ? "Show" : "Hide"}
                </button>
              </div>
            </div>
          )}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="grid gap-4 lg:grid-cols-2">
        {layout
          .filter((t) => !t.hidden)
          .map((t) => (
            <div key={t.id} className={t.wide ? "lg:col-span-2" : undefined}>
              {tiles[t.id]}
            </div>
          ))}
      </div>
      <button type="button" onClick={() => setEditing(layout)} className="mt-4 min-h-9 text-[13px] font-semibold text-subtle hover:text-accent">
        Customize dashboard
      </button>
    </div>
  );
}
