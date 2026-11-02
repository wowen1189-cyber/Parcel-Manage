"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { askAi, loadApprovals } from "@/app/(manager)/assistant-actions";
import type { Approval } from "@/lib/ai/assistant";
import { Button, buttonClass, Notice, Pill, Textarea } from "@/components/ui";

const EXAMPLES = ["Who owes more than $500?", "Which leases end in the next 90 days?", "What emergency work orders are open?", "How many units are vacant?"];

// The assistant side panel on every screen: read-only questions answered by the company's own AI, and
// what's waiting on a person ("Needs approval"), each linking to where to act.
export function AiPanel({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<"ask" | "approvals">("ask");
  const [items, setItems] = useState<Approval[] | null>(null);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<{ q: string; answer?: string; error?: string }[]>([]);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadApprovals()
      .then(setItems)
      .catch(() => setItems([]));
  }, []);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [history]);

  async function ask(q: string) {
    if (!q.trim() || busy) return;
    setBusy(true);
    setQuestion("");
    setHistory((h) => [...h, { q }]);
    const r = await askAi(q).catch(() => ({ error: "The assistant couldn't be reached. Try again." }));
    setHistory((h) => h.map((x, i) => (i === h.length - 1 ? { q, ...r } : x)));
    setBusy(false);
  }

  const waiting = items?.reduce((s, i) => s + i.count, 0) ?? 0;
  const tabClass = (on: boolean) => `min-h-11 flex-1 border-b-2 text-sm font-semibold ${on ? "border-accent text-ink" : "border-transparent text-subtle"}`;

  return (
    <aside aria-label="AI assistant" className="fixed inset-y-0 right-0 z-40 flex w-full max-w-[380px] flex-col border-l border-line bg-surface lg:sticky lg:top-[61px] lg:z-10 lg:h-[calc(100vh-61px)]">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <p className="font-bold">AI assistant</p>
        <button type="button" className={buttonClass("ghost", true)} onClick={onClose}>
          Close
        </button>
      </div>
      <div className="flex border-b border-line px-2" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "ask"} className={tabClass(tab === "ask")} onClick={() => setTab("ask")}>
          Ask
        </button>
        <button type="button" role="tab" aria-selected={tab === "approvals"} className={tabClass(tab === "approvals")} onClick={() => setTab("approvals")}>
          Needs approval{waiting ? ` (${waiting})` : ""}
        </button>
      </div>

      {tab === "ask" ? (
        <>
          <div className="flex-1 space-y-4 overflow-y-auto p-4 text-sm">
            {!history.length && (
              <div className="space-y-3 text-muted">
                <p>Ask about your properties, tenants, rent owed, work orders, deposits and bills. Answers come from your records through your own AI connection. The assistant can&apos;t change anything.</p>
                <div className="flex flex-wrap gap-2">
                  {EXAMPLES.map((e) => (
                    <button key={e} type="button" onClick={() => ask(e)} className="min-h-10 rounded-full border border-line px-3 text-[13px] text-ink hover:bg-surface-sunk">
                      {e}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {history.map((h, i) => (
              <div key={i} className="space-y-2">
                <p className="ml-8 rounded-[var(--radius-control)] bg-accent-softer px-3 py-2 text-ink">{h.q}</p>
                {h.answer ? <p className="whitespace-pre-wrap rounded-[var(--radius-control)] border border-line px-3 py-2">{h.answer}</p> : h.error ? <Notice tone="warn">{h.error}</Notice> : <p className="text-subtle">Thinking…</p>}
              </div>
            ))}
            <div ref={end} />
          </div>
          <form
            className="space-y-2 border-t border-line p-3"
            onSubmit={(e) => {
              e.preventDefault();
              ask(question);
            }}
          >
            <Textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  ask(question);
                }
              }}
              placeholder="Ask a question"
              aria-label="Ask the assistant a question"
              className="min-h-16"
              maxLength={1000}
            />
            <div className="flex justify-end">
              <Button type="submit" small disabled={busy || !question.trim()}>
                {busy ? "Asking…" : "Ask"}
              </Button>
            </div>
          </form>
        </>
      ) : (
        <div className="flex-1 space-y-2 overflow-y-auto p-4 text-sm">
          {items === null ? (
            <p className="text-subtle">Loading…</p>
          ) : items.length ? (
            items.map((i) => (
              <Link key={i.label} href={i.href} onClick={onClose} className="flex items-center justify-between gap-3 rounded-[var(--radius-control)] border border-line px-3 py-3 hover:bg-surface-sunk">
                <span>
                  <span className="font-semibold">{i.label}</span>
                  {i.detail && <span className={`block text-[13px] ${i.urgent ? "text-danger" : "text-subtle"}`}>{i.detail}</span>}
                </span>
                <Pill tone={i.urgent ? "danger" : "info"}>{i.count}</Pill>
              </Link>
            ))
          ) : (
            <p className="text-muted">Nothing is waiting on you.</p>
          )}
        </div>
      )}
    </aside>
  );
}
