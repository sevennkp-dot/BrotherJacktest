-- อัปเดตตาราง customers ให้รองรับข้อมูลโปรไฟล์ที่สมบูรณ์ขึ้น
-- ในกรณีที่ตารางยังไม่มีคอลัมน์เหล่านี้:

ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS address text,
ADD COLUMN IF NOT EXISTS province text,
ADD COLUMN IF NOT EXISTS district text,
ADD COLUMN IF NOT EXISTS line_id text,
ADD COLUMN IF NOT EXISTS avatar_url text,
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone default now();

-- หมายเหตุ: เพื่อความปลอดภัย คุณควรรันคำสั่งนี้ผ่าน Supabase SQL Editor โดยตรง 
-- เพื่อให้โครงสร้างตารางหลังบ้านพร้อมรับข้อมูลจากหน้าเว็บครับ
