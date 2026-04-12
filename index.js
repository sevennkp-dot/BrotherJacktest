// ===== CONFIGURATION =====
const CONFIG = {
  supabaseUrl: "https://uqcjajmqtlchftpqwsrp.supabase.co",
  supabaseKey: "sb_publishable_yWZiH8l1idY0QWGuj6p9sg_GqXPONGX"
};

// ===== SUPABASE CLIENT =====
let supabaseClient;

try {
  supabaseClient = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey);
  console.log('✅ Supabase Client Created Successfully');
} catch (error) {
  console.error('❌ Supabase Client Error:', error);
  showError('❌ ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
}

// ===== PORTFOLIO FUNCTIONS =====

/**
 * Fetch portfolio items from Supabase
 */
async function loadPortfolioData() {
  if (!supabaseClient) {
    showError('❌ ไม่สามารถโหลดข้อมูลได้ (Supabase ไม่พร้อม)');
    return;
  }

  try {
    console.log('📥 Fetching portfolio data from Supabase...');

    const { data, error } = await supabaseClient
      .from('our_work')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Supabase Error:', error);
      showError(`❌ Error: ${error.message}`);
      return;
    }

    if (!data || data.length === 0) {
      console.warn('⚠️ No portfolio data found');
      showEmptyState();
      return;
    }

    console.log('✅ Portfolio Data Loaded:', data);
    renderPortfolioItems(data);

  } catch (err) {
    console.error('❌ Unexpected Error:', err);
    showError('❌ เกิดข้อผิดพลาด กรุณาลองใหม่');
  }
}

/**
 * Render portfolio items
 */
function renderPortfolioItems(items) {
  const portfolioGrid = document.getElementById('portfolioGrid');
  
  // Clear skeleton loaders
  portfolioGrid.innerHTML = '';

  // If no items, show empty state
  if (!items || items.length === 0) {
    showEmptyState();
    return;
  }

  // Render each item
  items.forEach((item, index) => {
    const card = document.createElement('div');
    card.className = 'portfolio-card';
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');

    card.innerHTML = `
      <img 
        src="${item.image_url}" 
        alt="${item.title}" 
        loading="lazy"
        onerror="this.src='https://via.placeholder.com/300x200?text=รูปไม่โหลด'"
      >
      <div class="portfolio-info">
        <h3>${item.title}</h3>
        <p>${item.description || 'ผลงานจากลูกค้า'}</p>
      </div>
    `;

    // Click event
    card.addEventListener('click', () => {
      openImageModal(item.image_url, item.title);
    });

    // Keyboard event
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openImageModal(item.image_url, item.title);
      }
    });

    portfolioGrid.appendChild(card);
  });
}

/**
 * Open image in modal
 */
function openImageModal(imageUrl, title) {
  const modal = document.createElement('div');
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.95);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    padding: 20px;
  `;

  const closeButton = document.createElement('button');
  closeButton.setAttribute('aria-label', 'ปิด');
  closeButton.style.cssText = `
    position: absolute;
    top: 20px;
    right: 20px;
    background: white;
    border: none;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    font-size: 24px;
    cursor: pointer;
    z-index: 10001;
    transition: all 0.25s ease;
  `;
  closeButton.innerHTML = '✕';
  closeButton.onmouseover = () => closeButton.style.background = '#f0f0f0';
  closeButton.onmouseout = () => closeButton.style.background = 'white';
  closeButton.onclick = () => modal.remove();

  const img = document.createElement('img');
  img.src = imageUrl;
  img.alt = title;
  img.style.cssText = `
    width: 100%;
    height: auto;
    border-radius: 8px;
    max-height: 80vh;
    object-fit: contain;
  `;

  modal.appendChild(img);
  modal.appendChild(closeButton);
  document.body.appendChild(modal);

  // Close on background click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });

  // Close on Escape key
  const handleKeydown = (e) => {
    if (e.key === 'Escape') {
      modal.remove();
      document.removeEventListener('keydown', handleKeydown);
    }
  };
  document.addEventListener('keydown', handleKeydown);

  closeButton.focus();
}

/**
 * Show error message
 */
function showError(message) {
  const portfolioGrid = document.getElementById('portfolioGrid');
  const errorContainer = document.getElementById('errorContainer');
  
  portfolioGrid.innerHTML = '';
  errorContainer.innerHTML = `<div class="error-message">${message}</div>`;
}

/**
 * Show empty state
 */
function showEmptyState() {
  const portfolioGrid = document.getElementById('portfolioGrid');
  portfolioGrid.innerHTML = `
    <div class="empty-state" style="grid-column: 1/-1;">
      <p>😔 ยังไม่มีผลงาน</p>
      <p style="font-size: 14px; color: #999;">กรุณากลับมาตรวจสอบในภายหลัง</p>
    </div>
  `;
}

// ===== AUTHENTICATION =====

/**
 * Check authentication status
 */
async function checkAuth() {
  if (!supabaseClient) return;

  try {
    const { data: { session } } = await supabaseClient.auth.getSession();

    if (session) {
      const user = session.user;
      const { data: customer } = await supabaseClient
        .from("customers")
        .select("name")
        .eq("id", user.id)
        .single();

      // Check for technician role
      const { data: technicianMember } = await supabaseClient
        .from("technicians")
        .select("id")
        .eq("id", user.id)
        .single();
      
      const { data: profileData } = await supabaseClient
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      // UI update begins (synchronous block)
      const userName = customer?.name || user.email || 'User';
      const initial = userName.charAt(0).toUpperCase();

      document.getElementById("authUserInfo").style.display = "block";
      document.getElementById("authLoginBtn").style.display = "none";
      document.getElementById("userName").innerText = userName;
      document.getElementById("userInitial").innerText = initial;

      if (technicianMember) {
        const applyBtn = document.getElementById("navApply");
        if (applyBtn) applyBtn.style.display = "none";
      }

      // Add Admin/Technician dashboard links
      const dashContainer = document.getElementById("roleDashboardLink");
      if (dashContainer) {
        dashContainer.innerHTML = ""; 
        
        if (profileData?.role === 'admin') {
          const adminBtn = document.createElement("a");
          adminBtn.href = "admin.html";
          adminBtn.innerHTML = "🛠️ แอดมิน";
          adminBtn.style.cssText = "color: #e74c3c; font-weight: 600; margin-left: 12px; text-decoration: none;";
          dashContainer.appendChild(adminBtn);
        }
        
        if (technicianMember) {
          const techBtn = document.createElement("a");
          techBtn.href = "technician-dashboard.html";
          techBtn.innerHTML = "👨‍🔧 แดชบอร์ดช่าง";
          techBtn.style.cssText = "color: #10b981; font-weight: 600; margin-left: 12px; text-decoration: none;";
          dashContainer.appendChild(techBtn);
        }
      }
    }
  } catch (error) {
    console.error('Auth check error:', error);
  }
}

/**
 * Logout user
 */
async function logout() {
  if (!supabaseClient) return;

  try {
    await supabaseClient.auth.signOut();
    window.location.href = "login.html";
  } catch (error) {
    console.error('Logout error:', error);
    alert('เกิดข้อผิดพลาด');
  }
}

// ===== INITIALIZE ON PAGE LOAD =====
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Initializing application...');
  loadPortfolioData();
  checkAuth();
});