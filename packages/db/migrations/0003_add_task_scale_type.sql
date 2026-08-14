PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_task` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`target_value` real NOT NULL,
	`unit` text NOT NULL,
	`scale_type` text DEFAULT 'target' NOT NULL,
	`importance_weight` integer NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`scheduled_start` text NOT NULL,
	`scheduled_end` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "task_target_value_positive" CHECK("__new_task"."target_value" > 0),
	CONSTRAINT "task_unit_valid" CHECK("__new_task"."unit" IN ('km', 'hours', 'pages', 'reps', 'count', 'calories')),
	CONSTRAINT "task_scale_type_valid" CHECK("__new_task"."scale_type" IN ('target', 'limit', 'avoid', 'restriction')),
	CONSTRAINT "task_importance_weight_range" CHECK("importance_weight" >= 1 AND "importance_weight" <= 5)
);
--> statement-breakpoint
INSERT INTO `__new_task`("id", "project_id", "user_id", "title", "target_value", "unit", "scale_type", "importance_weight", "sort_order", "scheduled_start", "scheduled_end", "created_at", "updated_at") SELECT "id", "project_id", "user_id", "title", "target_value", "unit", CASE WHEN "unit" = 'calories' THEN 'limit' ELSE 'target' END AS "scale_type", "importance_weight", "sort_order", "scheduled_start", "scheduled_end", "created_at", "updated_at" FROM `task`;--> statement-breakpoint
DROP TABLE `task`;--> statement-breakpoint
ALTER TABLE `__new_task` RENAME TO `task`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_task_user_project_sort` ON `task` (`user_id`,`project_id`,`sort_order`);