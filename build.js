const { createClient } = window.supabase;
const supabaseClient = createClient(
  "https://uqcjajmqtlchftpqwsrp.supabase.co",
  "sb_publishable_yWZiH8l1idY0QWGuj6p9sg_GqXPONGX"
);

let allHouses = [];
let currentImages = [];
let currentImageIndex = 0;

async function loadHouses() {
  const { data, error } = await supabaseClient.from("houses").select("*");
  if (error) {
    console.error(error);
    document.getElementById('houseContainer').innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #e74c3c;">เกิดข้อผิดพลาดในการโหลดข้อมูล</p>';
    return;
  }
  allHouses = data || [];
  displayHouses(allHouses);
}

function displayHouses(houses) {
  const container = document.getElementById("houseContainer");
  container.innerHTML = "";

  if (houses.length === 0) {
    document.getElementById('noResult').style.display = "block";
    return;
  }

  document.getElementById('noResult').style.display = "none";

  houses.forEach((house, index) => {
    const card = document.createElement('div');
    card.className = 'house-card';
    card.innerHTML = `
      <img src="${house.image_url}" alt="${house.name}" loading="lazy">
      <div class="house-info">
        <h3>${house.name}</h3>
        <div class="price">฿${Number(house.price).toLocaleString()}</div>
        <div class="specs">
          ${house.bedrooms} ห้องนอน | ${house.bathrooms} ห้องน้ำ | ${house.parking} ที่จอดรถ<br>
          ขนาด ${house.width} × ${house.length} เมตร
        </div>
        <div class="card-action-buttons">
          <button class="btn-detail-pro" onclick="showDetail(${index})">รายละเอียด</button>
          <button class="btn-chat-pro" onclick="openAdminChatForBuild(${index}, event)">
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
            ติดต่อสอบถาม
          </button>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

async function showDetail(index) {
  const house = allHouses[index];

  const { data: images } = await supabaseClient
    .from("house_images")
    .select("image_url, display_order")
    .eq("house_id", house.id)
    .order("display_order", { ascending: true });

  if (images && images.length > 0) {
    currentImages = images.map(img => img.image_url);
  } else if (house.image_urls) {
    currentImages = house.image_urls.split(",").map(url => url.trim());
  } else {
    currentImages = [house.image_url];
  }

  currentImageIndex = 0;

  const thumbnails = currentImages.map((img, i) =>
    `<img src="${img}" class="${i===0?'active':''}" onclick="changeImage(${i}); event.stopPropagation();" alt="รูป ${i+1}">`
  ).join("");

  document.getElementById("modalBody").innerHTML = `
    <h2>${house.name}</h2>
    
    <div class="slider-container">
      <img id="mainImage" class="main-image" src="${currentImages[0]}" alt="${house.name}" loading="lazy">
      <button class="slider-btn slider-prev" onclick="prevImage(); event.stopPropagation()">‹</button>
      <button class="slider-btn slider-next" onclick="nextImage(); event.stopPropagation()">›</button>
    </div>

    <div class="thumbnail-container">${thumbnails}</div>

    <div class="house-details">
      <div class="detail-item"><strong>ราคา:</strong> ฿${Number(house.price).toLocaleString()}</div>
      <div class="detail-item"><strong>ขนาดที่ดิน:</strong> ${house.width} × ${house.length} ม.</div>
      <div class="detail-item"><strong>ห้องนอน:</strong> ${house.bedrooms} ห้อง</div>
      <div class="detail-item"><strong>ห้องน้ำ:</strong> ${house.bathrooms} ห้อง</div>
      <div class="detail-item"><strong>ที่จอดรถ:</strong> ${house.parking} คัน</div>
      <div class="detail-item"><strong>พื้นที่ใช้สอย:</strong> ${house.usable_area || '-'} ตร.ม.</div>
    </div>

    <hr>

    <h3>💎 เลือกเกรดวัสดุ</h3>
    <div class="grade-section">
      <select id="gradeSelect${index}" onchange="updatePrice(${index})">
        <option value="0">Standard - ราคาปกติ</option>
        <option value="0.15">Premium - เพิ่มขึ้น 15%</option>
        <option value="0.35">Luxury - เพิ่มขึ้น 35%</option>
      </select>
    </div>

    <hr>

    <h3>🧱 เลือกวัสดุทีละรายการ (Interactive BOQ)</h3>
    <div class="boq-section">
      <div class="boq-group">
        <label>หลังคา:</label>
        <select onchange="updatePrice(${index})" id="roof${index}">
          <option value="0">กระเบื้องคอนกรีต</option>
          <option value="120000">กระเบื้องเซรามิก (+120,000 บาท)</option>
          <option value="80000">Metal Sheet PU (+80,000 บาท)</option>
        </select>
      </div>

      <div class="boq-group">
        <label>พื้น:</label>
        <select onchange="updatePrice(${index})" id="floor${index}">
          <option value="0">กระเบื้องแกรนิตโต้</option>
          <option value="200000">หินอ่อน (+200,000 บาท)</option>
          <option value="90000">ลามิเนต (+90,000 บาท)</option>
        </select>
      </div>

      <div class="boq-group">
        <label>ผนัง:</label>
        <select onchange="updatePrice(${index})" id="wall${index}">
          <option value="0">อิฐมวลเบา</option>
          <option value="120000">อิฐแดง + ฉนวน (+120,000 บาท)</option>
        </select>
      </div>

      <div class="boq-group">
        <label>หน้าต่าง:</label>
        <select onchange="updatePrice(${index})" id="window${index}">
          <option value="0">อลูมิเนียมธรรมดา</option>
          <option value="120000">กระจก Low-E (+120,000 บาท)</option>
        </select>
      </div>

      <div class="boq-group">
        <label>ห้องน้ำ:</label>
        <select onchange="updatePrice(${index})" id="bath${index}">
          <option value="0">COTTO</option>
          <option value="150000">TOTO / Kohler (+150,000 บาท)</option>
        </select>
      </div>
    </div>

    <div class="price-box">
      ราคาประเมินใหม่: <span id="priceBox${index}">฿${Number(house.price).toLocaleString()}</span>
    </div>

    <hr>

    <button class="order-btn" onclick="toggleOrderForm(${index}); event.stopPropagation();">📌 สั่งสร้างบ้านรุ่นนี้</button>

    <div class="order-form" id="orderForm${index}">
      <input type="text" id="customerName${index}" placeholder="ชื่อ - นามสกุล *" required>
      <input type="tel" id="customerPhone${index}" placeholder="เบอร์โทร *" required>
      <input type="text" id="customerAddress${index}" placeholder="ที่อยู่สำหรับก่อสร้าง *" required>
      <input type="text" id="customerLandSize${index}" placeholder="ขนาดที่ดิน (กว้าง × ยาว) *" required>
      <input type="date" id="customerStartDate${index}" placeholder="ต้องการเริ่มก่อสร้างเมื่อไหร่">
      <textarea id="customerNote${index}" placeholder="รายละเอียดเพิ่มเติม"></textarea>
      <button class="submit-order" onclick="submitOrder(${index}); event.stopPropagation();">ยืนยันการสั่งสร้าง</button>
    </div>

    <hr>

    <h3>⏱️ ระยะเวลาก่อสร้าง</h3>
    <div class="info-box">
      <strong>โดยประมาณ 6 - 10 เดือน</strong> (ขึ้นอยู่กับพื้นที่และฤดูกาลก่อสร้าง)
    </div>

    <h3>🏢 บริษัท / ผู้รับเหม��</h3>
    <div class="info-box">
      <strong>⚠️ ตรวจสอบให้แน่นอน</strong><br>
      โปรดตรวจสอบผลงานที่ผ่านมา รีวิวลูกค้า และสัญญาก่อสร้างก่อนตัดสินใจจ้างงาน
    </div>
  `;

  document.getElementById("houseModal").classList.add('show');
}

function changeImage(index) {
  currentImageIndex = index;
  document.getElementById("mainImage").src = currentImages[index];
  document.querySelectorAll(".thumbnail-container img").forEach((img, i) => {
    img.classList.toggle("active", i === index);
  });
}

function nextImage() {
  currentImageIndex = (currentImageIndex + 1) % currentImages.length;
  changeImage(currentImageIndex);
}

function prevImage() {
  currentImageIndex = (currentImageIndex - 1 + currentImages.length) % currentImages.length;
  changeImage(currentImageIndex);
}

function toggleOrderForm(index) {
  const form = document.getElementById(`orderForm${index}`);
  form.classList.toggle('show');
}

async function submitOrder(index) {
  const house = allHouses[index];

  const name = document.getElementById(`customerName${index}`).value.trim();
  const phone = document.getElementById(`customerPhone${index}`).value.trim();
  const address = document.getElementById(`customerAddress${index}`).value.trim();
  const landSize = document.getElementById(`customerLandSize${index}`).value.trim();
  const startDate = document.getElementById(`customerStartDate${index}`).value;
  const note = document.getElementById(`customerNote${index}`).value.trim();

  const roofSelect = document.getElementById(`roof${index}`);
  const roofPrice = parseFloat(roofSelect?.value) || 0;
  const roofMaterial = roofSelect ? roofSelect.options[roofSelect.selectedIndex].text : "";

  const floorSelect = document.getElementById(`floor${index}`);
  const floorPrice = parseFloat(floorSelect?.value) || 0;
  const floorMaterial = floorSelect ? floorSelect.options[floorSelect.selectedIndex].text : "";

  const wallSelect = document.getElementById(`wall${index}`);
  const wallPrice = parseFloat(wallSelect?.value) || 0;
  const wallMaterial = wallSelect ? wallSelect.options[wallSelect.selectedIndex].text : "";

  const windowSelect = document.getElementById(`window${index}`);
  const windowPrice = parseFloat(windowSelect?.value) || 0;
  const windowMaterial = windowSelect ? windowSelect.options[windowSelect.selectedIndex].text : "";

  const bathSelect = document.getElementById(`bath${index}`);
  const bathroomPrice = parseFloat(bathSelect?.value) || 0;
  const bathroomMaterial = bathSelect ? bathSelect.options[bathSelect.selectedIndex].text : "";

  const estimatedTotalText = document.getElementById(`priceBox${index}`).innerText;
  const estimatedTotal = parseFloat(estimatedTotalText.replace(/[^0-9.-]+/g, "")) || 0;

  if (!name || !phone || !address || !landSize) {
    alert('กรุณากรอกข้อมูลที่มีเครื่องหมาย * ให้ครบถ้วน');
    return;
  }

  const { error } = await supabaseClient.from('orders').insert([
    {
      house_id: house.id,
      house_name: house.name,
      price: house.price,

      customer_name: name,
      customer_phone: phone,
      address: address,
      land_size: landSize,
      start_date: startDate || null,
      note: note || null,

      roof_material: roofMaterial,
      roof_price: roofPrice,

      floor_material: floorMaterial,
      floor_price: floorPrice,

      wall_material: wallMaterial,
      wall_price: wallPrice,

      window_material: windowMaterial,
      window_price: windowPrice,

      bathroom_material: bathroomMaterial,
      bathroom_price: bathroomPrice,

      estimated_total: estimatedTotal
    }
  ]);

  if (error) {
    alert('เกิดข้อผิดพลาด: ' + error.message);
    console.error(error);
    return;
  }

  alert('✅ ส่งคำขอสร้างบ้านเรียบร้อย ทีมงานจะติดต่อกลับเร็วที่สุด');
  document.getElementById(`orderForm${index}`).classList.remove('show');
  closeModal();
}

function closeModal() {
  document.getElementById("houseModal").classList.remove('show');
}

function filterHouses() {
  const width = parseFloat(document.getElementById('landWidth').value) || 0;
  const length = parseFloat(document.getElementById('landLength').value) || 0;
  const minPrice = parseFloat(document.getElementById('minPrice').value) || 0;
  const maxPrice = parseFloat(document.getElementById('maxPrice').value) || Infinity;
  const bedrooms = parseFloat(document.getElementById('bedrooms').value) || 0;
  const bathrooms = parseFloat(document.getElementById('bathrooms').value) || 0;
  const parking = parseFloat(document.getElementById('parking').value) || 0;

  const filtered = allHouses.filter(house => {
    const matchSize = (width === 0 && length === 0) || (width >= house.width && length >= house.length);
    const matchPrice = house.price >= minPrice && house.price <= maxPrice;
    const matchBedrooms = house.bedrooms >= bedrooms;
    const matchBathrooms = house.bathrooms >= bathrooms;
    const matchParking = house.parking >= parking;
    return matchSize && matchPrice && matchBedrooms && matchBathrooms && matchParking;
  });

  displayHouses(filtered);
}

function updatePrice(index) {
  const house = allHouses[index];

  const grade = parseFloat(document.getElementById(`gradeSelect${index}`)?.value || 0);

  const roof = parseInt(document.getElementById(`roof${index}`)?.value || 0);
  const floor = parseInt(document.getElementById(`floor${index}`)?.value || 0);
  const wall = parseInt(document.getElementById(`wall${index}`)?.value || 0);
  const windowM = parseInt(document.getElementById(`window${index}`)?.value || 0);
  const bath = parseInt(document.getElementById(`bath${index}`)?.value || 0);

  const boqTotal = roof + floor + wall + windowM + bath;
  let price = house.price + boqTotal;
  price = price + (price * grade);

  document.getElementById(`priceBox${index}`).innerText = '฿' + price.toLocaleString();
}

// ===== AI CHAT FUNCTIONS =====
const webhookURLAI = "https://sevennican19.app.n8n.cloud/webhook/ai-house";
let chatOpen = false;

function toggleChat() {
  const container = document.getElementById("chatContainer");
  chatOpen = !chatOpen;
  container.style.display = chatOpen ? "block" : "none";
  if(chatOpen) {
    document.getElementById("ai-input").focus();
    const messages = document.getElementById("ai-messages");
    messages.scrollTop = messages.scrollHeight;
  }
}

function addMessageAI(text, type, isImage=false) {
  const div = document.createElement("div");
  div.className = "message-ai " + type;
  if (isImage) {
    const img = document.createElement("img");
    img.src = text;
    img.className = "ai-image";
    img.onload = () => {
      const messages = document.getElementById("ai-messages");
      messages.scrollTop = messages.scrollHeight;
    };
    div.appendChild(img);
  } else {
    div.innerText = text;
  }
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
    const res = await fetch(webhookURLAI, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ message: message })
    });

    const contentType = res.headers.get("content-type");
    loading.remove();

    if (contentType && contentType.includes("image")) {
      const blob = await res.blob();
      const imageUrl = URL.createObjectURL(blob);
      addMessageAI(imageUrl, "bot-ai", true);
    } else {
      let data;
      if (contentType && contentType.includes("application/json")) {
        data = await res.json();
      } else {
        const textResponse = await res.text();
        data = { reply: textResponse };
      }

      if (data.reply) {
        addMessageAI(data.reply, "bot-ai");
      } else if (data.answer) {
        addMessageAI(data.answer, "bot-ai");
      } else if (data.message) {
        addMessageAI(data.message, "bot-ai");
      } else if (data.output) {
        addMessageAI(data.output, "bot-ai");
      } else if (typeof data === 'string') {
        addMessageAI(data, "bot-ai");
      } else if (data[0] && data[0].output) {
        addMessageAI(data[0].output, "bot-ai");
      } else {
        addMessageAI("AI ไม่สามารถตอบได้ (ไม่พบฟิลด์ข้อมูลที่รองรับ)", "bot-ai");
        console.log("Raw Bot Response:", data);
      }
    }
  } catch (err) {
    console.error("AI chat error:", err);
    if(loading) loading.remove();
    addMessageAI("เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง", "bot-ai");
  }
}

function handleKeyPress(e) {
  if (e.key === "Enter") {
    sendAI();
  }
}

// ===== AUTHENTICATION FUNCTIONS =====
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

// Run on page load
document.addEventListener('DOMContentLoaded', checkAuth);

// Load houses on page load
loadHouses();

// ===== ADMIN CHAT WIDGET (Context Aware) =====
let adminUserId = null;
let currentConversation = null;
let messagesSubscription = null;

async function openAdminChatForBuild(index, event) {
  if(event) {
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

  document.getElementById("chatTitle").innerText = `💬 สอบถามแบบบ้าน`;
  const houseContext = allHouses[index];

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

    // Context message logic: Fill the input box, so the user can easily send it
    if(houseContext) {
      document.getElementById("chatInput").value = `สนใจสร้างบ้านรุ่น: ${houseContext.name} ราคาเริ่มต้น: ฿${Number(houseContext.price).toLocaleString()}`;
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
  if(inputEl) inputEl.value = '';
  await loadAdminMessages();
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