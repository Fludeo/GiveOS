ALTER TABLE "items" ADD COLUMN "recipe_config" jsonb;
--> statement-breakpoint
UPDATE "items"
SET "recipe_config" = json_build_object(
	'yieldQuantity', COALESCE("yield_quantity", 1),
	'activeTimeMinutes', COALESCE("prep_time_minutes", 0),
	'passiveTimeMinutes', COALESCE("passive_time_minutes", 0),
	'isScalable', COALESCE("is_prep_time_scalable", false)
)
WHERE "type" = 'prepared' OR "prep_time_minutes" > 0 OR "yield_quantity" != 1;
