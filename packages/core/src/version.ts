/**
 * Event schema version, isolated in its own module (no zod) so lean consumers like the edge
 * middleware can import it without pulling the zod-based schema into their bundle.
 * Bump only on a breaking change to the Event shape.
 */
export const EVENT_VERSION = 1 as const;
