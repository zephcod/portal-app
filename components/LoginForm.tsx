"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { login } from "@/app/login/actions";

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}

function Fields({ error }: { error?: string }) {
  const { pending } = useFormStatus();
  const [visible, setVisible] = useState(false);

  return (
    <fieldset disabled={pending} className="contents">
      <label className="flex flex-col gap-2">
        <span className="font-mono text-[11px] tracking-[0.12em] text-white/60 uppercase">
          Client PIN
        </span>
        <div className="relative">
          <input
            type={visible ? "text" : "password"}
            name="password"
            required
            autoFocus
            className="w-full rounded-md border border-white/15 bg-navy px-3 py-2.5 pr-10 text-sm text-white focus:outline-2 focus:outline-gold disabled:opacity-60"
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            disabled={pending}
            aria-label={visible ? "Hide PIN" : "Show PIN"}
            aria-pressed={visible}
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-white/40 transition-colors hover:text-white disabled:pointer-events-none disabled:opacity-60"
          >
            {visible ? (
              <EyeOff className="h-4 w-4" aria-hidden />
            ) : (
              <Eye className="h-4 w-4" aria-hidden />
            )}
          </button>
        </div>
        <span className="font-mono text-[10px] leading-relaxed text-white/30">
          Use the PIN provided by your account manager.
        </span>
      </label>

      {error && !pending && (
        <p className="mt-3 font-mono text-[11px] text-amber">
          That code or PIN didn&apos;t match. Try again.
        </p>
      )}

      <button className="mt-5 flex w-full items-center justify-center gap-2 rounded-md bg-gold py-2.5 text-sm font-semibold text-navy transition-colors hover:bg-amber hover:text-white disabled:cursor-wait disabled:opacity-80">
        {pending ? (
          <>
            <Spinner />
            Checking…
          </>
        ) : (
          "Enter"
        )}
      </button>
    </fieldset>
  );
}

export default function LoginForm({ error }: { error?: string }) {
  return (
    <form
      action={login}
      className="mt-8 rounded-lg border border-white/10 bg-white/5 p-6"
    >
      <Fields error={error} />
    </form>
  );
}
