-- 1. ฟังก์ชันปลอดภัยเพื่ออัปเดต Role โดยข้าม RLS
CREATE OR REPLACE FUNCTION public.admin_set_user_role(target_user_id UUID, new_role TEXT)
RETURNS void AS $$
BEGIN
  -- บังคับอัปเดต role โดยไม่ต้องสน RLS
  UPDATE public.profiles
  SET role = new_role
  WHERE id = target_user_id;

  -- ถ้าบรรทัดนั้นไม่มีอยู่ (เช่น ข้อมูลเก่า) ให้สร้างใหม่เลย
  IF NOT FOUND THEN
    INSERT INTO public.profiles (id, role)
    VALUES (target_user_id, new_role);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
