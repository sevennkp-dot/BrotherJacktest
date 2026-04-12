-- คำสั่ง SQL สำหรับดึงอีเมลจริงของลูกค้าเก่าที่ตกหล่น มาใส่อัปเดตในตารางลูกค้า (Customers)
-- ให้นำโค้ดนี้ไปรันใน Supabase > SQL Editor นะครับ

UPDATE public.customers
SET email = auth.users.email
FROM auth.users
WHERE public.customers.id = auth.users.id
  AND (public.customers.email IS NULL OR public.customers.email LIKE 'test_user%');
