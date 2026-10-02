"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ChangePinPage() {
  const router = useRouter();
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (newPin !== confirmPin) {
      setError("New PIN doesn't match.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/change-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPin, newPin }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't change your PIN.");
        return;
      }
      router.push("/");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl mb-1 text-center">Set your PIN</h1>
        <p className="text-sm text-muted text-center mb-6">
          Pick a 4-6 digit PIN only you know. You&rsquo;ll use it every time you sign in.
        </p>
        <form onSubmit={onSubmit} className="bg-surface border border-line rounded-xl p-5 flex flex-col gap-4">
          <Field label="Current PIN" value={currentPin} onChange={setCurrentPin} />
          <Field label="New PIN (4-6 digits)" value={newPin} onChange={setNewPin} />
          <Field label="Confirm new PIN" value={confirmPin} onChange={setConfirmPin} />
          {error && <div className="text-sm rounded-md border border-danger bg-danger-bg px-3 py-2">{error}</div>}
          <button
            type="submit"
            disabled={loading}
            className="bg-accent text-accent-ink font-display uppercase tracking-wide font-bold rounded-md py-2.5 disabled:opacity-50"
          >
            {loading ? "Saving..." : "Save PIN"}
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wide text-muted mb-1">{label}</label>
      <input
        type="password"
        inputMode="numeric"
        className="w-full bg-bg border border-line rounded-md px-3 py-2.5"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
      />
    </div>
  );
}
