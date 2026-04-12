-- Add promo/discount columns to invoices table
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS promo_code text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS discount_amount numeric DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS tech_phone text;
