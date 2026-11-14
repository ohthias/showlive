"use client";

import { useOptimistic, useTransition } from "react";
import { updateSettings } from "@/app/actions/settings";
import { useToast } from "@/components/ui/Toast";
import type { LiveSettings } from "@/lib/live-types";

type BoolKey = { [K in keyof LiveSettings]: LiveSettings[K] extends boolean ? K : never }[keyof LiveSettings];

export function SettingToggle({
  eventId,
  name,
  value,
  label,
  hint,
  disabled,
}: {
  eventId: string;
  name: BoolKey;
  value: boolean;
  label: string;
  hint?: string;
  disabled?: boolean;
}) {
  const [optimistic, setOptimistic] = useOptimistic(value);
  const [pending, start] = useTransition();
  const { addToast } = useToast();

  const toggle = () =>
    start(async () => {
      setOptimistic(!optimistic);
      const r = await updateSettings(eventId, { [name]: !optimistic });
      if (!r.ok) addToast(r.error, "error");
    });

  return (
    <label className={`flex cursor-pointer items-start justify-between gap-4 rounded-tl-xl rounded-br-xl bg-base-200/70 px-4 py-3 ${disabled ? "opacity-50" : ""}`}>
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-base-content/55">{hint}</span>}
      </span>
      <input type="checkbox" className="toggle toggle-primary mt-0.5" checked={optimistic} disabled={pending || disabled} onChange={toggle} />
    </label>
  );
}
