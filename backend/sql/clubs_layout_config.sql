-- Optional JSON string: { "zones": { "stage": { "x", "y" }, ... } }
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS layout_config text;
