
/**
 * admin-requests.js
 * Manage customer build orders ('orders') and property inquiries ('interests')
 */
const SUPABASE_URL = "https://uqcjajmqtlchftpqwsrp.supabase.co";
const SUPABASE_KEY = "sb_publishable_yWZiH8l1idY0QWGuj6p9sg_GqXPONGX";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser = null;
let currentTab = 'orders';
let allItems = [];
let currentEditId = null;

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

  document.getElementById('menuToggle')?.addEventListener('click', toggleSidebar);
  document.getElementById('menuClose')?.addEventListener('click', toggleSidebar);
  overlay.addEventListener('click', toggleSidebar);
}

function showToast(title, message, isError = false) {
  const container = document.getElementById('toastContainer');
  if(!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = isError 
    ? `<i class="fa-solid fa-circle-xmark" style="color: var(--rose);"></i><div class="toast-body"><h4>${title}</h4><p>${message}</p></div>`
    : `<i class="fa-solid fa-bell" style="color: var(--primary);"></i><div class="toast-body"><h4>${title}</h4><p>${message}</p></div>`;
  if(isError) toast.style.borderLeftColor = 'var(--rose)';
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

    const { data: profile } = await supabaseClient.from("profiles").select("role").eq("id", session.user.id).maybeSingle();
    if (!profile || profile.role !== "admin") showToast("สิทธิ์ไม่เพียงพอ", "รับชมโครงสร้าง UI จำลอง");
    
    // Auto-refresh generic fallback
    supabaseClient.channel('admin-req-live').on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => { loadData(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'interests' }, () => { loadData(); }).subscribe();

    loadData();
  } catch (err) { console.error(err); }
}

async function logout() {
  await supabaseClient.auth.signOut();
  window.location.href = "login.html";
}

window.switchTab = function(tabName) {
  currentTab = tabName;
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
  event.currentTarget.classList.add('active');
  document.getElementById(`tab-${tabName}`).classList.add('active');
  loadData();
};

async function loadData() {
  const tbodyId = currentTab === 'orders' ? 'ordersTableBody' : 'interestsTableBody';
  document.getElementById(tbodyId).innerHTML = `<tr><td colspan="6" class="text-center py-5"><i class="fa-solid fa-circle-notch fa-spin text-primary"></i> <p class="mt-2 text-muted">Loading...</p></td></tr>`;
  
  try {
    const tableName = currentTab === 'orders' ? 'orders' : 'interests';
    const { data, error } = await supabaseClient.from(tableName).select('*').order('created_at', { ascending: false }).limit(50);
    if(error) throw error;
    
    // We expect an array. Even if empty, it's fine.
    allItems = data || [];
    renderTable();
  } catch(e) {
    document.getElementById(tbodyId).innerHTML = `<tr><td colspan="6" class="text-center py-5 text-danger"><b>ตารางยังไม่สมบูรณ์ หรือ ไม่มีสิทธิ์เข้าถึง (RLS)</b><br>โปรดตรวจสอบตาราง ${currentTab === 'orders' ? 'orders' : 'interests'}<br><small>${e.message}</small></td></tr>`;
  }
}

function renderTable() {
  const tbodyId = currentTab === 'orders' ? 'ordersTableBody' : 'interestsTableBody';
  const tbody = document.getElementById(tbodyId);
  
  if (allItems.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-5 text-muted">ยังไม่มีข้อมูลในระบบ หรือรอรับโครงสร้างตาราง</td></tr>`;
    return;
  }

  if(currentTab === 'orders') {
    tbody.innerHTML = allItems.map(item => {
      let badgeStyle = item.status === 'เสร็จสิ้น' ? 'completed' : item.status === 'รอการอนุมัติ' || item.status === 'รอดำเนินการ' ? 'pending' : (item.status === 'ยกเลิก' || item.status === 'ยกเลิกแล้ว' ? 'rejected' : 'in-progress');
      return `<tr>
        <td class="font-weight-bold">#ORD-${item.id}</td>
        <td>
          <div class="user-row mt-0">
             <i class="fa-solid fa-user-circle text-muted" style="font-size:24px; margin-right:10px;"></i>
             <div><div class="font-weight-bold" style="white-space:nowrap;">${item.customer_name || item.name || '-'}</div><div class="text-sm text-muted">${item.customer_phone || item.phone || '-'}</div></div>
          </div>
        </td>
        <td class="text-indigo font-weight-bold">${item.house_model || item.model_name || item.title || '-'}</td>
        <td class="text-muted text-sm" style="max-width:150px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${item.location || item.address || item.details || '-'}</td>
        <td><span class="badge-status ${badgeStyle}">${item.status || 'รอดำเนินการ'}</span></td>
        <td>
          <div class="action-buttons">
            <button class="action-btn view" onclick="viewItem('${item.id}')"><i class="fa-solid fa-file-contract"></i></button>
            <button class="action-btn edit" onclick="editItemStatus('${item.id}')"><i class="fa-solid fa-pen"></i></button>
            <button class="action-btn" onclick="deleteItem('${item.id}')" style="color:#e11d48;"><i class="fa-solid fa-trash"></i></button>
          </div>
        </td>
      </tr>`;
    }).join('');
  } else {
    // INTERESTS
    tbody.innerHTML = allItems.map(item => {
      let badgeStyle = item.status === 'ปิดการขาย' ? 'completed' : item.status === 'รอดำเนินการ' || item.status === 'รอติดต่อกลับ' ? 'pending' : (item.status === 'ยกเลิก' || item.status === 'ยกเลิกแล้ว' ? 'rejected' : 'in-progress');
      return `<tr>
        <td>
          <div class="user-row mt-0">
             <i class="fa-solid fa-user-circle text-muted" style="font-size:24px; margin-right:10px;"></i>
             <div class="font-weight-bold" style="white-space:nowrap;">${item.customer_name || item.name || '-'}</div>
          </div>
        </td>
        <td class="text-indigo font-weight-bold">${item.property_title || item.property_name || '-'}</td>
        <td><span class="badge-status in-progress">${item.interest_type || item.type || '-'}</span></td>
        <td class="text-muted text-sm" style="white-space:nowrap;">${item.customer_phone || item.phone || item.email || '-'}</td>
        <td><span class="badge-status ${badgeStyle}">${item.status || 'รอติดต่อกลับ'}</span></td>
        <td>
          <div class="action-buttons">
            <button class="action-btn view" onclick="viewItem('${item.id}')"><i class="fa-solid fa-eye"></i></button>
            <button class="action-btn edit" onclick="editItemStatus('${item.id}')"><i class="fa-solid fa-pen"></i></button>
            <button class="action-btn" onclick="deleteItem('${item.id}')" style="color:#e11d48;"><i class="fa-solid fa-trash"></i></button>
          </div>
        </td>
      </tr>`;
    }).join('');
  }
}

window.viewItem = function(id) {
    const item = allItems.find(x => x.id == id);
    if(!item) return;
    const isOrder = currentTab === 'orders';
    document.getElementById('modalTitleItem').innerText = isOrder ? "รายละเอียดใบสั่งสร้างบ้าน (Order)" : "รายละเอียดคำขอเช่า/ซื้อ (Interest)";
    
    // Simple render of raw key-values for maximum flexibility if schema unknown
    let html = `<div class="p-3 bg-light rounded" style="max-height:400px; overflow-y:auto;">`;
    for(let key in item) {
       let val = item[key];
       if(val === null || val === '') val = '-';
       html += `<div style="margin-bottom:8px; border-bottom:1px solid #e2e8f0; padding-bottom:4px;">
                  <span class="text-muted" style="display:inline-block; width:140px;">${key}:</span> 
                  <strong style="word-break:break-all;">${val}</strong>
                </div>`;
    }
    html += `</div>`;
    
    document.getElementById('modalBodyItem').innerHTML = html;
    document.getElementById('saveItemBtn').style.display = 'none';
    
    const m = document.getElementById('itemModalOverlay');
    m.style.display = 'flex';
    setTimeout(() => m.classList.add('active'), 10);
};

window.editItemStatus = function(id) {
    const item = allItems.find(x => x.id == id);
    if (!item) return;
    currentEditId = id;
    const isOrder = currentTab === 'orders';
    document.getElementById('modalTitleItem').innerText = "อัปเดตสถานะคำขอ";
    
    let options = isOrder 
      ? `<option value="รอดำเนินการ">รอดำเนินการ (Pending)</option>
         <option value="กำลังดำเนินการ">กำลังดำเนินการ (Processing)</option>
         <option value="เสร็จสิ้น">เสร็จสิ้น (Completed)</option>
         <option value="ยกเลิก">ยกเลิก (Cancelled)</option>`
      : `<option value="รอติดต่อกลับ">รอติดต่อกลับ (Pending)</option>
         <option value="ติดต่อแล้ว">ติดต่อแล้ว (Contacted)</option>
         <option value="ปิดการขาย">ปิดดดีลเช่า/ซื้อ (Closed)</option>
         <option value="ยกเลิก">ยกเลิก (Cancelled)</option>`;

    document.getElementById('modalBodyItem').innerHTML = `
      <div class="form-group mb-4">
         <label>เลือกสถานะล่าสุด</label>
         <select id="updateStatusInput" class="form-control">${options}</select>
      </div>
      <p class="text-muted text-sm"><i class="fa-solid fa-circle-info"></i> แจ้งเตือน: ระบบจะนำไอดี ${id} ไปอัปเดตค่าความคืบหน้าในตาราง ${currentTab} ทันที</p>
    `;
    
    // Quick preselect
    setTimeout(() => {
       if(item.status) {
         let sel = document.getElementById('updateStatusInput');
         for(let i=0; i<sel.options.length; i++){
            if(sel.options[i].value === item.status) sel.selectedIndex = i;
         }
       }
    }, 10);
    
    const saveBtn = document.getElementById('saveItemBtn');
    saveBtn.style.display = 'block';
    saveBtn.onclick = () => saveItemStatus();
    
    const m = document.getElementById('itemModalOverlay');
    m.style.display = 'flex';
    setTimeout(() => m.classList.add('active'), 10);
};

window.saveItemStatus = async function() {
    if(!currentEditId) return;
    const tableName = currentTab === 'orders' ? 'orders' : 'interests';
    const newStatus = document.getElementById('updateStatusInput').value;
    
    const saveBtn = document.getElementById('saveItemBtn');
    const oldText = saveBtn.innerText;
    saveBtn.innerText = "กำลังอัปเดต..."; saveBtn.disabled = true;

    try {
        const { error } = await supabaseClient.from(tableName).update({ status: newStatus }).eq('id', currentEditId);
        if(error) throw error;
        showToast("สำเร็จ", "อัปเดตสถานะเรียบร้อยแล้ว");
        closeItemModal();
        loadData();
    } catch(err) {
        showToast("ล้มเหลว", "ไม่พบคอลัมน์ 'status' หรือ RLS ป้องกัน: " + err.message, true);
    } finally {
        saveBtn.innerText = oldText; saveBtn.disabled = false;
    }
}

window.deleteItem = async function(id) {
    if(!confirm("ต้องการลบคำขอนี้ออกจากฐานข้อมูล?")) return;
    try {
        const tableName = currentTab === 'orders' ? 'orders' : 'interests';
        const { error } = await supabaseClient.from(tableName).delete().eq('id', id);
        if(error) throw error;
        showToast("สำเร็จ", "รายการถูกลบแล้ว");
        loadData();
    } catch(e) { showToast("Error", e.message, true); }
}

window.closeItemModal = function(e) {
    if (e && e.target !== e.currentTarget) return;
    const m = document.getElementById('itemModalOverlay');
    m.classList.remove('active');
    setTimeout(() => m.style.display = 'none', 300);
}

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
