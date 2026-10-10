CREATE TABLE `records` (
	`id` text PRIMARY KEY NOT NULL,
	`body` text NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`year` integer,
	`status` text NOT NULL,
	`search_text` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`views` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_records_status_category_year` ON `records` (`status`,`category`,`year`);--> statement-breakpoint
CREATE INDEX `idx_records_status_updated` ON `records` (`status`,`updated_at`);--> statement-breakpoint
CREATE TABLE `revisions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`record_id` text NOT NULL,
	`version` integer NOT NULL,
	`body` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_revisions_record_version` ON `revisions` (`record_id`,`version`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `visits` (
	`record_id` text NOT NULL,
	`visitor` text NOT NULL,
	`day` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_visits_record_visitor_day` ON `visits` (`record_id`,`visitor`,`day`);