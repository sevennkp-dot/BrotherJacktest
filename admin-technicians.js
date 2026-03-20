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
  document.getElementById('modalTitle').innerText = window.t ? window.t("ข้อมูลช่างเทคนิค") : "ข้อมูลช่างเทคนิค";
  let avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(tech.name || 'Tech')}&background=e0e7ff&color=4f46e5`;
  if (tech.technician_images && tech.technician_images.length > 0) {
    avatarUrl = tech.technician_images[0].image_url;
  }
  document.getElementById('modalBody').innerHTML = `
    <div class="text-center">
      <img src="${avatarUrl}" class="avatar-preview" style="object-fit:cover;">
      <h4>${tech.name}</h4>
      <p class="text-muted">${tech.category || '-'} | ${tech.area || '-'}</p>
    </div>
    <div class="mt-4 p-3 rounded" style="background: rgba(255,255,255,0.7); border:1px solid rgba(0,0,0,0.05);">
      <p class="mb-2"><strong><i class="fa-solid fa-hashtag text-indigo"></i> ID:</strong> TECH-${String(tech.id).substring(0,8)}</p>
      <p class="mb-2"><strong><i class="fa-solid fa-star text-amber"></i> Rating:</strong> ${tech.rating || 'ยังไม่มีคะแนน'}</p>
      <p class="mb-0"><strong><i class="fa-regular fa-calendar-plus text-primary"></i> Joined:</strong> ${tech.created_at ? new Date(tech.created_at).toLocaleDateString('th-TH') : '-'}</p>
    </div>
  `;
  document.getElementById('saveModalBtn').style.display = 'none';
  openTechModal();
};

window.editTech = function(id) {
  const tech = allTechs.find(t => t.id == id);
  if(!tech) return;
  currentEditingId = id;
  document.getElementById('modalTitle').innerText = window.t ? window.t("แก้ไขข้อมูลช่าง") : "แก้ไขข้อมูลช่าง";
  document.getElementById('modalBody').innerHTML = `
    <div class="form-group">
      <label>ชื่อ-นามสกุล (Name)</label>
      <input type="text" id="editName" class="form-control" value="${tech.name}" placeholder="ระบุชื่อช่าง...">
    </div>
    <div class="form-group">
      <label>หมวดหมู่ (Category)</label>
      <input type="text" id="editCategory" class="form-control" value="${tech.category || ''}">
    </div>
    <div class="form-group">
      <label>พื้นที่ให้บริการ (Area)</label>
      <input type="text" id="editArea" class="form-control" value="${tech.area || ''}">
    </div>
    <div class="form-group">
      <label>คะแนน (Rating)</label>
      <input type="number" id="editRating" class="form-control" step="0.1" max="5" min="0" value="${tech.rating || ''}">
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
  saveBtn.innerText = window.t ? window.t("กำลังบันทึก...") : "กำลังบันทึก...";
  saveBtn.disabled = true;

  const newName = document.getElementById('editName').value;
  const newCat = document.getElementById('editCategory').value;
  const newArea = document.getElementById('editArea').value;
  const newRatingRaw = parseFloat(document.getElementById('editRating').value);
  const newRating = isNaN(newRatingRaw) ? null : newRatingRaw;
  
  try {
     const { error } = await supabaseClient
       .from('technicians')
       .update({ name: newName, category: newCat, area: newArea, rating: newRating })
       .eq('id', currentEditingId);
       
     if(error) throw error;
     if(typeof showToast === 'function') showToast("อัปเดตข้อมูลสำเร็จ", "บันทึกข้อมูลแล้ว");
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
