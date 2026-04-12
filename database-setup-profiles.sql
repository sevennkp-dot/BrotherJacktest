-- 1. สร้างตาราง profiles (ถ้ายังไม่มี)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid not null REFERENCES auth.users (id) ON DELETE CASCADE,
  role text not null default 'customer', -- ค่าเริ่มต้นเป็น customer
  created_at timestamp with time zone null default now(),
  PRIMARY KEY (id)
);

-- 2. สร้างฟังก์ชันการเพิ่มผู้ใช้งานลง profiles อัตโนมัติเวลาคนโหวต Google / สมัครสมาชิก
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, role)
  VALUES (new.id, 'customer');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. สร้าง Trigger ให้ระบบเรียกฟังก์ชันบรรทัดบนทันทีที่มีคนสมัคร (เพื่อไม่ให้โปรไฟล์ว่างเปล่า)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 4. ตั้งค่า Policy (RLS) ให้ทุกคนสามารถ SELECT ยืนยันสิทธิ์ตัวเองได้
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow users to read their own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

-- ปลดล็อคให้ Admin สามารถอัปเดต role ให้ช่างได้
CREATE POLICY "Allow public update for roles"
ON public.profiles FOR UPDATE
USING (true); -- อนุญาตให้ทุกคนอัปเดต (เบื้องต้นเพื่อให้ admin.js ทำงานได้ไม่ติด RLS)

CREATE POLICY "Allow public insert"
ON public.profiles FOR INSERT
WITH CHECK (true);
