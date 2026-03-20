const SUPABASE_URL = "https://uqcjajmqtlchftpqwsrp.supabase.co";
const SUPABASE_KEY = "sb_publishable_yWZiH8l1idY0QWGuj6p9sg_GqXPONGX";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser = null;
let currentReviewTechId = null;
let currentReviewTechName = null;
let currentRating = 0;

async function checkAuth() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = "login.html";
    return;
  }
  currentUser = session.user;
  document.getElementById("profileEmail").innerText = currentUser.email;
  
  await loadProfile();
  loadRepairs();
  loadBuilds();
  loadMaterials();
  loadReviews();
}

async function loadProfile() {
  const { data, error } = await supabaseClient.from("customers").select("*").eq("id", currentUser.id).single();
  if (data) {
    document.getElementById("inputName").value = data.name || "";
    document.getElementById("inputPhone").value = data.phone || "";
    const displayName = data.name || currentUser.email;
    document.getElementById("profileName").innerText = displayName;
    document.getElementById("profileAvatar").innerText = displayName.charAt(0).toUpperCase();
  }
}

async function updateProfile(e) {
  e.preventDefault();
  const name = document.getElementById("inputName").value;
  const phone = document.getElementById("inputPhone").value;
  const btn = document.getElementById("btnSaveProfile");
  btn.innerText = "⏳ กำลังบันทึก...";
  btn.disabled = true;
  
  const { error } = await supabaseClient.from("customers").upsert({
    id: currentUser.id, 
    name: name, 
    phone: phone, 
    updated_at: new Date()
  });
  
  btn.innerText = "บันทึกข้อมูล";
  btn.disabled = false;

  if (error) {
    alert("เกิดข้อผิดพลาด: " + error.message);
  } else {
    alert("✅ บันทึกข้อมูลโปรไฟล์เรียบร้อย");
    loadProfile();
  }
}

async function loadRepairs() {
  const { data, error } = await supabaseClient.from("bookings").select("*").eq("customer_id", currentUser.id).order("created_at", { ascending: false });
  const tbody = document.getElementById("tableRepairs");
  
  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center">คุณยังไม่มีประวัติการแจ้งซ่อม</td></tr>';
    return;
  }
  
  tbody.innerHTML = data.map(b => {
    let badgeClass = "status-pending";
    let reviewBtn = "";
    if (b.status === "เสร็จสิ้น") {
      badgeClass = "status-success";
      reviewBtn = `<button class="btn-review" onclick="openReviewModal('${b.technician_id}', '${b.tech_name}')" style="margin-left:8px; background:#f59e0b; color:white; border:none; border-radius:4px; padding:4px 10px; cursor:pointer; font-family:'Sarabun', sans-serif; font-size:12px; font-weight:600;">⭐ รีวิว</button>`;
    }
    if (b.status === "ยกเลิกแล้ว") badgeClass = "status-cancel";
    if (b.status === "กำลังดำเนินการ") badgeClass = "status-progress";
    
    const d = new Date(b.created_at).toLocaleDateString('th-TH');
    return `<tr>
      <td>${d}</td>
      <td>${b.tech_name || 'ไม่ระบุ'}</td>
      <td>${b.category || 'ไม่ระบุ'}</td>
      <td>${b.problem_detail || 'ไม่ระบุ'}</td>
      <td><span class="status-badge ${badgeClass}">${b.status || 'รอดำเนินการ'}</span>${reviewBtn}</td>
    </tr>`;
  }).join("");
}

async function loadBuilds() {
  const { data, error } = await supabaseClient.from("orders").select("*").eq("user_id", currentUser.id).order("created_at", { ascending: false });
  const tbody = document.getElementById("tableBuilds");
  
  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-center">คุณยังไม่มีประวัติการสั่งสร้าง</td></tr>';
    return;
  }
  
  tbody.innerHTML = data.map(o => {
    const d = new Date(o.created_at).toLocaleDateString('th-TH');
    return `<tr>
      <td>${d}</td>
      <td>${o.building_type || 'บ้าน'} <br><small style="color:#666;">${o.house_name}</small></td>
      <td style="color:#2563eb; font-weight:600;">฿${Number(o.estimated_total || 0).toLocaleString()}</td>
      <td>${o.land_size}</td>
    </tr>`;
  }).join("");
}

async function loadMaterials() {
  const { data, error } = await supabaseClient.from("material_orders").select("*").eq("customer_id", currentUser.id).order("created_at", { ascending: false });
  const tbody = document.getElementById("tableMaterials");
  
  if (!error && data && data.length > 0) {
    tbody.innerHTML = data.map(m => {
      const d = new Date(m.created_at).toLocaleDateString('th-TH');
      return `<tr>
        <td>${d}</td>
        <td>${m.product_name}</td>
        <td style="color:#2563eb; font-weight:600;">฿${Number(m.price).toLocaleString()}</td>
        <td>${m.address || '-'}</td>
      </tr>`;
    }).join("");
  } else {
    tbody.innerHTML = '<tr><td colspan="4" class="text-center">คุณยังไม่มีประวัติการสั่งซื้อวัสดุ</td></tr>';
  }
}

function switchTab(tabId) {
  document.querySelectorAll('.tab-pane').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.menu-btn').forEach(btn => btn.classList.remove('active'));
  
  document.getElementById(tabId).classList.add('active');
  document.querySelector(`button[onclick="switchTab('${tabId}')"]`).classList.add('active');
}

async function logout() {
  await supabaseClient.auth.signOut();
  window.location.href = "login.html";
}

// ===== REVIEW FEATURE =====

function openReviewModal(techId, techName) {
  currentReviewTechId = techId;
  currentReviewTechName = techName;
  currentRating = 0;
  
  if (!techId || techId === 'null') {
    alert("ข้อมูลช่างไม่สมบูรณ์ ไม่สามารถรีวิวได้");
    return;
  }
  
  document.getElementById("reviewTechName").innerText = "ช่าง: " + (techName || 'ช่างมืออาชีพ');
  document.getElementById("reviewComment").value = "";
  
  const stars = document.querySelectorAll("#starRating span");
  stars.forEach(s => s.classList.remove("selected", "hover"));
  
  document.getElementById("reviewModal").classList.add("show");
}

function closeReviewModal() {
  document.getElementById("reviewModal").classList.remove("show");
  currentReviewTechId = null;
}

document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  
  const stars = document.querySelectorAll("#starRating span");
  stars.forEach(star => {
    star.addEventListener('mouseover', function() {
      const val = parseInt(this.getAttribute('data-value'));
      stars.forEach(s => {
        if (parseInt(s.getAttribute('data-value')) <= val) s.classList.add('hover');
        else s.classList.remove('hover');
      });
    });
    
    star.addEventListener('mouseout', function() {
      stars.forEach(s => s.classList.remove('hover'));
    });
    
    star.addEventListener('click', function() {
      currentRating = parseInt(this.getAttribute('data-value'));
      stars.forEach(s => {
        if (parseInt(s.getAttribute('data-value')) <= currentRating) s.classList.add('selected');
        else s.classList.remove('selected');
      });
    });
  });
});

async function submitReview() {
  if (currentRating === 0) {
    alert("กรุณาให้คะแนนดาวอย่างน้อย 1 ดาว");
    return;
  }
  
  const comment = document.getElementById("reviewComment").value.trim();
  const btn = document.getElementById("btnSubmitReview");
  btn.innerText = "⏳ กำลังส่ง...";
  btn.disabled = true;

  const { error } = await supabaseClient.from("reviews").insert([{
    technician_id: currentReviewTechId,
    customer_id: currentUser.id,
    customer_name: (document.getElementById("inputName").value || currentUser.email),
    rating: currentRating,
    comment: comment
  }]);

  btn.innerText = "ส่งรีวิว";
  btn.disabled = false;

  if (error) {
    alert("เกิดข้อผิดพลาดในการส่งรีวิว: " + error.message);
  } else {
    alert("✅ ส่งรีวิวให้ " + (currentReviewTechName||'ช่าง') + " เรียบร้อยแล้ว ขอบคุณที่ใช้บริการครับ!");
    closeReviewModal();
    loadReviews();
    updateTechAverageRating(currentReviewTechId);
  }
}

async function updateTechAverageRating(techId) {
  try {
    const { data: reviews } = await supabaseClient.from("reviews").select("rating").eq("technician_id", techId);
    if (reviews && reviews.length > 0) {
      const avg = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
      await supabaseClient.from("technicians").update({ rating: avg.toFixed(1) }).eq("id", techId);
    }
  } catch (err) {
    console.error("Error updating tech rating:", err);
  }
}

async function loadReviews() {
  const { data, error } = await supabaseClient.from("reviews")
    .select("*, technicians(name)")
    .eq("customer_id", currentUser.id)
    .order("created_at", { ascending: false });
    
  const tbody = document.getElementById("tableReviews");
  
  if (error || !data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-center">คุณยังไม่ได้รีวิวช่างคนไหน</td></tr>';
    return;
  }
  
  tbody.innerHTML = data.map(r => {
    const d = new Date(r.created_at).toLocaleDateString('th-TH');
    const stars = `<span style="color:#f59e0b;">${'⭐'.repeat(r.rating)}</span>`;
    const techName = (r.technicians && r.technicians.name) ? r.technicians.name : 'ช่างที่เคยเรียกบริการ';
    return `<tr>
      <td>${d}</td>
      <td>${techName}</td>
      <td>${stars}</td>
      <td>${r.comment || '-'}</td>
    </tr>`;
  }).join("");
}
