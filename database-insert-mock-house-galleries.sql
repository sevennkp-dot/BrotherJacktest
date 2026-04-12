-- ==========================================
-- โค้ดตัวอย่างการเพิ่มข้อมูล "แบบบ้าน" พร้อม "รูปภาพหลายรูป (Gallery)"
-- ระบบใช้การลิงก์จากตาราง houses ไปยังตาราง house_images
-- ==========================================

-- เพิ่มบ้านหลังที่ 1 พร้อมรูป 3 รูป
WITH house1 AS (
  INSERT INTO public.houses (
    name, building_type, price, width, length, bedrooms, bathrooms, parking, image_url
  ) VALUES (
    'วิลล่าหรู สไตล์ทรอปิคอล (Tropical Villa)', 'พูลวิลล่า', 6500000, 15, 20, 4, 3, 2, 
    'https://images.unsplash.com/photo-1613977257363-707ba9348227?w=800'
  )
  RETURNING id
)
INSERT INTO public.house_images (house_id, image_url, display_order)
SELECT id, 'https://images.unsplash.com/photo-1613977257363-707ba9348227?w=800', 1 FROM house1
UNION ALL
SELECT id, 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800', 2 FROM house1
UNION ALL
SELECT id, 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800', 3 FROM house1;


-- เพิ่มบ้านหลังที่ 2 พร้อมรูป 2 รูป
WITH house2 AS (
  INSERT INTO public.houses (
    name, building_type, price, width, length, bedrooms, bathrooms, parking, image_url
  ) VALUES (
    'แบบบ้าน สไตล์โคโลเนียลร่วมสมัย', 'บ้านสองชั้น', 5200000, 12, 12, 3, 3, 2, 
    'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800'
  )
  RETURNING id
)
INSERT INTO public.house_images (house_id, image_url, display_order)
SELECT id, 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800', 1 FROM house2
UNION ALL
SELECT id, 'https://images.unsplash.com/photo-1600607687931-570a2cb7bbfa?w=800', 2 FROM house2;
