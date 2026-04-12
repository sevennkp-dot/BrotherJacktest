-- เพิ่มฟิลด์ที่อยู่แบบละเอียดเพื่อให้ระบบสามารถเก็บข้อมูลแยกส่วนได้ชัดเจน
-- (รันสคริปต์นี้ใน Supabase SQL Editor)

-- 1. อัปเดตตารางลูกค้า (Customers)
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS house_no text,
ADD COLUMN IF NOT EXISTS village text,
ADD COLUMN IF NOT EXISTS alley text,
ADD COLUMN IF NOT EXISTS street text;

-- 2. อัปเดตตารางใบจอง (Bookings) เพื่อให้บันทึกข้อมูลแยกส่วนเหมือนกัน
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS house_no text,
ADD COLUMN IF NOT EXISTS village text,
ADD COLUMN IF NOT EXISTS alley text,
ADD COLUMN IF NOT EXISTS street text;

-- 3. ให้ข้อมูลที่อยู่ (Address) เดิมเป็น Textarea สำหรับหมายเหตุเพิ่มเติม (ถ้ามี)
-- แต่ข้อมูลหลักจะถูกเก็บแยกรายช่องเพื่อความถูกต้องแม่นยำ
COMMENT ON COLUMN public.customers.house_no IS 'บ้านเลขที่';
COMMENT ON COLUMN public.customers.village IS 'หมู่บ้าน/อาคาร';
COMMENT ON COLUMN public.customers.alley IS 'ซอย';
COMMENT ON COLUMN public.customers.street IS 'ถนน';
