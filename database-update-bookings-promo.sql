-- ========================================================
-- Database Update: Bookings (Add Promo Code)
-- ========================================================

-- Add promo_code column to bookings
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS promo_code text;

-- Add discount_amount column to bookings to track the value
-- Note: As agreed, this will store the discount intended, but actual payment updates happen at completion.
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS discount_amount numeric DEFAULT 0;
