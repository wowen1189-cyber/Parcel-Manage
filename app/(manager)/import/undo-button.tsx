"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { undoImport } from "./actions";

export function UndoImportButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const [result, setResult] = useState<{ error?: string; message?: string }>({});
  if (result.message) return <span className="text-[13px] text-subtle">{result.message}</span>;
  return (
    <span className="flex flex-col items-end gap-1">
      {confirm ? (
        <span className="flex gap-2">
          <Button
            small
            variant="secondary"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const fd = new FormData();
                fd.set("id", id);
                setResult(await undoImport(fd));
                setConfirm(false);
              })
            }
          >
            {pending ? "Undoing…" : "Yes, remove what it added"}
          </Button>
          <Button small variant="ghost" onClick={() => setConfirm(false)}>
            Keep
          </Button>
        </span>
      ) : (
        <Button small variant="ghost" onClick={() => setConfirm(true)}>
          Undo
        </Button>
      )}
      {result.error && <span className="max-w-xs text-right text-[13px] text-danger">{result.error}</span>}
    </span>
  );
}
