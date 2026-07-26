"use client";

import { useFormStatus } from "react-dom";

/**
 * Submit button with a pending spinner — drop into any <form action={...}>.
 */
export default function SubmitButton({
  children,
  pendingLabel = "Submitting…",
  className = "rounded-md bg-gold px-4 py-2 text-sm font-medium text-navy transition hover:bg-amber disabled:cursor-wait disabled:opacity-80",
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? (
        <span className="flex items-center gap-2">
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
          {pendingLabel}
        </span>
      ) : (
        children
      )}
    </button>
  );
}
