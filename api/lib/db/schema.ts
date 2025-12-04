import { InferSelectModel } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  date,
  numeric,
  json,
  integer,
} from 'drizzle-orm/pg-core';

export const user = pgTable('users', {
  id: text('id').primaryKey(), // Changed from uuid to text to support Privy DIDs
  name: varchar('name', { length: 256 }).notNull(),
  publicKey: varchar('public_key', { length: 256 }).notNull(),
  totalTradingVolume: integer('total_trading_volume').notNull().default(0),
});

export const entries = pgTable('entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id')
    .references(() => user.id)
    .notNull(),
  entryPrice: text('entry_price').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const chat = pgTable('chat', {
  id: uuid('id').primaryKey().unique().notNull().defaultRandom(),
  createdAt: timestamp('createdAt').notNull(),
  title: text('title').notNull(),
  userId: text('userId')
    .notNull()
    .references(() => user.id),
  visibility: varchar('visibility', { enum: ['public', 'private'] })
    .notNull()
    .default('private'),
});

export type Chat = InferSelectModel<typeof chat>;

export const message = pgTable('message', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  chatId: uuid('chatId')
    .notNull()
    .references(() => chat.id),
  role: varchar('role').notNull(),
  content: json('content').notNull(),
  createdAt: timestamp('createdAt').notNull(),
});

export type Message = InferSelectModel<typeof message>;

export const trades = pgTable('trades', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  userId: text('user_id').notNull().references(() => user.id),
  fromToken: varchar('from_token', { length: 64 }).notNull(),
  toToken: varchar('to_token', { length: 64 }).notNull(),
  amount: numeric('amount').notNull(),
  execPrice: numeric('exec_price').notNull(),
  txHash: varchar('tx_hash', { length: 128 }).notNull(),
  timestamp: timestamp('timestamp').notNull().defaultNow(),
});

export type Trade = InferSelectModel<typeof trades>;

export const positions = pgTable('positions', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  userId: text('user_id').notNull().references(() => user.id),
  token: varchar('token', { length: 64 }).notNull(),
  amount: numeric('amount').notNull().default('0'),
  avgEntryPrice: numeric('avg_entry_price').notNull().default('0'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type Position = InferSelectModel<typeof positions>;

export const daily_snapshots = pgTable('daily_snapshots', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  userId: text('user_id').notNull().references(() => user.id),
  date: date('date').notNull(),
  totalPortfolioValueUsd: numeric('total_portfolio_value_usd').notNull(),
  dailyChangeUsd: numeric('daily_change_usd').notNull(),
  dailyChangePct: numeric('daily_change_pct').notNull(),
});

export type DailySnapshot = InferSelectModel<typeof daily_snapshots>;

