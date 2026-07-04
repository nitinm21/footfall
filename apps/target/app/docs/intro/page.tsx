export default function Intro() {
  return (
    <article>
      <h1>Introduction</h1>
      <p>
        Acme SDK is a fictional library for talking to the Acme API. It exists only so Footfall has
        a realistic documentation site to capture agent and human traffic against.
      </p>
      <h2>Install</h2>
      <pre>
        <code>npm install @acme/sdk</code>
      </pre>
      <h2>Quick start</h2>
      <pre>
        <code>{`import { Acme } from "@acme/sdk";

const acme = new Acme({ apiKey: process.env.ACME_KEY });
const result = await acme.ping();
console.log(result);`}</code>
      </pre>
      <p>
        Next, read the <a href="/docs/guide">Guide</a> for a worked example, or jump to the{" "}
        <a href="/docs/private">API keys</a> page to create a key.
      </p>
    </article>
  );
}
