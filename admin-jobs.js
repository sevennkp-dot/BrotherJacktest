/**
 * admin-jobs.js
 * Logic for managing jobs/bookings via Admin Dashboard
 */

const SUPABASE_URL = "https://uqcjajmqtlchftpqwsrp.supabase.co";
const SUPABASE_KEY = "sb_publishable_yWZiH8l1idY0QWGuj6p9sg_GqXPONGX";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser = null;
let isMockMode = false;
let allJobs = [];

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
      const filtered = allJobs.filter(job => 
        (job.id && String(job.id).toLowerCase().includes(term)) ||
        (job.customer_name && job.customer_name.toLowerCase().includes(term)) || 
        (job.category && job.category.toLowerCase().includes(term)) ||
        (job.problem_detail && job.problem_detail.toLowerCase().includes(term))
      );
      renderJobsTable(filtered);
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

    await loadRealJobs(); supabaseClient.channel('admin-jobs-live').on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, payload => { showToast("📢 งานอัปเดต", "มีสถานะงานเปลี่ยนแปลงในระบบ"); loadRealJobs(); }).subscribe();
  } catch (err) {
    console.error(err);
    enableMockMode("System Error: " + err.message);
  }
}

function enableMockMode(reason) {
  isMockMode = true;
  showToast("Preview Mode", reason + " - ข้อมูลจำลอง");
  renderMockJobs();
}

async function logout() {
  if (!isMockMode) await supabaseClient.auth.signOut();
  window.location.href = "login.html";
}

async function loadRealJobs() {
  try {
    const { data, error } = await supabaseClient
      .from('bookings')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    allJobs = data || [];
    renderJobsTable(allJobs);
  } catch(e) {
    showToast("Error", "ไม่สามารถดึงข้อมูลออเดอร์งานได้", true);
  }
}

function renderMockJobs() {
  allJobs = [
    { id: 4029, customer_name: "สมชาย ใจดี", customer_phone: "089-123-4567", category: "ซ่อมแอร์บ้าน", problem_detail: "แอร์ไม่เย็น มีน้ำหยด", service_date: "2026-03-19", service_time: "10:00", province: "กรุงเทพมหานคร", status: "รอรับงาน", technician_id: null },
    { id: 4028, customer_name: "วิภา สุขสม", customer_phone: "081-987-6543", category: "ปูกระเบื้องห้องน้ำ", problem_detail: "กระเบื้องร่อน 2 แผ่น", service_date: "2026-03-18", service_time: "13:30", province: "นนทบุรี", status: "กำลังดำเนินการ", technician_id: "TECH-11" },
    { id: 4027, customer_name: "กรณ์ เรืองกิตติ์", customer_phone: "082-222-3333", category: "ซ่อมท่อน้ำรั่ว", problem_detail: "ท่อใต้อ่างล้างหน้าซึม", service_date: "2026-03-18", service_time: "15:00", province: "ปทุมธานี", status: "เสร็จสิ้น", technician_id: "TECH-10" },
    { id: 4026, customer_name: "พลอย นภา", customer_phone: "083-444-5555", category: "ประเมินราคาต่อเติม", problem_detail: "ทำหลังคาโรงรถ", service_date: "2026-03-17", service_time: "09:00", province: "สมุทรปราการ", status: "ยกเลิกแล้ว", technician_id: null }
  ];
  renderJobsTable(allJobs);
}

function renderJobsTable(jobs) {
  const tbody = document.getElementById('jobsTableBody');
  const countSpan = document.getElementById('totalJobsCount');
  const sidebarBadge = document.getElementById('sidebarJobsBadge');
  
  if (countSpan) countSpan.innerText = jobs.length.toLocaleString();
  
  // Update sidebar pending count (just filtering by waiting status ideally, but we'll show total active for now)
  const activeCount = jobs.filter(j => j.status !== 'เสร็จสิ้น' && j.status !== 'ยกเลิกแล้ว').length;
  if (sidebarBadge) sidebarBadge.innerText = activeCount.toString();

  if (!tbody) return;

  if (jobs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-5 text-muted">ไม่พบข้อมูลงานในระบบ</td></tr>`;
    return;
  }

  tbody.innerHTML = jobs.map(job => {
    let badgeClass = "pending";
    if (job.status === "กำลังดำเนินการ") badgeClass = "in-progress";
    if (job.status === "เสร็จสิ้น") badgeClass = "completed";
    if (job.status === "ยกเลิกแล้ว") badgeClass = "rejected";
    
    let dateStr = "ไม่ระบุ";
    if (job.service_date) {
        const d = new Date(job.service_date);
        dateStr = isNaN(d) ? job.service_date : d.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
    }
    const timeStr = job.service_time ? job.service_time : '-';
    
    const location = job.province || 'ไม่ระบุพื้นที่';
    const techSpan = job.technician_id ? `<span class="text-sm text-indigo"><i class="fa-solid fa-helmet-safety"></i> ${job.technician_id}</span>` : `<span class="text-sm text-muted">รอจับคู่ช่าง</span>`;

    return `
      <tr>
        <td class="font-weight-bold">#JOB-${job.id}</td>
        <td>
          <div class="user-row">
            <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(job.customer_name || 'U')}&background=f1f5f9&color=475569" alt="User">
            <div>
              <div class="font-weight-bold">${job.customer_name || '-'}</div>
              <div class="text-sm text-muted"><i class="fa-solid fa-phone"></i> ${job.customer_phone || '-'}</div>
            </div>
          </div>
        </td>
        <td>
          <div class="font-weight-bold text-sm bg-indigo-light text-indigo px-2 py-1 rounded d-inline-block" style="border-radius:6px; display:inline-block;">${job.category || 'บริการทั่วไป'}</div>
          <div class="text-muted text-sm mt-1" style="max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${job.problem_detail || '-'}</div>
        </td>
        <td>
          <div class="font-weight-bold"><i class="fa-regular fa-calendar text-muted mr-1"></i> ${dateStr}</div>
          <div class="text-sm text-muted mt-1"><i class="fa-regular fa-clock text-muted mr-1"></i> ${timeStr}</div>
        </td>
        <td>
          <div class="text-sm"><i class="fa-solid fa-location-dot text-muted mr-1"></i> ${location}</div>
          <div class="mt-1">${techSpan}</div>
        </td>
        <td><span class="badge-status ${badgeClass}">${job.status || 'รอดำเนินการ'}</span></td>
        <td>
          <div class="action-buttons">
            <button class="action-btn view" title="ดูรายละเอียด" onclick="viewJob('${job.id}')"><i class="fa-solid fa-file-invoice"></i></button>
            <button class="action-btn edit" title="อัปเดต" onclick="editJob('${job.id}')"><i class="fa-solid fa-pen"></i></button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}


// === JOB MODAL LOGIC ===
let currentEditJobId = null;

window.viewJob = function(id) {
  const job = allJobs.find(j => j.id == id);
  if(!job) return;
  document.getElementById('modalTitleJob').innerText = window.t ? window.t("รายละเอียดออเดอร์งาน") : "รายละเอียดออเดอร์งาน";
  
  let dateStr = job.service_date || "-";
  if(job.service_date) {
    const d = new Date(job.service_date);
    if(!isNaN(d)) dateStr = d.toLocaleDateString('th-TH');
  }

  document.getElementById('modalBodyJob').innerHTML = `
    <div class="p-3 rounded mb-3" style="background:${job.status==='เสร็จสิ้น'?'#dcfce7':job.status==='ยกเลิกแล้ว'?'#ffe4e6':'#e0e7ff'};">
      <h3 style="margin:0; font-size:1.3rem; color:var(--text-dark);">#JOB-${job.id} <span style="font-size:0.9rem; float:right; opacity:0.7;">${job.status}</span></h3>
    </div>
    <div style="display:flex; justify-content:space-between; margin-bottom:1rem;">
      <div><p class="mb-1" style="color:var(--text-muted);">ชื่อลูกค้า</p><p class="font-weight-bold">${job.customer_name || '-'}</p></div>
      <div><p class="mb-1" style="color:var(--text-muted);">เบอร์โทร</p><p class="font-weight-bold">${job.customer_phone || '-'}</p></div>
    </div>
    <div class="mb-3">
      <p class="mb-1" style="color:var(--text-muted);">หมวดหมู่งาน</p>
      <p class="font-weight-bold">${job.category || '-'}</p>
    </div>
    <div class="mb-3" style="background:#f8fafc; padding:12px; border-radius:8px;">
      <p class="mb-1" style="color:var(--text-muted);">รายละเอียดอาการ</p>
      <p>${job.problem_detail || '-'}</p>
    </div>
    <div style="display:flex; justify-content:space-between; margin-bottom:1rem;">
      <div><p class="mb-1" style="color:var(--text-muted);">วันที่นัดหมาย</p><p><i class="fa-regular fa-calendar text-primary"></i> ${dateStr}</p></div>
      <div><p class="mb-1" style="color:var(--text-muted);">เวลา</p><p><i class="fa-regular fa-clock text-primary"></i> ${job.service_time || '-'}</p></div>
    </div>
    <div class="mt-3 pt-3" style="border-top:1px solid #e2e8f0;">
      <p class="mb-1" style="color:var(--text-muted);">ช่างเทคนิคที่รับผิดชอบ</p>
      <p>${job.technician_id || '<span class="text-amber"><i class="fa-solid fa-triangle-exclamation"></i> ยังไม่จับคู่ช่าง</span>'}</p>
    </div>
  `;
  document.getElementById('saveModalBtnJob').style.display = 'none';
  openJobModal();
};

window.editJob = function(id) {
  const job = allJobs.find(j => j.id == id);
  if(!job) return;
  currentEditJobId = id;
  document.getElementById('modalTitleJob').innerText = window.t ? window.t("อัปเดตงาน & จัดสรรช่าง") : "อัปเดตงาน & จัดสรรช่าง";
  
  document.getElementById('modalBodyJob').innerHTML = `
    <div class="form-group">
      <label>ช่างเทคนิคที่รับผิดชอบ (Tech ID)</label>
      <input type="text" id="editJobTechId" class="form-control" value="${job.technician_id || ''}" placeholder="ใส่รหัส TECH-xxx หรือเว้นว่าง">
      <small style="color:#64748b; font-size:12px;">*กรอกไอดีของช่างลงพื้นที่</small>
    </div>
    <div class="form-group mt-3">
      <label>สถานะงาน (Status)</label>
      <select id="editJobStatus" class="form-control">
         <option value="รอรับงาน" ${job.status==='รอรับงาน'?'selected':''}>รอรับงาน (Pending)</option>
         <option value="กำลังดำเนินการ" ${job.status==='กำลังดำเนินการ'?'selected':''}>กำลังดำเนินการ (In Progress)</option>
         <option value="เสร็จสิ้น" ${job.status==='เสร็จสิ้น'?'selected':''}>เสร็จสิ้น (Completed)</option>
         <option value="ยกเลิกแล้ว" ${job.status==='ยกเลิกแล้ว'?'selected':''}>ยกเลิกแล้ว (Cancelled)</option>
      </select>
    </div>
  `;
  const saveBtn = document.getElementById('saveModalBtnJob');
  saveBtn.style.display = 'block';
  saveBtn.onclick = () => saveJobData();
  openJobModal();
};

window.openJobModal = function() {
  const overlay = document.getElementById('jobModalOverlay');
  overlay.style.display = 'flex';
  setTimeout(() => overlay.classList.add('active'), 10);
  if(window.applyTranslations) window.applyTranslations(overlay);
};

window.closeJobModal = function(e) {
  if (e && e.target !== e.currentTarget) return;
  const overlay = document.getElementById('jobModalOverlay');
  overlay.classList.remove('active');
  setTimeout(() => overlay.style.display = 'none', 300);
};

window.saveJobData = async function() {
  if(!currentEditJobId) return;
  const saveBtn = document.getElementById('saveModalBtnJob');
  const oldText = saveBtn.innerText;
  saveBtn.innerText = "กำลังบันทึก...";
  saveBtn.disabled = true;

  let newTechId = document.getElementById('editJobTechId').value.trim();
  if(newTechId === '') newTechId = null;
  const newStatus = document.getElementById('editJobStatus').value;
  
  try {
     const { error } = await supabaseClient
       .from('bookings')
       .update({ technician_id: newTechId, status: newStatus })
       .eq('id', currentEditJobId);
       
     if(error) throw error;
     if(typeof showToast === 'function') showToast("อัปเดตข้อมูลสำเร็จ", "บันทึกออเดอร์งานเรียบร้อยแล้ว");
     closeJobModal();
     if(typeof loadRealJobs === 'function') loadRealJobs();
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
