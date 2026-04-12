-- ==========================================
-- โค้ดตัวอย่างสำหรับเพิ่มข้อมูล "แบบบ้าน" จำนวน 3 หลังเข้าฐานข้อมูล
-- (Mock Data สำหรับทดสอบระบบ)
-- ==========================================

INSERT INTO public.houses (
    name, building_type, price, width, length, bedrooms, bathrooms, parking, image_url
)
VALUES 
  (
    'บ้านเดี่ยวสไตล์โมเดิร์น Cozy', 
    'บ้านสองชั้น', 
    2500000, 
    8, 12, 
    3, 2, 2, 
    'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=500&q=80'
  ),
  (
    'บ้านนอร์ดิกหน้ากว้าง (Nordic House)', 
    'บ้านชั้นเดียว', 
    1850000, 
    10, 10, 
    2, 2, 1, 
    'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=500&q=80'
  ),
  (
    'ทาวน์โฮม มินิมอล Muji', 
    'ทาวน์โฮม', 
    1200000, 
    5, 15, 
    2, 1, 1, 
    'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=500&q=80'
  );
