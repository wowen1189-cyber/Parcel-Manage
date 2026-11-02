"use client";

import { useActionState, useState } from "react";
import { Button, Notice } from "@/components/ui";
import { disconnectFeed, finishBankLink, pullBalance, startBankLink, syncNow, type FeedState } from "./feed-actions";

type StripeJs = { collectFinancialConnectionsAccounts: (o: { clientSecret: string }) => Promise<{ financialConnectionsSession?: { id: string }; error?: { message?: string } }> };
declare global {
  interface Window {
    Stripe?: (key: string) => StripeJs;
  }
}

/** Stripe.js, loaded from Stripe only when someone connects a bank. */
function loadStripe(): Promise<NonNullable<Window["Stripe"]>> {
  if (window.Stripe) return Promise.resolve(window.Stripe);
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://js.stripe.com/v3/";
    s.onload = () => (window.Stripe ? resolve(window.Stripe) : reject(new Error("Stripe didn't load.")));
    s.onerror = () => reject(new Error("Stripe didn't load. Check your connection."));
    document.head.appendChild(s);
  });
}

const PUBLISHABLE = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

export function ConnectBankButton() {
  const [state, setState] = useState<FeedState>({});
  const [busy, setBusy] = useState(false);
  if (!PUBLISHABLE) return <Notice tone="warn">Bank feeds need Stripe&apos;s publishable key in Parcel Manage&apos;s settings (NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY).</Notice>;
  async function connect() {
    setBusy(true);
    setState({});
    try {
      const start = await startBankLink();
      if (!start.clientSecret || !start.sessionId) return setState({ error: start.error ?? "Couldn't start." });
      const Stripe = await loadStripe();
      const r = await Stripe(PUBLISHABLE!).collectFinancialConnectionsAccounts({ clientSecret: start.clientSecret });
      if (r.error) return setState({ error: r.error.message ?? "The bank connection didn't finish." });
      setState(await finishBankLink(r.financialConnectionsSession?.id ?? start.sessionId));
    } catch (e) {
      setState({ error: e instanceof Error ? e.message : "The bank connection didn't finish." });
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-3">
      {state.error && <Notice tone="danger">{state.error}</Notice>}
      {state.message && <Notice tone="success">{state.message}</Notice>}
      <Button type="button" onClick={connect} disabled={busy}>
        {busy ? "Connecting…" : "Connect a bank"}
      </Button>
    </div>
  );
}

const empty: FeedState = {};
function Status({ state }: { state: FeedState }) {
  if (state.error) return <Notice tone="danger">{state.error}</Notice>;
  if (state.message) return <Notice tone="success">{state.message}</Notice>;
  return null;
}

export function FeedControls({ id }: { id: string }) {
  const [syncState, sync, syncing] = useActionState(syncNow.bind(null, id), empty);
  const [balState, bal, pulling] = useActionState(pullBalance.bind(null, id), empty);
  const [offState, off, stopping] = useActionState(disconnectFeed.bind(null, id), empty);
  return (
    <div className="space-y-3">
      {[syncState, balState, offState].map((s, i) => (
        <Status key={i} state={s} />
      ))}
      <div className="flex flex-wrap gap-2">
        <form action={sync}>
          <Button type="submit" small variant="secondary" disabled={syncing}>
            {syncing ? "Syncing…" : "Sync now"}
          </Button>
        </form>
        <form action={bal}>
          <Button type="submit" small variant="secondary" disabled={pulling}>
            {pulling ? "Asking the bank…" : "Get today's balance"}
          </Button>
        </form>
        <form action={off}>
          <Button type="submit" small variant="secondary" disabled={stopping}>
            {stopping ? "Disconnecting…" : "Disconnect"}
          </Button>
        </form>
      </div>
    </div>
  );
}
