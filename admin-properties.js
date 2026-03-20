/**
 * admin-properties.js
 * Logic for managing Properties and Houses via Admin Dashboard
 */

const SUPABASE_URL = "https://uqcjajmqtlchftpqwsrp.supabase.co";
const SUPABASE_KEY = "sb_publishable_yWZiH8l1idY0QWGuj6p9sg_GqXPONGX";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser = null;
let currentTab = 'properties'; // 'properties' or 'houses'
let allItems = [];

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
    if (!session) return window.location.href = "login.html";

    const { data: profile, error } = await supabaseClient.from("profiles").select("role").eq("id", session.user.id).maybeSingle();
    if (error || !profile || profile.role !== "admin") {
      showToast("สิทธิ์ไม่เพียงพอ", "รับชมโครงสร้าง UI จำลอง");
    } else {
      currentUser = session.user;
    }

    loadData();
  } catch (err) {
    console.error(err);
  }
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
  const tbodyId = currentTab === 'properties' ? 'propertiesTableBody' : 'housesTableBody';
  document.getElementById(tbodyId).innerHTML = `<tr><td colspan="6" class="text-center py-5"><i class="fa-solid fa-circle-notch fa-spin text-primary"></i> <p class="mt-2 text-muted">Loading...</p></td></tr>`;
  
  try {
    let tableName = currentTab === 'properties' ? 'properties' : 'houses';
    let imgRelation = currentTab === 'properties' ? 'property_images(image_url)' : 'house_images(image_url)';
    
    let { data, error } = await supabaseClient
      .from(tableName)
      .select(`*, ${imgRelation}`)
      .order('created_at', { ascending: false }).limit(50);
      
    if (error) {
      console.warn("Relation fetch failed, retrying simple select:", error.message);
      let simpleFetch = await supabaseClient.from(tableName).select('*').order('created_at', { ascending: false }).limit(50);
      if(simpleFetch.error) throw simpleFetch.error;
      data = simpleFetch.data;
    }
    
    allItems = data || [];
    renderTable();
  } catch(e) {
    console.error(e);
    document.getElementById(tbodyId).innerHTML = `<tr><td colspan="6" class="text-center py-5"><p class="text-danger">ไม่สามารถเชื่อมต่อตาราง <b>${currentTab === 'properties' ? 'properties' : 'houses'}</b> ได้<br><small>${e.message}</small></p><br><strong>กรุณาส่งโครงสร้างตาราง (Create Table) ให้แชท AI เพื่อทำงานต่อ</strong></td></tr>`;
  }
}

function renderTable() {
  const tbodyId = currentTab === 'properties' ? 'propertiesTableBody' : 'housesTableBody';
  const tbody = document.getElementById(tbodyId);
  
  if (allItems.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-5 text-muted">ยังไม่มีข้อมูลในระบบ หรือรอรับโครงสร้างตารางจากคุณ</td></tr>`;
    return;
  }

  if(currentTab === 'properties') {
    tbody.innerHTML = allItems.map(item => {
      let img = 'https://ui-avatars.com/api/?name=P&background=e2e8f0';
      if(item.property_images && item.property_images.length > 0) img = item.property_images[0].image_url;
      else if(item.image_url) img = item.image_url; 
      
      const typeBadge = item.type === 'ขาย' ? '<span class="badge-status pending">ขาย</span>' : '<span class="badge-status in-progress">เช่า</span>';
      
      return `<tr>
        <td><img src="${img}" style="width:60px; height:60px; object-fit:cover; border-radius:8px;"></td>
        <td class="font-weight-bold" style="max-width:200px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${item.title || item.name || '-'}</td>
        <td>${typeBadge}</td>
        <td class="text-muted"><i class="fa-solid fa-location-dot"></i> ${item.location || item.province || '-'}</td>
        <td class="font-weight-bold text-success">฿ ${Number(item.price || 0).toLocaleString()}</td>
        <td>
          <div class="action-buttons">
            <button class="action-btn edit" onclick="editItem('${item.id}')"><i class="fa-solid fa-pen"></i></button>
            <button class="action-btn" onclick="deleteItem('${item.id}')" style="color:#e11d48;"><i class="fa-solid fa-trash"></i></button>
          </div>
        </td>
      </tr>`;
    }).join('');
  } else {
    // HOUSES
    tbody.innerHTML = allItems.map(item => {
      let img = 'https://ui-avatars.com/api/?name=H&background=e2e8f0';
      if(item.house_images && item.house_images.length > 0) img = item.house_images[0].image_url;
      else if(item.image_url) img = item.image_url;
      
      const specs = `🛏️ ${item.bedrooms || 0} &nbsp; 🚿 ${item.bathrooms || 0}`;
      
      return `<tr>
        <td><img src="${img}" style="width:60px; height:60px; object-fit:cover; border-radius:8px;"></td>
        <td class="font-weight-bold">${item.title || item.name || item.model_name || '-'}</td>
        <td class="text-muted">${item.area || 0} ตร.ม.</td>
        <td class="text-muted">${specs}</td>
        <td class="font-weight-bold text-success">฿ ${Number(item.price || item.base_price || 0).toLocaleString()}</td>
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


// === CRUD SYSTEM ===
let currentEditId = null;

window.openAddModal = function() {
    currentEditId = null;
    const isProp = currentTab === 'properties';
    document.getElementById('modalTitleItem').innerText = isProp ? "เพิ่มประกาศ เช่า/ขายบ้าน" : "เพิ่มแบบบ้านสั่งสร้าง";
    
    let html = '';
    if (isProp) {
        html = `
        <div class="form-group mb-3">
            <label>หัวข้อประกาศ (Title)</label>
            <input type="text" id="propTitle" class="form-control" placeholder="เช่น บ้านเดี่ยว 2 ชั้น ใกล้รถไฟฟ้า">
        </div>
        <div class="form-group row mb-3">
            <div class="col-6">
                <label>ประเภท (Type)</label>
                <select id="propType" class="form-control">
                    <option value="ขาย">ประกาศขาย</option>
                    <option value="เช่า">ประกาศเช่า</option>
                </select>
            </div>
            <div class="col-6">
                <label>ราคา (Price)</label>
                <input type="number" id="propPrice" class="form-control" placeholder="0">
            </div>
        </div>
        <div class="form-group mb-3">
            <label>ทำเล/ที่ตั้ง (Location)</label>
            <input type="text" id="propLocation" class="form-control" placeholder="เช่น กรุงเทพมหานคร, สุขุมวิท">
        </div>
        <div class="form-group mb-3">
            <label>ลิงก์รูปภาพ (Image URL)</label>
            <input type="text" id="propImg" class="form-control" placeholder="https://...">
            <small class="text-muted">แนะนำให้อัปโหลดรูปลงระบบ (Supabase) แล้วนำลิงก์มาวาง</small>
        </div>
        <div class="form-group mb-3">
            <label>รายละเอียดเพิ่มเติม (Description)</label>
            <textarea id="propDesc" class="form-control" rows="3"></textarea>
        </div>`;
    } else {
        html = `
        <div class="form-group mb-3">
            <label>ชื่อแบบบ้าน (Model Name)</label>
            <input type="text" id="houseTitle" class="form-control" placeholder="เช่น แบบบ้านสไตล์โมเดิร์น M-101">
        </div>
        <div class="form-group row mb-3">
            <div class="col-4">
                <label>ราคาเริ่มต้น (Price)</label>
                <input type="number" id="housePrice" class="form-control" placeholder="0">
            </div>
            <div class="col-4">
                <label>พื้นที่ใช้สอย (Sq.m)</label>
                <input type="number" id="houseArea" class="form-control" placeholder="0">
            </div>
            <div class="col-4">
                <label>ห้องนอน / น้ำ</label>
                <div style="display:flex; gap:5px;">
                  <input type="number" id="houseBed" class="form-control" placeholder="น.">
                  <input type="number" id="houseBath" class="form-control" placeholder="น.">
                </div>
            </div>
        </div>
        <div class="form-group mb-3">
            <label>ลิงก์รูปภาพตัวอย่าง (Image URL)</label>
            <input type="text" id="houseImg" class="form-control" placeholder="https://...">
        </div>
        <div class="form-group mb-3">
            <label>รายละเอียดเพิ่มเติม (Description)</label>
            <textarea id="houseDesc" class="form-control" rows="3"></textarea>
        </div>`;
    }

    document.getElementById('modalBodyItem').innerHTML = html;
    
    const saveBtn = document.getElementById('saveItemBtn');
    saveBtn.onclick = () => saveItemData();
    
    const overlay = document.getElementById('itemModalOverlay');
    overlay.style.display = 'flex';
    setTimeout(() => overlay.classList.add('active'), 10);
    if(window.applyTranslations) window.applyTranslations(overlay);
};

window.editItem = function(id) {
    const item = allItems.find(x => x.id == id);
    if (!item) return;
    currentEditId = id;
    
    const isProp = currentTab === 'properties';
    document.getElementById('modalTitleItem').innerText = isProp ? "แก้ไขประกาศ เช่า/ขายบ้าน" : "แก้ไขแบบบ้านสั่งสร้าง";
    
    let html = '';
    if (isProp) {
        let img = item.image_url || '';
        if(item.property_images && item.property_images[0]) img = item.property_images[0].image_url;
        
        html = `
        <div class="form-group mb-3">
            <label>หัวข้อประกาศ (Title)</label>
            <input type="text" id="propTitle" class="form-control" value="${item.title || item.name || ''}">
        </div>
        <div class="form-group row mb-3">
            <div class="col-6">
                <label>ประเภท (Type)</label>
                <select id="propType" class="form-control">
                    <option value="ขาย" ${item.type==='ขาย'?'selected':''}>ประกาศขาย</option>
                    <option value="เช่า" ${item.type==='เช่า'?'selected':''}>ประกาศเช่า</option>
                </select>
            </div>
            <div class="col-6">
                <label>ราคา (Price)</label>
                <input type="number" id="propPrice" class="form-control" value="${item.price || 0}">
            </div>
        </div>
        <div class="form-group mb-3">
            <label>ทำเล/ที่ตั้ง (Location)</label>
            <input type="text" id="propLocation" class="form-control" value="${item.location || item.province || ''}">
        </div>
        <div class="form-group mb-3">
            <label>ลิงก์รูปภาพ (Image URL)</label>
            <input type="text" id="propImg" class="form-control" value="${img}">
        </div>
        <div class="form-group mb-3">
            <label>รายละเอียด (Description)</label>
            <textarea id="propDesc" class="form-control" rows="3">${item.description || ''}</textarea>
        </div>`;
    } else {
        let img = item.image_url || '';
        if(item.house_images && item.house_images[0]) img = item.house_images[0].image_url;
        
        html = `
        <div class="form-group mb-3">
            <label>ชื่อแบบบ้าน (Model Name)</label>
            <input type="text" id="houseTitle" class="form-control" value="${item.title || item.name || item.model_name || ''}">
        </div>
        <div class="form-group row mb-3">
            <div class="col-4">
                <label>ราคาเริ่มต้น (Price)</label>
                <input type="number" id="housePrice" class="form-control" value="${item.price || item.base_price || 0}">
            </div>
            <div class="col-4">
                <label>พื้นที่ใช้สอย (Sq.m)</label>
                <input type="number" id="houseArea" class="form-control" value="${item.area || 0}">
            </div>
            <div class="col-4">
                <label>ห้องนอน / น้ำ</label>
                <div style="display:flex; gap:5px;">
                  <input type="number" id="houseBed" class="form-control" value="${item.bedrooms || 0}">
                  <input type="number" id="houseBath" class="form-control" value="${item.bathrooms || 0}">
                </div>
            </div>
        </div>
        <div class="form-group mb-3">
            <label>ลิงก์รูปภาพ (Image URL)</label>
            <input type="text" id="houseImg" class="form-control" value="${img}">
        </div>
        <div class="form-group mb-3">
            <label>รายละเอียด (Description)</label>
            <textarea id="houseDesc" class="form-control" rows="3">${item.description || ''}</textarea>
        </div>`;
    }

    document.getElementById('modalBodyItem').innerHTML = html;
    
    const saveBtn = document.getElementById('saveItemBtn');
    saveBtn.onclick = () => saveItemData();
    
    const overlay = document.getElementById('itemModalOverlay');
    overlay.style.display = 'flex';
    setTimeout(() => overlay.classList.add('active'), 10);
    if(window.applyTranslations) window.applyTranslations(overlay);
};

window.saveItemData = async function() {
    const isProp = currentTab === 'properties';
    const tableName = isProp ? 'properties' : 'houses';
    const imgTable = isProp ? 'property_images' : 'house_images';
    const relationKey = isProp ? 'property_id' : 'house_id';
    
    let payload = {};
    let imgUrl = "";
    
    if (isProp) {
        payload = {
            title: document.getElementById('propTitle').value,
            type: document.getElementById('propType').value,
            price: document.getElementById('propPrice').value,
            location: document.getElementById('propLocation').value,
            description: document.getElementById('propDesc').value
        };
        imgUrl = document.getElementById('propImg').value;
    } else {
        payload = {
            title: document.getElementById('houseTitle').value,
            price: document.getElementById('housePrice').value,
            area: document.getElementById('houseArea').value,
            bedrooms: document.getElementById('houseBed').value,
            bathrooms: document.getElementById('houseBath').value,
            description: document.getElementById('houseDesc').value
        };
        imgUrl = document.getElementById('houseImg').value;
    }

    const saveBtn = document.getElementById('saveItemBtn');
    const oldText = saveBtn.innerText;
    saveBtn.innerText = "กำลังบันทึก...";
    saveBtn.disabled = true;

    try {
        let itemId = currentEditId;
        
        // 1. Save main data (update or insert)
        if (currentEditId) {
            const { error } = await supabaseClient.from(tableName).update(payload).eq('id', currentEditId);
            if(error) throw error;
        } else {
            const { data, error } = await supabaseClient.from(tableName).insert([payload]).select('id').single();
            if(error) throw error;
            itemId = data.id;
        }
        
        // 2. Save Image properly
        if (imgUrl && itemId) {
            // First check if image relation exists
            const { data: existImgs } = await supabaseClient.from(imgTable).select('id').eq(relationKey, itemId);
            if (existImgs && existImgs.length > 0) {
                 await supabaseClient.from(imgTable).update({ image_url: imgUrl }).eq('id', existImgs[0].id);
            } else {
                 await supabaseClient.from(imgTable).insert([{ [relationKey]: itemId, image_url: imgUrl }]);
            }
            
            // Optional: fallback directly to main table if it has image_url
            await supabaseClient.from(tableName).update({ image_url: imgUrl }).eq('id', itemId);
        }

        if(typeof showToast==='function') showToast("บันทึกสำเร็จ", "ระบบเพิ่มข้อมูลลงฐานข้อมูลของคุณแล้ว");
        closeItemModal();
        loadData();

    } catch(err) {
        console.error(err);
        if(typeof showToast==='function') showToast("บันทึกไม่สำเร็จ", "คอลัมน์ใน DB ไม่ตรงกัน: " + err.message, true);
    } finally {
        saveBtn.innerText = oldText;
        saveBtn.disabled = false;
    }
}

window.deleteItem = async function(id) {
    if(!confirm("คุณต้องการลบรายการนี้ออกจากฐานข้อมูลแบบถาวรใช่หรือไม่?")) return;
    try {
        let tableName = currentTab === 'properties' ? 'properties' : 'houses';
        const { error } = await supabaseClient.from(tableName).delete().eq('id', id);
        if(error) throw error;
        if(typeof showToast==='function') showToast("ลบสำเร็จ", "ลบข้อมูลออกจากระบบเรียบร้อย");
        loadData();
    } catch(e) {
        if(typeof showToast==='function') showToast("Error", e.message, true);
    }
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
