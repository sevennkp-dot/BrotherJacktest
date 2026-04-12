/**
 * admin-lang.js
 * Advanced Auto-Translator Engine for Admin Dashboard
 * Uses a TreeWalker and MutationObserver to natively translate the entire DOM without disrupting HTML/CSS layouts.
 */

const dictEN = {
  // Navigation & Core Sidebars
  "Main Menu": "Main Menu",
  "เมนูหลัก": "Main Menu",
  "Overview": "Overview",
  "Jobs Management": "Jobs Management",
  "Customers": "Customers",
  "Technicians": "Technicians",
  "Analytics & Reports": "Reports & Analytics",
  "Settings": "Settings",
  "Logout": "Logout",
  "Users": "Users",
  "System": "System",

  // Page Titles & Subtitles
  "แดชบอร์ดภาพรวม": "Dashboard Overview",
  "รายงานสถิติและข้อมูลสรุปผลแบบเรียลไทม์": "Real-time statistics and summary reports",
  "ระบบจัดการคิวงาน (Jobs Management)": "Jobs Management",
  "ตรวจสอบสถานะงานและรายละเอียดการเรียกช่างของลูกค้า": "Monitor job statuses and customer service requests",
  "จัดการข้อมูลลูกค้า (Customers)": "Customer Management",
  "รายชื่อและข้อมูลผู้ใช้งานทั่วไปในระบบทั้งหมด": "List of all registered general users",
  "ระบบจัดการช่างเทคนิค (Technicians)": "Technician Management",
  "อนุมัติและจัดการข้อมูลช่างรับเหมาในระบบ": "Approve and manage technicians and contractors",
  "รายงานและสถิติ (Analytics & Reports)": "Analytics & Reports",
  "ดูภาพรวมการเติบโต สถิติรายได้ และบริการยอดฮิต": "View growth trends, revenue, and popular services",
  "ตั้งค่าระบบ (Settings)": "System Settings",
  "จัดการข้อมูลส่วนตัว พาสเวิร์ด และเปิดปิดฟังก์ชันของระบบ": "Manage profile, passwords, and system functions",

  // Stats Dashboard
  "ผู้ใช้ทั้งหมด": "Total Users",
  "ช่างเทคนิค": "Verified Techs",
  "งานที่กำลังดำเนินการ": "Active Jobs",
  "รายได้โดยประมาณ": "Est. Revenue",
  "ออเดอร์งานล่าสุด": "Recent Jobs",
  "รออนุมัติช่าง": "Pending Approvals",
  "ดูทั้งหมด": "View All",

  // Table Data & Headers
  "ไม่พบข้อมูลงานในระบบ": "No jobs found",
  "ไม่พบข้อมูลลูกค้า": "No customers found",
  "ไม่พบข้อมูลช่างในระบบ": "No technicians found",
  "รายชื่อลูกค้าทั้งหมด": "All Registered Customers",
  "ออเดอร์งานทั้งหมด": "All Job Orders",
  "รายชื่อช่างทั้งหมด": "All Registered Technicians",

  // Statuses (Dynamic)
  "รอรับงาน": "Pending",
  "กำลังดำเนินการ": "In Progress",
  "เสร็จสิ้น": "Completed",
  "ยกเลิกแล้ว": "Cancelled",
  "รอจับคู่ช่าง": "Pending Tech",
  "ไม่ระบุพื้นที่": "Unspecified",
  "ยังไม่มีคะแนน": "Unrated",

  // Service Types
  "ซ่อมแอร์บ้าน": "AC Repair",
  "ซ่อมแอร์": "AC Repair",
  "ปูกระเบื้องห้องน้ำ": "Tile Work",
  "ซ่อมท่อน้ำรั่ว": "Plumbing",
  "ซ่อมประปา": "Plumbing",
  "ซ่อมไฟฟ้า": "Electrical",
  "ช่างแอร์": "AC Tech",
  "ประเมินราคาต่อเติม": "Consultation",
  "ต่อเติมบ้าน": "Home Additions",
  "บริการทั่วไป": "General Service",
  "อื่นๆ": "Others",

  // Reports Page
  "ภาพรวมรายได้ (Revenue Overview)": "Revenue Overview",
  "ย้อนหลัง 6 เดือน": "Past 6 months",
  "บริการยอดนิยม (Top Services)": "Top Services",
  "สถิติสำคัญประจำสัปดาห์": "Weekly Key Stats",
  "อัตราการจองสำเร็จ": "Success Rate",
  "เติบโตจากสัปดาห์ก่อน": "Growth from last week",
  "คะแนนเฉลี่ยช่างเทคนิค": "Avg Tech Rating",
  "คะแนนความพึงพอใจ": "Customer Satisfaction",
  "เวลาเฉลี่ยเข้าถึงพื้นที่": "Avg Arrival Time",
  "การเดินทางไปซ่อม": "Travel to site",
  "นาที": "mins",

  // Settings Page
  "ข้อมูลผู้ดูแลระบบ (Admin Profile)": "Admin Profile",
  "เปลี่ยนรูปภาพ": "Change Photo",
  "ลบรูปปัจจุบัน": "Remove Photo",
  "ชื่อ-นามสกุล (Name)": "Full Name",
  "อีเมล (Email Address)": "Email Address",
  "ไม่สามารถเปลี่ยนอีเมลที่ใช้ล็อกอินได้": "Login email cannot be changed",
  "บันทึกการเปลี่ยนแปลง (Save Profile)": "Save Profile",
  "การตั้งค่าระบบส่วนกลาง (System Preferences)": "System Preferences",
  "อนุมัติช่างเทคนิคอัตโนมัติ (Auto-Approve)": "Auto-Approve Technicians",
  "ให้ระบบอนุมัติบัญชีช่างทันทีโดยไม่ต้องรอแอดมินกดยืนยัน": "Automatically approve new technicians without manual checks",
  "ส่งอีเมลรับงานให้ช่างอัตโนมัติ": "Auto-Email Dispatch",
  "ส่ง Notification ผ่านอีเมลทุกครั้งที่มีการกดจองงานใหม่": "Send email notifications for every new job order",
  "โหมดมืด (Dark Mode / พัฒนาอยู่)": "Dark Mode (In Development)",
  "สลับธีมแอปพลิเคชันเป็นสีเข้ม": "Toggle dark application theme"
};

let currentLang = localStorage.getItem('admin_lang') || 'th';

function applyTranslations(root = document.body) {
    if (currentLang !== 'en') return; // Base language in HTML is Thai
    
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
    let node;
    while (node = walker.nextNode()) {
        const originalText = node.nodeValue.trim();
        if (originalText && dictEN[originalText]) {
            node.nodeValue = node.nodeValue.replace(originalText, dictEN[originalText]);
        }
    }
}

function toggleLanguage() {
    currentLang = currentLang === 'en' ? 'th' : 'en';
    localStorage.setItem('admin_lang', currentLang);
    window.location.reload(); // Instantly reloads UI with new localized state
}

document.addEventListener('DOMContentLoaded', () => {
    // Sync Button State
    const btn = document.getElementById('langToggleBtn');
    if (btn) {
        btn.innerText = currentLang === 'en' ? 'EN' : 'TH';
    }

    // Apply translations on initial load
    applyTranslations();
    
    // Auto-Translate dynamic content (Supabase data loads, new tables, etc.)
    const observer = new MutationObserver((mutations) => {
        mutations.forEach(m => {
            if (m.addedNodes.length > 0) {
                m.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) applyTranslations(node);
                });
            }
        });
    });
    observer.observe(document.body, { childList: true, subtree: true });
});
