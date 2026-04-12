// ===== CONFIGURATION =====
const SUPABASE_URL = "https://uqcjajmqtlchftpqwsrp.supabase.co";
const SUPABASE_KEY = "sb_publishable_yWZiH8l1idY0QWGuj6p9sg_GqXPONGX";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const AI_CHAT_WEBHOOK = "https://sevenican4.app.n8n.cloud/webhook/b89fb2e1-4eb2-43f3-9c26-d83d0fcdc97e";

// ===== STATE ===== 
let technicians = [];
let currentTech = null;
let currentTechImageIndex = 0;
let currentTechImages = [];
let currentUser = null;

window.togglePriceGuide = function(e) {
  const modal = document.getElementById('priceGuideModal');
  if (!modal) return;
  
  // If event exists, check if we should ignore it (e.g. clicking inside modal content)
  if (e) {
    // Only close if clicking the backdrop (currentTarget) or a close element
    const isBackdrop = e.target === e.currentTarget;
    const isCloseBtn = e.target.classList.contains('close-modal') || e.target.tagName === 'BUTTON' || e.target.closest('.close-modal');
    
    if (!isBackdrop && !isCloseBtn) return;
    
    // Stop propagation to prevent double-triggering if nested
    e.stopPropagation();
  }
  
  if (modal.style.display === 'none' || !modal.style.display) {
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden'; // Prevent scroll when modal is open
  } else {
    modal.style.display = 'none';
    document.body.style.overflow = ''; // Restore scroll
  }
};

const subCategoryData = {
  "ช่างตามบ้าน": ["ไม้", "ไฟฟ้า", "ประปา", "ปูน", "ช่างโครงสร้าง", "ช่างรางน้ำ", "ช่างหลังคา", "ช่างโซล่าเซลล์", "ช่างเชื่อม", "ช่างสี", "ช่างถมดิน", "ช่างแอร์", "ช่างต้นไม้", "ช่างกระจก", "ช่างอลูมิเนียม"],
  "ช่างยนต์": ["🚗 ช่างเครื่องยนต์ (Engine Mechanic)", "⚡ ช่างไฟฟ้ารถยนต์ (Auto Electrician)", "❄️ ช่างแอร์รถยนต์ (Car Air Conditioning)", "🛞 ช่างช่วงล่าง / เบรก / ล้อ (Suspension & Brake)", "🛢️ ช่างบำรุงรักษา (Maintenance)", "🚘 ช่างเกียร์ (Transmission)", "🔩 ช่างตัวถัง / สี (Body & Paint)", "🔍 ช่างวิเคราะห์ระบบ (Diagnostic)", "🚙 ช่างรถเฉพาะทาง", "🔋 ช่างรถไฟฟ้า (EV Specialist)"],
  "ช่างทำฟาร์มทำโรงเรือน": ["ช่่างโดรน", "ช่่างสวน", "ช่างวางระบบน้ำ", "ช่่างขุดสระ", "ช่่างขุดเจาะบาดาน"],
  "แม่บ้านพี่เลี้ยงเด็กและคนชรา": ["ช่างเย็บ", "ช่างรองเท้า", "ช่างตัดชุด", "แม่บ้านพี่เลี้ยงเด็กคนชรา", "👶 พี่เลี้ยงเด็ก (Babysitter / Nanny)", "👵 ดูแลผู้สูงอายุ (Elderly Caregiver)", "🏥 ผู้ช่วยพยาบาล / ดูแลผู้ป่วย (Caregiver / Nurse Assistant)", "🍳 แม่ครัว / คนทำอาหาร (Cook)", "🐶 คนดูแลสัตว์เลี้ยง (Pet Care)"],
  "ช่างอิเล็คทรอนิกส์และ iot": ["🔧 ซ่อมอุปกรณ์อิเล็กทรอนิกส์ (Electronics Repair)", "📡 ติดตั้งระบบ Smart Home", "📷 ระบบกล้องวงจรปิด (CCTV)", "🌐 ระบบ IoT (Internet of Things)", "🧠 งานเขียนโปรแกรม / ควบคุม (Embedded / IoT Dev)", "🔋 ระบบพลังงาน & อุปกรณ์ไฟฟ้าอัจฉริยะ", "🚪 ระบบความปลอดภัยอัจฉริยะ"],
  "ช่างสารสนเทศ": ["🖥️ ซ่อมคอมพิวเตอร์ / โน้ตบุ๊ก", "🌐 ระบบเครือข่าย (Network)", "🔐 ระบบความปลอดภัย IT (Cybersecurity เบื้องต้น)", "☁️ ระบบ Cloud / Server", "📱 ซ่อมมือถือ / อุปกรณ์ไอที", "🧑💻 พัฒนาเว็บไซต์ / แอป", "📊 ระบบธุรกิจ / Software", "🎓 สอน / ให้คำปรึกษา IT"],
  "ช่างออเกไนท์(อีเว้นท์)": ["รับจัดงานเปิดตัวบริษัทห้างร้านธนาคาร", "รับจัดงานแข่งขันวิชาการงานกีฬา", "รับจัดงานประกวดนางงาม", "🎈 จัดงานทั่วไป (Event Organizer)", "💍 งานแต่งงาน (Wedding Organizer)", "🎤 เวที แสง สี เสียง (Production)", "🎪 ตกแต่งสถานที่ (Decoration)", "📸 ช่างภาพ / วิดีโอ", "🎭 พิธีกร / นักแสดง / ดนตรี", "🍱 อาหาร / Catering", "🚚 อุปกรณ์ & โลจิสติกส์"]
};

window.updateSkillDropdown = function() {
  const category = document.getElementById('categoryFilter').value;
  const skillDropdown = document.getElementById('skillDropdown');
  
  // Clear existing options except "All"
  skillDropdown.innerHTML = '<option value="all">ทั้งหมด</option>';
  
  if (category && subCategoryData[category]) {
    subCategoryData[category].forEach(skill => {
      const option = document.createElement('option');
      option.value = skill.toLowerCase();
      option.textContent = skill;
      skillDropdown.appendChild(option);
    });
  }
};
let currentConversation = null;
let messagesSubscription = null;
let aiChatWidgetOpen = false;
let appliedPromoData = null;

const locationData = {
  "นครพนม": {
    "เมืองนครพนม": ["ในเมือง", "หนองญาติ", "อาจสามารถ"],
    "ศรีสงคราม": ["ศรีสงคราม", "บ้านเอื้อง", "ท่าบ่อสงคราม"]
  },
  "มุกดาหาร": {
    "เมืองมุกดาหาร": ["มุกดาหาร", "บางทรายใหญ่", "ศรีบุญเรือง"]
  },
  "กาฬสินธุ์": {
    "เมืองกาฬสินธุ์": ["กาฬสินธุ์", "ปล้องโยง", "ลือชา"]
  },
  "อุดรธานี": {
    "เมืองอุดรธานี": ["หมากแข้ง", "บ้านเลื่อม", "หนองบัว"]
  },
  "หนองคาย": {
    "เมืองหนองคาย": ["หนองคาย", "ศรีเชียงใหม่", "ท่าลี่"]
  },
  "บึงกาฬ": {
    "เมืองบึงกาฬ": ["บึงกาฬ", "นามน้อย", "สตึก"]
  }
};

// ===== AUTHENTICATION =====
async function checkAuth() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  
  if (session) {
    currentUser = session.user;

    const { data: customerInfo } = await supabaseClient
      .from("customers")
      .select("name, phone, address, province, district, subdistrict, line_id, house_no, village, alley, street")
      .eq("id", currentUser.id)
      .single();

    // Store globally for auto-filling
    window.currentUserData = customerInfo;

    // UI update begins (synchronous block)
    const userName = customerInfo?.name || currentUser.email;
    const initial = userName.charAt(0).toUpperCase();
    
    document.getElementById("authUserInfo").style.display = "block";
    document.getElementById("authLoginBtn").style.display = "none";
    document.getElementById("userName").innerText = userName;
    document.getElementById("userInitial").innerText = initial;

    // Fetch tech and profile info separately for modularity
    const { data: techInfo } = await supabaseClient.from("technicians").select("id").eq("id", currentUser.id).single();
    const { data: profileObj } = await supabaseClient.from("profiles").select("role").eq("id", currentUser.id).single();

    if (techInfo) {
      const applyNode = document.getElementById("navApply");
      if (applyNode) applyNode.style.display = "none";
    }

    // Add Admin/Technician dashboard links
    const dashLinkContainer = document.getElementById("roleDashboardLink");
    if (dashLinkContainer) {
      dashLinkContainer.innerHTML = ""; 
      
      if (profileObj?.role === 'admin') {
        const adminBtn = document.createElement("a");
        adminBtn.href = "admin.html";
        adminBtn.innerHTML = "🛠️ แอดมิน";
        adminBtn.style.cssText = "color: #e74c3c; font-weight: 600; margin-left: 12px; text-decoration: none;";
        dashLinkContainer.appendChild(adminBtn);
      }
      
      if (techInfo) {
        const techBtn = document.createElement("a");
        techBtn.href = "technician-dashboard.html";
        techBtn.innerHTML = "👨‍🔧 แดชบอร์ดช่าง";
        techBtn.style.cssText = "color: #10b981; font-weight: 600; margin-left: 12px; text-decoration: none;";
        dashLinkContainer.appendChild(techBtn);
      }
    }
  } else {
    document.getElementById("authUserInfo").style.display = "none";
    document.getElementById("authLoginBtn").style.display = "block";
  }
}

async function logout() {
  await supabaseClient.auth.signOut();
  currentUser = null;
  window.location.href = "login.html";
}

// ===== TECHNICIAN LOADING =====
async function loadTechnicians() {
  const container = document.getElementById("technicianList");
  container.innerHTML = "<p style='text-align:center; grid-column: 1/-1;'>กำลังโหลดข้อมูล...</p>";

  const { data, error } = await supabaseClient
    .from("technicians")
    .select(`
      *,
      technician_images (
        image_url
      )
    `)
    // .eq('is_online', true) // Removed: always show technicians on website
    .order("created_at", { ascending: false });

  if (error) {
    console.error("❌ Error loading technicians:", error);
    container.innerHTML = "<p style='color: #e74c3c; text-align:center; grid-column: 1/-1;'>เกิดข้อผิดพลาดในการโหลดข้อมูล</p>";
    return;
  }

  technicians = data || [];

  if (technicians.length === 0) {
    document.getElementById('noData').style.display = "block";
    container.innerHTML = "";
    return;
  }

  document.getElementById('noData').style.display = "none";
  renderTechnicians(technicians);
}

function renderTechnicians(list) {
  const container = document.getElementById("technicianList");
  container.innerHTML = "";

  list.forEach((tech, index) => {
    const firstImage = (tech.profile_image)
      ? tech.profile_image
      : (tech.technician_images && tech.technician_images.length > 0 && tech.technician_images[0].image_url)
        ? tech.technician_images[0].image_url
        : "https://uqcjajmqtlchftpqwsrp.supabase.co/storage/v1/object/public/ssss/technician-placeholder.png";

    const skillClass = tech.skill_level === 'Gold' ? 'skill-gold' : tech.skill_level === 'Silver' ? 'skill-silver' : 'skill-bronze';
    const rateClass = tech.rate_type === 'เหมา' ? 'rate-fixed' : tech.rate_type === 'รายวัน' ? 'rate-daily' : 'rate-hourly';
    const rateText = tech.daily_rate ? `${parseFloat(tech.daily_rate).toLocaleString()} ฿ / ${tech.rate_type || 'งาน'}` : 'ราคาตามตกลง';

    const startingPriceText = tech.starting_price ? `<div style="font-size:14px; color:#1e293b; margin-bottom:4px;">🏷️ ราคาเริ่มต้น: <span style="font-weight:600; color:#059669;">${tech.starting_price}</span></div>` : '';
    const travelFeeText = tech.travel_fee ? `<div style="font-size:13px; color:#64748b; margin-bottom:4px;">🚗 ค่าเดินทาง: ${tech.travel_fee}</div>` : '';
    const freeDistanceText = (tech.free_distance > 0) ? `<div style="font-size:12px; color:#10b981; margin-bottom:8px;">📍 ฟรี ${tech.free_distance} กม. แรก</div>` : '';

    const locationText = [tech.subdistrict, tech.district, tech.province].filter(Boolean).join(' ') || tech.area || 'ไม่ระบุพื้นที่';

    const card = document.createElement('div');
    card.className = 'tech-card';
    card.innerHTML = `
      <div style="position:relative;">
        <img src="${firstImage}" alt="${tech.name}" onerror="this.src='https://via.placeholder.com/400x300?text=ไม่มีรูป'">
        ${tech.skill_level ? `<div style="position:absolute; top:10px; left:10px;" class="skill-badge ${skillClass}">${tech.skill_level}</div>` : ''}
      </div>
      <div class="tech-info" onclick="openBooking(${index})">
        <h3>${tech.name}</h3>
        <p style="margin: 4px 0; font-weight: 600; font-size: 13px; color: ${tech.is_online !== false ? '#10b981' : '#ef4444'};">${tech.is_online !== false ? '🟢 ว่าง พร้อมรับงาน' : '🔴 ไม่ว่าง'}</p>
        <p>🔧 <strong>หมวดหมู่:</strong> ${tech.category}</p>
        <p class="expertise-text">🛠️ <strong>ประเภทงาน:</strong> ${tech.expertise || tech.category}</p>
        <p>📍 <strong>พื้นที่:</strong> ${locationText}</p>
        <p>⚡ <strong>ความด่วน:</strong> ${tech.availability_urgency === 'รับทั้ง 2 แบบ' ? 'รับงานล่วงหน้า ,รับงานทันที' : (tech.availability_urgency || 'รับงานล่วงหน้า')}</p>
        <p>⏱️ <strong>ประสบการณ์:</strong> ${tech.experience_years || '1 ปี'} </p>
        
        <div style="margin-top: 10px; border-top: 1px solid #f1f5f9; padding-top: 10px;">
          ${startingPriceText}
          ${travelFeeText}
          ${freeDistanceText}
        </div>

        <div class="tech-price-tag">💰 ${rateText}</div>
        <p class="tech-rating" style="display: flex; gap: 8px; align-items: center; margin-top:10px;">
          <span style="color:#f59e0b; letter-spacing: 2px;">
            ${tech.rating > 0 ? '⭐'.repeat(Math.round(parseFloat(tech.rating))) : '<span style="font-size:11px; vertical-align:middle; background:var(--primary-light); color:var(--primary); padding:2px 8px; border-radius:10px; font-weight:700;">🆕 ใหม่</span>'}
          </span> 
          <strong>${tech.rating > 0 ? parseFloat(tech.rating).toFixed(1) : ""}</strong>
        </p>
        <div class="tech-buttons" style="margin-top:15px;">
          ${(currentUser && currentUser.id === tech.id) 
            ? `<div style="background: #f3f4f6; color: #6b7280; padding: 8px; border-radius: 6px; text-align: center; font-weight: 600; width: 100%;">👤 นี่คือโปรไฟล์ของคุณ</div>`
            : `
              <button onclick="event.stopPropagation(); openBooking(${index})">📂 ดูโปรไฟล์</button>
              ${currentUser ? `<button class="btn-chat" onclick="event.stopPropagation(); openChat(${index})">💬 แชท</button>` : ''}
            `
          }
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

function filterTechnicians() {
  const category = document.getElementById("categoryFilter").value;
  const skillSearch = document.getElementById("skillDropdown")?.value.toLowerCase().trim() || "all";
  const availability = document.getElementById("availabilityFilter")?.value || "all";
  const province = document.getElementById("filterProvince")?.value || "all";
  const district = document.getElementById("filterDistrict")?.value || "all";
  const subdistrict = document.getElementById("filterSubdistrict")?.value || "all";

  const filtered = technicians.filter(t => {
    if (category !== "all" && t.category !== category) return false;

    if (skillSearch !== "all") {
      const expertise = (t.expertise || "").toLowerCase();
      if (!expertise.includes(skillSearch)) return false;
    }

    if (availability !== "all") {
      if (availability === "รับงานทันที") {
        if (t.availability_urgency !== "รับงานทันที" && 
            t.availability_urgency !== "รับทั้ง 2 แบบ" && 
            t.availability_urgency !== "รับงานล่วงหน้า ,รับงานทันที") return false;
      } else if (availability === "รับงานล่วงหน้า") {
        if (t.availability_urgency !== "รับงานล่วงหน้า" && 
            t.availability_urgency !== "รับทั้ง 2 แบบ" && 
            t.availability_urgency !== "รับงานล่วงหน้า ,รับงานทันที") return false;
      } else if (availability === "รับงานล่วงหน้า ,รับงานทันที") {
        if (t.availability_urgency !== "รับทั้ง 2 แบบ" && 
            t.availability_urgency !== "รับงานล่วงหน้า ,รับงานทันที") return false;
      }
    }

    if (province !== "all") {
      if (t.province) {
        if (t.province !== province) return false;
      } else if (t.area && !t.area.includes(province)) {
        return false;
      }
    }

    if (district !== "all") {
       if (t.district) {
         if (t.district !== district) return false;
       } else if (t.area && !t.area.includes(district)) {
         return false;
       }
    }

    if (subdistrict !== "all") {
       if (t.subdistrict) {
         if (t.subdistrict !== subdistrict) return false;
       } else if (t.area && !t.area.includes(subdistrict)) {
         return false;
       }
    }

    return true;
  });

  renderTechnicians(filtered);
}

// ===== FILTER LOCATION UPDATE =====
function updateFilterDistricts() {
  const province = document.getElementById("filterProvince").value;
  const districtSelect = document.getElementById("filterDistrict");
  districtSelect.innerHTML = '<option value="all">ทั้งหมด</option>';
  document.getElementById("filterSubdistrict").innerHTML = '<option value="all">ทั้งหมด</option>';

  if (province === "all" || !locationData[province]) return;

  Object.keys(locationData[province]).forEach(district => {
    const option = document.createElement("option");
    option.value = district;
    option.textContent = district;
    districtSelect.appendChild(option);
  });
}

function updateFilterSubdistricts() {
  const province = document.getElementById("filterProvince").value;
  const district = document.getElementById("filterDistrict").value;
  const subdistrictSelect = document.getElementById("filterSubdistrict");
  subdistrictSelect.innerHTML = '<option value="all">ทั้งหมด</option>';

  if (province === "all" || district === "all" || !locationData[province] || !locationData[province][district]) return;

  locationData[province][district].forEach(subdistrict => {
    const option = document.createElement("option");
    option.value = subdistrict;
    option.textContent = subdistrict;
    subdistrictSelect.appendChild(option);
  });
}

function openBooking(index) {
  currentTech = technicians[index];
  currentTechImageIndex = 0;

  // Images for Slider
  let images = [];
  if (currentTech.profile_image) images.push(currentTech.profile_image);
  if (currentTech.technician_images && currentTech.technician_images.length > 0) {
    currentTech.technician_images.forEach(img => {
      if(img.image_url && img.image_url !== currentTech.profile_image) images.push(img.image_url);
    });
  }
  if (images.length === 0) images = ["https://uqcjajmqtlchftpqwsrp.supabase.co/storage/v1/object/public/ssss/technician-placeholder.png"];
  currentTechImages = images;

  // Basic Header Info
  const locationText = [currentTech.subdistrict, currentTech.district, currentTech.province].filter(Boolean).join(' ') || currentTech.area || 'ไม่ระบุพื้นที่';
  document.getElementById("selectedTech").innerText = currentTech.name;
  const ratingDisplay = currentTech.rating > 0 
    ? `⭐ ${parseFloat(currentTech.rating).toFixed(1)}` 
    : '<span style="font-size:12px; vertical-align:middle; background:var(--primary-light); color:var(--primary); padding:2px 10px; border-radius:12px; font-weight:700; margin-left:8px;">🆕 ใหม่ (New)</span>';
  document.getElementById("techDetails").innerHTML = `${currentTech.category} | ${locationText} | ประสบการณ์ ${currentTech.experience_years || '1 ปี'} | ${ratingDisplay}`;
  
  const skillClass = currentTech.skill_level === 'Gold' ? 'skill-gold' : currentTech.skill_level === 'Silver' ? 'skill-silver' : 'skill-bronze';
  document.getElementById("techSkillBadgeContainer").innerHTML = currentTech.skill_level ? `<span class="skill-badge ${skillClass}">${currentTech.skill_level} Rank</span>` : '';

  // Main Info
  document.getElementById("techSellingPoints").innerText = currentTech.selling_points || "มุ่งมั่นให้บริการด้วยคุณภาพและความซื่อสัตย์";
  document.getElementById("techTools").innerText = `🛠️ เครื่องมือหลัก: ${currentTech.tools || 'เครื่องมือช่างพื้นฐานครบชุด'}`;
  
  // Expertise Tags
  const expTags = (currentTech.expertise || currentTech.category || "").split(/[,|\n]/).filter(t => t.trim());
  document.getElementById("techExpertiseTags").innerHTML = expTags.map(tag => `<span class="tag">${tag.trim()}</span>`).join("");

  // Experience List
  const expItems = (currentTech.experience || "เชี่ยวชาญงานด้าน " + currentTech.category).split("\n").filter(t => t.trim());
  document.getElementById("techExperienceList").innerHTML = expItems.map(item => `
    <div class="exp-item">
      <div class="title">${item}</div>
    </div>
  `).join("");

  // Specs
  document.getElementById("specRate").innerText = currentTech.daily_rate ? `${parseFloat(currentTech.daily_rate).toLocaleString()} ฿ / ${currentTech.rate_type || 'งาน'}` : "ตามตกลง";
  document.getElementById("specStartingPrice").innerText = currentTech.starting_price || "-";
  document.getElementById("specTravelFee").innerText = currentTech.travel_fee || "ตามตกลง";
  document.getElementById("specFreeDistance").innerText = currentTech.free_distance ? `${currentTech.free_distance} กม.` : "0 กม.";
  document.getElementById("specHours").innerText = currentTech.work_hours || "08:00 - 17:00";
  document.getElementById("specUrgency").innerText = currentTech.availability_urgency || "ภายใน 24 ชม.";
  document.getElementById("specTeam").innerText = currentTech.team_size || "ช่างเดี่ยว";
  document.getElementById("specVehicle").innerText = currentTech.vehicle || "รถยนต์/มอเตอร์ไซค์";
  
  // Update QR Code with 10% deposit amount
  const techQrImg = document.getElementById('techQrCode');
  if (techQrImg) {
    let depositAmount = 0;
    const rate = parseFloat(currentTech.daily_rate);
    if (!isNaN(rate) && rate > 0) {
      depositAmount = Math.round(rate * 0.10);
      techQrImg.src = `https://promptpay.io/0621934749/${depositAmount}.png`;
    } else {
      techQrImg.src = `https://promptpay.io/0621934749.png`;
    }
  }

  // Slider & Thumbnails
  updateTechImage();
  const thumbnailContainer = document.getElementById("thumbnailContainer");
  thumbnailContainer.innerHTML = images.map((img, i) => 
    `<img src="${img}" class="${i === 0 ? 'active' : ''}" onclick="selectTechImage(${i})" alt="รูป ${i+1}">`
  ).join("");

  // Portfolio Images (Merge JSONB with related table images)
  const portfolioGrid = document.getElementById("techPortfolioGrid");
  portfolioGrid.innerHTML = "";
  
  // Collect all unique image URLs except the profile_image
  let allPortfolioImages = [];
  if (currentTech.portfolio_images && Array.isArray(currentTech.portfolio_images)) {
    allPortfolioImages = [...currentTech.portfolio_images];
  }
  if (currentTech.technician_images && currentTech.technician_images.length > 0) {
    currentTech.technician_images.forEach(img => {
      if(img.image_url && !allPortfolioImages.includes(img.image_url) && img.image_url !== currentTech.profile_image) {
        allPortfolioImages.push(img.image_url);
      }
    });
  }

  if (allPortfolioImages.length > 0) {
    allPortfolioImages.forEach(url => {
      const div = document.createElement('div');
      div.className = 'portfolio-item';
      div.innerHTML = `<img src="${url}" onclick="window.open('${url}', '_blank')">`;
      portfolioGrid.appendChild(div);
    });
  } else {
    portfolioGrid.innerHTML = "<p style='font-size:12px; color:#999;'>ยังไม่มีรูปผลงานเพิ่มเติม</p>";
  }

  // Load reviews
  const reviewsContainer = document.getElementById("techReviewsList");
  reviewsContainer.innerHTML = "กำลังโหลด...";
  supabaseClient.from("reviews")
    .select("rating, comment, customer_name, created_at")
    .eq("technician_id", currentTech.id)
    .order("created_at", { ascending: false })
    .then(({data, error}) => {
      if (error || !data || data.length === 0) {
        reviewsContainer.innerHTML = "<p style='color:#666; font-size:14px; text-align:center;'>ยังไม่มีรีวิวสำหรับช่างท่านนี้</p>";
        return;
      }
      reviewsContainer.innerHTML = data.map(r => `
        <div class="review-item" style="background:#f9fafb; padding:12px; border-radius:8px; margin-bottom:12px; border-left: 3px solid #f59e0b;">
          <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
            <strong style="font-size: 14px;">${r.customer_name || 'ลูกค้า'}</strong>
            <span style="color:#f59e0b; font-size:12px;">${'⭐'.repeat(Math.round(r.rating || 5))}</span>
          </div>
          <p style="margin:0; font-size:13px; color:#444;">${r.comment || ''}</p>
          <span style="font-size:11px; color:#999; margin-top:6px; display:block;">${new Date(r.created_at).toLocaleDateString('th-TH')}</span>
        </div>
      `).join("");
    });

  document.getElementById("serviceDate").value = "";
  document.getElementById("serviceTime").selectedIndex = 0;
  document.getElementById("serviceDate").dispatchEvent(new Event('change'));

  const promoInput = document.getElementById("promoCodeInput");
  const promoRes = document.getElementById("promoResultMsg");
  if(promoInput) { promoInput.value = ""; promoInput.disabled = false; }
  if(promoRes) { promoRes.style.display = "none"; promoRes.className = ""; }
  appliedPromoData = null;

  // Disable confirm button if it's the owner
  const btnConfirm = document.querySelector(".btn-confirm");
  if (currentUser && currentTech && currentUser.id === currentTech.id) {
    if (btnConfirm) {
      btnConfirm.disabled = true;
      btnConfirm.innerHTML = "🚫 ไม่สามารถจองงานตัวเองได้";
      btnConfirm.style.opacity = "0.5";
      btnConfirm.style.cursor = "not-allowed";
    }
  } else {
    if (btnConfirm) {
      btnConfirm.disabled = false;
      btnConfirm.innerHTML = "✅ ยืนยันการนัดหมาย";
      btnConfirm.style.opacity = "1";
      btnConfirm.style.cursor = "pointer";
    }
  }

  document.getElementById("bookingModal").classList.add('show');

  // Auto-fill from profile if logged in
  if (window.currentUserData) {
    const data = window.currentUserData;
    if (data.name) document.getElementById("customerName").value = data.name;
    if (data.phone) document.getElementById("customerPhone").value = data.phone;
    if (data.line_id) document.getElementById("customerLineId").value = data.line_id;
    if (data.house_no) document.getElementById("customerHouseNo").value = data.house_no;
    if (data.village) document.getElementById("customerVillage").value = data.village;
    if (data.alley) document.getElementById("customerAlley").value = data.alley;
    if (data.street) document.getElementById("customerStreet").value = data.street;
    if (data.address) document.getElementById("customerAddress").value = data.address;
    
    // Cascading Location Selects
    if (data.province) {
      document.getElementById("province").value = data.province;
      updateDistricts();
      if (data.district) {
        document.getElementById("district").value = data.district;
        updateSubdistricts();
        if (data.subdistrict) {
          document.getElementById("subdistrict").value = data.subdistrict;
        }
      }
    }
  }
}

window.applyPromoCode = async function() {
  const code = document.getElementById("promoCodeInput")?.value.trim().toUpperCase();
  const resultMsg = document.getElementById("promoResultMsg");
  
  if (!code) {
    resultMsg.style.display = "block";
    resultMsg.style.color = "var(--rose)";
    resultMsg.innerHTML = "❌ กรุณากรอกรหัสส่วนลด";
    return;
  }

  resultMsg.style.display = "block";
  resultMsg.style.color = "var(--text-muted)";
  resultMsg.innerHTML = "กำลังตรวจสอบ...";

  try {
    const { data, error } = await supabaseClient.from('campaigns').select('*').eq('code', code).maybeSingle();
    
    if (error || !data) {
      resultMsg.style.color = "var(--rose)";
      resultMsg.innerHTML = "❌ ไม่พบรหัสส่วนลดนี้ (หรือพิมพ์ผิด)";
      return;
    }

    if (data.status !== 'active') {
      resultMsg.style.color = "var(--rose)";
      resultMsg.innerHTML = "❌ โค้ดนี้ถูกระงับการใช้งานแล้ว";
      return;
    }

    const now = new Date();
    if (data.end_date && now > new Date(data.end_date)) {
      resultMsg.style.color = "var(--rose)";
      resultMsg.innerHTML = "❌ โค้ดส่วนลดหมดอายุแล้ว";
      return;
    }

    if (data.usage_limit && data.usage_count >= data.usage_limit) {
      resultMsg.style.color = "var(--rose)";
      resultMsg.innerHTML = "❌ สิทธิ์การใช้งานโค้ดนี้เต็มแล้ว";
      return;
    }

    // Success
    appliedPromoData = data;
    const discountText = data.discount_type === 'percentage' ? `${data.discount_value}%` : `${data.discount_value} บาท`;
    const minText = data.min_spend > 0 ? ` (ขั้นต่ำ ${data.min_spend} บ.)` : "";

    resultMsg.style.color = "var(--emerald)";
    resultMsg.innerHTML = `✅ ยืนยันสิทธิ์! โค้ด ${discountText}${minText} จะหักกับราคาประเมินหลังรับบริการ`;
    
    document.getElementById("promoCodeInput").disabled = true;

  } catch(e) {
    resultMsg.style.color = "var(--rose)";
    resultMsg.innerHTML = "❌ เกิดข้อผิดพลาด: " + e.message;
  }
};

function updateTechImage() {
  document.getElementById("techSliderImage").src = currentTechImages[currentTechImageIndex];
  document.querySelectorAll(".thumbnail-container img").forEach((img, i) => {
    img.classList.toggle("active", i === currentTechImageIndex);
  });
}

function nextTechImage() {
  currentTechImageIndex = (currentTechImageIndex + 1) % currentTechImages.length;
  updateTechImage();
}

function prevTechImage() {
  currentTechImageIndex = (currentTechImageIndex - 1 + currentTechImages.length) % currentTechImages.length;
  updateTechImage();
}

function selectTechImage(index) {
  currentTechImageIndex = index;
  updateTechImage();
}

function closeBooking() {
  document.getElementById("bookingModal").classList.remove('show');
}

async function confirmBooking() {
  const phone = document.getElementById("customerPhone").value.trim();
  const lineId = document.getElementById("customerLineId").value.trim();
  const houseNo = document.getElementById("customerHouseNo").value.trim();
  const village = document.getElementById("customerVillage").value.trim();
  const alley = document.getElementById("customerAlley").value.trim();
  const street = document.getElementById("customerStreet").value.trim();
  const problem = document.getElementById("problemDetail").value.trim();
  const province = document.getElementById("province").value;
  const district = document.getElementById("district").value;
  const subdistrict = document.getElementById("subdistrict").value;
  const address = document.getElementById("customerAddress").value.trim();
  const serviceDate = document.getElementById("serviceDate").value;
  const serviceTime = document.getElementById("serviceTime").value;
  const problemImageInput = document.getElementById("problemImage");
  const problemImageFile = problemImageInput.files[0];
  const bookingSlipInput = document.getElementById("bookingSlip");
  const bookingSlipFile = bookingSlipInput ? bookingSlipInput.files[0] : null;

  if (!currentTech) {
    alert("ไม่พบข้อมูลช่าง");
    return;
  }

  const phoneRegex = /^0[0-9]{8,9}$/;

  if (!name || !phone || !problem || !province || !district || !subdistrict) {
    alert("กรุณากรอกข้อมูลให้ครบถ้วน");
    return;
  }

  if (!phoneRegex.test(phone)) {
    alert("รูปแบบเบอร์โทรไม่ถูกต้อง");
    return;
  }

  if (!serviceDate || !serviceTime) {
    alert("กรุณาเลือกวันที่และเวลา");
    return;
  }

  // No upfront slip required for repair bookings

  // Determine actual mapped service time
  const mappedServiceTime = (() => {
    const timeMap = {
      'เช้า (08:00-12:00)': '08:00:00',
      'บ่าย (13:00-17:00)': '13:00:00',
      'เย็น (17:00-20:00)': '17:00:00',
      'ด่วน (ASAP)': '00:00:00'
    };
    return timeMap[serviceTime] || '08:00:00';
  })();

  const btnConfirm = document.querySelector(".btn-confirm");
  const originalBtnText = btnConfirm.innerHTML;
  btnConfirm.innerHTML = "⏳ กำลังตรวจสอบคิว...";
  btnConfirm.disabled = true;

  try {
    // Check for existing bookings on the same Date and Time
    const { data: existingBookings, error: checkError } = await supabaseClient
      .from("bookings")
      .select("id")
      .eq("technician_uuid", currentTech.id)
      .eq("service_date", serviceDate)
      .eq("service_time", mappedServiceTime)
      .not("status", "eq", "ยกเลิก"); // Ignore cancelled bookings

    if (checkError) throw checkError;

    if (existingBookings && existingBookings.length > 0) {
      alert(`ช่างไม่ว่างในคิวนี้ครับ\nมีลูกค้าท่านอื่นจองคิว "${serviceTime}" ของวันที่ ${new Date(serviceDate).toLocaleDateString('th-TH')} ไปแล้ว กรุณาเลื่อนเป็นเวลาอื่น`);
      return;
    }

    btnConfirm.innerHTML = "⏳ กำลังบันทึก...";

    let problemImageUrl = null;
    if (problemImageFile) {
      const fileExt = problemImageFile.name.split('.').pop();
      const fileName = `problem_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
      const filePath = `problem_images/${fileName}`;
      const { data: uploadData, error: uploadError } = await supabaseClient.storage.from('ssss').upload(filePath, problemImageFile);
      if (!uploadError) {
        const { data: publicData } = supabaseClient.storage.from('ssss').getPublicUrl(filePath);
        problemImageUrl = publicData.publicUrl;
      }
    }

    let slipUrl = null;
    if (bookingSlipFile) {
      const slipExt = bookingSlipFile.name.split('.').pop();
      const slipName = `slip_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${slipExt}`;
      const slipPath = `payment_slips/${slipName}`;
      const { data: slipUploadData, error: slipUploadError } = await supabaseClient.storage.from('ssss').upload(slipPath, bookingSlipFile);
      if (!slipUploadError) {
        const { data: slipPublicData } = supabaseClient.storage.from('ssss').getPublicUrl(slipPath);
        slipUrl = slipPublicData.publicUrl;
      }
    }
    
    
    // No upfront payment for repair bookings
    const bookingFee = 0;
    
    const dbPayload = {
      technician_uuid: currentTech.id,
      tech_name: currentTech.name,
      category: currentTech.category,
      customer_id: currentUser ? currentUser.id : null,
      customer_name: name,
      customer_phone: phone,
      problem_detail: problem,
      problem_image: problemImageUrl,
      slip_url: slipUrl,
      province: province,
      district: district,
      subdistrict: subdistrict,
      customer_address: address,
      customer_line_id: lineId,
      house_no: houseNo,
      village: village,
      alley: alley,
      street: street,
      service_date: serviceDate,
      service_time: (() => {
        const timeMap = {
          'เช้า (08:00-12:00)': '08:00:00',
          'บ่าย (13:00-17:00)': '13:00:00',
          'เย็น (17:00-20:00)': '17:00:00',
          'ด่วน (ASAP)': '00:00:00'
        };
        return timeMap[serviceTime] || '08:00:00';
      })(),
      payment_amount: 0,
      payment_status: 'no_payment',
      status: "รอดำเนินการ"
    };

    if (appliedPromoData) {
      dbPayload.promo_code = appliedPromoData.code;
      dbPayload.discount_amount = appliedPromoData.discount_value;
    }

    const { error } = await supabaseClient.from("bookings").insert([dbPayload]);

    if (error) throw error;
    
    if (appliedPromoData) {
      // Increment usage count of the campaign
      await supabaseClient.from('campaigns').update({ usage_count: appliedPromoData.usage_count + 1 }).eq('id', appliedPromoData.id);
    }

    // (Removed: Technician no longer hides after booking)

    alert("✅ บันทึกการนัดหมายเรียบร้อยแล้ว!\nเจ้าหน้าที่จะตรวจสอบและติดต่อกลับเพื่อยืนยันนัดหมาย");
    
    // Reset form
    document.getElementById("customerName").value = "";
    document.getElementById("customerPhone").value = "";
    document.getElementById("customerLineId").value = "";
    document.getElementById("customerHouseNo").value = "";
    document.getElementById("customerVillage").value = "";
    document.getElementById("customerAlley").value = "";
    document.getElementById("customerStreet").value = "";
    document.getElementById("problemDetail").value = "";
    document.getElementById("province").value = "";
    document.getElementById("district").innerHTML = '<option value="">เลือกอำเภอ</option>';
    document.getElementById("subdistrict").innerHTML = '<option value="">เลือกตำบล</option>';
    document.getElementById("customerAddress").value = "";
    document.getElementById("serviceDate").value = "";
    document.getElementById("serviceTime").value = "";
    document.getElementById("problemImage").value = "";
    document.getElementById("problemImagePreview").style.display = "none";
    
    closeBooking();
    
    // Refresh the list to hide the booked technician
    if (typeof loadTechnicians === 'function') {
      loadTechnicians();
    } else {
      window.location.reload();
    }

  } catch (err) {
    alert("เกิดข้อผิดพลาด: " + err.message);
    console.error(err);
  } finally {
    btnConfirm.innerHTML = originalBtnText;
    btnConfirm.disabled = false;
  }
}

// Image Preview Event
document.getElementById('problemImage')?.addEventListener('change', function(e) {
  const file = e.target.files[0];
  const previewContainer = document.getElementById('problemImagePreview');
  const previewImage = document.getElementById('previewImage');
  if (file) {
    previewImage.src = window.URL.createObjectURL(file);
    previewContainer.style.display = 'block';
  } else {
    previewContainer.style.display = 'none';
  }
});

// ===== BOOKING TIME VALIDATION =====
document.getElementById('serviceDate')?.addEventListener('change', async function(e) {
  const dateStr = e.target.value;
  const timeSelect = document.getElementById('serviceTime');
  
  // Reset all options to default state
  Array.from(timeSelect.options).forEach(opt => {
    if (opt.value) {
      opt.disabled = false;
      opt.text = opt.value;
    }
  });

  if (!dateStr || !currentTech) return;

  timeSelect.options[0].text = "กำลังตรวจสอบคิว...";

  try {
    const { data, error } = await supabaseClient
      .from('bookings')
      .select('service_time')
      .eq('technician_uuid', currentTech.id)
      .eq('service_date', dateStr)
      .not('status', 'eq', 'ยกเลิก');

    timeSelect.options[0].text = "เลือกช่วงเวลา";

    if (error || !data) return;

    const bookedTimes = data.map(b => b.service_time);

    Array.from(timeSelect.options).forEach(opt => {
      if (!opt.value) return;

      let mappedTime = '08:00:00';
      if (opt.value.includes('บ่าย')) mappedTime = '13:00:00';
      else if (opt.value.includes('เย็น')) mappedTime = '17:00:00';
      else if (opt.value.includes('ด่วน') || opt.value.includes('ASAP')) mappedTime = '00:00:00';
      else mappedTime = '08:00:00';

      if (bookedTimes.includes(mappedTime)) {
        opt.disabled = true;
        opt.text = opt.value + ' (❌ คิวเต็ม)';
      } else {
        opt.text = opt.value + ' (✅ ว่าง)';
      }
    });
  } catch (err) {
    console.error("Error checking times:", err);
    timeSelect.options[0].text = "เลือกช่วงเวลา";
  }
});

// ===== LOCATION ===== 
function updateDistricts() {
  const province = document.getElementById("province").value;
  const districtSelect = document.getElementById("district");
  districtSelect.innerHTML = '<option value="">เลือกอำเภอ</option>';
  document.getElementById("subdistrict").innerHTML = '<option value="">เลือกตำบล</option>';

  if (!locationData[province]) return;

  Object.keys(locationData[province]).forEach(district => {
    const option = document.createElement("option");
    option.value = district;
    option.textContent = district;
    districtSelect.appendChild(option);
  });
}

function updateSubdistricts() {
  const province = document.getElementById("province").value;
  const district = document.getElementById("district").value;
  const subdistrictSelect = document.getElementById("subdistrict");
  subdistrictSelect.innerHTML = '<option value="">เลือกตำบล</option>';

  if (!locationData[province] || !locationData[province][district]) return;

  locationData[province][district].forEach(subdistrict => {
    const option = document.createElement("option");
    option.value = subdistrict;
    option.textContent = subdistrict;
    subdistrictSelect.appendChild(option);
  });
}

// ===== CHAT =====
async function openChat(index) {
  if (!currentUser) {
    alert("กรุณาเข้าสู่ระบบก่อน");
    window.location.href = "login.html";
    return;
  }

  currentTech = technicians[index];

  document.getElementById("chatTitle").innerText = `💬 แชทกับ ${currentTech.name}`;

  try {
    const { data: existingConv } = await supabaseClient
      .from("conversations")
      .select("*")
      .eq("customer_id", currentUser.id)
      .eq("technician_id", currentTech.id);

    if (existingConv && existingConv.length > 0) {
      currentConversation = existingConv[0];
    } else {
      const { data: newConv, error: insertError } = await supabaseClient
        .from("conversations")
        .insert([{
          customer_id: currentUser.id,
          technician_id: currentTech.id
        }])
        .select();

      if (insertError) {
        alert("ไม่สามารถสร้างการสนทนา: " + insertError.message);
        return;
      }

      currentConversation = newConv[0];
    }

    await loadMessages();
    document.getElementById("chatModal").classList.add('show');
    document.getElementById("chatInput").focus();

    if (messagesSubscription) {
      messagesSubscription.unsubscribe();
    }
    
    messagesSubscription = supabaseClient
      .channel(`messages:${currentConversation.id}`)
      .on('postgres_changes', 
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${currentConversation.id}`
        },
        (payload) => {
          loadMessages();
        }
      )
      .subscribe();

  } catch (err) {
    console.error("Chat open error:", err);
    alert("เกิด���้อผิดพลาด: " + err.message);
  }
}

async function loadMessages() {
  if (!currentConversation || !currentConversation.id) {
    return;
  }

  const { data: messages } = await supabaseClient
    .from("messages")
    .select("*")
    .eq("conversation_id", currentConversation.id)
    .order("created_at", { ascending: true });

  const messagesList = document.getElementById("messagesList");
  messagesList.innerHTML = (messages || []).map(msg => {
    const isOwn = msg.sender_id === currentUser.id;
    const senderName = isOwn ? "คุณ" : currentTech.name;
    const d = new Date(msg.created_at);
    const dateStr = d.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
    const timeStr = d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.';
    
    return `
      <div class="message-item ${isOwn ? 'own' : ''}">
        <div class="message-bubble ${isOwn ? 'own' : 'other'}">
          <strong style="font-size: 12px;">${senderName}</strong>
          <p style="margin: 4px 0 0 0;">${msg.message_text || ''}</p>
          <span class="message-time" style="display:block; margin-top:4px; font-size:11px; opacity:0.8;">${dateStr} ${timeStr}</span>
        </div>
      </div>
    `;
  }).join("");

  const container = document.getElementById("messagesContainer");
  container.scrollTop = container.scrollHeight;
}

async function sendMessage() {
  const input = document.getElementById("chatInput");
  const message = input.value.trim();
  
  if (!message) {
    alert("กรุณาพิมพ์ข้อความ");
    return;
  }

  if (!currentUser || !currentConversation) {
    alert("ไม่พบการสนทนา");
    return;
  }

  const { error } = await supabaseClient
    .from("messages")
    .insert([{
      conversation_id: currentConversation.id,
      sender_id: currentUser.id,
      receiver_id: currentTech.id,
      message_text: message
    }]);

  if (error) {
    alert("เกิดข้อผิดพลาด: " + error.message);
    return;
  }

  input.value = "";
  await loadMessages();
}

function closeChat() {
  document.getElementById("chatModal").classList.remove('show');
  if (messagesSubscription) {
    messagesSubscription.unsubscribe();
  }
}

// ===== AI CHAT WIDGET =====
function toggleAIChatWidget() {
  const widget = document.getElementById("aiChatWidget");
  aiChatWidgetOpen = !aiChatWidgetOpen;
  widget.style.display = aiChatWidgetOpen ? "block" : "none";
  
  if (aiChatWidgetOpen) {
    document.getElementById("aiChatInput").focus();
  }
}

function addAIChatMessage(text, isUser) {
  const messagesContainer = document.getElementById("aiChatMessages");
  
  const wrapper = document.createElement("div");
  wrapper.className = `message-wrapper ${isUser ? 'user' : 'ai'}`;
  
  const messageDiv = document.createElement("div");
  messageDiv.className = `message ${isUser ? 'user' : 'ai'}`;
  messageDiv.innerText = text;

  const d = new Date();
  const dateStr = d.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.';
  
  const timeSpan = document.createElement("span");
  timeSpan.className = "message-time";
  timeSpan.style.display = "block";
  timeSpan.style.marginTop = "4px";
  timeSpan.style.fontSize = "11px";
  timeSpan.style.opacity = "0.7";
  timeSpan.style.textAlign = isUser ? "right" : "left";
  timeSpan.innerText = `${dateStr} ${timeStr}`;
  
  wrapper.appendChild(messageDiv);
  wrapper.appendChild(timeSpan);
  messagesContainer.appendChild(wrapper);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function showAIChatLoading() {
  const messagesContainer = document.getElementById("aiChatMessages");
  
  const wrapper = document.createElement("div");
  wrapper.className = "message-wrapper ai";
  wrapper.id = "loadingMessage";
  
  const messageDiv = document.createElement("div");
  messageDiv.className = "message loading";
  messageDiv.innerText = "⏳ กำลังวิเคราะห์...";
  
  wrapper.appendChild(messageDiv);
  messagesContainer.appendChild(wrapper);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function removeAIChatLoading() {
  const loadingMsg = document.getElementById("loadingMessage");
  if (loadingMsg) {
    loadingMsg.remove();
  }
}

async function sendAIChat() {
  const input = document.getElementById("aiChatInput");
  const text = input.value.trim();

  if (!text) return;

  addAIChatMessage(text, true);
  input.value = "";

  showAIChatLoading();

  try {
    const response = await fetch(AI_CHAT_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: text })
    });

    removeAIChatLoading();

    const data = await response.json();
    const botResponse = data.answer || data.reply || "ขอโทษ ฉันไม่สามารถตอบได้";
    
    addAIChatMessage(botResponse, false);

  } catch (err) {
    console.error("❌ AI Chat Error:", err);
    removeAIChatLoading();
    addAIChatMessage("❌ เกิดข้อผิดพลาดในการเชื่อมต่อ", false);
  }
}

function handleAIChatKeyPress(event) {
  if (event.key === 'Enter') {
    event.preventDefault();
    sendAIChat();
  }
}

// ===== CHAT IMAGE UPLOAD =====
async function handleChatImageUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (!currentUser || !currentConversation) {
    alert("ไม่พบการสนทนา");
    return;
  }

  const fileExt = file.name.split('.').pop();
  const fileName = `chat_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
  const filePath = `chat_images/${fileName}`;

  try {
    const { data, error: uploadError } = await supabaseClient.storage
      .from('ssss')
      .upload(filePath, file);

    if (uploadError) {
      console.warn("Storage upload failed, falling back to Base64", uploadError);
      resizeImageBeforeUpload(file, async (base64Str) => {
        await sendImageMessage(base64Str);
      });
    } else {
      const { data: publicData } = supabaseClient.storage
        .from('ssss')
        .getPublicUrl(filePath);
      await sendImageMessage(publicData.publicUrl);
    }
  } catch (err) {
    console.warn("Error:", err);
    resizeImageBeforeUpload(file, async (base64Str) => {
      await sendImageMessage(base64Str);
    });
  }
}

async function sendImageMessage(imageUrl) {
  const message = `<img src="${imageUrl}" style="max-width:200px; border-radius:8px; display:block; margin-top:4px;" alt="รูปภาพแชท">`;

  const { error } = await supabaseClient
    .from("messages")
    .insert([{
      conversation_id: currentConversation.id,
      sender_id: currentUser.id,
      receiver_id: currentTech.id,
      message_text: message
    }]);

  if (error) {
    alert("เกิดข้อผิดพลาดในการส่งรูปภาพ: " + error.message);
    return;
  }

  const inputEl = document.getElementById("chatImageInput");
  if(inputEl) inputEl.value = '';
  await loadMessages();
}

function resizeImageBeforeUpload(file, callback) {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = function(e) {
    const img = new Image();
    img.src = e.target.result;
    img.onload = function() {
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 800;
      const MAX_HEIGHT = 800;
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
      } else {
        if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
      }
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      callback(canvas.toDataURL('image/jpeg', 0.8));
    };
  };
}

// ===== INITIALIZE =====
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Initializing Technician page...');
  checkAuth();
  updateSkillDropdown();
  loadTechnicians();
});