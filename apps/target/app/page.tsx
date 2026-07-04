export default function Home() {
  return (
    <article>
      <h1>Acme SDK Documentation</h1>
      <p>
        Welcome to the Acme SDK docs. Acme is a small, fictional developer tool used as a Footfall
        capture test rig. These pages deliberately include a few common failure modes so agent
        traffic has something to trip over.
      </p>
      <h2>Contents</h2>
      <ul>
        <li>
          <a href="/docs/intro">Introduction</a> — what Acme is and how to install it.
        </li>
        <li>
          <a href="/docs/guide">Guide</a> — a worked example with code and an image.
        </li>
        <li>
          <a href="/docs/interactive">Interactive playground</a> — rendered entirely on the client
          (an empty shell to a JS-less agent).
        </li>
        <li>
          <a href="/docs/private">API keys</a> — behind an auth wall (returns 403).
        </li>
        <li>
          <a href="/docs/old-intro">Old introduction</a> — a moved page that now 404s.
        </li>
      </ul>
      <p>
        Looking for a machine-readable index? Try <a href="/llms.txt">/llms.txt</a> (it does not
        exist yet).
      </p>
    </article>
  );
}
