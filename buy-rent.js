// ===== CONFIGURATION =====
const SUPABASE_URL = "https://uqcjajmqtlchftpqwsrp.supabase.co";
const SUPABASE_KEY = "sb_publishable_yWZiH8l1idY0QWGuj6p9sg_GqXPONGX";
const AI_CHAT_WEBHOOK = "https://sevenican6.app.n8n.cloud/webhook/b813bf13-6067-4721-a453-9503789c0bce";
const AI_INVESTMENT_WEBHOOK = "https://sevenican6.app.n8n.cloud/webhook/ai-investment";

// ===== SUPABASE CLIENT =====
const { createClient } = window.supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
const supabaseClient = sb;

// ===== STATE =====
let propertyData = [];
let currentSlide = 0;
let currentImages = [];
let currentActionType = null;
let currentPropertyId = null;
let chatOpen = false;

// ===== HELPER FUNCTIONS =====
function safe(value) {
  return value !== null && value !== undefined && value !== '' ? value : '-';
}

function formatNumber(num) {
  return num ? Number(num).toLocaleString() : '-';
}

// ===== AUTHENTICATION =====
async function checkAuth() {
  const { data: { session } } = await supabaseClient.auth.getSession();

  if (session) {
    const user = session.user;
    const { data: customer } = await supabaseClient
      .from("customers")
      .select("name")
      .eq("id", user.id)
      .single();

    const userName = customer?.name || user.email;
    const initial = userName.charAt(0).toUpperCase();

    document.getElementById("authUserInfo").style.display = "block";
    document.getElementById("authLoginBtn").style.display = "none";
    document.getElementById("userName").innerText = userName;
    document.getElementById("userInitial").innerText = initial;
  } else {
    document.getElementById("authUserInfo").style.display = "none";
    document.getElementById("authLoginBtn").style.display = "block";
  }
}

async function logout() {
  await supabaseClient.auth.signOut();
  window.location.href = "login.html";
}

// ===== PROPERTY MODAL =====
window.openModalById = async function (id) {
  currentSlide = 0;
  const property = propertyData.find(p => p.id === id);
  if (!property) return;

  const modal = document.getElementById('detailModal');
  const content = document.getElementById('modalContent');

  const { data: images } = await sb
    .from('property_images')
    .select('image_url')
    .eq('property_id', id);

  currentImages = [];

  if (images && images.length > 0) {
    currentImages = images.map(img => img.image_url);
  } else if (property.image_url) {
    currentImages = [property.image_url];
  } else {
    currentImages = ['https://via.placeholder.com/800x500?text=No+Image'];
  }

  const imageSlides = currentImages.map((url, index) => `
    <img src="${url}" class="slide-image ${index === 0 ? 'active' : ''}" alt="Property image">
  `).join('');

  const thumbnails = currentImages.length > 1 ? `
    <div class="thumbnail-container">
      ${currentImages.map((img, i) => `
        <img src="${img}" class="${i === 0 ? 'active' : ''}" onclick="changeImage(${i})" alt="Thumbnail ${i + 1}">
      `).join('')}
    </div>
  ` : '';

  content.innerHTML = `
    <div class="image-slider">
      <div class="slider-main">
        ${imageSlides}
        ${currentImages.length > 1 ? `
          <div class="slider-nav">
            <button onclick="prevImage()">‹</button>
            <button onclick="nextImage()">›</button>
          </div>
        ` : ''}
      </div>
      ${thumbnails}
    </div>

    <h2>${safe(property.title)}</h2>
    <p class="location-info">${safe(property.subdistrict)} ${safe(property.district)} ${safe(property.province)}</p>

    <div class="property-details">
      <div><strong>สถานะ:</strong> ${safe(property.status)}</div>
      <div><strong>ราคา:</strong> ฿${formatNumber(property.price)}</div>
      <div><strong>พื้นที่ใช้สอย:</strong> ${safe(property.usable_area)} ตร.ม.</div>
      <div><strong>ขนาดที่ดิน:</strong> ${safe(property.land_area_wa)} ตร.ว.</div>
      <div><strong>ห้องนอน:</strong> ${safe(property.bedrooms)}</div>
      <div><strong>ห้องน้ำ:</strong> ${safe(property.bathrooms)}</div>
      <div><strong>ที่จอดรถ:</strong> ${safe(property.parking)}</div>
      <div><strong>อายุทรัพย์:</strong> ${safe(property.property_age)} ปี</div>
      <div><strong>ค่าส่วนกลาง:</strong> ฿${formatNumber(property.common_fee)}</div>
      <div><strong>ประเภทโฉนด:</strong> ${safe(property.deed_type)}</div>
      <div style="grid-column:1/-1"><strong>รายละเอียดเพิ่มเติม:</strong><br>${safe(property.description)}</div>
    </div>

    <hr>

    ${(() => {
      let buttons = [];
      const status = property.status || '';

      // ✅ AI Investment Analysis Button
      buttons.push(`<button class="btn-ai-analyze" onclick="analyzeInvestment(${property.id})"><i class="fa-solid fa-wand-magic-sparkles"></i> ✨ AI วิเคราะห์การลงทุน</button>`);

      if (status.includes('ขาย')) {
        buttons.push(`<button class="btn-buy" onclick="handleAction('ซื้อ', ${property.id})">💰 ซื้อ</button>`);
      }
      if (status.includes('เช่')) {
        buttons.push(`<button class="btn-rent" onclick="handleAction('เช่า', ${property.id})">🏠 เช่า</button>`);
      }
      return buttons.length ? `<div class="action-buttons">${buttons.join('')}</div>` : '';
    })()}
  `;

  modal.classList.add('show');
}

window.changeImage = function (index) {
  const slides = document.querySelectorAll('.slide-image');
  const thumbs = document.querySelectorAll('.thumbnail-container img');

  slides.forEach(s => s.classList.remove('active'));
  thumbs.forEach(t => t.classList.remove('active'));

  slides[index].classList.add('active');
  thumbs[index].classList.add('active');
  currentSlide = index;
}

window.nextImage = function () {
  if (currentImages.length === 0) return;
  currentSlide = (currentSlide + 1) % currentImages.length;
  changeImage(currentSlide);
}

window.prevImage = function () {
  if (currentImages.length === 0) return;
  currentSlide = (currentSlide - 1 + currentImages.length) % currentImages.length;
  changeImage(currentSlide);
}

function closeModal() {
  const modal = document.getElementById('detailModal');
  modal.classList.remove('show');
}

// ===== ACTION MODAL =====
window.handleAction = function (type, id) {
  currentActionType = type;
  currentPropertyId = id;

  const property = propertyData.find(p => p.id === id);
  const price = property ? (property.price || 0) : 0;
  const bookingFee = price * 0.10;

  document.getElementById('actionTitle').innerText =
    type === 'ซื้อ' ? '🏠 กรอกข้อมูลเพื่อทำสัญญาซื้อ' : '🏠 กรอกข้อมูลเพื่อเช่า';
  
  document.getElementById('displayPrice').innerText = `฿${formatNumber(price)}`;
  document.getElementById('displayBookingFee').innerText = `฿${formatNumber(bookingFee)}`;
  
  // Update QR Code with amount
  const qrImg = document.getElementById('qrCodeImage');
  if (qrImg) {
    qrImg.src = `https://promptpay.io/0621934749/${bookingFee}.png`;
  }

  document.getElementById('fullname').value = '';
  document.getElementById('phone').value = '';
  document.getElementById('readyDate').value = '';

  const modal = document.getElementById('actionModal');
  modal.classList.add('show');
}

function closeActionModal() {
  const modal = document.getElementById('actionModal');
  modal.classList.remove('show');
  
  // Reset slip preview
  const preview = document.getElementById('slipPreviewContainer');
  if (preview) preview.style.display = 'none';
  const fileInput = document.getElementById('slipUpload');
  if (fileInput) fileInput.value = '';
}

window.submitAction = async function () {
  const fullname = document.getElementById('fullname').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const readyDate = document.getElementById('readyDate').value;
  const slipFile = document.getElementById('slipUpload').files[0];

  if (!fullname || fullname.split(' ').length < 2) {
    alert('กรุณากรอกชื่อ-สกุลให้ครบถ้วน');
    return;
  }

  if (!/^0[0-9]{8,9}$/.test(phone)) {
    alert('กรุณากรอกเบอร์โทรให้ถูกต้อง');
    return;
  }

  if (!readyDate) {
    alert('กรุณาเลือกวันที่');
    return;
  }

  if (!slipFile) {
    alert('⚠️ กรุณาแนบรูปสลิปการโอนเงินเพื่อยืนยันการจอง');
    return;
  }

  const btn = document.querySelector('.action-modal .btn-confirm');
  const oldText = btn.innerHTML;
  btn.innerHTML = '⏳ กำลังบันทึก...';
  btn.disabled = true;

  try {
    let slipUrl = null;
    const fileExt = slipFile.name.split('.').pop();
    const fileName = `slip_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
    const filePath = `payment_slips/${fileName}`;
    
    const { data: uploadData, error: uploadError } = await sb.storage.from('ssss').upload(filePath, slipFile);
    if (uploadError) throw uploadError;

    const { data: publicData } = sb.storage.from('ssss').getPublicUrl(filePath);
    slipUrl = publicData.publicUrl;

    const property = propertyData.find(p => p.id === currentPropertyId);
    const { data: { session } } = await sb.auth.getSession();
    const currentUser = session?.user;
    
    // Calculate 10% booking fee
    const bookingFee = Math.floor((property?.price || 0) * 0.1);

    const { error } = await sb
      .from('interests')
      .insert([{
        property_id: currentPropertyId,
        property_title: property?.title || property?.name || '-',
        customer_id: currentUser ? currentUser.id : null,
        customer_name: fullname,
        customer_phone: phone,
        interest_type: currentActionType === 'ซื้อ' ? 'ซื้อ' : 'เช่า',
        ready_date: readyDate,
        slip_url: slipUrl,
        payment_amount: bookingFee,
        payment_status: 'pending_verification'
      }]);

    if (error) throw error;

    // Update property status to hide it from the website
    await sb.from('properties').update({ status: 'จองแล้ว' }).eq('id', currentPropertyId);

    alert('✅ แจ้งความสนใจและแนบทหลักฐานการโอนเงินเรียบร้อยแล้ว!\nทีมงานจะตรวจสอบและติดต่อกลับโดยเร็วที่สุด');
    closeActionModal();
    closeModal();
    
    // Refresh the list to hide the booked property
    if (typeof applyFilter === 'function') {
      applyFilter();
    } else {
      window.location.reload();
    }

  } catch (err) {
    alert('เกิดข้อผิดพลาด: ' + err.message);
    console.error(err);
  } finally {
    btn.innerHTML = oldText;
    btn.disabled = false;
  }
}

// ===== PROPERTY LOADING =====
async function loadProperties() {
  await applyFilter();
}

window.applyFilter = async function () {
  const container = document.getElementById('property-list');
  container.innerHTML = '<p style="text-align:center; grid-column: 1/-1;">กำลังโหลด...</p>';

  const status = document.getElementById('filterStatus').value;
  const type = document.getElementById('filterType').value;
  const minPrice = document.getElementById('minPrice').value;
  const maxPrice = document.getElementById('maxPrice').value;
  const province = document.getElementById('filterProvince').value;
  const district = document.getElementById('filterDistrict').value;
  const subdistrict = document.getElementById('filterSubdistrict').value;

  let query = sb.from('properties')
    .select('*')
    .neq('status', 'จองแล้ว')
    .neq('status', 'ขายแล้ว') // Also hide sold items
    .neq('status', 'เช่าแล้ว') // Also hide rented items
    .order('created_at', { ascending: false });

  if (status) {
    query = query.ilike('status', `%${status}%`);
  }

  if (type) {
    query = query.ilike('title', `%${type}%`);
  }

  if (minPrice) {
    query = query.gte('price', minPrice);
  }

  if (maxPrice) {
    query = query.lte('price', maxPrice);
  }

  if (province) {
    query = query.ilike('province', `%${province}%`);
  }

  if (district) {
    query = query.ilike('district', `%${district}%`);
  }

  if (subdistrict) {
    query = query.ilike('subdistrict', `%${subdistrict}%`);
  }

  const { data, error } = await query;

  if (error) {
    container.innerHTML = `<p style="color: #e74c3c; grid-column: 1/-1;">${error.message}</p>`;
    console.error(error);
    return;
  }

  if (!data || data.length === 0) {
    document.getElementById('noResult').style.display = "block";
    container.innerHTML = '';
    return;
  }

  propertyData = data;
  container.innerHTML = '';
  document.getElementById('noResult').style.display = "none";

  for (const p of propertyData) {
    const { data: images } = await sb
      .from('property_images')
      .select('image_url')
      .eq('property_id', p.id);

    let imageUrl = 'https://via.placeholder.com/600x400?text=No+Image';
    let imageCount = 0;

    if (images && images.length > 0) {
      imageUrl = images[0].image_url;
      imageCount = images.length;
    } else if (p.image_url) {
      imageUrl = p.image_url;
      imageCount = 1;
    }

    const isSell = p.status === 'ขาย';
    const badgeClass = isSell ? 'badge-sell' : 'badge-rent';

    const card = document.createElement('div');
    card.className = 'property-card';
    card.innerHTML = `
      <div class="property-img-wrapper">
        <div class="badge-status ${badgeClass}">${safe(p.status)}</div>
        <img src="${imageUrl}" alt="${safe(p.title)}" loading="lazy">
        ${imageCount > 1 ? `<div class="property-img-count">
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
          ${imageCount} รูป
        </div>` : ''}
      </div>
      <div class="property-info">
        <div class="prop-type-tag">${safe(p.type)}</div>
        <h3>${safe(p.title)}</h3>
        <p class="location">
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
          ${safe(p.subdistrict)} ${safe(p.district)}
        </p>
        <p class="price">฿${formatNumber(p.price)} ${!isSell ? '<span>/ เดือน</span>' : ''}</p>
        <div class="card-action-buttons">
          <button class="btn-detail-pro" onclick="openModalById(${p.id})">รายละเอียด</button>
          <button class="btn-chat-pro" onclick="openAdminChatForRent(${p.id}, event)">
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
            ติดต่อสอบถาม
          </button>
        </div>
      </div>
    `;
    container.appendChild(card);
  }
}

// ===== AI CHAT WIDGET =====
function toggleChat() {
  const container = document.getElementById("chatContainer");
  chatOpen = !chatOpen;
  container.style.display = chatOpen ? "block" : "none";
  if (chatOpen) {
    document.getElementById("ai-input").focus();
  }
}

function addMessageAI(text, type) {
  const div = document.createElement("div");
  div.className = "message-ai " + type;
  div.innerText = text;
  const messages = document.getElementById("ai-messages");
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
  return div;
}

async function sendAI() {
  const input = document.getElementById("ai-input");
  const message = input.value.trim();
  if (!message) return;

  addMessageAI(message, "user-ai");
  input.value = "";

  const loading = addMessageAI("AI กำลังคิด...", "loading-ai");

  try {
    const res = await fetch(AI_CHAT_WEBHOOK, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ message: message })
    });

    let data;
    const contentType = res.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      data = await res.json();
    } else {
      const textResponse = await res.text();
      data = { reply: textResponse };
    }

    loading.remove();

    if (data.reply) {
      addMessageAI(data.reply, "bot-ai");
    } else if (data.output) {
      addMessageAI(data.output, "bot-ai");
    } else if (typeof data === 'string') {
      addMessageAI(data, "bot-ai");
    } else if (data[0] && data[0].output) {
      addMessageAI(data[0].output, "bot-ai");
    } else {
      addMessageAI("AI ไม่สามารถตอบได้", "bot-ai");
    }

  } catch (err) {
    console.error("AI chat error:", err);
    loading.remove();
    addMessageAI("เกิดข้อผิดพลาดในการเชื่อมต่อ", "bot-ai");
  }
}

function handleKeyPress(e) {
  if (e.key === "Enter") {
    sendAI();
  }
}

async function populateLocationFilters() {
  try {
    const { data, error } = await sb.from('properties').select('province, district, subdistrict');
    if (error) throw error;

    if (!data) return;

    const provinces = [...new Set(data.map(p => p.province).filter(Boolean))].sort();
    const districts = [...new Set(data.map(p => p.district).filter(Boolean))].sort();
    const subdistricts = [...new Set(data.map(p => p.subdistrict).filter(Boolean))].sort();

    const provSelect = document.getElementById('filterProvince');
    const distSelect = document.getElementById('filterDistrict');
    const subSelect = document.getElementById('filterSubdistrict');

    // Clear existing besides first option
    provSelect.innerHTML = '<option value="">จังหวัด</option>';
    distSelect.innerHTML = '<option value="">อำเภอ</option>';
    subSelect.innerHTML = '<option value="">ตำบล</option>';

    provinces.forEach(p => provSelect.add(new Option(p, p)));
    districts.forEach(d => distSelect.add(new Option(d, d)));
    subdistricts.forEach(s => subSelect.add(new Option(s, s)));
  } catch (err) {
    console.error("Error populating filters:", err);
  }
}

// ===== INITIALIZE =====
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Initializing Buy-Rent page...');
  checkAuth();
  populateLocationFilters();
  loadProperties();
});

// ===== AI INVESTMENT ANALYSIS =====
window.analyzeInvestment = async function (id) {
  const property = propertyData.find(p => p.id === id);
  if (!property) return;

  const modal = document.getElementById('investmentModal');
  const resultDiv = document.getElementById('investmentResult');

  // Reset result area to loading state
  resultDiv.innerHTML = `
    <div class="loading-state">
      <div class="sparkle-loader">✨</div>
      <p>AI กำลังประมวลผลข้อมูลการลงทุนสำหรับ <strong>${property.title}</strong>...</p>
    </div>
  `;

  modal.classList.add('show');

  try {
    const response = await fetch(AI_INVESTMENT_WEBHOOK, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        // ข้อมูลพื้นฐาน
        name: property.title,
        description: property.description,
        price: property.price,
        status: property.status,
        // ที่ตั้ง
        location: `${safe(property.subdistrict)} ${safe(property.district)} ${safe(property.province)}`,
        province: property.province,
        district: property.district,
        subdistrict: property.subdistrict,
        // ขนาด/พื้นที่
        size: property.usable_area,
        land_area_wa: property.land_area_wa,
        land_width: property.land_width,
        land_length: property.land_length,
        area: property.area,
        // ห้อง/สิ่งอำนวยความสะดวก
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
        parking: property.parking,
        property_age: property.property_age,
        // การเงิน
        monthly_payment: property.monthly_payment,
        loan_percent: property.loan_percent,
        transfer_fee: property.transfer_fee,
        common_fee: property.common_fee,
        direct_installment: property.direct_installment,
        // ข้อมูลทรัพย์สิน
        deed_type: property.deed_type,
        encumbrance: property.encumbrance,
        mortgage_status: property.mortgage_status,
        // สภาพแวดล้อม
        flood_history: property.flood_history,
        structure_info: property.structure_info,
        renovated: property.renovated,
        nearby_places: property.nearby_places,
        transportation: property.transportation,
        environment: property.environment,
        // ผลตอบแทนคาดการณ์ (คำนวณอย่างง่าย)
        potential_yield: property.monthly_payment
          ? `${safe(property.monthly_payment)} บาท/เดือน`
          : property.status === 'เช่า'
            ? `ประมาณ ${Math.round((property.price || 0) * 0.005).toLocaleString()} บาท/เดือน (ประมาณการ)`
            : '-'
      })
    });

    const rawText = await response.text();
    console.log("🔍 n8n raw response:", rawText); // DEBUG - ดูใน F12 > Console
    let analysis = "";

    try {
      // Helper function to extract text recursively
      const extractText = (obj) => {
        if (!obj) return "";
        if (typeof obj === 'string') {
          // Check if it's a nested JSON string
          if (obj.trim().startsWith('{') || obj.trim().startsWith('[')) {
            try {
              const parsed = JSON.parse(obj);
              return extractText(parsed);
            } catch (e) {
              return obj; // Normal string
            }
          }
          return obj;
        }
        
        if (Array.isArray(obj)) {
          // Handle Anthropic/Langchain array formats
          for (const item of obj) {
            if (item && item.content) return extractText(item.content);
            if (item && item.text) return extractText(item.text);
            if (item && item.output) return extractText(item.output);
          }
          if (obj.length > 0) return extractText(obj[0]);
          return "";
        }
        
        if (typeof obj === 'object') {
          if (obj.output) return extractText(obj.output);
          if (obj.reply) return extractText(obj.reply);
          if (obj.analysis) return extractText(obj.analysis);
          if (obj.text) return extractText(obj.text);
          if (obj.message && obj.message.content) return extractText(obj.message.content);
          if (obj.choices && obj.choices[0] && obj.choices[0].message) return extractText(obj.choices[0].message.content);
          if (obj.content) return extractText(obj.content);
          
          // Fallback: try to stringify if it's a plain object
          return JSON.stringify(obj);
        }
        return String(obj);
      };

      const data = JSON.parse(rawText);
      analysis = extractText(data);

      if (typeof analysis === 'object' || analysis.startsWith('[{"id"')) {
         analysis = JSON.stringify(analysis);
      }
      
      // One last check for nested string arrays like "[{\"type\":\"output_text\"}]"
      if (typeof analysis === 'string' && analysis.trim().startsWith('[')) {
        try {
          const parsedArr = JSON.parse(analysis);
          analysis = extractText(parsedArr) || analysis;
        } catch(e) {}
      }

    } catch (error) {
      console.error("Error parsing response:", error);
      analysis = rawText || "ไม่สามารถดึงข้อมูลได้";
    }

    // ถ้า analysis ว่างเปล่า แสดง raw response เพื่อ debug
    if (!analysis || !analysis.trim() || analysis === '[object Object]') {
      analysis = `[DEBUG] n8n ส่งข้อมูลกลับมาแต่ไม่สามารถอ่านได้:\n\n${rawText}`;
    }

    resultDiv.innerHTML = `<div class="analysis-content">${formatMarkdown(analysis)}</div>`;

  } catch (error) {
    console.error("Investment analysis error:", error);
    resultDiv.innerHTML = `
      <div class="error-state" style="text-align:center; padding: 40px;">
        <p style="color:#ef4444; font-size: 18px; margin-bottom: 20px;">❌ เกิดข้อผิดพลาดในการเชื่อมต่อกับ AI</p>
        <button onclick="analyzeInvestment(${id})" class="btn-retry" style="background:#3b82f6; color:white; border:none; padding:10px 20px; border-radius:8px; cursor:pointer;">ลองใหม่อีกครั้ง</button>
      </div>
    `;
  }
}

window.closeInvestmentModal = function () {
  document.getElementById('investmentModal').classList.remove('show');
}

function formatMarkdown(text) {
  if (!text) return "";

  // Basic markdown to HTML conversion
  let html = text
    .replace(/^### (.*$)/gm, '<h3 style="color:#1e293b; margin-top:20px; border-bottom:2px solid #e2e8f0; padding-bottom:8px;">$1</h3>')
    .replace(/^## (.*$)/gm, '<h2 style="color:#0f172a; margin-top:24px;">$1</h2>')
    .replace(/^# (.*$)/gm, '<h1 style="color:#0f172a; margin-top:28px;">$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong style="color:#1e3a8a;">$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^\- (.*$)/gm, '<li style="margin-bottom:8px; margin-left:20px;">$1</li>')
    .replace(/\n\n/g, '</p><p style="margin-bottom:16px; line-height:1.7;">')
    .replace(/\n/g, '<br>');

  // Wrap list items in <ul> if they exist
  if (html.includes('<li')) {
    html = html.replace(/(<li.*<\/li>)/gms, '<ul style="margin-bottom:16px;">$1</ul>');
  }

  return `<p style="margin-bottom:16px; line-height:1.7;">${html}</p>`;
}

// ===== ADMIN CHAT WIDGET (Context Aware) =====
let adminUserId = null;
let currentConversation = null;
let messagesSubscription = null;

async function openAdminChatForRent(propertyId, event) {
  if (event) {
    event.stopPropagation();
  }

  // Check login
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    alert("กรุณาเข้าสู่ระบบก่อน");
    window.location.href = "login.html";
    return;
  }
  const user = session.user;

  // 1. Fetch admin user ID
  if (!adminUserId) {
    const { data: adminProfile, error: adminErr } = await supabaseClient
      .from('profiles')
      .select('id')
      .eq('role', 'admin')
      .limit(1)
      .maybeSingle();

    if (adminErr || !adminProfile) {
      alert("ไม่พบผู้ดูแลระบบในขณะนี้");
      return;
    }
    adminUserId = adminProfile.id;
  }

  document.getElementById("chatTitle").innerText = `💬 สอบถามเรื่องเช่า/ซื้อ`;

  // Find property context
  const propertyContext = propertyData.find(p => p.id === propertyId);

  try {
    const { data: existingConv } = await supabaseClient
      .from("admin_conversations")
      .select("*")
      .eq("customer_id", user.id)
      .eq("admin_id", adminUserId);

    if (existingConv && existingConv.length > 0) {
      currentConversation = existingConv[0];
    } else {
      const { data: newConv, error: insertError } = await supabaseClient
        .from("admin_conversations")
        .insert([{
          customer_id: user.id,
          admin_id: adminUserId
        }])
        .select();

      if (insertError) {
        alert("ไม่สามารถสร้างการสนทนา: " + insertError.message);
        return;
      }
      currentConversation = newConv[0];
    }

    await loadAdminMessages();
    document.getElementById("chatModal").classList.add('show');
    document.getElementById("chatInput").focus();

    // Context message logic
    if (propertyContext) {
      const pStatus = safe(propertyContext.status);
      document.getElementById("chatInput").value = `สนใจ${pStatus}อสังหาฯ: ${safe(propertyContext.title)} ราคา: ฿${formatNumber(propertyContext.price)}`;
    }

    if (messagesSubscription) {
      messagesSubscription.unsubscribe();
    }

    messagesSubscription = supabaseClient
      .channel(`admin_messages:${currentConversation.id}`)
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'admin_messages',
          filter: `conversation_id=eq.${currentConversation.id}`
        },
        (payload) => {
          loadAdminMessages();
        }
      )
      .subscribe();

  } catch (err) {
    console.error("Chat open error:", err);
    alert("เกิดข้อผิดพลาด: " + err.message);
  }
}

async function loadAdminMessages() {
  if (!currentConversation || !currentConversation.id) return;

  const { data: { session } } = await supabaseClient.auth.getSession();
  const userId = session?.user?.id;

  const { data: messages } = await supabaseClient
    .from("admin_messages")
    .select("*")
    .eq("conversation_id", currentConversation.id)
    .order("created_at", { ascending: true });

  const messagesList = document.getElementById("messagesList");
  messagesList.innerHTML = (messages || []).map(msg => {
    const isOwn = msg.sender_id === userId;
    const senderName = isOwn ? "คุณ" : "Admin";
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

async function sendAdminMessage() {
  const input = document.getElementById("chatInput");
  const message = input.value.trim();

  if (!message) {
    alert("กรุณาพิมพ์ข้อความ");
    return;
  }

  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session || !currentConversation) {
    alert("ไม่พบการสนทนา");
    return;
  }

  const { error } = await supabaseClient
    .from("admin_messages")
    .insert([{
      conversation_id: currentConversation.id,
      sender_id: session.user.id,
      receiver_id: adminUserId,
      message_text: message
    }]);

  if (error) {
    alert("เกิดข้อผิดพลาด: " + error.message);
    return;
  }

  input.value = "";
  await loadAdminMessages();
}

function closeChat() {
  document.getElementById("chatModal").classList.remove('show');
  if (messagesSubscription) {
    messagesSubscription.unsubscribe();
  }
}

// ===== CHAT IMAGE UPLOAD =====
async function handleAdminChatImageUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session || !currentConversation) {
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
        await sendImageMessage(base64Str, session.user.id);
      });
    } else {
      const { data: publicData } = supabaseClient.storage
        .from('ssss')
        .getPublicUrl(filePath);
      await sendImageMessage(publicData.publicUrl, session.user.id);
    }
  } catch (err) {
    console.warn("Error:", err);
    resizeImageBeforeUpload(file, async (base64Str) => {
      await sendImageMessage(base64Str, session.user.id);
    });
  }
}

async function sendImageMessage(imageUrl, senderId) {
  const message = `<img src="${imageUrl}" style="max-width:200px; border-radius:8px; display:block; margin-top:4px;" alt="รูปภาพแชท">`;

  const { error } = await supabaseClient
    .from("admin_messages")
    .insert([{
      conversation_id: currentConversation.id,
      sender_id: senderId,
      receiver_id: adminUserId,
      message_text: message
    }]);

  if (error) {
    alert("เกิดข้อผิดพลาดในการส่งรูปภาพ: " + error.message);
    return;
  }

  const inputEl = document.getElementById("chatImageInput");
  if (inputEl) inputEl.value = '';
  await loadAdminMessages();
}

function resizeImageBeforeUpload(file, callback) {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = function (e) {
    const img = new Image();
    img.src = e.target.result;
    img.onload = function () {
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