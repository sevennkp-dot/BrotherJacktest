// ===== SUPABASE SETUP =====
const SUPABASE_URL = "https://uqcjajmqtlchftpqwsrp.supabase.co";
const SUPABASE_KEY = "sb_publishable_yWZiH8l1idY0QWGuj6p9sg_GqXPONGX";

const { createClient } = window.supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);
const db = supabaseClient;

const shopContainer = document.getElementById("shopContainer");

// ===== AUTHENTICATION STATE MANAGEMENT =====
let authUnsubscribe = null;

/**
 * Check authentication status
 */
async function checkAuth() {
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    if (session) {
      const user = session.user;
      console.log('✅ User logged in:', user.email);
      
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
      console.log('❌ No user logged in');
      document.getElementById("authUserInfo").style.display = "none";
      document.getElementById("authLoginBtn").style.display = "block";
    }
  } catch (error) {
    console.error("❌ Auth check error:", error);
  }
}

/**
 * Logout user
 */
async function logout() {
  try {
    await supabaseClient.auth.signOut();
    console.log('✅ Logged out successfully');
    window.location.href = "login.html";
  } catch (error) {
    console.error("❌ Logout error:", error);
  }
}

// ===== SHOPS LOADING =====

/**
 * Load shops from database with optional filters
 */
async function loadShops(filters = {}) {
  console.log('📥 Loading shops with filters:', filters);
  
  let query = db.from("shops").select("*");

  if (filters.name) query = query.ilike("name", `%${filters.name}%`);
  if (filters.subdistrict) query = query.ilike("subdistrict", `%${filters.subdistrict}%`);
  if (filters.district) query = query.ilike("district", `%${filters.district}%`);
  if (filters.province) query = query.ilike("province", `%${filters.province}%`);

  const { data, error } = await query;

  console.log('✅ Query Result - Data length:', data ? data.length : 0);
  if (error) console.error('❌ Query Error:', error);

  if (error) {
    console.error("❌ Error loading shops:", error);
    shopContainer.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #e74c3c;">⚠️ Database Error: ' + error.message + '</p>';
    return;
  }

  shopContainer.innerHTML = "";

  if (!data || data.length === 0) {
    console.warn('⚠️ No shops found');
    document.getElementById('noResult').style.display = "block";
    return;
  }

  document.getElementById('noResult').style.display = "none";

  data.forEach(shop => {
    const statusBadge = shop.is_open
      ? `<span class="status-badge status-open">✓ เปิดอยู่</span>`
      : `<span class="status-badge status-closed">✕ ปิดแล้ว</span>`;

    const websiteButton = shop.website_url
      ? `<a href="${shop.website_url}" target="_blank" class="website-btn">🌐 เข้าสู่เว็บไซต์</a>`
      : `<a class="no-website">❌ ไม่มีเว็บไซต์</a>`;

    const shopCard = document.createElement('div');
    shopCard.className = 'shop-card';
    shopCard.innerHTML = `
      <div>
        ${shop.image_url
          ? `<img src="${shop.image_url}" alt="${shop.name}" loading="lazy">`
          : `<div class="no-image">ไม่มีรูปภาพ</div>`}
      </div>
      <div class="shop-info">
        <div class="shop-header">
          <h3>${shop.name}</h3>
          ${statusBadge}
        </div>
        <p>${shop.description || "ร้านวัสดุก่อสร้าง"}</p>
        <div class="shop-details">
          <p>📍 ${shop.subdistrict || ""} ${shop.district || ""} ${shop.province || ""}</p>
          <p>🚚 พื้นที่ให้บริการ: ${shop.service_area || "ไม่ระบุ"}</p>
          <p>📞 ${shop.phone || "-"}</p>
        </div>
        ${websiteButton}
      </div>
    `;
    shopContainer.appendChild(shopCard);
  });
}

/**
 * Search shops based on input filters
 */
function searchShops() {
  const filters = {
    name: document.getElementById("searchInput").value,
    subdistrict: document.getElementById("subdistrictInput").value,
    district: document.getElementById("districtInput").value,
    province: document.getElementById("provinceInput").value
  };

  loadShops(filters);
}

// ===== AI CHAT FUNCTIONALITY =====
const webhookURLAI = "https://sevenican6.app.n8n.cloud/webhook/b813bf13-6067-4721-a453-9503789c0bce";
let chatOpen = false;

/**
 * Toggle chat visibility
 */
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

/**
 * Add message to chat
 */
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

/**
 * Send message to AI
 */
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
    console.error("❌ AI chat error:", err);
    if(loading) loading.remove();
    addMessageAI("เกิดข้อผิดพลาดในการเชื่อมต��อ กรุณาลองใหม่อีกครั้ง", "bot-ai");
  }
}

/**
 * Handle Enter key press in chat input
 */
function handleKeyPress(e) {
  if (e.key === "Enter") {
    sendAI();
  }
}

// ===== INITIALIZE ON PAGE LOAD =====
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Initializing Materials page...');
  
  checkAuth();
  
  // Listen for authentication state changes
  authUnsubscribe = supabaseClient.auth.onAuthStateChange((event, session) => {
    console.log('🔄 Auth state changed:', event);
    checkAuth();
  });

  // Load shops on initial load
  loadShops();
});

// ===== CLEANUP =====
window.addEventListener('beforeunload', () => {
  if (authUnsubscribe) {
    console.log('🧹 Cleaning up auth listener');
    authUnsubscribe.data.subscription.unsubscribe();
  }
});