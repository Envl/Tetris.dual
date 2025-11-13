import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
	id: text('id').primaryKey(),
	email: text('email').notNull().unique(),
	name: text('name'),
	image: text('image'),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
});

export const matches = sqliteTable('matches', {
	id: text('id').primaryKey(),
	player1Id: text('player1_id')
		.notNull()
		.references(() => users.id),
	player2Id: text('player2_id')
		.notNull()
		.references(() => users.id),
	winnerId: text('winner_id').references(() => users.id),
	player1Score: integer('player1_score').notNull().default(0),
	player2Score: integer('player2_score').notNull().default(0),
	player1Lines: integer('player1_lines').notNull().default(0),
	player2Lines: integer('player2_lines').notNull().default(0),
	duration: integer('duration'), // in seconds
	startedAt: integer('started_at', { mode: 'timestamp' }).notNull(),
	endedAt: integer('ended_at', { mode: 'timestamp' })
});

export const userStats = sqliteTable('user_stats', {
	userId: text('user_id')
		.primaryKey()
		.references(() => users.id),
	totalGames: integer('total_games').notNull().default(0),
	wins: integer('wins').notNull().default(0),
	losses: integer('losses').notNull().default(0),
	highScore: integer('high_score').notNull().default(0),
	totalLinesCleared: integer('total_lines_cleared').notNull().default(0)
});
