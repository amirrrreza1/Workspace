"use client";

import { useLayoutEffect, useRef } from "react";

import { formatTomanInput, tomanInputCaret } from "@/lib/expenses-month";

export function TomanAmountInput({
  id,
  value,
  onChange,
  placeholder = "e.g. 50,000",
  required = true,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const caret = useRef<number | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || caret.current == null) return;
    el.setSelectionRange(caret.current, caret.current);
    caret.current = null;
  }, [value]);

  return (
    <input
      ref={ref}
      id={id}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder={placeholder}
      value={value}
      required={required}
      onChange={(event) => {
        const input = event.target;
        const cursor = input.selectionStart ?? input.value.length;
        const digitsBefore = input.value.slice(0, cursor).replace(/\D/g, "").length;
        const formatted = formatTomanInput(input.value);
        caret.current = tomanInputCaret(formatted, digitsBefore);
        onChange(formatted);
      }}
    />
  );
}
