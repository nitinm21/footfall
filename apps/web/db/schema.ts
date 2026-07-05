// Metadata store (Neon Postgres in prod, PGlite in dev/test) — Drizzle schema.
// Two concerns live here: the Auth.js tables (users/accounts/sessions/verification)
// and Footfall's own tables (sites, site_members, fixes).

import { relations } from "drizzle-orm";
import { integer, pgTable, primaryKey, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

// ── Auth.js (@auth/drizzle-adapter) ─────────────────────────────────────────

export const users = pgTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("email_verified", { mode: "date", withTimezone: true }),
  image: text("image"),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })],
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date", withTimezone: true }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date", withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

// ── Footfall metadata ────────────────────────────────────────────────────────

/**
 * A site under observation. `token` is the value the middleware/ingest use (in v1 the
 * write token IS the site token). `source` selects the dashboard's event source:
 * "live" → Tinybird; "fixture" → a checked-in JSONL (the seeded demo site).
 */
export const sites = pgTable("sites", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  token: text("token").notNull().unique(),
  name: text("name").notNull(),
  source: text("source", { enum: ["live", "fixture"] })
    .notNull()
    .default("live"),
  /** For fixture sites: which fixture to load (path relative to repo root). */
  fixture: text("fixture"),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  /** First event received — the onboarding funnel metric (token-issued → first-event elapsed). */
  firstEventAt: timestamp("first_event_at", { mode: "date", withTimezone: true }),
});

/**
 * Per-site daily ingest usage — the ingest-side cap's counter. Enforced at /api/ingest (not just
 * in the middleware) so a hostile or buggy sender can't blow the Tinybird quota; `dropped` drives
 * the dashboard's sampling notice. Keyed by token so ingest never needs a site lookup.
 */
export const siteUsage = pgTable(
  "site_usage",
  {
    token: text("token").notNull(),
    /** UTC day, YYYY-MM-DD. */
    day: text("day").notNull(),
    received: integer("received").notNull().default(0),
    dropped: integer("dropped").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.token, t.day] })],
);

/** Per-site membership — the access-control table. A user sees a site iff a row exists. */
export const siteMembers = pgTable(
  "site_members",
  {
    siteId: text("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["owner", "member"] })
      .notNull()
      .default("member"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.siteId, t.userId] })],
);

/**
 * A fix the owner has marked as deployed for a failing path. Drives the failure feed's
 * "fix live" status and the fix-impact card (before/after windows around markedDeployedAt).
 */
export const fixes = pgTable(
  "fixes",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    siteId: text("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    path: text("path").notNull(),
    /** Mirrors core FailureType: dead_end | auth_wall | empty_shell | retry_loop. */
    type: text("type").notNull(),
    markedDeployedAt: timestamp("marked_deployed_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("fixes_site_path_uq").on(t.siteId, t.path)],
);

export const sitesRelations = relations(sites, ({ many }) => ({
  members: many(siteMembers),
  fixes: many(fixes),
}));

export const siteMembersRelations = relations(siteMembers, ({ one }) => ({
  site: one(sites, { fields: [siteMembers.siteId], references: [sites.id] }),
  user: one(users, { fields: [siteMembers.userId], references: [users.id] }),
}));

export const fixesRelations = relations(fixes, ({ one }) => ({
  site: one(sites, { fields: [fixes.siteId], references: [sites.id] }),
}));

export type Site = typeof sites.$inferSelect;
export type Fix = typeof fixes.$inferSelect;
export type SiteMember = typeof siteMembers.$inferSelect;
