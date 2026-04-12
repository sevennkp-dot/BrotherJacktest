/**
 * admin.js
 * Superior Admin Dashboard Interaction & Resilient Integration (Real-Time Edition)
 */

// ===== CONFIGURATIONS =====
const SUPABASE_URL = "https://uqcjajmqtlchftpqwsrp.supabase.co";
const SUPABASE_KEY = "sb_publishable_yWZiH8l1idY0QWGuj6p9sg_GqXPONGX";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser = null;
let isMockMode = false; // Graceful fallback if not logged in
let realtimeChannel = null;

document.addEventListener('DOMContentLoaded', async () => {
  setupUI();
  await checkAuthAndLoadData();
});

// ===== UI LOGIC =====
function setupUI() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.createElement('div');
  overlay.className = 'sidebar-overlay';
  document.body.appendChild(overlay);

  function toggleSidebar() {
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
    document.body.style.overflow = sidebar.classList.contains('active') ? 'hidden' : '';
  }

  const menuToggle = document.getElementById('menuToggle');
  const menuClose = document.getElementById('menuClose');
  if (menuToggle) menuToggle.addEventListener('click', toggleSidebar);
  if (menuClose) menuClose.addEventListener('click', toggleSidebar);
  overlay.addEventListener('click', toggleSidebar);

  // Buttons feedback
  document.querySelectorAll('.btn, .icon-btn, .action-btn').forEach(btn => {
    btn.addEventListener('mousedown', function() { this.style.transform = 'scale(0.95)'; });
    btn.addEventListener('mouseup', function() { this.style.transform = ''; });
    btn.addEventListener('mouseleave', function() { this.style.transform = ''; });
  });
}

function showToast(title, message, isError = false) {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = 'toast';
  
  if (isError) {
    toast.style.borderLeftColor = 'var(--rose)';
    toast.innerHTML = `<i class="fa-solid fa-circle-xmark" style="color: var(--rose);"></i>`;
  } else {
    toast.innerHTML = `<i class="fa-solid fa-bell" style="color: var(--primary);"></i>`;
  }

  toast.innerHTML += `
    <div class="toast-body">
      <h4>${title}</h4>
      <p>${message}</p>
    </div>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(20px)';
    setTimeout(() => toast.remove(), 300);
  }, 6000);
}

// ===== AUTH & DATA =====
async function checkAuthAndLoadData() {
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return enableMockMode("ยังไม่ได้ล็อกอิน (No Session)");

    const { data: profile, error } = await supabaseClient.from("profiles").select("role").eq("id", session.user.id).maybeSingle();

    if (error) {
      console.error("DB Error:", error);
      return enableMockMode("DB Error: " + error.message + " (เช็กสิทธิ์ RLS!)");
    }
    if (!profile) return enableMockMode("ตาราง Profiles ไม่มีบัญชี UUID ของคุณ (Not Found)");
    if (profile.role !== "admin") return enableMockMode("สิทธิ์ของคุณตอนนี้คือ: [" + profile.role + "] (ระบบต้องการ admin)");

    currentUser = session.user;
    if (document.getElementById('adminNameDisplay')) document.getElementById('adminNameDisplay').innerText = "System Admin";

    await loadRealData(); if(typeof setupRealtime === "function") setupRealtime();
  } catch (err) {
    console.error(err);
    enableMockMode("System Error: " + err.message);
  }
}

function enableMockMode(reason) {
  isMockMode = true;
  console.warn("Running in Mock Mode. Reason:", reason);
  showToast("โหมดดูตัวอย่าง (Preview Mode)", reason + " - ข้อมูลที่แสดงเป็นเพียงข้อมูลจำลองเพื่อให้เห็นโครงสร้างเท่านั้น");
  
  // Render dummy data instead of redirecting so the user can see the UI
  renderMockData();
}

async function logout() {
  if (!isMockMode) {
    await supabaseClient.auth.signOut();
  }
  window.location.href = "login.html";
}

// ===== REAL DATA FETCHING & REALTIME =====
async function loadRealData() {
  try {
    // 1. Fetch counts
    const { count: uCount } = await supabaseClient.from('profiles').select('*', { count: 'exact', head: true });
    const { count: tCount } = await supabaseClient.from('technicians').select('*', { count: 'exact', head: true });

    const { count: oCount } = await supabaseClient.from('orders').select('*', { count: 'exact', head: true }).in('status', ['รอรับงาน', 'รอดำเนินการ', 'รอการอนุมัติ']);
    const { count: iCount } = await supabaseClient.from('interests').select('*', { count: 'exact', head: true }).in('status', ['รอดำเนินการ', 'รอติดต่อกลับ']);
    const { count: pCount1 } = await supabaseClient.from('properties').select('*', { count: 'exact', head: true });
    const { count: pCount2 } = await supabaseClient.from('houses').select('*', { count: 'exact', head: true });
    
    const { count: revCount } = await supabaseClient.from('reviews').select('*', { count: 'exact', head: true });
    
    setCounterTarget('statUsers', uCount || 0);
    setCounterTarget('statTechs', tCount || 0);

    if(document.getElementById('statOrders')) setCounterTarget('statOrders', oCount || 0);
    if(document.getElementById('statInterests')) setCounterTarget('statInterests', iCount || 0);
    if(document.getElementById('statProperties')) setCounterTarget('statProperties', (pCount1 || 0) + (pCount2 || 0));
    if(document.getElementById('statReviews')) setCounterTarget('statReviews', revCount || 0);
    
    // Revenue calculation (ดึงยอดเงินจริงจากฐานข้อมูลผ่าน RPC)
    let estRevenue = 0;
    try {
      const { data: totalRevenue, error: revErr } = await supabaseClient.rpc('get_admin_revenue');
      if (revErr) {
        console.error("RPC get_admin_revenue error:", revErr);
      } else {
        estRevenue = Number(totalRevenue) || 0;
      }
    } catch (e) {
      console.warn("Failed to fetch revenue stats via RPC:", e);
    }

    setCounterTarget('statRevenue', estRevenue || 0);

    animateCounters();


    // === Fetch Recent Activity for Tabs ===
    const { data: recentOrders } = await supabaseClient.from('orders').select('*').order('created_at', { ascending: false }).limit(5);
    renderRecentOrders(recentOrders || []);

    const { data: recentInterests } = await supabaseClient.from('interests').select('*').order('created_at', { ascending: false }).limit(5);
    renderRecentInterests(recentInterests || []);

    const { data: recentBookings } = await supabaseClient.from('bookings').select('*').order('created_at', { ascending: false }).limit(5);
    renderRecentBookings(recentBookings || []);
    // ===================================


    // Fetch Pending Applications
    const { data: apps, error: appError } = await supabaseClient
      .from('job_applications')
      .select('id, fullname, position, experience_years, profile_image')
      .order('created_at', { ascending: false })
      .limit(10);
      
    if (!appError) {
      renderPendingApprovals(apps || []);
    } else {
      console.error("Fetch Job Apps Error:", appError);
      if (typeof showToast !== 'undefined') showToast('แจ้งเตือน', 'ไม่สามารถดึงข้อมูลคนสมัครงานได้ (เช็ก RLS ตาราง job_applications): ' + appError.message, true);
      renderPendingApprovals([]);
    }

  } catch(e) {
    console.error(e);
    showToast("ข้อผิดพลาดการโหลดข้อมูล", "ไม่สามารถดึงข้อมูลจริงจากเซิร์ฟเวอร์ได้", true);
  }
}

function setupRealtime() {
  if (realtimeChannel) return;
  console.log("🟢 ใช้งาน Real-time: ฟังการเปลี่ยนแปลงบนตารางแล้ว!");

  realtimeChannel = supabaseClient.channel('admin-realtime')

    .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, payload => {
      console.log('🔄 ตรวจพบการเปลี่ยนแปลงตาราง Profiles', payload);
      loadRealData();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'technicians' }, payload => {
      console.log('🔄 ตรวจพบการเปลี่ยนแปลงตาราง Technicians', payload);
      loadRealData();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'reviews' }, payload => {
      console.log('🔄 ตรวจพบการเปลี่ยนแปลงตาราง Reviews', payload);
      loadRealData();
    })
    .subscribe();
}

// ===== MOCK DATA FALLBACK =====
function renderMockData() {
  setCounterTarget('statUsers', 2845);
  setCounterTarget('statTechs', 142);

  setCounterTarget('statRevenue', 845000);
  animateCounters();


}

// ===== UTILS & RENDERERS =====
function setCounterTarget(id, val) {
  const el = document.getElementById(id);
  if (el) el.setAttribute('data-target', val);
}

function animateCounters() {
  document.querySelectorAll('.stat-number').forEach(counter => {
    const target = +counter.getAttribute('data-target') || 0;
    const isCurrency = counter.classList.contains('format-currency');
    const duration = 1000;
    
    // Parse current displayed value (strip non-digits)
    let currentText = counter.innerText.replace(/[^0-9.-]+/g,"");
    let current = parseInt(currentText) || 0;
    
    if(target === current) return;
    
    const diff = target - current;
    const increment = diff / (duration / 16);
    
    const update = () => {
      current += increment;
      if ((diff > 0 && current < target) || (diff < 0 && current > target)) {
        counter.innerText = isCurrency ? '฿' + Math.ceil(current).toLocaleString() : Math.ceil(current).toLocaleString();
        requestAnimationFrame(update);
      } else {
        counter.innerText = isCurrency ? '฿' + target.toLocaleString() : target.toLocaleString();
      }
    };
    update();
  });
}




// ================= Recent Activity Renderers =================
window.renderRecentOrders = function(orders) {
  const tbody = document.getElementById('recentOrdersList');
  if(!tbody) return;
  if(orders.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">ไม่พบข้อมูลใบสั่งทำบ้าน</td></tr>';
    return;
  }
  
  tbody.innerHTML = orders.map(o => {
    const dateStr = new Date(o.created_at).toLocaleDateString('th-TH');
    const priceStr = o.estimated_total ? parseFloat(o.estimated_total).toLocaleString() : (o.budget || '-');
    
    let statusClass = 'text-muted';
    let statusIcon = 'clock';
    if(o.status === 'เสร็จสิ้น') { statusClass = 'text-emerald'; statusIcon = 'check-circle'; }
    if(o.status === 'กำลังดำเนินการ') { statusClass = 'text-primary'; statusIcon = 'person-digging'; }
    
    return `
      <tr>
        <td>${dateStr}</td>
        <td><strong>${o.customer_name || 'ไม่ระบุ'}</strong><br><span style="font-size:12px; color:#888;">${o.phone || ''}</span></td>
        <td>${o.service_type || 'รับเหมาก่อสร้าง'}</td>
        <td class="format-currency">฿${priceStr}</td>
        <td class="${statusClass}"><i class="fa-solid fa-${statusIcon}"></i> ${o.status || 'รอดำเนินการ'}</td>
      </tr>
    `;
  }).join('');
};

window.renderRecentInterests = function(interests) {
  const tbody = document.getElementById('recentInterestsList');
  if(!tbody) return;
  if(interests.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">ไม่พบข้อมูลคำขอเช่า/ซื้อ</td></tr>';
    return;
  }
  
  tbody.innerHTML = interests.map(i => {
    const dateStr = new Date(i.created_at).toLocaleDateString('th-TH');
    
    // Support multiple field names based on schema
    const cName = i.customer_name || i.name || 'ไม่ระบุ';
    const cPhone = i.customer_phone || i.phone || '';
    const rawType = i.interest_type || i.type || 'ไม่ระบุ';
    const priceRaw = i.payment_amount || i.deposit_amount || i.price || i.budget;
    const priceStr = priceRaw ? parseFloat(priceRaw).toLocaleString() : '-';
    
    // Normalize type string
    let typeStr = rawType;
    if(rawType === 'buy') typeStr = 'ซื้อ';
    if(rawType === 'rent') typeStr = 'เช่า';
    
    let statusClass = 'text-muted';
    let statusIcon = 'clock';
    if(i.status === 'เสร็จสิ้น' || i.status === 'ตกลง') { statusClass = 'text-emerald'; statusIcon = 'check-circle'; }
    if(i.status === 'กำลังดำเนินการ' || i.status === 'ติดต่อแล้ว') { statusClass = 'text-primary'; statusIcon = 'phone'; }
    if(i.status === 'ยกเลิก' || i.status === 'ยกเลิกแล้ว') { statusClass = 'text-rose'; statusIcon = 'xmark-circle'; }
    
    return `
      <tr>
        <td>${dateStr}</td>
        <td><strong>${cName}</strong><br><span style="font-size:12px; color:#888;">${cPhone}</span></td>
        <td><span class="badge ${typeStr === 'ซื้อ' ? 'badge-primary' : 'badge-emerald'}">${typeStr}</span></td>
        <td class="format-currency">฿${priceStr}</td>
        <td class="${statusClass}"><i class="fa-solid fa-${statusIcon}"></i> ${i.status || 'รอติดต่อกลับ'}</td>
      </tr>
    `;
  }).join('');
};

window.renderRecentBookings = function(bookings) {
  const tbody = document.getElementById('recentBookingsList');
  if(!tbody) return;
  if(bookings.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">ไม่พบข้อมูลการจองช่าง</td></tr>';
    return;
  }
  
  tbody.innerHTML = bookings.map(b => {
    const dateStr = new Date(b.created_at).toLocaleDateString('th-TH');
    
    let statusClass = 'text-muted';
    let statusIcon = 'clock';
    if(b.status === 'เสร็จสิ้น') { statusClass = 'text-emerald'; statusIcon = 'check-circle'; }
    if(b.status === 'กำลังเดินทาง' || b.status === 'กำลังทำงาน') { statusClass = 'text-primary'; statusIcon = 'truck-fast'; }
    if(b.status === 'ยกเลิก') { statusClass = 'text-rose'; statusIcon = 'xmark-circle'; }
    
    return `
      <tr>
        <td>${dateStr}</td>
        <td><strong>${b.customer_name || 'ไม่ระบุ'}</strong><br><span style="font-size:12px; color:#888;">${b.customer_phone || ''}</span></td>
        <td>${b.description || b.job_type || 'งานซ่อมทั่วไป'}</td>
        <td>${b.technician_name || 'ไม่ระบุช่าง'}</td>
        <td class="${statusClass}"><i class="fa-solid fa-${statusIcon}"></i> ${b.status || 'รอดำเนินการ'}</td>
      </tr>
    `;
  }).join('');
};

// ================= Pending Approvals Widget =================
window.renderPendingApprovals = function(apps) {
  const badge = document.getElementById('pendingApprovalsBadge');
  const list = document.getElementById('pendingApprovalsList');
  if (!list) return;

  if (badge) badge.innerText = apps.length;

  if (apps.length === 0) {
    list.innerHTML = `<div class="p-4 text-center text-muted">ไม่มีผู้สมัครใหม่</div>`;
    return;
  }

  list.innerHTML = apps.map(app => {
    const avatar = app.profile_image || `https://ui-avatars.com/api/?name=${encodeURIComponent(app.fullname || 'U')}&background=f1f5f9&color=64748b`;
    const exp = app.experience_years ? ` • ${app.experience_years} ปี` : ' • ไม่มี ปสก.';
    return `
      <div class="list-item">
        <img src="${avatar}" alt="Avatar" class="list-avatar" style="object-fit:cover;">
        <div class="list-info">
          <p class="list-title" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 130px;">${app.fullname || 'ไม่ระบุชื่อ'}</p>
          <p class="list-subtitle">${app.position || 'ช่างทั่วไป'}${exp}</p>
        </div>
        <div class="list-actions">
          <button class="btn-icon view-app" onclick="viewJobApp('${app.id}')" title="ดูข้อมูลลึก"><i class="fa-solid fa-eye text-primary"></i></button>
          <button class="btn-icon accept" onclick="approveJobApp('${app.id}')" title="อนุมัติ"><i class="fa-solid fa-check"></i></button>
          <button class="btn-icon reject" onclick="rejectJobApp('${app.id}')" title="ปฏิเสธ"><i class="fa-solid fa-xmark"></i></button>
        </div>
      </div>
    `;
  }).join('');
  if (window.applyTranslations) window.applyTranslations(list);
};

window.approveJobApp = async function(appId) {
  try {
    const btn = document.querySelector(`button[onclick="approveJobApp('${appId}')"]`);
    if(btn) {
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
      btn.disabled = true;
    }

    // 1. Fetch the application
    const { data: app, error: fErr } = await supabaseClient.from('job_applications').select('*').eq('id', appId).maybeSingle();
    if(fErr || !app) throw new Error("ไม่พบข้อมูลผู้สมัคร หรือถูกดึงไปแล้ว");
    
    // Validate if the user_id exists (to map with Auth Uid)
    if(!app.user_id) throw new Error("ใบสมัครนี้ไม่มี UID (user_id) ทำให้ไม่สามารถผูกบัญชีช่างกับระบบล็อกอินได้");

    // 2. Upsert into technicians (using the Auth UID as explicit ID)
    const { data: tech, error: iErr } = await supabaseClient.from('technicians').upsert([{
      id: app.user_id,
      name: app.fullname,
      category: app.position || 'ช่างทั่วไป',
      area: app.province || app.service_area || 'ไม่ระบุ',
      rating: null,
      skill_level: app.skill_level,
      experience_years: app.experience_years,
      expertise: app.expertise,
      phone: app.phone,
      subdistrict: app.subdistrict,
      district: app.district,
      province: app.province,
      service_area: app.service_area,
      service_distance: app.service_distance,
      latitude: app.latitude,
      longitude: app.longitude,
      team_size: app.team_size,
      vehicle: app.vehicle,
      rate_type: app.rate_type,
      daily_rate: app.daily_rate,
      availability_urgency: app.availability_urgency,
      work_hours: app.work_hours,
      past_work_count: app.past_work_count,
      past_work_types: app.past_work_types,
      email: app.email,
      line_id: app.line_id,
      tools: app.tools,
      selling_points: app.selling_points,
      experience: app.experience,
      portfolio: app.portfolio,
      portfolio_category: app.portfolio_category,
      profile_image: app.profile_image,
      portfolio_images: app.portfolio_images,
      id_card_image: app.id_card_image,
      selfie_image: app.selfie_image,
      training_cert_image: app.training_cert_image,
      certificate_image: app.certificate_image,
      license_image: app.license_image
    }]).select('id').single();
    if(iErr) throw iErr;

    // 2.5 Update the user's role to 'technician' in profiles table via RPC (Bypasses RLS)
    const { error: profileErr } = await supabaseClient.rpc('admin_set_user_role', {
      target_user_id: app.user_id,
      new_role: 'technician'
    });
    if(profileErr) console.warn("Cannot update profile role via RPC:", profileErr);
    if(iErr) throw iErr;

    // 3. Insert Image if exists
    if (app.profile_image) {
      await supabaseClient.from('technician_images').insert([{
        technician_id: tech.id,
        image_url: app.profile_image
      }]);
    }

    // 4. Delete the application
    await supabaseClient.from('job_applications').delete().eq('id', appId);

    if (typeof showToast !== 'undefined') showToast('อนุมัติสำเร็จ', `เพิ่ม ${app.fullname} เข้าระบบช่างเทคนิคเรียบร้อยแล้ว!`);
    loadRealData(); // Refresh UI

  } catch(e) {
    if (typeof showToast !== 'undefined') showToast('ล้มเหลว', e.message, true);
  }
};

window.rejectJobApp = async function(appId) {
  if(!confirm("คุณต้องการปฏิเสธและลบข้อมูลผู้สมัครนี้ใช่หรือไม่?")) return;
  try {
     const { error } = await supabaseClient.from('job_applications').delete().eq('id', appId);
     if (error) throw error;
     if (typeof showToast !== 'undefined') showToast('ปฏิเสธสำเร็จ', 'ลบผู้สมัครออกจากระบบแล้ว');
     loadRealData();
  } catch(e) {
     if (typeof showToast !== 'undefined') showToast('ล้มเหลว', e.message, true);
  }
};

// ================= Applicant Modal Details =================
window.viewJobApp = async function(appId) {
  const overlay = document.getElementById('appModalOverlay');
  if(!overlay) return;
  overlay.classList.add('active');
  document.getElementById('appModalBody').innerHTML = '<div class="text-center py-4"><i class="fa-solid fa-spinner fa-spin fa-2x text-primary"></i></div>';
  document.getElementById('appModalFooter').innerHTML = '';

  try {
    const { data: app, error } = await supabaseClient.from('job_applications').select('*').eq('id', appId).maybeSingle();
    if(error || !app) throw new Error("ไม่พบข้อมูลผู้สมัคร (อาจถูกอนุมัติ/ปฏิเสธไปแล้ว)");
    
    const avatar = app.profile_image || ('https://ui-avatars.com/api/?name='+encodeURIComponent(app.fullname || 'U')+'&background=f1f5f9&color=64748b');
    
    const keyMap = {
      fullname: 'ชื่อ-นามสกุล', position: 'ประเภทช่าง/ตำแหน่ง', experience_years: 'ประสบการณ์ (ปี)',
      phone: 'เบอร์โทรศัพท์', province: 'จังหวัด', service_area: 'พื้นที่รับงาน',
      team_size: 'จำนวนทีมงาน', work_alone: 'ทำคนเดียว', has_vehicle: 'มีรถสำหรับออกงาน',
      daily_wage: 'ค่าแรงต่อวัน (บาท)', available_time: 'เวลาที่สะดวกรับงาน', every_day: 'รับงานทุกวัน',
      line_id: 'Line ID', email: 'Email', tools: 'เครื่องมือที่มี', experience: 'รายละเอียดประสบการณ์',
      portfolio_link: 'ลิงก์ผลงาน', id_card_number: 'เลขบัตรประชาชน', address: 'ที่อยู่จัดส่ง/ติดต่อ',
      id_card_image: 'รูปบัตรประชาชน', certificate_image: 'ใบรับรองอบรม', license_image: 'ใบอนุญาตช่าง',
      work_images: 'รูปผลงาน', documents: 'เอกสารแนบ', skills: 'ทักษะ/ความถนัด'
    };
    
    let dynamicHtml = '';
    const excludeKeys = ['id', 'user_id', 'created_at', 'profile_image', 'fullname', 'position'];
    
    for (const [key, val] of Object.entries(app)) {
        if (excludeKeys.includes(key) || val === null || val === '' || val === undefined) continue;
        
        const label = keyMap[key] || key;
        let displayVal = val;
        let isGallery = false;
        
        let parsedVal = val;
        if (typeof val === 'string' && val.startsWith('[') && val.endsWith(']')) {
           try { parsedVal = JSON.parse(val); } catch(e){}
        }

        if (typeof parsedVal === 'boolean') {
           displayVal = parsedVal ? '<span class="text-emerald"><i class="fa-solid fa-check"></i> ใช่ (Yes)</span>' : '<span class="text-rose"><i class="fa-solid fa-xmark"></i> ไม่ (No)</span>';
        } else if (Array.isArray(parsedVal) && parsedVal.length > 0 && typeof parsedVal[0] === 'string' && parsedVal[0].startsWith('http')) {
           displayVal = '<div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:8px; width:100%;">';
           parsedVal.forEach(url => {
               displayVal += `<a href="${url}" target="_blank"><img src="${url}" style="width:70px; height:70px; object-fit:cover; border-radius:6px; border:1px solid #cbd5e1; box-shadow:0 2px 4px rgba(0,0,0,0.1); transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'"></a>`;
           });
           displayVal += '</div>';
           isGallery = true;
        } else if (typeof parsedVal === 'object' && parsedVal !== null) {
           try { displayVal = JSON.stringify(parsedVal); } catch(e){}
        } else if (typeof parsedVal === 'string' && parsedVal.startsWith('http')) {
           if (parsedVal.match(/\.(jpeg|jpg|gif|png|webp)(\?.*)?$/i) || key.includes('image')) {
               displayVal = `<div style="margin-top:8px; width:100%;"><a href="${parsedVal}" target="_blank"><img src="${parsedVal}" style="height:90px; border-radius:6px; border:1px solid #cbd5e1; box-shadow:0 2px 4px rgba(0,0,0,0.1); transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'"></a></div>`;
               isGallery = true;
           } else {
               displayVal = `<a href="${parsedVal}" target="_blank" class="text-primary" style="text-decoration:underline; font-weight:600;"><i class="fa-solid fa-paperclip"></i> ดูไฟล์แนบ</a>`;
           }
        }
        
        if (key === 'id_card_number' && typeof parsedVal === 'string' && parsedVal.length > 4) {
           displayVal = 'xxx-xxx-' + parsedVal.substring(parsedVal.length-4);
        }
        
        if (isGallery) {
            dynamicHtml += `
              <div style="padding:12px 0; border-bottom:1px dashed var(--glass-border);">
                <strong style="color:var(--text-main); font-size:14px; display:block; margin-bottom:4px;">${label}:</strong>
                ${displayVal}
              </div>
            `;
        } else {
            dynamicHtml += `
              <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px dashed var(--glass-border);">
                <strong style="color:var(--text-main); font-size:14px; flex-shrink:0;">${label}:</strong>
                <span style="color:var(--text-muted); text-align:right; font-size:14px; max-width:65%; word-break:break-word;">${displayVal}</span>
              </div>
            `;
        }
    }

    document.getElementById('appModalBody').innerHTML = `
      <div class="text-center mb-4">
        <img src="${avatar}" style="width:100px; height:100px; border-radius:50%; object-fit:cover; margin-bottom:15px; border:3px solid var(--primary-light); box-shadow:0 4px 12px rgba(0,0,0,0.1);">
        <h4 style="margin:0; color:var(--text-main); font-weight:600;">${app.fullname || 'ไม่ระบุชื่อ'}</h4>
        <p style="color:var(--text-muted); margin-top:5px; font-size:15px;">${app.position || 'ไม่ระบุตำแหน่ง'}</p>
      </div>
      <div style="background:var(--glass-bg); padding:18px; border-radius:8px; border:1px solid var(--glass-border); line-height:1.6; text-align:left; max-height:450px; overflow-y:auto;">
        ${dynamicHtml}
        <div style="padding-top:15px; font-size:12.5px; color:var(--text-muted); text-align:center;">
          <i class="fa-regular fa-clock"></i> ส่งใบสมัครเมื่อ: ${app.created_at ? new Date(app.created_at).toLocaleString('th-TH') : '-'}
        </div>
      </div>
    `;
    
    document.getElementById('appModalFooter').innerHTML = `
      <button class="btn btn-secondary" onclick="closeAppModal()">ปิดหน้าต่าง</button>
      <button class="btn btn-primary" onclick="closeAppModal(); approveJobApp('${app.id}')" style="background:var(--emerald); border-color:var(--emerald);"><i class="fa-solid fa-check mr-2"></i> อนุมัติทันที</button>
    `;
  } catch(e) {
    document.getElementById('appModalBody').innerHTML = `<div class="text-center text-rose p-4">
      <i class="fa-solid fa-circle-exclamation fa-3x mb-3"></i><br><strong>ไม่สามารถโหลดข้อมูลได้</strong><br>${e.message}
    </div>`;
  }
};

window.closeAppModal = function() {
  const overlay = document.getElementById('appModalOverlay');
  if(overlay) overlay.classList.remove('active');
};
