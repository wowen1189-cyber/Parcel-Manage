"use client";

import { useRef, useState, type ReactNode } from "react";

export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export type SortControls = { index: number; count: number; moveUp: () => void; moveDown: () => void; dragging: boolean };

/**
 * A list you can reorder by dragging (mouse) or with the ↑ ↓ buttons each row gets (touch, keyboard).
 * `render` draws one row; spread `rowProps` on the row's outer element.
 */
export function SortableList<T>({
  items,
  getKey,
  onChange,
  render,
  className,
  itemClassName,
  as: Tag = "ul",
}: {
  items: T[];
  getKey: (item: T) => string;
  onChange: (next: T[]) => void;
  render: (item: T, controls: SortControls) => ReactNode;
  className?: string;
  /** Extra classes for one row, e.g. a full-width tile. */
  itemClassName?: (item: T) => string | undefined;
  as?: "ul" | "ol" | "div";
}) {
  const dragFrom = useRef<number | null>(null);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const Item = Tag === "div" ? "div" : "li";

  return (
    <Tag className={className}>
      {items.map((item, index) => {
        const key = getKey(item);
        return (
          <Item
            key={key}
            draggable
            onDragStart={(e) => {
              dragFrom.current = index;
              setDragKey(key);
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("text/plain", key);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              const from = dragFrom.current;
              if (from == null || from === index) return;
              onChange(moveItem(items, from, index));
              dragFrom.current = index;
            }}
            onDragEnd={() => {
              dragFrom.current = null;
              setDragKey(null);
            }}
            className={[dragKey === key ? "opacity-50" : "", itemClassName?.(item) ?? ""].join(" ").trim() || undefined}
          >
            {render(item, {
              index,
              count: items.length,
              moveUp: () => onChange(moveItem(items, index, index - 1)),
              moveDown: () => onChange(moveItem(items, index, index + 1)),
              dragging: dragKey === key,
            })}
          </Item>
        );
      })}
    </Tag>
  );
}

/** The ⠿ handle and ↑ ↓ buttons shown on each row while customizing. */
export function SortHandle({ label, controls }: { label: string; controls: SortControls }) {
  const btn = "grid size-8 place-items-center rounded-[8px] text-[13px] text-muted hover:bg-surface-sunk disabled:opacity-30";
  return (
    <span className="flex shrink-0 items-center gap-0.5">
      <span aria-hidden className="cursor-grab px-1 text-subtle active:cursor-grabbing" title="Drag to move">
        ⠿
      </span>
      <button type="button" className={btn} onClick={controls.moveUp} disabled={controls.index === 0} aria-label={`Move ${label} up`}>
        ↑
      </button>
      <button type="button" className={btn} onClick={controls.moveDown} disabled={controls.index === controls.count - 1} aria-label={`Move ${label} down`}>
        ↓
      </button>
    </span>
  );
}
