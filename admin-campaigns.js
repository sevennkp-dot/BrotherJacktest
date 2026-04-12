/**
 * admin-campaigns.js
 * Logic for managing discount codes and campaigns via Admin Dashboard
 */

const SUPABASE_URL = "https://uqcjajmqtlchftpqwsrp.supabase.co";
const SUPABASE_KEY = "sb_publishable_yWZiH8l1idY0QWGuj6p9sg_GqXPONGX";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser = null;
let allCampaigns = [];
let currentEditCampId = null;

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
      const filtered = allCampaigns.filter(c => 
        (c.name && c.name.toLowerCase().includes(term)) || 
        (c.code && c.code.toLowerCase().includes(term))
      );
      renderCampaignsTable(filtered);
    });
  }
}

function showToast(title, message, isError = false) {
  const container = document.getElementById('toastContainer');
  if (!container) return;
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
    if (!session) return window.location.href = "login.html";

    const { data: profile, error } = await supabaseClient.from("profiles").select("role").eq("id", session.user.id).maybeSingle();

    if (error || !profile || profile.role !== "admin") {
      showToast("สิทธิ์ไม่เพียงพอ", "ระบบต้องการสิทธิ์แอดมิน", true);
    } else {
      currentUser = session.user;
      loadCampaigns();
    }
  } catch (err) {
    console.error(err);
    showToast("System Error", err.message, true);
  }
}

async function logout() {
  await supabaseClient.auth.signOut();
  window.location.href = "login.html";
}

async function loadCampaigns() {
  try {
    const { data, error } = await supabaseClient
      .from('campaigns')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
       // Table might not exist yet
       throw error;
    }
    
    allCampaigns = data || [];
    renderCampaignsTable(allCampaigns);
  } catch(e) {
    console.error(e);
    const tbody = document.getElementById('campaignsTableBody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="text-center py-5 text-rose">ไม่สามารถดึงข้อมูลแคมเปญได้: ${e.message} (เช็กตาราง Database)</td></tr>`;
  }
}

function renderCampaignsTable(campaigns) {
  const tbody = document.getElementById('campaignsTableBody');
  const countSpan = document.getElementById('totalCampaignsCount');
  
  if (countSpan) countSpan.innerText = campaigns.length.toLocaleString();
  if (!tbody) return;

  if (campaigns.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-5 text-muted">ไม่พบข้อมูลแคมเปญในระบบ</td></tr>`;
    return;
  }

  tbody.innerHTML = campaigns.map(camp => {
    // Determine Status
    let statusBadge = '';
    const now = new Date();
    const end = camp.end_date ? new Date(camp.end_date) : null;
    let isActive = camp.status === 'active';
    
    if (camp.status === 'inactive') {
      statusBadge = `<span class="badge-status" style="background:#f1f5f9; color:#64748b;">ปิดใช้งาน</span>`;
    } else if (end && now > end) {
      statusBadge = `<span class="badge-status" style="background:#fef2f2; color:#ef4444;">หมดอายุแล้ว</span>`;
    } else if (camp.usage_limit && camp.usage_count >= camp.usage_limit) {
      statusBadge = `<span class="badge-status" style="background:#fffbeb; color:#d97706;">สิทธิ์เต็ม</span>`;
    } else {
      statusBadge = `<span class="badge-status positive">ใช้งานได้</span>`;
    }

    // Format Dates
    let dateStr = 'ไม่ระบุวันหมดอายุ';
    if (camp.start_date || camp.end_date) {
        const dS = camp.start_date ? new Date(camp.start_date).toLocaleDateString('th-TH', { month: 'short', day: 'numeric'}) : '?';
        const dE = camp.end_date ? new Date(camp.end_date).toLocaleDateString('th-TH', { year: '2-digit', month: 'short', day: 'numeric'}) : '?';
        dateStr = `${dS} - ${dE}`;
    }
    
    // Format Discount
    let discountStr = camp.discount_type === 'percentage' 
      ? `${camp.discount_value}%` 
      : `฿${Number(camp.discount_value).toLocaleString()}`;
      
    let minSpendStr = camp.min_spend > 0 ? `ขั้นต่ำ ฿${Number(camp.min_spend).toLocaleString()}` : "ไม่มีขั้นต่ำ";

    // Format Usage
    let usageStr = camp.usage_limit 
      ? `ใช้แล้ว ${camp.usage_count}/${camp.usage_limit}` 
      : `${camp.usage_count} ครั้ง (ไม่จำกัด)`;

    return `
      <tr>
        <td>${statusBadge}</td>
        <td>
          <div class="font-weight-bold" style="color:var(--text-main); font-size:15px">${camp.name}</div>
          <div class="font-monospace mt-1 px-2 py-1" style="background:#f1f5f9; display:inline-block; border-radius:4px; font-size:13px; font-weight:600; color:var(--primary);">${camp.code}</div>
        </td>
        <td>
          <div class="font-weight-bold text-success">${discountStr}</div>
          <div class="text-sm text-muted mt-1">${minSpendStr}</div>
        </td>
        <td class="text-muted"><i class="fa-regular fa-calendar mr-1"></i> ${dateStr}</td>
        <td><i class="fa-solid fa-ticket text-muted mr-1"></i> ${usageStr}</td>
        <td>
          <div class="action-buttons">
            <button class="action-btn edit" title="แก้ไข" onclick="editCampaign('${camp.id}')"><i class="fa-solid fa-pen"></i></button>
            <button class="action-btn" title="ลบ" style="color:#e11d48;" onclick="deleteCampaign('${camp.id}')"><i class="fa-solid fa-trash"></i></button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// === MODAL LOGIC ===
window.openCampaignModal = function() {
  currentEditCampId = null;
  document.getElementById('modalTitleCamp').innerText = "สร้างแคมเปญส่วนลด";
  
  // Reset fields
  document.getElementById('cName').value = '';
  document.getElementById('cCode').value = '';
  document.getElementById('cType').value = 'fixed';
  document.getElementById('cValue').value = '';
  document.getElementById('cMinSpend').value = '0';
  document.getElementById('cStart').value = '';
  document.getElementById('cEnd').value = '';
  document.getElementById('cLimit').value = '';
  document.getElementById('cStatus').value = 'active';

  const saveBtn = document.getElementById('saveModalBtnCamp');
  saveBtn.onclick = () => saveCampaignData();
  
  const overlay = document.getElementById('campaignModalOverlay');
  overlay.style.display = 'flex';
  setTimeout(() => overlay.classList.add('active'), 10);
};

window.editCampaign = function(id) {
  const camp = allCampaigns.find(c => c.id == id);
  if (!camp) return;
  currentEditCampId = id;
  
  document.getElementById('modalTitleCamp').innerText = "แก้ไขแคมเปญ";
  
  document.getElementById('cName').value = camp.name || '';
  document.getElementById('cCode').value = camp.code || '';
  document.getElementById('cType').value = camp.discount_type || 'fixed';
  document.getElementById('cValue').value = camp.discount_value || '';
  document.getElementById('cMinSpend').value = camp.min_spend || '0';
  document.getElementById('cStatus').value = camp.status || 'active';
  
  if (camp.start_date) document.getElementById('cStart').value = camp.start_date.split('T')[0];
  else document.getElementById('cStart').value = '';
  
  if (camp.end_date) document.getElementById('cEnd').value = camp.end_date.split('T')[0];
  else document.getElementById('cEnd').value = '';
  
  if (camp.usage_limit) document.getElementById('cLimit').value = camp.usage_limit;
  else document.getElementById('cLimit').value = '';

  const saveBtn = document.getElementById('saveModalBtnCamp');
  saveBtn.onclick = () => saveCampaignData();
  
  const overlay = document.getElementById('campaignModalOverlay');
  overlay.style.display = 'flex';
  setTimeout(() => overlay.classList.add('active'), 10);
};

window.closeCampaignModal = function(e) {
  if (e && e.target !== e.currentTarget) return;
  const overlay = document.getElementById('campaignModalOverlay');
  overlay.classList.remove('active');
  setTimeout(() => overlay.style.display = 'none', 300);
};

window.saveCampaignData = async function() {
  const name = document.getElementById('cName').value.trim();
  const code = document.getElementById('cCode').value.trim().toUpperCase();
  const discount_type = document.getElementById('cType').value;
  const discount_value = document.getElementById('cValue').value;
  const min_spend = document.getElementById('cMinSpend').value || 0;
  const start_date = document.getElementById('cStart').value || null;
  const end_date = document.getElementById('cEnd').value || null;
  const usage_limit = document.getElementById('cLimit').value || null;
  const status = document.getElementById('cStatus').value;

  if (!name || !code || !discount_value) {
    showToast("ข้อมูลไม่ครบ", "กรุณากรอกชื่อแคมเปญ, โค้ด และมูลค่าส่วนลด", true);
    return;
  }

  const payload = {
    name, code, discount_type, discount_value, min_spend,
    start_date: start_date ? start_date + 'T00:00:00Z' : null,
    end_date: end_date ? end_date + 'T23:59:59Z' : null,
    usage_limit, status
  };

  const saveBtn = document.getElementById('saveModalBtnCamp');
  const oldText = saveBtn.innerText;
  saveBtn.innerText = "กำลังบันทึก...";
  saveBtn.disabled = true;

  try {
    if (currentEditCampId) {
      const { error } = await supabaseClient.from('campaigns').update(payload).eq('id', currentEditCampId);
      if(error) throw error;
      showToast("สำเร็จ", "แก้ไขแคมเปญเรียบร้อยแล้ว");
    } else {
      const { error } = await supabaseClient.from('campaigns').insert([payload]);
      if(error) throw error;
      showToast("สำเร็จ", "สร้างแคมเปญใหม่เรียบร้อยแล้ว");
    }
    closeCampaignModal();
    loadCampaigns();
  } catch(err) {
    if (err.code === '23505') {
       showToast("Error", "โค้ดส่วนลดนี้ซ้ำกับในระบบ กรุณาใช้คำอื่น", true);
    } else {
       showToast("Error", err.message, true);
    }
  } finally {
    saveBtn.innerText = oldText;
    saveBtn.disabled = false;
  }
};

window.deleteCampaign = async function(id) {
  if (!confirm("คุณแน่ใจหรือไม่ว่าต้องการลบแคมเปญนี้อย่างถาวร?")) return;
  try {
    const { error } = await supabaseClient.from('campaigns').delete().eq('id', id);
    if(error) throw error;
    showToast("สำเร็จ", "ลบแคมเปญเรียบร้อยแล้ว");
    loadCampaigns();
  } catch(e) {
    showToast("Error", "ไม่สามารถลบข้อมูลได้: " + e.message, true);
  }
};

// Universal CSV Export
window.exportToCSV = function() {
    let filename = document.title.split('|')[0].trim().replace(/\s+/g, '_') + '.csv';
    let activeTable = document.querySelector('table');
    if(!activeTable) return;
    
    let csv = [];
    let rows = activeTable.querySelectorAll('tr');
    for (let i = 0; i < rows.length; i++) {
        let row = [], cols = rows[i].querySelectorAll('td, th');
        if(cols.length === 1 && cols[0].colSpan > 1) continue;
        
        let colCount = (i === 0) ? cols.length - 1 : cols.length; 
        if(cols[cols.length-1].innerText.trim() === '' || cols[cols.length-1].querySelector('.action-buttons')) colCount = cols.length - 1;

        for (let j = 0; j < colCount; j++) {
            let data = cols[j].innerText.trim().replace(/\r?\n|\r/g, ' ').replace(/"/g, '""');
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
};
