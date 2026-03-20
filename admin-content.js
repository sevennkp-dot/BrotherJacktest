
/**
 * admin-content.js
 * Manage Portfolio (our_work) and Partners (shops)
 */
const SUPABASE_URL = "https://uqcjajmqtlchftpqwsrp.supabase.co";
const SUPABASE_KEY = "sb_publishable_yWZiH8l1idY0QWGuj6p9sg_GqXPONGX";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser = null;
let currentTab = 'works'; // or 'shops'
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
  const tbodyId = currentTab === 'works' ? 'worksTableBody' : 'shopsTableBody';
  document.getElementById(tbodyId).innerHTML = `<tr><td colspan="5" class="text-center py-5"><i class="fa-solid fa-circle-notch fa-spin text-primary"></i> <p class="mt-2 text-muted">Loading...</p></td></tr>`;
  
  try {
    const tableName = currentTab === 'works' ? 'our_work' : 'shops';
    const { data, error } = await supabaseClient.from(tableName).select('*').order('created_at', { ascending: false }).limit(50);
    if(error) throw error;
    
    allItems = data || [];
    renderTable();
  } catch(e) {
    document.getElementById(tbodyId).innerHTML = `<tr><td colspan="5" class="text-center py-5 text-danger"><b>Error Loading ${currentTab}:</b><br>${e.message}</td></tr>`;
  }
}

function renderTable() {
  const tbodyId = currentTab === 'works' ? 'worksTableBody' : 'shopsTableBody';
  const tbody = document.getElementById(tbodyId);
  
  if (allItems.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center py-5 text-muted">ยังไม่มีข้อมูลในระบบ หรือรอรับโครงสร้างตาราง</td></tr>`;
    return;
  }

  if(currentTab === 'works') {
    tbody.innerHTML = allItems.map(item => {
      let img = item.image_url || 'https://ui-avatars.com/api/?name=W&background=e2e8f0';
      
      return `<tr>
        <td><img src="${img}" style="width:60px; height:60px; object-fit:cover; border-radius:8px;"></td>
        <td class="font-weight-bold">${item.title || item.project_name || '-'}</td>
        <td><span class="badge-status in-progress">${item.category || '-'}</span></td>
        <td class="text-muted"><i class="fa-regular fa-calendar"></i> ${item.completion_date ? new Date(item.completion_date).toLocaleDateString('th-TH') : '-'}</td>
        <td>
          <div class="action-buttons">
            <button class="action-btn edit" onclick="editItem('${item.id}')"><i class="fa-solid fa-pen"></i></button>
            <button class="action-btn" onclick="deleteItem('${item.id}')" style="color:#e11d48;"><i class="fa-solid fa-trash"></i></button>
          </div>
        </td>
      </tr>`;
    }).join('');
  } else {
    tbody.innerHTML = allItems.map(item => {
      let img = item.image_url || item.logo_url || 'https://ui-avatars.com/api/?name=S&background=e2e8f0';
      return `<tr>
        <td><img src="${img}" style="width:60px; height:60px; object-fit:contain; border-radius:8px; background:#fff; padding:2px; border:1px solid #e2e8f0;"></td>
        <td class="font-weight-bold">${item.shop_name || item.name || '-'}</td>
        <td class="text-muted"><i class="fa-solid fa-location-dot"></i> ${item.location || '-'}</td>
        <td class="text-muted">${item.category || '-'} | ${item.contact_info || item.phone || '-'}</td>
        <td>
          <div class="action-buttons">
            <button class="action-btn edit" onclick="editItem('${item.id}')"><i class="fa-solid fa-pen"></i></button>
            <button class="action-btn" onclick="deleteItem('${item.id}')" style="color:#e11d48;"><i class="fa-solid fa-trash"></i></button>
          </div>
        </td>
      </tr>`;
    }).join('');
  }
}

window.openAddModal = function() {
    currentEditId = null;
    const isWork = currentTab === 'works';
    document.getElementById('modalTitleItem').innerText = isWork ? "เพิ่มผลงานของเรา" : "เพิ่มร้านค้าพันธมิตร";
    
    let html = '';
    if (isWork) {
        html = `
        <div class="form-group mb-3"><label>ชื่อผลงาน / โครงการ (Title)</label><input type="text" id="wTitle" class="form-control" placeholder="..."></div>
        <div class="form-group row mb-3">
            <div class="col-6"><label>หมวดหมู่ (Category)</label><input type="text" id="wCat" class="form-control" placeholder="เช่น สร้างบ้าน, รีโนเวท"></div>
            <div class="col-6"><label>วันที่แล้วเสร็จ</label><input type="date" id="wDate" class="form-control"></div>
        </div>
        <div class="form-group mb-3"><label>ลิงก์รูปภาพผลงาน (Image URL)</label><input type="text" id="wImg" class="form-control"></div>
        <div class="form-group mb-3"><label>รายละเอียดผลงาน (Description)</label><textarea id="wDesc" class="form-control" rows="3"></textarea></div>`;
    } else {
        html = `
        <div class="form-group mb-3"><label>ชื่อร้านค้า (Shop Name)</label><input type="text" id="sName" class="form-control"></div>
        <div class="form-group row mb-3">
            <div class="col-6"><label>หมวดหมู่สินค้า (Category)</label><input type="text" id="sCat" class="form-control"></div>
            <div class="col-6"><label>เบอร์ติดต่อ (Contact)</label><input type="text" id="sContact" class="form-control"></div>
        </div>
        <div class="form-group mb-3"><label>ที่ตั้ง (Location)</label><input type="text" id="sLoc" class="form-control"></div>
        <div class="form-group mb-3"><label>เว็บไซต์ / แผนที่ (Link URL)</label><input type="text" id="sLink" class="form-control"></div>
        <div class="form-group mb-3"><label>ลิงก์โลโก้ร้าน (Logo Image URL)</label><input type="text" id="sImg" class="form-control"></div>`;
    }

    document.getElementById('modalBodyItem').innerHTML = html;
    
    const saveBtn = document.getElementById('saveItemBtn');
    saveBtn.onclick = () => saveItemData();
    
    const m = document.getElementById('itemModalOverlay');
    m.style.display = 'flex';
    setTimeout(() => m.classList.add('active'), 10);
};

window.editItem = function(id) {
    const item = allItems.find(x => x.id == id);
    if (!item) return;
    currentEditId = id;
    const isWork = currentTab === 'works';
    document.getElementById('modalTitleItem').innerText = isWork ? "แก้ไขข้อมูลผลงาน" : "แก้ไขข้อมูลร้านค้า";
    
    let html = '';
    if (isWork) {
        html = `
        <div class="form-group mb-3"><label>ชื่อผลงาน (Title)</label><input type="text" id="wTitle" class="form-control" value="${item.title || item.project_name || ''}"></div>
        <div class="form-group row mb-3">
            <div class="col-6"><label>หมวดหมู่</label><input type="text" id="wCat" class="form-control" value="${item.category || ''}"></div>
            <div class="col-6"><label>วันที่แล้วเสร็จ</label><input type="date" id="wDate" class="form-control" value="${item.completion_date ? item.completion_date.split('T')[0] : ''}"></div>
        </div>
        <div class="form-group mb-3"><label>Image URL</label><input type="text" id="wImg" class="form-control" value="${item.image_url || ''}"></div>
        <div class="form-group mb-3"><label>Description</label><textarea id="wDesc" class="form-control" rows="3">${item.description || ''}</textarea></div>`;
    } else {
        html = `
        <div class="form-group mb-3"><label>ชื่อร้านค้า</label><input type="text" id="sName" class="form-control" value="${item.shop_name || item.name || ''}"></div>
        <div class="form-group row mb-3">
            <div class="col-6"><label>หมวดหมู่สินค้า</label><input type="text" id="sCat" class="form-control" value="${item.category || ''}"></div>
            <div class="col-6"><label>เบอร์ติดต่อ</label><input type="text" id="sContact" class="form-control" value="${item.contact_info || item.phone || ''}"></div>
        </div>
        <div class="form-group mb-3"><label>ที่ตั้ง</label><input type="text" id="sLoc" class="form-control" value="${item.location || ''}"></div>
        <div class="form-group mb-3"><label>เว็บไซต์ / แผนที่</label><input type="text" id="sLink" class="form-control" value="${item.link || item.website || ''}"></div>
        <div class="form-group mb-3"><label>Logo Image URL</label><input type="text" id="sImg" class="form-control" value="${item.image_url || item.logo_url || ''}"></div>`;
    }

    document.getElementById('modalBodyItem').innerHTML = html;
    
    const saveBtn = document.getElementById('saveItemBtn');
    saveBtn.onclick = () => saveItemData();
    
    const m = document.getElementById('itemModalOverlay');
    m.style.display = 'flex';
    setTimeout(() => m.classList.add('active'), 10);
};

window.saveItemData = async function() {
    const isWork = currentTab === 'works';
    const tableName = isWork ? 'our_work' : 'shops';
    
    let payload = {};
    if (isWork) {
        payload = {
            title: document.getElementById('wTitle').value,
            category: document.getElementById('wCat').value,
            completion_date: document.getElementById('wDate').value || null,
            image_url: document.getElementById('wImg').value,
            description: document.getElementById('wDesc').value
        };
    } else {
        payload = {
            shop_name: document.getElementById('sName').value,
            category: document.getElementById('sCat').value,
            contact_info: document.getElementById('sContact').value,
            location: document.getElementById('sLoc').value,
            link: document.getElementById('sLink').value,
            image_url: document.getElementById('sImg').value
        };
    }

    const saveBtn = document.getElementById('saveItemBtn');
    const oldText = saveBtn.innerText;
    saveBtn.innerText = "กำลังบันทึก..."; saveBtn.disabled = true;

    try {
        if (currentEditId) {
            const { error } = await supabaseClient.from(tableName).update(payload).eq('id', currentEditId);
            if(error) throw error;
        } else {
            const { error } = await supabaseClient.from(tableName).insert([payload]);
            if(error) throw error;
        }
        showToast("บันทึกข้อมูลเรียบร้อย", "จัดเก็บลงระบบเรียบร้อยแล้ว");
        closeItemModal();
        loadData();
    } catch(err) {
        showToast("Error", "ข้อมูลไม่ตรงกับคอลัมน์ในฐานข้อมูล (โปรดปรับแก้): " + err.message, true);
    } finally {
        saveBtn.innerText = oldText; saveBtn.disabled = false;
    }
}

window.deleteItem = async function(id) {
    if(!confirm("ต้องการลบรายการนี้ออกจากฐานข้อมูล?")) return;
    try {
        const tableName = currentTab === 'works' ? 'our_work' : 'shops';
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
