-- รีเซ็ตสถานะช่างซ่อมทุกคนให้กลับมาเป็น "ว่าง พร้อมรับงาน" 
-- หลังจากโดนระบบเก่าล็อคตอนทดสอบจอง

UPDATE public.technicians
SET is_online = true
WHERE is_online = false;
