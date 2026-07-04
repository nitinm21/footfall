"use client";

import { useEffect, useState } from "react";

/**
 * The "empty shell" failure mode: the server renders only a "Loading…" placeholder,
 * and the real content is injected on the client after hydration. An agent that does
 * not execute JavaScript sees an almost-empty page — exactly the empty_shell signal.
 */
export default function Interactive() {
  const [content, setContent] = useState<string | null>(null);

  useEffect(() => {
    setContent(
      "This interactive playground is rendered entirely on the client. If you can read this, JavaScript ran. Acme lets you send a live request and inspect the response inline.",
    );
  }, []);

  return (
    <article>
      <h1>Interactive playground</h1>
      <div id="playground">{content ?? "Loading…"}</div>
    </article>
  );
}
