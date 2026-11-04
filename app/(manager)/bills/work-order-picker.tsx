"use client";

import { useEffect, useState } from "react";
import { Field, Input, Select } from "@/components/ui";
import type { WorkOrderPick } from "@/lib/bills";
import { searchWorkOrders } from "./actions";

const SEARCH = "search";
const label = (w: WorkOrderPick) => `#${w.number} · ${w.title}${w.property ? ` · ${w.property}` : ""}`;

// Work order on a bill: the 5 newest in the dropdown, and a search for any other.
export function WorkOrderPicker({ recent, current }: { recent: WorkOrderPick[]; current?: WorkOrderPick | null }) {
  const [options, setOptions] = useState<WorkOrderPick[]>(() => (current && !recent.some((w) => w.number === current.number) ? [current, ...recent] : recent));
  const [chosen, setChosen] = useState(current ? String(current.number) : "");
  const [searching, setSearching] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<WorkOrderPick[] | null>(null);

  useEffect(() => {
    if (!searching || !q.trim()) return;
    let live = true;
    const t = setTimeout(async () => {
      const found = await searchWorkOrders(q);
      if (live) setResults(found);
    }, 300);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q, searching]);

  const choose = (w: WorkOrderPick) => {
    if (!options.some((o) => o.number === w.number)) setOptions((o) => [w, ...o]);
    setChosen(String(w.number));
    setSearching(false);
    setQ("");
    setResults(null);
  };

  return (
    <div className="space-y-2 sm:col-span-2">
      <input type="hidden" name="work_order" value={searching ? "" : chosen} />
      {/* Lets the form show the same choice again if saving fails. */}
      <input type="hidden" name="work_order_label" value={searching ? "" : (options.find((w) => String(w.number) === chosen)?.title ?? "")} />
      <input type="hidden" name="work_order_property" value={searching ? "" : (options.find((w) => String(w.number) === chosen)?.property ?? "")} />
      <Field label="Work order (optional)" hint="The 5 newest are listed. Choose Search to find an older one.">
        <Select
          value={searching ? SEARCH : chosen}
          onChange={(e) => {
            if (e.target.value === SEARCH) setSearching(true);
            else {
              setSearching(false);
              setChosen(e.target.value);
            }
          }}
        >
          <option value="">None</option>
          {options.map((w) => (
            <option key={w.number} value={String(w.number)}>
              {label(w)}
            </option>
          ))}
          <option value={SEARCH}>Search for another work order…</option>
        </Select>
      </Field>
      {searching && (
        <div className="rounded-[var(--radius-control)] border border-line p-3">
          <Field label="Search work orders" hint="Number, words from the title, or the property">
            <Input
              type="search"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                if (!e.target.value.trim()) setResults(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.preventDefault();
              }}
              placeholder="1042, faucet, Oak Street…"
              autoFocus
            />
          </Field>
          {results && (
            <ul className="mt-2 divide-y divide-line" aria-live="polite">
              {results.length ? (
                results.map((w) => (
                  <li key={w.number}>
                    <button type="button" onClick={() => choose(w)} className="block min-h-11 w-full px-1 py-2 text-left text-sm hover:bg-surface-muted">
                      {label(w)}
                    </button>
                  </li>
                ))
              ) : (
                <li className="py-2 text-[13px] text-subtle">No work orders match.</li>
              )}
            </ul>
          )}
          <button type="button" onClick={() => setSearching(false)} className="mt-1 min-h-11 text-[13px] font-semibold text-muted hover:underline">
            Cancel search
          </button>
        </div>
      )}
    </div>
  );
}
