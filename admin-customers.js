/**
 * admin-customers.js
 * Logic for managing customers via Admin Dashboard
 */

const SUPABASE_URL = "https://uqcjajmqtlchftpqwsrp.supabase.co";
const SUPABASE_KEY = "sb_publishable_yWZiH8l1idY0QWGuj6p9sg_GqXPONGX";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser = null;
let isMockMode = false;
let allCustomers = [];

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
      const filtered = allCustomers.filter(c => 
        (c.name && c.name.toLowerCase().includes(term)) || 
        (c.id && c.id.toLowerCase().includes(term))
      );
      renderCustomersTable(filtered);
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

    await loadRealCustomers(); supabaseClient.channel('admin-customers-live').on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, payload => { loadRealCustomers(); }).subscribe();
  } catch (err) {
    console.error(err);
    enableMockMode("System Error: " + err.message);
  }
}

function enableMockMode(reason) {
  isMockMode = true;
  showToast("Preview Mode", reason + " - ข้อมูลจำลอง");
  renderMockCustomers();
}

async function logout() {
  if (!isMockMode) await supabaseClient.auth.signOut();
  window.location.href = "login.html";
}

async function loadRealCustomers() {
  try {
    // 1. Fetch all customer records
    const { data: custData, error: custErr } = await supabaseClient
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false });

    if (custErr) throw custErr;
    
    // 2. Fetch all profiles to determine roles
    const { data: profData, error: profErr } = await supabaseClient
      .from('profiles')
      .select('id, role');
      
    if (profErr) throw profErr;

    // 3. Map roles to customers
    const profilesMap = {};
    profData.forEach(p => { profilesMap[p.id] = p.role; });

    allCustomers = (custData || [])
      .map(c => ({
        ...c, 
        role: profilesMap[c.id] || 'customer'
      }))
      .filter(c => c.role !== 'admin'); // Hide admins from the customers page!

    renderCustomersTable(allCustomers);
  } catch(e) {
    console.error(e);
    showToast("Error", "ไม่สามารถดึงข้อมูลลูกค้าได้", true);
  }
}

function renderMockCustomers() {
  allCustomers = [
    { id: "uid-8273", name: "สมชาย ใจดี", role: "customer", phone: "089-123-4567", email: "somchai@email.com", created_at: "2026-03-01T10:00:00Z" },
    { id: "uid-8274", name: "วิภา สุขสม", role: "customer", phone: "081-987-6543", email: "wipaa@email.com", created_at: "2026-03-05T14:30:00Z" },
    { id: "uid-8275", name: "กรณ์ เรืองกิตติ์", role: "technician", phone: "082-222-3333", email: "korn.tech@email.com", created_at: "2026-03-10T09:15:00Z" }
  ];
  renderCustomersTable(allCustomers);
}

function maskEmail(email) {
  if (!email || email === '-') return '-';
  return email; // Unmasked as requested
}

function maskPhone(phone) {
  if (!phone || phone === '-') return '-';
  return phone; // Unmasked as requested
}

function renderCustomersTable(customers) {
  const tbody = document.getElementById('customersTableBody');
  const countSpan = document.getElementById('totalCustomersCount');
  
  if (countSpan) countSpan.innerText = customers.length.toLocaleString();

  if (!tbody) return;

  if (customers.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-5 text-muted">ไม่พบข้อมูลลูกค้า</td></tr>`;
    return;
  }

  tbody.innerHTML = customers.map(user => {
    let dateStr = "-";
    if (user.created_at) {
        const d = new Date(user.created_at);
        dateStr = isNaN(d) ? user.created_at : d.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
    }

    const shortId = user.id ? user.id.substring(0, 8) + '...' : '-';
    
    let roleBadge = `<span class="badge-status pending">Customer</span>`;
    if (user.role === 'technician') roleBadge = `<span class="badge-status in-progress">Technician</span>`;

    return `
      <tr>
        <td class="text-muted text-sm font-monospace">${shortId}</td>
        <td>
          <div class="user-row">
            <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=f1f5f9&color=475569" alt="User">
            <span class="font-weight-bold">${user.name || 'ผู้ใช้ไม่ระบุชื่อ'}</span>
          </div>
        </td>
        <td>
          <div style="font-size:13px"><i class="fa-solid fa-phone text-muted mr-1"></i> ${maskPhone(user.phone)}</div>
          <div style="font-size:13px; margin-top:4px"><i class="fa-regular fa-envelope text-muted mr-1"></i> ${maskEmail(user.email)}</div>
        </td>
        <td>${roleBadge}</td>
        <td class="text-muted">${dateStr}</td>
        <td>
          <div class="action-buttons">
            <button class="action-btn view" title="ดูโปรไฟล์" onclick="viewCustomer('${user.id}')"><i class="fa-solid fa-user"></i></button>
            <button class="action-btn edit" title="แก้ไข" onclick="editCustomer('${user.id}')"><i class="fa-solid fa-gear"></i></button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}


// === CUSTOMER MODAL LOGIC ===
let currentEditCustId = null;

window.viewCustomer = function(id) {
  const cust = allCustomers.find(c => c.id == id);
  if(!cust) return;
  document.getElementById('modalTitleCust').innerText = window.t ? window.t("ข้อมูลผู้ใช้งาน") : "ข้อมูลผู้ใช้งาน";
  
  const roleText = cust.role === 'technician' ? 'ช่างเทคนิค' : cust.role === 'admin' ? 'แอดมิน' : 'ลูกค้าทั่วไป';
  
  document.getElementById('modalBodyCust').innerHTML = `
    <div class="text-center">
      <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(cust.name || 'User')}&background=f1f5f9&color=475569" class="avatar-preview">
      <h4>${cust.name || 'ไม่ระบุชื่อ'}</h4>
      <p class="text-muted">${maskEmail(cust.email)} | ${maskPhone(cust.phone)}</p>
    </div>
    <div class="mt-4 p-3 rounded" style="background: rgba(255,255,255,0.7); border:1px solid rgba(0,0,0,0.05);">
      <p class="mb-2"><strong><i class="fa-solid fa-hashtag text-indigo"></i> ID:</strong> ${cust.id.substring(0,8)}...</p>
      <p class="mb-2"><strong><i class="fa-solid fa-shield-halved text-amber"></i> บทบาท:</strong> ${roleText}</p>
      <p class="mb-0"><strong><i class="fa-regular fa-calendar-plus text-primary"></i> วันที่สมัคร:</strong> ${cust.created_at ? new Date(cust.created_at).toLocaleDateString('th-TH') : '-'}</p>
    </div>`;
  document.getElementById('saveModalBtnCust').style.display = 'none';
  openCustomerModal();
};

window.editCustomer = function(id) {
  const cust = allCustomers.find(c => c.id == id);
  if(!cust) return;
  currentEditCustId = id;
  document.getElementById('modalTitleCust').innerText = window.t ? window.t("แก้ไขข้อมูลผู้ใช้") : "แก้ไขข้อมูลผู้ใช้";
  
  document.getElementById('modalBodyCust').innerHTML = `
    <div class="form-group">
      <label>ชื่อ-นามสกุล (Name)</label>
      <input type="text" id="editCustName" class="form-control" value="${cust.name || ''}" placeholder="ระบุชื่อ...">
    </div>
    <div class="form-group">
      <label>อีเมล (Email)</label>
      <input type="email" id="editCustEmail" class="form-control" value="${cust.email || ''}" readonly style="background:#f1f5f9; cursor:not-allowed;">
      <small style="color:#64748b;">*ไม่สามารถเปลี่ยนอีเมลได้จากหน้านี้</small>
    </div>
    <div class="form-group">
      <label>เบอร์โทรศัพท์ (Phone)</label>
      <input type="text" id="editCustPhone" class="form-control" value="${cust.phone || ''}">
    </div>
    <div class="form-group">
      <label>บทบาท (Role)</label>
      <select id="editCustRole" class="form-control">
         <option value="customer" ${cust.role==='customer'?'selected':''}>ลูกค้าทั่วไป (Customer)</option>
         <option value="technician" ${cust.role==='technician'?'selected':''}>ช่างเทคนิค (Technician)</option>
         <option value="admin" ${cust.role==='admin'?'selected':''}>แอดมิน (Admin)</option>
      </select>
    </div>`;
  const saveBtn = document.getElementById('saveModalBtnCust');
  saveBtn.style.display = 'block';
  saveBtn.onclick = () => saveCustomerData();
  openCustomerModal();
};

window.openCustomerModal = function() {
  const overlay = document.getElementById('customerModalOverlay');
  overlay.style.display = 'flex';
  setTimeout(() => overlay.classList.add('active'), 10);
  if(window.applyTranslations) window.applyTranslations(overlay);
};

window.closeCustomerModal = function(e) {
  if (e && e.target !== e.currentTarget) return;
  const overlay = document.getElementById('customerModalOverlay');
  overlay.classList.remove('active');
  setTimeout(() => overlay.style.display = 'none', 300);
};

window.saveCustomerData = async function() {
  if(!currentEditCustId) return;
  const saveBtn = document.getElementById('saveModalBtnCust');
  const oldText = saveBtn.innerText;
  saveBtn.innerText = "กำลังบันทึก...";
  saveBtn.disabled = true;

  const newName = document.getElementById('editCustName').value;
  const newPhone = document.getElementById('editCustPhone').value;
  const newRole = document.getElementById('editCustRole').value;
  
  try {
     const { error } = await supabaseClient
       .from('customers')
       .update({ name: newName, phone: newPhone })
       .eq('id', currentEditCustId);
       
     // Also try updating the role in the profiles table if they exist
     await supabaseClient
       .from('profiles')
       .update({ role: newRole })
       .eq('id', currentEditCustId);
       
     if(error) throw error;
     if(typeof showToast === 'function') showToast("อัปเดตข้อมูลสำเร็จ", "บันทึกแก้ไขข้อมูลผู้ใช้แล้ว");
     closeCustomerModal();
     if(typeof loadRealCustomers === 'function') loadRealCustomers();
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
