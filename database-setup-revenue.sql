-- ไฟล์นี้ถูกสร้างขึ้นมาเพื่อให้คุณนำโค้ดไปรันใน Supabase (เมนู SQL Editor)
-- ใช้สำหรับสร้างฟังก์ชันให้ฐานข้อมูลคำนวณยอดเงินแทนการโหลดมาบวกบนคอมพิวเตอร์ลูกข่าย

CREATE OR REPLACE FUNCTION get_admin_revenue()
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER -- ให้ทำงานข้าม RLS ชั่วคราวเพื่อให้ Admin เข้าถึงยอดรวมรวดเร็ว
AS $$
DECLARE
  total_revenue numeric := 0;
  bookings_revenue numeric := 0;
  orders_revenue numeric := 0;
  interests_revenue numeric := 0;
BEGIN
  -- 1. ยอดงานซ่อม
  SELECT COALESCE(SUM(NULLIF(regexp_replace(payment_amount::text, '[^0-9.]', '', 'g'), '')::numeric), 0) 
  INTO bookings_revenue 
  FROM bookings 
  WHERE status = 'เสร็จสิ้น';

  -- 2. ยอดงานสร้าง/รับเหมา (ลำดับความสำคัญ: จ่ายจริง -> ประเมิน -> มัดจำ)
  SELECT COALESCE(SUM(
    COALESCE(
      NULLIF(regexp_replace(payment_amount::text, '[^0-9.]', '', 'g'), '')::numeric, 
      NULLIF(regexp_replace(estimated_total::text, '[^0-9.]', '', 'g'), '')::numeric, 
      NULLIF(regexp_replace(deposit_amount::text, '[^0-9.]', '', 'g'), '')::numeric, 
      0
    )
  ), 0) 
  INTO orders_revenue 
  FROM orders 
  WHERE status = 'เสร็จสิ้น';

  -- 3. ยอดซื้อ/เช่าอสังหาฯ
  SELECT COALESCE(SUM(NULLIF(regexp_replace(payment_amount::text, '[^0-9.]', '', 'g'), '')::numeric), 0) 
  INTO interests_revenue 
  FROM interests 
  WHERE status = 'เสร็จสิ้น';

  -- สรุปยอด
  total_revenue := bookings_revenue + orders_revenue + interests_revenue;
  RETURN total_revenue;
EXCEPTION WHEN OTHERS THEN
  -- กรณีที่มีปัญหาเรื่องแปลกๆ จะคืนค่า 0 ป้องกัน error ลาม
  RETURN 0;
END;
$$;
