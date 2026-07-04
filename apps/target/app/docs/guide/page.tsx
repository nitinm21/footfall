export default function Guide() {
  return (
    <article>
      <h1>Guide</h1>
      <p>
        This guide walks through a complete Acme SDK workflow. It also embeds an image, so a real
        browser fetches an extra asset that a JS-less agent typically does not.
      </p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.svg" alt="Acme logo" width={120} height={120} />
      <h2>1. Authenticate</h2>
      <pre>
        <code>{`const acme = new Acme({ apiKey: process.env.ACME_KEY });`}</code>
      </pre>
      <h2>2. Make a request</h2>
      <pre>
        <code>{`const items = await acme.items.list({ limit: 10 });`}</code>
      </pre>
      <h2>3. Handle errors</h2>
      <p>
        Acme throws <code>AcmeError</code> on failure. See the{" "}
        <a href="/docs/intro">Introduction</a> for installation, or the{" "}
        <a href="/docs/interactive">playground</a> to try it live.
      </p>
    </article>
  );
}
