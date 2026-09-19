"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { secondaryButtonClass } from "@/components/auth/shared";

export function RetryDeliveriesButton() {
  const router = useRouter();
  const [state, setState] = useState<{ busy: boolean; note: string | null }>({ busy: false, note: null });

  async function retry() {
    setState({ busy: true, note: null });
    try {
      const response = await fetch("/api/admin/leads/retry", { method: "POST" });
      const body = (await response.json().catch(() => null)) as { ok?: boolean; requeued?: number; sent?: number; waiting?: number; retrying?: number; error?: string } | null;
      if (!response.ok || !body?.ok) throw new Error(body?.error ?? "Retry failed.");
      setState({ busy: false, note: `Requeued ${body.requeued} · sent ${body.sent} · retrying ${body.retrying} · waiting on credentials ${body.waiting}` });
      router.refresh();
    } catch (error) {
      setState({ busy: false, note: (error as Error).message });
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" onClick={retry} disabled={state.busy} className={secondaryButtonClass}>
        {state.busy ? "Working the outbox…" : "Retry failed and deliver now"}
      </button>
      {state.note && (
        <p role="status" className="tnum text-xs text-ink-soft">
          {state.note}
        </p>
      )}
    </div>
  );
}
