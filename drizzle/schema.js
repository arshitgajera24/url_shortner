import { relations, sql } from 'drizzle-orm';
import { text } from 'drizzle-orm/gel-core';
import { boolean, int, mysqlEnum, mysqlTable, timestamp, varchar } from 'drizzle-orm/mysql-core';

export const short_links = mysqlTable('short_links', {
  id: int().autoincrement().primaryKey(),
  short_code: varchar({ length: 255 }).notNull().unique(),
  url: varchar({ length: 255 }).notNull(),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "string" }).default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`).notNull(),
  userId: int("user_id").notNull().references(() => usersTable.id),
});

export const sessionsTable = mysqlTable('sessions', {
  id: int().autoincrement().primaryKey(),
  userId: int("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade"}),
  valid: boolean().default(true).notNull(),
  userAgent: text("user_agent"),
  ip: varchar({ length: 255 }),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "string" }).default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`).notNull(),
});

export const verifyEmailTokenTable = mysqlTable('verify_email_tokens', {
  id: int().autoincrement().primaryKey(),
  userId: int("user_id").notNull().references(() => usersTable.id, { onDelete: 'cascade' }),
  token: varchar({length: 8}).notNull(),
  expiresAt: timestamp("expires_at").default(sql`(CURRENT_TIMESTAMP + INTERVAL 1 DAY)`).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const passwordResetTokensTable = mysqlTable("password_reset_tokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull().references(() => usersTable.id, {onDelete : 'cascade'}).unique(),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at").default(sql`(CURRENT_TIMESTAMP + INTERVAL 1 HOUR)`).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const oauthAccountsTable = mysqlTable("oauth_accounts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  provider: mysqlEnum("provider", ["google", "github"]).notNull(),
  providerAccountId: varchar("provider_account_id", {length : 255}).notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const usersTable = mysqlTable('users', {
  id: int().autoincrement().primaryKey(),
  name: varchar({ length: 255 }).notNull(),
  email: varchar({ length: 255 }).notNull().unique(),
  password: varchar({ length: 255 }),
  avatarUrl: text("avatar_url"),
  isEmailValid: boolean("is_email_valid").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`).notNull(),
});

export const usersRelation = relations(usersTable, ({many}) => ({
  shortLinks: many(short_links),
  session: many(sessionsTable),

}))

export const shortLinksRelation = relations(short_links, ({one}) => ({
  users: one(usersTable, {
    fields: [short_links.userId],
    references: [usersTable.id],
  }),
}))

export const sessionRelation = relations(sessionsTable, ({one}) => ({
  users: one(usersTable, {
    fields: [sessionsTable.userId],   // Foreign key
    references: [usersTable.id],
  })
}))
