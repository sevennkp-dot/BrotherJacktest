-- เพิ่มข้อมูลร้านวัสดุแนะนำ (Mock Shops) ลงในตาราง shops

INSERT INTO public.shops (
    name, 
    description, 
    phone, 
    location, 
    website_url, 
    image_url
) VALUES 
(
    'ไทวัสดุ (Thai Watsadu)',
    'ศูนย์รวมวัสดุก่อสร้างและของตกแต่งบ้านครบวงจร',
    '1308',
    'ทุกสาขาทั่วประเทศ (หรือ สกลนคร)',
    'https://www.thaiwatsadu.com/',
    'https://images.deliveryhero.io/image/fd-th/LH/k0to-hero.jpg'
),
(
    'โกลบอลเฮ้าส์ (Global House)',
    'ผู้นำศูนย์รวมวัสดุก่อสร้าง ของใช้ในบ้าน และสวน',
    '1160',
    'สาขาสกลนคร',
    'https://globalhouse.co.th/',
    'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR0kYdK-O6a3y8_zL0oF3b0G1M8zP_pGzM38g&s'
),
(
    'โฮมโปร (HomePro)',
    'เครื่องใช้ไฟฟ้า เฟอร์นิเจอร์ เครื่องมือช่างคุณภาพทนทาน',
    '1284',
    'สาขาสกลนคร',
    'https://www.homepro.co.th/',
    'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQJ5g-oZ_uG1F2YV5f_R1lE1W1bQ3Z0F3x_Mw&s'
),
(
    'ดูโฮม (DoHome)',
    'ครบ คุ้ม ถูก ดี... วัสดุก่อสร้างราคาโรงงาน',
    '1746',
    'หนองคาย (ใกล้เคียง)',
    'https://www.dohome.co.th/',
    'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT2g-B4k4yN8l7k9D8J5M1x_r4T1J4H0N2N7Q&s'
),
(
    'ร้านสมชาย ฮาร์ดแวร์ (ตัวอย่างร้านท้องถิ่น)',
    'จำหน่ายอุปกรณ์ฮาร์ดแวร์ สี ท่อประปา และสายไฟราคาถูก',
    '081-234-5678',
    'อ.เมือง จ.สกลนคร',
    '#',
    'https://uqcjajmqtlchftpqwsrp.supabase.co/storage/v1/object/public/ssss/shop-placeholder.jpg'
);
