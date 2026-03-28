/**
 * admin-technicians.js
 * Logic for managing technicians via Admin Dashboard
 */

const SUPABASE_URL = "https://uqcjajmqtlchftpqwsrp.supabase.co";
const SUPABASE_KEY = "sb_publishable_yWZiH8l1idY0QWGuj6p9sg_GqXPONGX";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser = null;
let isMockMode = false;
let allTechs = [];

document.addEventListener('DOMContentLoaded', async () => {
  setupUI();
  await checkAuthAndLoadData();
});

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

  // Search filter
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('keyup', (e) => {
      const term = e.target.value.toLowerCase();
      const filtered = allTechs.filter(c => 
        (c.name && c.name.toLowerCase().includes(term)) || 
        (c.category && c.category.toLowerCase().includes(term))
      );
      renderTechsTable(filtered);
    });
  }
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

    await loadRealTechs(); supabaseClient.channel('admin-techs-live').on('postgres_changes', { event: '*', schema: 'public', table: 'technicians' }, payload => { loadRealTechs(); }).subscribe();
  } catch (err) {
    console.error(err);
    enableMockMode("System Error: " + err.message);
  }
}

function enableMockMode(reason) {
  isMockMode = true;
  showToast("Preview Mode", reason + " - ข้อมูลจำลอง");
  renderMockTechs();
}

async function logout() {
  if (!isMockMode) await supabaseClient.auth.signOut();
  window.location.href = "login.html";
}

async function loadRealTechs() {
  try {
    const { data, error } = await supabaseClient
      .from('technicians')
      .select('*, technician_images(image_url)')
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    allTechs = data || [];
    renderTechsTable(allTechs);
  } catch(e) {
    showToast("Error", "ไม่สามารถดึงข้อมูลช่างได้", true);
  }
}

function renderMockTechs() {
  allTechs = [
    { id: "10", name: "วิระวัฒน์ มั่นคง", category: "ซ่อมประปา", area: "กรุงเทพมหานคร", rating: 4.8 },
    { id: "11", name: "สุรศักดิ์ ใจกล้า", category: "ซ่อมไฟฟ้า", area: "นนทบุรี", rating: 4.5 },
    { id: "12", name: "วิชัย สมบัติ", category: "ช่างแอร์", area: "ปทุมธานี", rating: null }
  ];
  renderTechsTable(allTechs);
}

function renderTechsTable(techs) {
  const tbody = document.getElementById('techsTableBody');
  const countSpan = document.getElementById('totalTechsCount');
  
  if (countSpan) countSpan.innerText = techs.length.toLocaleString();

  if (!tbody) return;

  if (techs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-5 text-muted">ไม่พบข้อมูลช่างในระบบ</td></tr>`;
    return;
  }

  tbody.innerHTML = techs.map(tech => {
    let avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(tech.name || 'Tech')}&background=e0e7ff&color=4f46e5`;
    if (tech.technician_images && tech.technician_images.length > 0) {
      avatarUrl = tech.technician_images[0].image_url;
    }
    let ratingHtml = `<span class="text-muted text-sm">ยังไม่มีคะแนน</span>`;
    if (tech.rating) {
      ratingHtml = `<span class="text-amber"><i class="fa-solid fa-star"></i> ${tech.rating}</span>`;
    }

    return `
      <tr>
        <td class="text-muted font-monospace">TECH-${String(tech.id).substring(0,8)}</td>
        <td>
          <div class="user-row">
            <img src="${avatarUrl}" alt="Tech" style="object-fit:cover;">
            <span class="font-weight-bold">${tech.name || 'ชื่อช่าง'}</span>
          </div>
        </td>
        <td><span class="badge-status in-progress bg-indigo-light text-indigo border-0">${tech.category || '-'}</span></td>
        <td class="text-muted"><i class="fa-solid fa-location-dot mr-1"></i> ${tech.area || '-'}</td>
        <td class="font-weight-bold">${ratingHtml}</td>
        <td>
          <div class="action-buttons">
  <button class="action-btn view" title="ดูโปรไฟล์" onclick="viewTech('${tech.id}')"><i class="fa-solid fa-id-card"></i></button>
  <button class="action-btn edit" title="แก้ไข" onclick="editTech('${tech.id}')"><i class="fa-solid fa-pen"></i></button>
</div>
        </td>
      </tr>
    `;
  }).join('');
}


// ==================== MODAL ACTION LOGIC ====================
let currentEditingId = null;

window.viewTech = function(id) {
  const tech = allTechs.find(t => t.id == id);
  if(!tech) return;
  document.getElementById('modalTitle').innerText = window.t ? window.t("ข้อมูลเชิงลึกช่างเทคนิค") : "ข้อมูลเชิงลึกช่างเทคนิค";
  let avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(tech.name || 'Tech')}&background=e0e7ff&color=4f46e5`;
  if (tech.technician_images && tech.technician_images.length > 0) {
    avatarUrl = tech.technician_images[0].image_url;
  } else if (tech.profile_image) {
    avatarUrl = tech.profile_image;
  }

  const keyMap = {
    name: 'ชื่อ-นามสกุล', category: 'ตำแหน่งหลัก', experience_years: 'ประสบการณ์ (ปี)', skill_level: 'ระดับฝีมือ',
    expertise: 'ความเชี่ยวชาญ', phone: 'เบอร์โทร', area: 'พื้นที่ดูแล', service_distance: 'ระยะทางรับงาน (กม.)',
    team_size: 'จำนวนทีมงาน', vehicle: 'ยานพาหนะ', rate_type: 'รูปแบบค่าแรง', daily_rate: 'เรทค่าแรง (บาท)',
    availability_urgency: 'ความพร้อมรับงาน', work_hours: 'เวลาทำงาน', past_work_count: 'จำนวนงานที่เคยทำ',
    past_work_types: 'ประเภทงานที่รับ', email: 'อีเมล', line_id: 'Line ID', tools: 'เครื่องมือที่มี',
    selling_points: 'จุดขาย/จุดเด่น', experience: 'ประสบการณ์/รายละเอียด', portfolio_category: 'หมวดหมู่ผลงาน',
    portfolio_images: 'รูปผลงาน', id_card_image: 'รูปบัตรประชาชน', selfie_image: 'รูปถ่ายคู่บัตร', 
    training_cert_image: 'ใบรับรอง/อบรม', certificate_image: 'ใบประกาศนียบัตร', license_image: 'ใบอนุญาตช่าง'
  };

  let dynamicHtml = '';
  // exclude standard metadata and layout stuff
  const excludeKeys = ['id', 'user_id', 'created_at', 'profile_image', 'name', 'category', 'rating', 'technician_images', 'latitude', 'longitude'];
  
  for (const [key, val] of Object.entries(tech)) {
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
             displayVal = `<a href="${parsedVal}" target="_blank" class="text-primary" style="text-decoration:underline; font-weight:600;"><i class="fa-solid fa-paperclip"></i> ดูไฟล์แนบ/ลิงก์</a>`;
         }
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

  let locationBtn = '';
  if (tech.latitude && tech.longitude) {
    locationBtn = `<a href="https://maps.google.com/?q=${tech.latitude},${tech.longitude}" target="_blank" class="btn btn-sm" style="margin-top:10px; background:#e2e8f0; color:#475569;"><i class="fa-solid fa-map-pin"></i> เปิดพิกัดช่างใน Google Maps</a>`;
  }

  document.getElementById('modalBody').innerHTML = `
    <div class="text-center mb-4">
      <img src="${avatarUrl}" style="width:100px; height:100px; border-radius:50%; object-fit:cover; margin-bottom:15px; border:3px solid var(--primary-light); box-shadow:0 4px 12px rgba(0,0,0,0.1);">
      <h4 style="margin:0; color:var(--text-main); font-weight:600;">${tech.name || 'ไม่ระบุชื่อ'}</h4>
      <p style="color:var(--text-muted); margin-top:5px; font-size:15px;"><i class="fa-solid fa-star text-amber"></i> ${tech.rating || 'N/A'} | ${tech.category || '-'} | ${tech.area || '-'}</p>
      ${locationBtn}
    </div>
    <div style="background:var(--glass-bg); padding:18px; border-radius:8px; border:1px solid var(--glass-border); line-height:1.6; text-align:left; max-height:450px; overflow-y:auto;">
      ${dynamicHtml}
      <div style="padding-top:15px; font-size:12.5px; color:var(--text-muted); text-align:center;">
        <p class="mb-0"><strong><i class="fa-solid fa-hashtag text-indigo"></i> ID:</strong> TECH-${String(tech.id).substring(0,8)}</p>
        <i class="fa-regular fa-clock"></i> เข้าร่วมระบบเมื่อ: ${tech.created_at ? new Date(tech.created_at).toLocaleString('th-TH') : '-'}
      </div>
    </div>
  `;
  document.getElementById('saveModalBtn').style.display = 'none';
  openTechModal();
};

window.editTech = function(id) {
  const tech = allTechs.find(t => t.id == id);
  if(!tech) return;
  currentEditingId = id;
  document.getElementById('modalTitle').innerText = window.t ? window.t("แก้ไขข้อมูลเชิงลึกช่าง") : "แก้ไขข้อมูลเชิงลึกช่าง";
  
  // Build dynamic groups for editing
  document.getElementById('modalBody').innerHTML = `
    <div style="max-height: 500px; overflow-y: auto; padding-right: 10px;">
      <div class="mb-4">
        <h5 class="text-primary border-bottom pb-2 mb-3"><i class="fa-solid fa-user-gear"></i> ข้อมูลพื้นฐานเเละตัวตน</h5>
        <div class="form-row" style="display:flex; gap:15px; margin-bottom:15px;">
           <div style="flex:1;">
             <label class="small font-weight-bold">ชื่อ-นามสกุล</label>
             <input type="text" id="editName" class="form-control" value="${tech.name || ''}">
           </div>
           <div style="flex:1;">
             <label class="small font-weight-bold">ตำแหน่ง/ประเภทหลัก</label>
             <input type="text" id="editCategory" class="form-control" value="${tech.category || ''}">
           </div>
        </div>
        <div class="form-row" style="display:flex; gap:15px; margin-bottom:15px;">
           <div style="flex:1;">
             <label class="small font-weight-bold">ระดับฝีมือ</label>
             <select id="editSkillLevel" class="form-control">
               <option value="มือใหม่" ${tech.skill_level === 'มือใหม่' ? 'selected' : ''}>มือใหม่</option>
               <option value="ทั่วไป" ${tech.skill_level === 'ทั่วไป' ? 'selected' : ''}>ทั่วไป</option>
               <option value="มืออาชีพ" ${tech.skill_level === 'มืออาชีพ' ? 'selected' : ''}>มืออาชีพ</option>
             </select>
           </div>
           <div style="flex:1;">
             <label class="small font-weight-bold">คะแนนระบบ (Rating)</label>
             <input type="number" id="editRating" class="form-control" step="0.1" value="${tech.rating || 5}">
           </div>
        </div>
      </div>

      <div class="mb-4">
        <h5 class="text-primary border-bottom pb-2 mb-3"><i class="fa-solid fa-phone"></i> ข้อมูลการติดต่อ</h5>
        <div class="form-row" style="display:flex; gap:15px; margin-bottom:15px;">
           <div style="flex:1;">
             <label class="small font-weight-bold">เบอร์โทรศัพท์</label>
             <input type="text" id="editPhone" class="form-control" value="${tech.phone || ''}">
           </div>
           <div style="flex:1;">
             <label class="small font-weight-bold">Line ID</label>
             <input type="text" id="editLineId" class="form-control" value="${tech.line_id || ''}">
           </div>
        </div>
        <div class="form-group mb-3">
           <label class="small font-weight-bold">Email</label>
           <input type="email" id="editEmail" class="form-control" value="${tech.email || ''}">
        </div>
      </div>

      <div class="mb-4">
        <h5 class="text-primary border-bottom pb-2 mb-3"><i class="fa-solid fa-location-dot"></i> พื้นที่ให้บริการ</h5>
        <div class="form-row" style="display:flex; gap:15px; margin-bottom:15px;">
           <div style="flex:1;">
             <label class="small font-weight-bold">จังหวัด</label>
             <input type="text" id="editProvince" class="form-control" value="${tech.province || tech.area || ''}">
           </div>
           <div style="flex:1;">
             <label class="small font-weight-bold">เขต/อำเภอ</label>
             <input type="text" id="editDistrict" class="form-control" value="${tech.district || ''}">
           </div>
        </div>
        <div style="margin-bottom:15px;">
           <label class="small font-weight-bold">ระยะทางรับงานสูงสุด (กม.)</label>
           <input type="number" id="editServiceDistance" class="form-control" value="${tech.service_distance || 30}">
        </div>
      </div>

      <div class="mb-4">
        <h5 class="text-primary border-bottom pb-2 mb-3"><i class="fa-solid fa-money-bill-wave"></i> ค่าแรงและรูปแบบงาน</h5>
        <div class="form-row" style="display:flex; gap:15px; margin-bottom:15px;">
           <div style="flex:1;">
             <label class="small font-weight-bold">รูปแบบค่าแรง</label>
             <select id="editRateType" class="form-control">
               <option value="รายวัน" ${tech.rate_type === 'รายวัน' ? 'selected' : ''}>รายวัน</option>
               <option value="เหมา" ${tech.rate_type === 'เหมา' ? 'selected' : ''}>เหมา</option>
               <option value="รายชั่วโมง" ${tech.rate_type === 'รายชั่วโมง' ? 'selected' : ''}>รายชั่วโมง</option>
             </select>
           </div>
           <div style="flex:1;">
             <label class="small font-weight-bold">เรทราคา (บาท)</label>
             <input type="number" id="editDailyRate" class="form-control" value="${tech.daily_rate || ''}">
           </div>
        </div>
        <div style="margin-bottom:15px;">
           <label class="small font-weight-bold">ยานพาหนะ</label>
           <input type="text" id="editVehicle" class="form-control" value="${tech.vehicle || ''}" placeholder="กระบะ / มอเตอร์ไซค์">
        </div>
      </div>

      <div class="mb-2">
        <h5 class="text-primary border-bottom pb-2 mb-3"><i class="fa-solid fa-tools"></i> ทักษะเเละเครื่องมือ</h5>
        <div class="form-group mb-3">
           <label class="small font-weight-bold">ความเชี่ยวชาญ/จุดเด่น</label>
           <textarea id="editExpertise" class="form-control" rows="2">${tech.expertise || ''}</textarea>
        </div>
        <div class="form-group mb-3">
           <label class="small font-weight-bold">เครื่องมือที่มี</label>
           <input type="text" id="editTools" class="form-control" value="${tech.tools || ''}">
        </div>
      </div>
    </div>
  `;

  const saveBtn = document.getElementById('saveModalBtn');
  saveBtn.style.display = 'block';
  saveBtn.onclick = () => saveTechData();
  openTechModal();
};

window.openTechModal = function() {
  const overlay = document.getElementById('techModalOverlay');
  overlay.style.display = 'flex';
  setTimeout(() => overlay.classList.add('active'), 10);
  if(window.applyTranslations) window.applyTranslations(overlay);
};

window.closeTechModal = function(e) {
  if (e && e.target !== e.currentTarget) return; // Prevent closing when clicking content
  const overlay = document.getElementById('techModalOverlay');
  overlay.classList.remove('active');
  setTimeout(() => overlay.style.display = 'none', 300);
};

window.saveTechData = async function() {
  if(!currentEditingId) return;
  const saveBtn = document.getElementById('saveModalBtn');
  const oldText = saveBtn.innerText;
  saveBtn.innerText = "กำลังบันทึก...";
  saveBtn.disabled = true;

  const updates = {
    name: document.getElementById('editName').value,
    category: document.getElementById('editCategory').value,
    skill_level: document.getElementById('editSkillLevel').value,
    rating: parseFloat(document.getElementById('editRating').value) || null,
    phone: document.getElementById('editPhone').value,
    line_id: document.getElementById('editLineId').value,
    email: document.getElementById('editEmail').value,
    province: document.getElementById('editProvince').value,
    area: document.getElementById('editProvince').value, // sync for legacy columns
    district: document.getElementById('editDistrict').value,
    service_distance: parseInt(document.getElementById('editServiceDistance').value) || 0,
    rate_type: document.getElementById('editRateType').value,
    daily_rate: parseFloat(document.getElementById('editDailyRate').value) || 0,
    vehicle: document.getElementById('editVehicle').value,
    expertise: document.getElementById('editExpertise').value,
    tools: document.getElementById('editTools').value
  };
  
  try {
     const { error } = await supabaseClient
       .from('technicians')
       .update(updates)
       .eq('id', currentEditingId);
       
     if(error) throw error;
     if(typeof showToast === 'function') showToast("อัปเดตข้อมูลสำเร็จ", "บันทึกข้อมูลเชิงลึกเรียบร้อยแล้ว");
     closeTechModal();
     if(typeof loadRealTechs === 'function') loadRealTechs();
  } catch(err) {
     if(typeof showToast === 'function') showToast("Error", err.message, true);
  } finally {
     saveBtn.innerText = oldText;
     saveBtn.disabled = false;
  }
};

// Universal CSV Export
window.exportToCSV = function() {
    let filename = document.title.split('|')[0].trim().replace(/\s+/g, '_') + '.csv';
    let activeTable = document.querySelector('.tab-content.active table') || document.querySelector('table');
    if(!activeTable) {
       if(typeof showToast==='function') showToast("ข้อผิดพลาด", "ไม่พบตารางข้อมูลสำหรับส่งออก", true);
       return;
    }
    
    let csv = [];
    let rows = activeTable.querySelectorAll('tr');
    
    for (let i = 0; i < rows.length; i++) {
        let row = [], cols = rows[i].querySelectorAll('td, th');
        
        // Skip rows with "Loading" or "No data"
        if(cols.length === 1 && cols[0].colSpan > 1) continue;
        
        // Skip the last column usually (Actions)
        let colCount = (i === 0) ? cols.length - 1 : cols.length; 
        if(cols[cols.length-1].innerText.trim() === '' || cols[cols.length-1].querySelector('.action-buttons')) colCount = cols.length - 1;

        for (let j = 0; j < colCount; j++) {
            let data = cols[j].innerText.trim()
                .replace(/\r?\n|\r/g, ' ') // remove newlines
                .replace(/"/g, '""'); // escape double quotes
            
            // Re-format special characters if needed
            row.push('"' + data + '"');
        }
        csv.push(row.join(','));
    }
    
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF" + csv.join('\n');
    let encodedUri = encodeURI(csvContent);
    let link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    if(typeof showToast==='function') showToast("สำเร็จ", "ดาวน์โหลดรายงาน Excel เรียบร้อยแล้ว");
};
