-- สคริปต์แก้ไขข้อผิดพลาด (Master Database Fix)
-- สาเหตุ: พบว่าบางคอลัมน์ (เช่น subdistrict) ยังไม่ถูกสร้างในฐานข้อมูล Supabase
-- วิธีแก้: กรุณาก๊อปปี้โค้ดทั้งหมดนี้ไปรันใน Supabase SQL Editor เพื่อสร้างคอลัมน์ที่ขาดหายไปครับ

-- 1. อัปเดตตารางลูกค้า (Customers) - เพิ่มข้อมูลที่อยู่และโปรไฟล์ทั้งหมด
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS province text,
ADD COLUMN IF NOT EXISTS district text,
ADD COLUMN IF NOT EXISTS subdistrict text,
ADD COLUMN IF NOT EXISTS address text,
ADD COLUMN IF NOT EXISTS line_id text,
ADD COLUMN IF NOT EXISTS house_no text,
ADD COLUMN IF NOT EXISTS village text,
ADD COLUMN IF NOT EXISTS alley text,
ADD COLUMN IF NOT EXISTS street text,
ADD COLUMN IF NOT EXISTS avatar_url text,
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone;

-- 2. อัปเดตตารางการจอง (Bookings) - เพิ่มข้อมูลผู้ติดต่อและที่อยู่ละเอียด
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS customer_address text,
ADD COLUMN IF NOT EXISTS customer_line_id text,
ADD COLUMN IF NOT EXISTS province text,
ADD COLUMN IF NOT EXISTS district text,
ADD COLUMN IF NOT EXISTS subdistrict text,
ADD COLUMN IF NOT EXISTS house_no text,
ADD COLUMN IF NOT EXISTS village text,
ADD COLUMN IF NOT EXISTS alley text,
ADD COLUMN IF NOT EXISTS street text;

-- 3. เพิ่มคำอธิบายคอลัมน์ (Optional)
COMMENT ON COLUMN public.customers.subdistrict IS 'ตำบล';
COMMENT ON COLUMN public.customers.district IS 'อำเภอ';
COMMENT ON COLUMN public.customers.province IS 'จังหวัด';
