// detect/ — Phase 2.
// Failure taxonomy: dead_end (404/410), auth_wall (401/403), retry_loop,
// empty_shell (heuristic; disabled when resp_bytes is null). Plus demand signals
// (404s on /llms.txt, *.md variants, moved-path clusters).
export {};
