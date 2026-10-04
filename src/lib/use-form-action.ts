"use client";

import { useActionState, useRef, startTransition, useEffect, type FormEvent } from "react";

// Like useActionState, but submits through onSubmit so React doesn't clear the form
// when the server sends back an error. Pass resetOnSuccess to clear it after a save.
export function useFormAction<S extends { ok?: boolean }>(
  action: (prev: S, formData: FormData) => Promise<S>,
  initial: S,
  { resetOnSuccess = false } = {},
) {
  const [state, formAction, pending] = useActionState<S, FormData>(action, initial as Awaited<S>);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(() => formAction(data));
  };
  return { state, pending, ref, onSubmit };
}
