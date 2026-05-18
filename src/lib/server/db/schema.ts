import { pgTable, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import type { MessageContent } from '../../types/message';

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  role: text('role', { enum: ['admin', 'employee'] }).notNull().default('employee'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  archivedAt: timestamp('archived_at'),
});

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at').notNull(),
});

export const messages = pgTable(
  'messages',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    content: jsonb('content').notNull().$type<MessageContent>(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    deletedAt: timestamp('deleted_at'),
  },
  (t) => [index('messages_created_at_idx').on(t.createdAt)]
);