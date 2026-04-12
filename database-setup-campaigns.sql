-- ========================================================
-- Database Setup: Campaigns (Promotions and Discounts)
-- Date: 2026-04-06
-- ========================================================

-- 1. Create table
CREATE TABLE IF NOT EXISTS public.campaigns (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  code text not null unique,
  discount_type text not null check (discount_type in ('percentage', 'fixed')),
  discount_value numeric not null check (discount_value > 0),
  min_spend numeric default 0,
  start_date timestamp with time zone,
  end_date timestamp with time zone,
  usage_limit integer default null,  -- Null means unlimited
  usage_count integer default 0,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- 2. Add RLS Policies
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

-- Allow anyone to Read active campaigns (for checking codes)
CREATE POLICY "Allow public read access for campaigns"
ON public.campaigns FOR SELECT
TO public
USING (true);

-- Allow admins to insert/update/delete
CREATE POLICY "Allow admin edit access for campaigns"
ON public.campaigns FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

-- 3. Inset Mock Data
INSERT INTO public.campaigns (name, code, discount_type, discount_value, min_spend, start_date, end_date, usage_limit, status)
VALUES 
  ('โปรโมชั่นหน้าร้อน (Summer Sale)', 'SUMMER50', 'fixed', 50.00, 500.00, now(), now() + interval '30 days', 100, 'active'),
  ('เปิดระบบใหม่ส่วนลดพิเศษ', 'WELCOME10', 'percentage', 10.00, 0, now() - interval '5 days', now() + interval '10 days', 500, 'active'),
  ('โปรโมชั่นปีใหม่', 'NY2026', 'fixed', 100.00, 1000.00, now() - interval '90 days', now() - interval '60 days', 50, 'inactive')
ON CONFLICT (code) DO NOTHING;
