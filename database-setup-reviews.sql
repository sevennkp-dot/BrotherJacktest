-- 1. Create the reviews table
CREATE TABLE IF NOT EXISTS public.reviews (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  technician_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  customer_name text,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

-- 2. Enable Row Level Security
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS Policies

-- Policy: Allow everyone to read reviews (Publicly visible on technician profiles)
CREATE POLICY "Allow public read-only access to reviews" 
ON public.reviews FOR SELECT 
USING (true);

-- Policy: Allow authenticated customers to insert reviews 
-- (Note: Ideally check if they actually booked the technician, but for simplicity we allow any auth user for now)
CREATE POLICY "Allow authenticated customers to insert reviews" 
ON public.reviews FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

-- Policy: Allow admins to manage (Delete/Update) all reviews
-- (Assuming 'admin' role in profiles table)
CREATE POLICY "Allow service_role to manage all reviews" 
ON public.reviews FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

-- 4. Create an index for faster lookups
CREATE INDEX IF NOT EXISTS idx_reviews_technician_id ON public.reviews(technician_id);
CREATE INDEX IF NOT EXISTS idx_reviews_booking_id ON public.reviews(booking_id);
