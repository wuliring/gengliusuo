CREATE TABLE `reader_records` (
	`owner_key` text NOT NULL,
	`record_id` text NOT NULL,
	`favorite` integer DEFAULT 0 NOT NULL,
	`favorited_at` text,
	`is_read` integer DEFAULT 0 NOT NULL,
	`read_at` text,
	`last_visited_at` text,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`owner_key`, `record_id`),
	FOREIGN KEY (`record_id`) REFERENCES `records`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "reader_favorite_boolean" CHECK("reader_records"."favorite" IN (0,1)),
	CONSTRAINT "reader_read_boolean" CHECK("reader_records"."is_read" IN (0,1))
);
--> statement-breakpoint
CREATE INDEX `idx_reader_owner_favorite` ON `reader_records` (`owner_key`,`favorite`,`favorited_at`);--> statement-breakpoint
CREATE INDEX `idx_reader_owner_read` ON `reader_records` (`owner_key`,`is_read`,`read_at`);--> statement-breakpoint
CREATE INDEX `idx_reader_owner_visit` ON `reader_records` (`owner_key`,`last_visited_at`);