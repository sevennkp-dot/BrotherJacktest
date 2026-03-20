/**
 * admin-settings.js
 * Logic for Admin System Settings and Profile Updates
 */

const SUPABASE_URL = "https://uqcjajmqtlchftpqwsrp.supabase.co";
const SUPABASE_KEY = "sb_publishable_yWZiH8l1idY0QWGuj6p9sg_GqXPONGX";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let isMockMode = false;
let currentUser = null;

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

  // Buttons feedback
  document.querySelectorAll('.btn, .icon-btn').forEach(btn => {
    btn.addEventListener('mousedown', function() { this.style.transform = 'scale(0.95)'; });
    btn.addEventListener('mouseup', function() { this.style.transform = ''; });
    btn.addEventListener('mouseleave', function() { this.style.transform = ''; });
  });

  // Settings Tabs
  document.querySelectorAll('.set-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      document.querySelectorAll('.set-tab').forEach(t => t.classList.remove('active'));
      e.currentTarget.classList.add('active');
      showToast('เชื่อมต่อเมนูสำเร็จ', 'เปิดหน้าต่างการตั้งค่าส่วนนี้พร้อมใช้งาน...', false);
    });
  });
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
  }, 6000);
}

async function checkAuthAndLoadData() {
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return enableMockMode("ยังไม่ได้ล็อกอิน (No Session)");

    const { data: profile, error } = await supabaseClient.from("profiles").select("*").eq("id", session.user.id).maybeSingle();

    if (error) {
      console.error("DB Error:", error);
      return enableMockMode("DB Error: " + error.message);
    }
    if (!profile) return enableMockMode("ไม่พบข้อมูลโปรไฟล์ในตาราง");
    if (profile.role !== "admin") return enableMockMode("สิทธิ์ของคุณตอนนี้คือ: [" + profile.role + "] (เข้าถึงระบบแอดมินไม่ได้จริง)");

    currentUser = session.user;
    
    // Bind current user info to input
    if (document.getElementById('adminNameDisplay')) {
        document.getElementById('adminNameDisplay').innerText = profile.fullname || profile.username || profile.name || "System Admin";
    }
    
    const nameInput = document.getElementById('profileNameInput');
    const emailInput = document.querySelector('input[type="email"]');
    
    if(nameInput) nameInput.value = profile.fullname || profile.username || profile.name || "";
    if(emailInput) emailInput.value = currentUser.email || "";
    
  } catch (err) {
    console.error(err);
    enableMockMode("System Error: " + err.message);
  }
}

window.saveAdminProfile = async function() {
    if(isMockMode || !currentUser) return showToast("โหมดจำลอง", "ไม่อนุญาตให้แก้ไขในโหมดทดสอบ", true);
    
    const newName = document.getElementById('profileNameInput').value;
    const btn = document.getElementById('saveProfileBtn');
    if(!btn) return;
    
    const oldHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> กำลังบันทึก...';
    btn.disabled = true;
    
    try {
        // Find which column the user table uses for name (fullname vs username vs name)
        let { error } = await supabaseClient.from('profiles').update({ fullname: newName }).eq('id', currentUser.id);
        if(error) {
             console.warn("Update fullname failed, trying username...");
             let er2 = await supabaseClient.from('profiles').update({ username: newName }).eq('id', currentUser.id);
             if(er2.error) {
                 console.warn("Update username failed, trying name...");
                 let er3 = await supabaseClient.from('profiles').update({ name: newName }).eq('id', currentUser.id);
                 if(er3.error) throw er3.error;
             }
        }
        
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

function enableMockMode(reason) {
  isMockMode = true;
  showToast("Preview Mode", reason + " - ข้อมูลจำลอง", true);
}

async function logout() {
  if (!isMockMode) {
    await supabaseClient.auth.signOut();
  }
  window.location.href = "login.html";
}
