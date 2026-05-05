-- Optional list price for promotion offer detail (used with discount_value).
ALTER TABLE public.promotions
  ADD COLUMN IF NOT EXISTS original_price numeric(10, 2) NULL;
