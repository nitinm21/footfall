export default function Home() {
  return (
    <main
      style={{
        fontFamily: "system-ui, sans-serif",
        maxWidth: 640,
        margin: "4rem auto",
        padding: "0 1rem",
      }}
    >
      <h1>👣 Footfall</h1>
      <p>Agent-experience analytics. The live dashboard lands in Phase 5.</p>
      <p>
        Ingest endpoint: <code>POST /api/ingest</code> (observe-only, token-authorized).
      </p>
    </main>
  );
}
