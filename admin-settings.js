const SUPABASE_URL = "https://uqcjajmqtlchftpqwsrp.supabase.co";
const SUPABASE_KEY = "sb_publishable_yWZiH8l1idY0QWGuj6p9sg_GqXPONGX";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let isMockMode = false;
let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
  setupUI();
  await checkAuthAndLoadData();
  await loadSystemSettings();
  setupTabNavigation();
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

  // Buttons feedback
  document.querySelectorAll('.btn, .icon-btn').forEach(btn => {
    btn.addEventListener('mousedown', function() { this.style.transform = 'scale(0.95)'; });
    btn.addEventListener('mouseup', function() { this.style.transform = ''; });
    btn.addEventListener('mouseleave', function() { this.style.transform = ''; });
  });
}

function setupTabNavigation() {
    document.querySelectorAll('.set-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            const tabName = e.currentTarget.getAttribute('data-tab');
            switchTab(tabName);
        });
    });
}

function switchTab(tabName) {
    // Update Nav
    document.querySelectorAll('.set-tab').forEach(t => {
        t.classList.toggle('active', t.getAttribute('data-tab') === tabName);
    });

    // Update Panes
    document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.style.display = pane.id === tabName + 'Section' ? 'block' : 'none';
        pane.classList.toggle('active', pane.id === tabName + 'Section');
    });

    showToast('เปลี่ยนหน้าต่าง', `กำลังแสดงส่วน ${tabName}...`, false);
}

function showToast(title, message, isError = false) {
  const container = document.getElementById('toastContainer');
  if(!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  
  if (isError) {
    toast.style.borderLeftColor = 'var(--rose)';
    toast.innerHTML = `<i class="fa-solid fa-circle-xmark" style="color: var(--rose);"></i>`;
  } else {
    toast.innerHTML = `<i class="fa-solid fa-check-circle" style="color: var(--emerald);"></i>`;
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
  }, 4000);
}

async function checkAuthAndLoadData() {
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return enableMockMode("ยังไม่ได้ล็อกอิน (No Session)");

    currentUser = session.user;

    const { data: profile, error } = await supabaseClient.from("profiles").select("*").eq("id", currentUser.id).maybeSingle();

    if (error) {
      console.error("DB Error:", error);
      return enableMockMode("DB Error: " + error.message);
    }
    
    if (!profile) return enableMockMode("ไม่พบข้อมูลโปรไฟล์ในตาราง");
    if (profile.role !== "admin") return enableMockMode("สิทธิ์ของคุณไม่ใช่แอดมิน");

    // Bind current user info
    if (document.getElementById('adminNameDisplay')) {
        document.getElementById('adminNameDisplay').innerText = profile.fullname || profile.username || profile.name || "System Admin";
    }
    
    const nameInput = document.getElementById('profileNameInput');
    const emailInput = document.getElementById('profileEmailInput');
    const profileImg = document.getElementById('adminProfileImg');
    
    if(nameInput) nameInput.value = profile.fullname || profile.username || profile.name || "";
    if(emailInput) emailInput.value = currentUser.email || "";

    if (profile.avatar_url && profileImg) {
        profileImg.src = profile.avatar_url;
    }
    
  } catch (err) {
    console.error(err);
    enableMockMode("System Error: " + err.message);
  }
}

// ===== SYSTEM SETTINGS LOGIC =====

async function loadSystemSettings() {
    if (isMockMode) return;
    try {
        const { data, error } = await supabaseClient.from('system_settings').select('*');
        if (error) throw error;

        data.forEach(setting => {
            const toggle = document.getElementById(getToggleId(setting.key));
            if (toggle) {
                toggle.checked = (setting.value === true || setting.value === 'true');
            }
        });
    } catch (err) {
        console.warn("Could not load system settings:", err);
    }
}

function getToggleId(key) {
    if (key === 'auto_approve_technicians') return 'autoApproveToggle';
    if (key === 'email_notifications') return 'emailNotificationsToggle';
    return null;
}

window.updateSetting = async function(key, value) {
    if (isMockMode) return showToast("โหมดจำลอง", "ไม่สามารถบันทึกค่าได้ในโหมดทดสอบ", true);
    
    try {
        const { error } = await supabaseClient
            .from('system_settings')
            .update({ value: value, updated_at: new Date().toISOString() })
            .eq('key', key);
            
        if (error) throw error;
        showToast("บันทึกสำเร็จ", `ปรับปรุงค่า ${key} เรียบร้อยแล้ว`);
    } catch (err) {
        showToast("ล้มเหลว", err.message, true);
    }
}

// ===== PROFILE & SECURITY =====

window.saveAdminProfile = async function() {
    if(isMockMode || !currentUser) return showToast("โหมดจำลอง", "ไม่อนุญาตให้แก้ไขในโหมดทดสอบ", true);
    
    const newName = document.getElementById('profileNameInput').value;
    const btn = document.getElementById('saveProfileBtn');
    
    const oldHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> กำลังบันทึก...';
    btn.disabled = true;
    
    try {
        const { error } = await supabaseClient.from('profiles').update({ fullname: newName }).eq('id', currentUser.id);
        if(error) throw error;
        
        showToast("บันทึกสำเร็จ", "ระบบอัปเดตข้อมูลผู้ดูแลระบบเรียบร้อยแล้ว");
        if (document.getElementById('adminNameDisplay')) {
            document.getElementById('adminNameDisplay').innerText = newName;
        }
    } catch(err) {
        showToast("เกิดข้อผิดพลาด", err.message, true);
    } finally {
        btn.innerHTML = oldHtml;
        btn.disabled = false;
    }
}

window.handleChangePassword = async function() {
    const newPass = document.getElementById('newPasswordInput').value;
    const confirmPass = document.getElementById('confirmPasswordInput').value;

    if (!newPass || newPass.length < 6) return showToast("รหัสผ่านสั้นเกินไป", "กรุณาระบุอย่างน้อย 6 ตัวอักษร", true);
    if (newPass !== confirmPass) return showToast("ข้อมูลไม่ตรงกัน", "รหัสผ่านและการยืนยันไม่ตรงกัน", true);

    const btn = document.getElementById('changePasswordBtn');
    btn.disabled = true;

    try {
        const { error } = await supabaseClient.auth.updateUser({ password: newPass });
        if (error) throw error;
        showToast("เปลี่ยนรหัสผ่านสำเร็จ", "รหัสผ่านของคุณถูกเปลี่ยนเรียบร้อยแล้ว");
        document.getElementById('newPasswordInput').value = "";
        document.getElementById('confirmPasswordInput').value = "";
    } catch (err) {
        showToast("ล้มเหลว", err.message, true);
    } finally {
        btn.disabled = false;
    }
}

window.handleAvatarUpload = async function(event) {
    showToast("Coming Soon", "ระบบอัปโหลดรูปภาพกำลังอยู่ระหว่างการเชื่อมต่อ Storage", false);
}

window.removeAvatar = function() {
    showToast("Coming Soon", "ฟังก์ชันลบรูปภาพจะพร้อมใช้งานเร็วๆ นี้", false);
}

function enableMockMode(reason) {
  isMockMode = true;
  showToast("Preview Mode", "โหมดตัวอย่าง: " + reason, true);
}

async function logout() {
  if (!isMockMode) {
    await supabaseClient.auth.signOut();
  }
  window.location.href = "login.html";
}

