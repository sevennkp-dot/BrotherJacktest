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
    let imgRelation = currentTab === 'properties' ? 'property_images(id, image_url)' : 'house_images(id, image_url)';
    
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
      
      let statusClass = 'pending';
      if(item.status === 'เช่า') statusClass = 'in-progress';
      else if(item.status === 'ขายแล้ว' || item.status === 'เช่าแล้ว') statusClass = 'completed';
      const typeBadge = `<span class="badge-status ${statusClass}">${item.status || 'ขาย'}</span>`;
      
      let locText = [];
      if(item.district) locText.push(item.district);
      if(item.province) locText.push(item.province);
      const locDisplay = locText.length > 0 ? locText.join(', ') : '-';
      
      return `<tr>
        <td><img src="${img}" style="width:60px; height:60px; object-fit:cover; border-radius:8px;"></td>
        <td class="font-weight-bold" style="max-width:200px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${item.title || item.name || '-'}</td>
        <td>${typeBadge}</td>
        <td class="text-muted"><i class="fa-solid fa-location-dot"></i> ${locDisplay}</td>
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
      
      const specs = `🛏️ ${item.bedrooms || 0} &nbsp; 🚿 ${item.bathrooms || 0} &nbsp; 🚗 ${item.parking || 0}`;
      const areaStr = `${item.width || 0} x ${item.length || 0} ม.`;
      
      return `<tr>
        <td><img src="${img}" style="width:60px; height:60px; object-fit:cover; border-radius:8px;"></td>
        <td><div class="font-weight-bold">${item.name || item.title || '-'}</div><small class="text-muted"><i class="fa-solid fa-house"></i> ${item.building_type || 'บ้าน'}</small></td>
        <td class="text-muted">${areaStr}</td>
        <td class="text-muted">${specs}</td>
        <td class="font-weight-bold text-success">฿ ${Number(item.price || 0).toLocaleString()}</td>
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
        <div class="form-group mb-3"><label class="text-primary font-weight-bold"><i class="fa-solid fa-circle-info"></i> ข้อมูลพื้นฐาน</label></div>
        <div class="form-group row mb-3">
            <div class="col-12 mb-2">
                <label>หัวข้อประกาศ (Title) *</label>
                <input type="text" id="propTitle" class="form-control" placeholder="เช่น บ้านเดี่ยว 2 ชั้น ใกล้รถไฟฟ้า">
            </div>
            <div class="col-6">
                <label>ประเภท (Status) *</label>
                <select id="propStatus" class="form-control">
                    <option value="ขาย">ขาย</option>
                    <option value="เช่า">เช่า</option>
                </select>
            </div>
            <div class="col-6">
                <label>ราคา (Price) *</label>
                <input type="number" id="propPrice" class="form-control" placeholder="0">
            </div>
        </div>
        <div class="form-group mb-3"><label class="text-primary font-weight-bold mt-2"><i class="fa-solid fa-map-location-dot"></i> ทำเลที่ตั้ง</label></div>
        <div class="form-group row mb-3">
            <div class="col-4"><label>จังหวัด</label><input type="text" id="propProv" class="form-control" placeholder="เช่น กรุงเทพฯ"></div>
            <div class="col-4"><label>อำเภอ/เขต</label><input type="text" id="propDist" class="form-control" placeholder="เช่น ภาษีเจริญ"></div>
            <div class="col-4"><label>ตำบล/แขวง</label><input type="text" id="propSubD" class="form-control" placeholder="เช่น บางหว้า"></div>
        </div>
        <div class="form-group mb-3"><label class="text-primary font-weight-bold mt-2"><i class="fa-solid fa-vector-square"></i> ขนาดและพื้นที่</label></div>
        <div class="form-group row mb-3">
            <div class="col-3"><label>เนื้อที่ (ตร.ว.)</label><input type="number" id="propLandWa" class="form-control" placeholder="0"></div>
            <div class="col-3"><label>ใช้สอย (ตร.ม.)</label><input type="number" id="propUsable" class="form-control" placeholder="0"></div>
            <div class="col-6">
                <label>หน้ากว้าง x ความลึก (ม.)</label>
                <div style="display:flex; gap:5px;">
                    <input type="number" id="propLandW" class="form-control" placeholder="ก.">
                    <input type="number" id="propLandL" class="form-control" placeholder="ล.">
                </div>
            </div>
        </div>
        <div class="form-group mb-3"><label class="text-primary font-weight-bold mt-2"><i class="fa-solid fa-house"></i> รายละเอียดตัวบ้าน</label></div>
        <div class="form-group row mb-3">
            <div class="col-3"><label>ห้องนอน</label><input type="number" id="propBed" class="form-control" placeholder="0"></div>
            <div class="col-3"><label>ห้องน้ำ</label><input type="number" id="propBath" class="form-control" placeholder="0"></div>
            <div class="col-3"><label>ที่จอดรถ</label><input type="number" id="propPark" class="form-control" placeholder="0"></div>
            <div class="col-3"><label>อายุทรัพย์(ปี)</label><input type="number" id="propAge" class="form-control" placeholder="0"></div>
        </div>
        <div class="form-group row mb-3">
            <div class="col-6"><label>ประวัติการรีโนเวท</label><input type="text" id="propReno" class="form-control"></div>
            <div class="col-6"><label>ประวัติน้ำท่วม</label><input type="text" id="propFlood" class="form-control"></div>
            <div class="col-12 mt-2"><label>โครงสร้าง/การต่อเติม</label><input type="text" id="propStruct" class="form-control"></div>
        </div>
        <div class="form-group mb-3"><label class="text-primary font-weight-bold mt-2"><i class="fa-solid fa-coins"></i> การเงินและเงื่อนไข</label></div>
        <div class="form-group row mb-3">
            <div class="col-4"><label>ค่าส่วนกลาง(บ/ปี)</label><input type="number" id="propCommon" class="form-control" placeholder="0"></div>
            <div class="col-4"><label>เงื่อนไขโอน</label><input type="text" id="propTransfer" class="form-control" placeholder="เช่น ฟรีโอน"></div>
            <div class="col-4"><label>สถานะจำนอง</label><input type="text" id="propMortgage" class="form-control" placeholder="เช่น ปลอดจำนอง"></div>
            <div class="col-4 mt-2"><label>กู้ได้ประเมิน (%)</label><input type="number" id="propLoan" class="form-control" placeholder="เช่น 100"></div>
            <div class="col-4 mt-2"><label>ผ่อนประมาณ (บ/ด)</label><input type="number" id="propMonthly" class="form-control" placeholder="0"></div>
            <div class="col-4 mt-2"><label>ผ่อนตรง/อื่นๆ</label><input type="text" id="propDirect" class="form-control"></div>
        </div>
        <div class="form-group mb-3"><label class="text-primary font-weight-bold mt-2"><i class="fa-solid fa-tree-city"></i> สภาพแวดล้อมและอื่นๆ</label></div>
        <div class="form-group row mb-3">
            <div class="col-6"><label>สถานที่ใกล้เคียง</label><textarea id="propNearby" class="form-control" rows="2"></textarea></div>
            <div class="col-6"><label>การเดินทาง</label><textarea id="propTrans" class="form-control" rows="2"></textarea></div>
            <div class="col-12 mt-2"><label>สภาพแวดล้อมโดยรอบ</label><textarea id="propEnv" class="form-control" rows="2"></textarea></div>
            <div class="col-6 mt-2"><label>ประเภทโฉนด</label><input type="text" id="propDeed" class="form-control" placeholder="เช่น น.ส. 4"></div>
            <div class="col-6 mt-2"><label>ภาระผูกพัน</label><input type="text" id="propEncum" class="form-control" placeholder="-"></div>
        </div>
        <div class="form-group mb-3">
            <label>รายละเอียดประกาศ (Description)</label>
            <textarea id="propDesc" class="form-control" rows="4"></textarea>
        </div>
        <div class="form-group mb-3">
            <label>อัปโหลดรูปภาพ (Upload Image)</label>
            <input type="file" id="propImgUpload" class="form-control" accept="image/*" multiple style="padding: 10px;" onchange="previewImages(event, 'propImgPreview')">
            <div id="propImgPreview" style="display:flex; flex-wrap:wrap; gap:10px; margin-top:10px;"></div>
            <small class="text-muted d-block mt-2 mb-1">หรือใส่ลิงก์รูปภาพ (Image URL)</small>
            <input type="text" id="propImg" class="form-control" placeholder="https://...">
        </div>`;
    } else {
        html = `
        <div class="form-group row mb-3">
            <div class="col-8">
                <label>ชื่อแบบบ้าน (Name)</label>
                <input type="text" id="houseName" class="form-control" placeholder="เช่น แบบบ้านสไตล์โมเดิร์น M-101">
            </div>
            <div class="col-4">
                <label>ประเภทอาคาร (Type)</label>
                <input type="text" id="houseType" class="form-control" placeholder="บ้าน">
            </div>
        </div>
        <div class="form-group row mb-3">
            <div class="col-4">
                <label>ราคาเริ่มต้น (Price)</label>
                <input type="number" id="housePrice" class="form-control" placeholder="0">
            </div>
            <div class="col-4">
                <label>ขนาด (กว้าง x ยาว เมตร)</label>
                <div style="display:flex; gap:5px;">
                  <input type="number" id="houseWidth" class="form-control" placeholder="ก.">
                  <input type="number" id="houseLength" class="form-control" placeholder="ย.">
                </div>
            </div>
            <div class="col-4">
                <label>ห้องนอน/น้ำ/จอดรถ</label>
                <div style="display:flex; gap:5px;">
                  <input type="number" id="houseBed" class="form-control" placeholder="นอน">
                  <input type="number" id="houseBath" class="form-control" placeholder="น้ำ">
                  <input type="number" id="housePark" class="form-control" placeholder="จอด">
                </div>
            </div>
        </div>
        <div class="form-group mb-3">
            <label>อัปโหลดรูปภาพ (Upload Image)</label>
            <input type="file" id="houseImgUpload" class="form-control" accept="image/*" multiple style="padding: 10px;" onchange="previewImages(event, 'houseImgPreview')">
            <div id="houseImgPreview" style="display:flex; flex-wrap:wrap; gap:10px; margin-top:10px;"></div>
            <small class="text-muted d-block mt-2 mb-1">หรือใส่ลิงก์รูปภาพ (Image URL)</small>
            <input type="text" id="houseImg" class="form-control" placeholder="https://...">
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
        <div class="form-group mb-3"><label class="text-primary font-weight-bold"><i class="fa-solid fa-circle-info"></i> ข้อมูลพื้นฐาน</label></div>
        <div class="form-group row mb-3">
            <div class="col-12 mb-2">
                <label>หัวข้อประกาศ (Title) *</label>
                <input type="text" id="propTitle" class="form-control" value="${item.title || ''}">
            </div>
            <div class="col-6">
                <label>ประเภท (Status) *</label>
                <select id="propStatus" class="form-control">
                    <option value="ขาย" ${item.status==='ขาย'?'selected':''}>ขาย</option>
                    <option value="เช่า" ${item.status==='เช่า'?'selected':''}>เช่า</option>
                    <option value="จองแล้ว" ${item.status==='จองแล้ว'?'selected':''}>จองแล้ว</option>
                    <option value="ขายแล้ว" ${item.status==='ขายแล้ว'?'selected':''}>ขายแล้ว</option>
                    <option value="เช่าแล้ว" ${item.status==='เช่าแล้ว'?'selected':''}>เช่าแล้ว</option>
                </select>
            </div>
            <div class="col-6">
                <label>ราคา (Price) *</label>
                <input type="number" id="propPrice" class="form-control" value="${item.price || 0}">
            </div>
        </div>
        <div class="form-group mb-3"><label class="text-primary font-weight-bold mt-2"><i class="fa-solid fa-map-location-dot"></i> ทำเลที่ตั้ง</label></div>
        <div class="form-group row mb-3">
            <div class="col-4"><label>จังหวัด</label><input type="text" id="propProv" class="form-control" value="${item.province || ''}"></div>
            <div class="col-4"><label>อำเภอ/เขต</label><input type="text" id="propDist" class="form-control" value="${item.district || ''}"></div>
            <div class="col-4"><label>ตำบล/แขวง</label><input type="text" id="propSubD" class="form-control" value="${item.subdistrict || ''}"></div>
        </div>
        <div class="form-group mb-3"><label class="text-primary font-weight-bold mt-2"><i class="fa-solid fa-vector-square"></i> ขนาดและพื้นที่</label></div>
        <div class="form-group row mb-3">
            <div class="col-3"><label>เนื้อที่ (ตร.ว.)</label><input type="number" id="propLandWa" class="form-control" value="${item.land_area_wa || 0}"></div>
            <div class="col-3"><label>ใช้สอย (ตร.ม.)</label><input type="number" id="propUsable" class="form-control" value="${item.usable_area || 0}"></div>
            <div class="col-6">
                <label>หน้ากว้าง x ความลึก (ม.)</label>
                <div style="display:flex; gap:5px;">
                    <input type="number" id="propLandW" class="form-control" value="${item.land_width || 0}">
                    <input type="number" id="propLandL" class="form-control" value="${item.land_length || 0}">
                </div>
            </div>
        </div>
        <div class="form-group mb-3"><label class="text-primary font-weight-bold mt-2"><i class="fa-solid fa-house"></i> รายละเอียดตัวบ้าน</label></div>
        <div class="form-group row mb-3">
            <div class="col-3"><label>ห้องนอน</label><input type="number" id="propBed" class="form-control" value="${item.bedrooms || 0}"></div>
            <div class="col-3"><label>ห้องน้ำ</label><input type="number" id="propBath" class="form-control" value="${item.bathrooms || 0}"></div>
            <div class="col-3"><label>ที่จอดรถ</label><input type="number" id="propPark" class="form-control" value="${item.parking || 0}"></div>
            <div class="col-3"><label>อายุทรัพย์(ปี)</label><input type="number" id="propAge" class="form-control" value="${item.property_age || 0}"></div>
        </div>
        <div class="form-group row mb-3">
            <div class="col-6"><label>ประวัติการรีโนเวท</label><input type="text" id="propReno" class="form-control" value="${item.renovated || ''}"></div>
            <div class="col-6"><label>ประวัติน้ำท่วม</label><input type="text" id="propFlood" class="form-control" value="${item.flood_history || ''}"></div>
            <div class="col-12 mt-2"><label>โครงสร้าง/การต่อเติม</label><input type="text" id="propStruct" class="form-control" value="${item.structure_info || ''}"></div>
        </div>
        <div class="form-group mb-3"><label class="text-primary font-weight-bold mt-2"><i class="fa-solid fa-coins"></i> การเงินและเงื่อนไข</label></div>
        <div class="form-group row mb-3">
            <div class="col-4"><label>ค่าส่วนกลาง(บ/ปี)</label><input type="number" id="propCommon" class="form-control" value="${item.common_fee || 0}"></div>
            <div class="col-4"><label>เงื่อนไขโอน</label><input type="text" id="propTransfer" class="form-control" value="${item.transfer_fee || ''}"></div>
            <div class="col-4"><label>สถานะจำนอง</label><input type="text" id="propMortgage" class="form-control" value="${item.mortgage_status || ''}"></div>
            <div class="col-4 mt-2"><label>กู้ได้ประเมิน (%)</label><input type="number" id="propLoan" class="form-control" value="${item.loan_percent || 0}"></div>
            <div class="col-4 mt-2"><label>ผ่อนประมาณ (บ/ด)</label><input type="number" id="propMonthly" class="form-control" value="${item.monthly_payment || 0}"></div>
            <div class="col-4 mt-2"><label>ผ่อนตรง/อื่นๆ</label><input type="text" id="propDirect" class="form-control" value="${item.direct_installment || ''}"></div>
        </div>
        <div class="form-group mb-3"><label class="text-primary font-weight-bold mt-2"><i class="fa-solid fa-tree-city"></i> สภาพแวดล้อมและอื่นๆ</label></div>
        <div class="form-group row mb-3">
            <div class="col-6"><label>สถานที่ใกล้เคียง</label><textarea id="propNearby" class="form-control" rows="2">${item.nearby_places || ''}</textarea></div>
            <div class="col-6"><label>การเดินทาง</label><textarea id="propTrans" class="form-control" rows="2">${item.transportation || ''}</textarea></div>
            <div class="col-12 mt-2"><label>สภาพแวดล้อมโดยรอบ</label><textarea id="propEnv" class="form-control" rows="2">${item.environment || ''}</textarea></div>
            <div class="col-6 mt-2"><label>ประเภทโฉนด</label><input type="text" id="propDeed" class="form-control" value="${item.deed_type || ''}"></div>
            <div class="col-6 mt-2"><label>ภาระผูกพัน</label><input type="text" id="propEncum" class="form-control" value="${item.encumbrance || ''}"></div>
        </div>
        <div class="form-group mb-3">
            <label>รายละเอียดประกาศ (Description)</label>
            <textarea id="propDesc" class="form-control" rows="4">${item.description || ''}</textarea>
        </div>
        <div class="form-group mb-3">
            <label>รูปภาพปัจจุบัน (Existing Images)</label>
            <div style="display:flex; flex-wrap:wrap; gap:10px; margin-bottom:10px;">
                ${(item.property_images || []).map(img => `
                    <div style="position:relative; width:80px; height:80px;" id="imgBox-${img.id}">
                        <img src="${img.image_url}" style="width:100%; height:100%; object-fit:cover; border-radius:8px; border: 1px solid #ddd;">
                        <span style="position:absolute; top:-5px; right:-5px; background:#e11d48; color:white; border-radius:50%; width:20px; height:20px; text-align:center; line-height:20px; font-size:12px; cursor:pointer;" onclick="deleteExistingImage(${img.id}, 'property_images')"><i class="fa-solid fa-xmark"></i></span>
                    </div>
                `).join('')}
            </div>
            <label>อัปโหลดรูปภาพใหม่ (Upload New Image)</label>
            <input type="file" id="propImgUpload" class="form-control" accept="image/*" multiple style="padding: 10px;" onchange="previewImages(event, 'propImgPreview')">
            <div id="propImgPreview" style="display:flex; flex-wrap:wrap; gap:10px; margin-top:10px;"></div>
            <small class="text-muted d-block mt-2 mb-1">ใส่ลิงก์รูปภาพใหม่ (Image URL)</small>
            <input type="text" id="propImg" class="form-control" placeholder="https://...">
        </div>`;
    } else {
        let img = item.image_url || '';
        if(item.house_images && item.house_images[0]) img = item.house_images[0].image_url;
        
        html = `
        <div class="form-group row mb-3">
            <div class="col-8">
                <label>ชื่อแบบบ้าน (Name)</label>
                <input type="text" id="houseName" class="form-control" value="${item.name || ''}">
            </div>
            <div class="col-4">
                <label>ประเภทอาคาร (Type)</label>
                <input type="text" id="houseType" class="form-control" value="${item.building_type || 'บ้าน'}">
            </div>
        </div>
        <div class="form-group row mb-3">
            <div class="col-4">
                <label>ราคาเริ่มต้น (Price)</label>
                <input type="number" id="housePrice" class="form-control" value="${item.price || 0}">
            </div>
            <div class="col-4">
                <label>ขนาด (กว้าง x ยาว เมตร)</label>
                <div style="display:flex; gap:5px;">
                  <input type="number" id="houseWidth" class="form-control" value="${item.width || 0}">
                  <input type="number" id="houseLength" class="form-control" value="${item.length || 0}">
                </div>
            </div>
            <div class="col-4">
                <label>ห้องนอน/น้ำ/จอดรถ</label>
                <div style="display:flex; gap:5px;">
                  <input type="number" id="houseBed" class="form-control" value="${item.bedrooms || 0}">
                  <input type="number" id="houseBath" class="form-control" value="${item.bathrooms || 0}">
                  <input type="number" id="housePark" class="form-control" value="${item.parking || 0}">
                </div>
            </div>
        </div>
        <div class="form-group mb-3">
            <label>รูปภาพปัจจุบัน (Existing Images)</label>
            <div style="display:flex; flex-wrap:wrap; gap:10px; margin-bottom:10px;">
                ${(item.house_images || []).map(img => `
                    <div style="position:relative; width:80px; height:80px;" id="imgBox-${img.id}">
                        <img src="${img.image_url}" style="width:100%; height:100%; object-fit:cover; border-radius:8px; border: 1px solid #ddd;">
                        <span style="position:absolute; top:-5px; right:-5px; background:#e11d48; color:white; border-radius:50%; width:20px; height:20px; text-align:center; line-height:20px; font-size:12px; cursor:pointer;" onclick="deleteExistingImage(${img.id}, 'house_images')"><i class="fa-solid fa-xmark"></i></span>
                    </div>
                `).join('')}
            </div>
            <label>อัปโหลดรูปภาพใหม่ (Upload New Image)</label>
            <input type="file" id="houseImgUpload" class="form-control" accept="image/*" multiple style="padding: 10px;" onchange="previewImages(event, 'houseImgPreview')">
            <div id="houseImgPreview" style="display:flex; flex-wrap:wrap; gap:10px; margin-top:10px;"></div>
            <small class="text-muted d-block mt-2 mb-1">ใส่ลิงก์รูปภาพใหม่ (Image URL)</small>
            <input type="text" id="houseImg" class="form-control" placeholder="https://...">
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
            status: document.getElementById('propStatus').value,
            price: document.getElementById('propPrice').value || 0,
            province: document.getElementById('propProv').value,
            district: document.getElementById('propDist').value,
            subdistrict: document.getElementById('propSubD').value,
            land_area_wa: document.getElementById('propLandWa').value || null,
            usable_area: document.getElementById('propUsable').value || null,
            land_width: document.getElementById('propLandW').value || null,
            land_length: document.getElementById('propLandL').value || null,
            bedrooms: document.getElementById('propBed').value || 0,
            bathrooms: document.getElementById('propBath').value || 0,
            parking: document.getElementById('propPark').value || 0,
            property_age: document.getElementById('propAge').value || null,
            renovated: document.getElementById('propReno').value || null,
            flood_history: document.getElementById('propFlood').value || null,
            structure_info: document.getElementById('propStruct').value || null,
            common_fee: document.getElementById('propCommon').value || null,
            transfer_fee: document.getElementById('propTransfer').value || null,
            mortgage_status: document.getElementById('propMortgage').value || null,
            loan_percent: document.getElementById('propLoan').value || null,
            monthly_payment: document.getElementById('propMonthly').value || null,
            direct_installment: document.getElementById('propDirect').value || null,
            nearby_places: document.getElementById('propNearby').value || null,
            transportation: document.getElementById('propTrans').value || null,
            environment: document.getElementById('propEnv').value || null,
            deed_type: document.getElementById('propDeed').value || null,
            encumbrance: document.getElementById('propEncum').value || null,
            description: document.getElementById('propDesc').value || null
        };
        imgUrl = document.getElementById('propImg').value;
    } else {
        payload = {
            name: document.getElementById('houseName').value,
            building_type: document.getElementById('houseType').value || 'บ้าน',
            price: document.getElementById('housePrice').value || 0,
            width: document.getElementById('houseWidth').value || 0,
            length: document.getElementById('houseLength').value || 0,
            bedrooms: document.getElementById('houseBed').value || 0,
            bathrooms: document.getElementById('houseBath').value || 0,
            parking: document.getElementById('housePark').value || 0
        };
        imgUrl = document.getElementById('houseImg').value;
    }

    const saveBtn = document.getElementById('saveItemBtn');
    const oldText = saveBtn.innerText;
    saveBtn.innerText = "กำลังอัปโหลด...";
    saveBtn.disabled = true;

    try {
        saveBtn.innerText = "กำลังบันทึกข้อมูล (1/2)...";
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
        
        // 2. Save image relationship and multi-uploads
        if (itemId) {
            const fileInputId = isProp ? 'propImgUpload' : 'houseImgUpload';
            const fileInput = document.getElementById(fileInputId);
            
            // Text URL Input
            if (imgUrl) {
                await supabaseClient.from(tableName).update({ image_url: imgUrl }).eq('id', itemId);
                const { data: existImgs } = await supabaseClient.from(imgTable).select('id').eq(relationKey, itemId);
                if (!existImgs || existImgs.length === 0) {
                     let imgData = { [relationKey]: itemId, image_url: imgUrl };
                     if (!isProp) imgData.display_order = 0;
                     await supabaseClient.from(imgTable).insert([imgData]);
                }
            }

            // Multi File Uploads
            if (fileInput && fileInput.files && fileInput.files.length > 0) {
                saveBtn.innerText = "กำลังอัปโหลดรูปภาพ (2/2)...";
                
                const { data: eImgs } = await supabaseClient.from(imgTable).select('display_order').eq(relationKey, itemId).order('display_order', { ascending: false }).limit(1);
                let orderNum = (eImgs && eImgs.length > 0) ? (eImgs[0].display_order || 0) + 1 : 1;

                for (let i = 0; i < fileInput.files.length; i++) {
                    const file = fileInput.files[i];
                    const fileExt = file.name.split('.').pop();
                    const fileName = `${isProp?'prop':'house'}_${Date.now()}_${i}.${fileExt}`;
                    const filePath = `properties/${fileName}`;
                    
                    const { error: uploadError } = await supabaseClient.storage.from('ssss').upload(filePath, file);
                    if (!uploadError) {
                        const { data: { publicUrl } } = supabaseClient.storage.from('ssss').getPublicUrl(filePath);
                        let fileData = { [relationKey]: itemId, image_url: publicUrl };
                        if (!isProp) fileData.display_order = orderNum++;
                        await supabaseClient.from(imgTable).insert([fileData]);
                        if (i === 0 && !imgUrl) {
                           await supabaseClient.from(tableName).update({ image_url: publicUrl }).eq('id', itemId);
                        }
                    }
                }
            }
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

window.previewImages = function(event, previewId) {
    const previewContainer = document.getElementById(previewId);
    previewContainer.innerHTML = '';
    const files = event.target.files;
    if (files) {
        Array.from(files).forEach((file) => {
            const reader = new FileReader();
            reader.onload = function(e) {
                previewContainer.innerHTML += `
                    <div style="width:80px; height:80px;">
                        <img src="${e.target.result}" style="width:100%; height:100%; object-fit:cover; border-radius:8px; border: 1px solid #ddd;">
                    </div>
                `;
            }
            reader.readAsDataURL(file);
        });
    }
}

window.deleteExistingImage = async function(id, table) {
    if(!confirm("ต้องการลบรูปภาพนี้ใช่หรือไม่?")) return;
    try {
        const relationKey = table === 'property_images' ? 'property_id' : 'house_id';
        const parentTable = table === 'property_images' ? 'properties' : 'houses';
        
        const { data: imgRow } = await supabaseClient.from(table).select(relationKey + ', image_url').eq('id', id).maybeSingle();
        
        await supabaseClient.from(table).delete().eq('id', id);
        
        if (imgRow) {
            const parentId = imgRow[relationKey];
            const { data: remaining } = await supabaseClient.from(table).select('image_url').eq(relationKey, parentId).limit(1);
            if (!remaining || remaining.length === 0) {
                 await supabaseClient.from(parentTable).update({ image_url: '' }).eq('id', parentId);
            } else {
                 await supabaseClient.from(parentTable).update({ image_url: remaining[0].image_url }).eq('id', parentId);
            }
        }

        const el = document.getElementById(`imgBox-${id}`);
        if(el) el.remove();
        if(typeof showToast==='function') showToast("สำเร็จ", "ลบรูปภาพเรียบร้อย");
        loadData();
    } catch(e) {
        if(typeof showToast==='function') showToast("Error", e.message, true);
    }
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
