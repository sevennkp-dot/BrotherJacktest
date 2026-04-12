const SUPABASE_URL = "https://uqcjajmqtlchftpqwsrp.supabase.co";
const SUPABASE_KEY = "sb_publishable_yWZiH8l1idY0QWGuj6p9sg_GqXPONGX";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser = null;
let currentReviewTechId = null;
let currentReviewTechName = null;
let currentReviewBookingId = null;
let currentRating = 0;
let locationData = {
  "นครพนม": {
    "เมืองนครพนม": ["ในเมือง", "หนองญาติ", "อาจสามารถ"],
    "ศรีสงคราม": ["ศรีสงคราม", "บ้านเอื้อง", "ท่าบ่อสงคราม"]
  },
  "มุกดาหาร": {
    "เมืองมุกดาหาร": ["มุกดาหาร", "บางทรายใหญ่", "ศรีบุญเรือง"]
  },
  "กาฬสินธุ์": {
    "เมืองกาฬสินธุ์": ["เมืองกาฬสินธุ์", "ยางตลาด", "กมลาไสย"]
  },
  "อุดรธานี": {
    "เมืองอุดรธานี": ["หมากแข้ง", "บ้านเลื่อม", "หนองบัว"]
  },
  "หนองคาย": {
    "เมืองหนองคาย": ["หนองคาย", "โพธิ์ชัย", "กวนวัน"]
  },
  "บึงกาฬ": {
    "เมืองบึงกาฬ": ["บึงกาฬ", "บึงกาฬกลาง", "นาสวรรค์"]
  }
};

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
  const { data, error } = await supabaseClient.from("customers").select("*").eq("id", currentUser.id).maybeSingle();
  
  const displayName = data?.name || currentUser?.email || 'ผู้ใช้งาน';
  document.getElementById("profileName").innerText = displayName;
  
  const avatarImg = document.getElementById("avatarImage");
  const avatarPlaceholder = document.getElementById("profileAvatar");

  if (data?.avatar_url) {
    avatarImg.src = data.avatar_url;
    avatarImg.style.display = "block";
    avatarPlaceholder.style.display = "none";
  } else {
    avatarImg.style.display = "none";
    avatarPlaceholder.style.display = "flex";
    avatarPlaceholder.innerText = displayName.charAt(0).toUpperCase();
  }

  if (data) {
    document.getElementById("inputName").value = data.name || "";
    document.getElementById("inputPhone").value = data.phone || "";
    document.getElementById("inputLine").value = data.line_id || "";
    
    // Set Location Dropdowns
    if (data.province) {
      document.getElementById("province").value = data.province;
      updateDistricts();
      if (data.district) {
        document.getElementById("district").value = data.district;
        updateSubdistricts();
        if (data.subdistrict) {
          document.getElementById("subdistrict").value = data.subdistrict || "";
        }
      }
    }
    
    document.getElementById("inputHouseNo").value = data.house_no || "";
    document.getElementById("inputVillage").value = data.village || "";
    document.getElementById("inputAlley").value = data.alley || "";
    document.getElementById("inputStreet").value = data.street || "";
    document.getElementById("inputAddress").value = data.address || "";
  } else {
    document.getElementById("inputName").value = "";
    document.getElementById("inputPhone").value = "";
    document.getElementById("inputLine").value = "";
    document.getElementById("province").value = "";
    document.getElementById("district").innerHTML = '<option value="">เลือกอำเภอ</option>';
    document.getElementById("subdistrict").innerHTML = '<option value="">เลือกตำบล</option>';
    document.getElementById("inputHouseNo").value = "";
    document.getElementById("inputVillage").value = "";
    document.getElementById("inputAlley").value = "";
    document.getElementById("inputStreet").value = "";
    document.getElementById("inputAddress").value = "";
  }
}

async function updateProfile(e) {
  e.preventDefault();
  const name = document.getElementById("inputName").value;
  const phone = document.getElementById("inputPhone").value;
  const line_id = document.getElementById("inputLine").value;
  const province = document.getElementById("province").value;
  const district = document.getElementById("district").value;
  const subdistrict = document.getElementById("subdistrict").value;
  const house_no = document.getElementById("inputHouseNo").value;
  const village = document.getElementById("inputVillage").value;
  const alley = document.getElementById("inputAlley").value;
  const street = document.getElementById("inputStreet").value;
  const address = document.getElementById("inputAddress").value;

  const btn = document.getElementById("btnSaveProfile");
  btn.innerText = "⏳ กำลังบันทึก...";
  btn.disabled = true;
  
  const { error } = await supabaseClient.from("customers").upsert({
    id: currentUser.id, 
    name: name, 
    phone: phone, 
    line_id: line_id,
    province: province,
    district: district,
    subdistrict: subdistrict,
    house_no: house_no,
    village: village,
    alley: alley,
    street: street,
    address: address,
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

async function uploadAvatar(input) {
  if (!input.files || input.files.length === 0) return;
  const file = input.files[0];
  const fileExt = file.name.split('.').pop();
  const fileName = `${currentUser.id}-${Math.random()}.${fileExt}`;
  const filePath = `customer-avatars/${fileName}`;

  const btn = document.querySelector(".avatar-edit-badge");
  btn.innerText = "⏳";

  try {
    // 1. Upload to Supabase Storage (Bucket must be 'ssss' or similar, using 'ssss' as seen in HTML logo)
    // Assuming bucket name is 'ssss' based on line 16 of customer-profile.html
    const { data: uploadData, error: uploadErr } = await supabaseClient.storage
      .from('ssss')
      .upload(filePath, file);

    if (uploadErr) throw uploadErr;

    // 2. Get Public URL
    const { data: { publicUrl } } = supabaseClient.storage
      .from('ssss')
      .getPublicUrl(filePath);

    // 3. Update Profile with new avatar_url
    // Include name in upsert to satisfy NOT NULL constraint if record doesn't exist yet
    const currentName = document.getElementById("inputName").value || "New User";
    
    const { error: updateErr } = await supabaseClient.from("customers").upsert({
      id: currentUser.id,
      name: currentName,
      avatar_url: publicUrl,
      updated_at: new Date()
    });

    if (updateErr) throw updateErr;

    alert("✅ เปลี่ยนรูปโปรไฟล์สำเร็จ");
    loadProfile();
  } catch (err) {
    console.error(err);
    alert("เกิดข้อผิดพลาดในการอัปโหลด: " + err.message);
  } finally {
    btn.innerText = "📷";
  }
}

async function loadRepairs() {
  const { data, error } = await supabaseClient.from("bookings").select("*").eq("customer_id", currentUser.id).order("created_at", { ascending: false });
  
  // Fetch existing reviews to identify which bookings have already been reviewed
  const { data: reviewsData } = await supabaseClient.from("reviews").select("booking_id").eq("customer_id", currentUser.id);
  const reviewedIds = new Set(reviewsData?.map(r => String(r.booking_id)) || []);

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
      
      // Only show the review button if NOT already reviewed
      if (!reviewedIds.has(String(b.id))) {
        const actualTechId = b.technician_uuid || b.technician_id || 'null';
        reviewBtn = `<button class="btn-review" onclick="openReviewModal('${actualTechId}', '${b.tech_name}', '${b.id}')" style="margin-left:8px; background:#f59e0b; color:white; border:none; border-radius:4px; padding:4px 10px; cursor:pointer; font-family:'Sarabun', sans-serif; font-size:12px; font-weight:600;">⭐ รีวิว</button>`;
      }
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

// ===== LOCATION (DROPDOWNS) =====
function updateDistricts() {
  const province = document.getElementById("province").value;
  const districtSelect = document.getElementById("district");
  districtSelect.innerHTML = '<option value="">เลือกอำเภอ</option>';
  document.getElementById("subdistrict").innerHTML = '<option value="">เลือกตำบล</option>';

  if (!locationData[province]) return;

  Object.keys(locationData[province]).forEach(dist => {
    const option = document.createElement("option");
    option.value = dist;
    option.textContent = dist;
    districtSelect.appendChild(option);
  });
}

function updateSubdistricts() {
  const province = document.getElementById("province").value;
  const district = document.getElementById("district").value;
  const subdistrictSelect = document.getElementById("subdistrict");
  subdistrictSelect.innerHTML = '<option value="">เลือกตำบล</option>';

  if (!locationData[province] || !locationData[province][district]) return;

  locationData[province][district].forEach(sub => {
    const option = document.createElement("option");
    option.value = sub;
    option.textContent = sub;
    subdistrictSelect.appendChild(option);
  });
}

// ===== REVIEW FEATURE =====

function openReviewModal(techId, techName, bookingId) {
  currentReviewTechId = techId;
  currentReviewTechName = techName;
  currentReviewBookingId = bookingId;
  currentRating = 0;
  
  if (!techId || techId === 'null' || techId === 'undefined') {
    alert("ขออภัย ข้อมูลช่างในระบบไม่สมบูรณ์ (Missing Technician ID) จึงไม่สามารถรับรีวิวได้ในขณะนี้ กรุณาติดต่อแอดมินครับ");
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
  currentReviewBookingId = null;
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
    booking_id: currentReviewBookingId,
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
    loadRepairs(); // Refresh to hide the review button
    loadReviews();
    updateTechAverageRating(currentReviewTechId);
  }
}

async function updateTechAverageRating(techId) {
  if (!techId || techId === 'null') {
    console.warn("Cannot update rating: Missing technician ID");
    return;
  }
  
  try {
    // 1. Fetch current average from reviews table
    const { data: reviews, error: fetchErr } = await supabaseClient.from("reviews").select("rating").eq("technician_id", techId);
    if (fetchErr) throw fetchErr;

    if (reviews && reviews.length > 0) {
      const avg = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
      const roundedAvg = parseFloat(avg.toFixed(1));

      // 2. Update the technician table (This might fail if RLS is strict - but we recommend the SQL trigger instead)
      const { error: updateErr } = await supabaseClient.from("technicians").update({ rating: roundedAvg }).eq("id", techId);
      
      if (updateErr) {
        console.warn("Client-side rating update failed (likely RLS). We recommend using the provided SQL trigger for reliable updates:", updateErr);
      } else {
        console.log("✅ Managed to update technician rating from client-side.");
      }
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
