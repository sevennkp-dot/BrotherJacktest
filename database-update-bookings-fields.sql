-- เพิ่มฟิลด์สำหรับระบุที่อยู่ละเอียดและข้อมูลติดต่อเพิ่มเติมในการจอง (Bookings)
-- เพื่อให้ช่างสามารถเดินทางไปยังสถานที่นัดหมายได้ถูกต้องและติดต่อลูกค้าได้สะดวก

-- 1. เพิ่มคอลัมน์ใหม่ที่มีความหมายสำคัญสำหรับการบริการ
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS customer_address text,
ADD COLUMN IF NOT EXISTS customer_line_id text;

-- 2. เพื่อความแม่นยำในการจัดกลุ่มและค้นหา (เผื่อว่าในอนาคตต้องการทำ Map)
-- หาก table มีคอลัมน์ชื่อจังหวัด/อำเภออยู่แล้ว (เช่น province, district, subdistrict)
-- จะเป็นการอัปเดตให้รองรับการเก็บข้อมูลจากโปรไฟล์ที่กรอกมาครับ

-- หมายเหตุ: รันสคริปต์นี้ใน Supabase SQL Editor เพื่อเริ่มใช้งานฟิลด์ใหม่
COMMENT ON COLUMN public.bookings.customer_address IS 'ที่อยู่ละเอียดยิบ (บ้านเลขที่, ถนน, หมู่บ้าน)';
COMMENT ON COLUMN public.bookings.customer_line_id IS 'ID Line ของผู้จอง (ดึงมาจากโปรไฟล์อัตโนมัติ)';
