/**
 * admin-reports.js
 * Logic for Charts and Analytics Reports
 */

const SUPABASE_URL = "https://uqcjajmqtlchftpqwsrp.supabase.co";
const SUPABASE_KEY = "sb_publishable_yWZiH8l1idY0QWGuj6p9sg_GqXPONGX";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser = null;
let isMockMode = false;

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
    if (!session) return enableMockMode("ยังไม่ได้ล็อกอิน (No Session)");

    const { data: profile, error } = await supabaseClient.from("profiles").select("role").eq("id", session.user.id).maybeSingle();

    if (error) {
      console.error("DB Error:", error);
      return enableMockMode("DB Error: " + error.message + " (เช็กสิทธิ์ RLS!)");
    }
    if (!profile) return enableMockMode("ตาราง Profiles ไม่มีบัญชี UUID ของคุณ (Not Found)");
    if (profile.role !== "admin") return enableMockMode("สิทธิ์ของคุณตอนนี้คือ: [" + profile.role + "] (ระบบต้องการ admin)");

    currentUser = session.user;
    if (document.getElementById('adminNameDisplay')) document.getElementById('adminNameDisplay').innerText = "System Admin";

    renderCharts();
  } catch (err) {
    console.error(err);
    enableMockMode("System Error: " + err.message);
  }
}

function enableMockMode(reason) {
  isMockMode = true;
  showToast("Preview Mode", reason + " - ข้อมูลจำลอง");
  renderCharts();
}

async function logout() {
  if (!isMockMode) await supabaseClient.auth.signOut();
  window.location.href = "login.html";
}

// ===== CHARTS & GRAPHS =====
function renderCharts() {
  // Common visual aesthetics
  Chart.defaults.font.family = "'Outfit', 'Sarabun', sans-serif";
  Chart.defaults.color = '#64748b';
  
  // 1. Revenue Chart (Line)
  const revCtx = document.getElementById('revenueChart').getContext('2d');
  
  // Create gradient
  let gradient = revCtx.createLinearGradient(0, 0, 0, 300);
  gradient.addColorStop(0, 'rgba(79, 70, 229, 0.4)'); // Primary indigo with opacity
  gradient.addColorStop(1, 'rgba(79, 70, 229, 0.0)');
  
  new Chart(revCtx, {
    type: 'line',
    data: {
      labels: ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'],
      datasets: [{
        label: 'รายได้ (THB)',
        data: [420000, 480000, 600000, 520000, 680000, 845000],
        fill: true,
        backgroundColor: gradient,
        borderColor: '#4f46e5',
        borderWidth: 3,
        tension: 0.4, // Smooth curvy line
        pointBackgroundColor: '#ffffff',
        pointBorderColor: '#4f46e5',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: { 
          beginAtZero: true, 
          grid: { color: '#f1f5f9', drawBorder: false },
          ticks: { callback: function(val) { return '฿' + (val/1000) + 'k'; } }
        },
        x: { grid: { display: false, drawBorder: false } }
      }
    }
  });

  // 2. Services Chart (Doughnut)
  const srvCtx = document.getElementById('servicesChart').getContext('2d');
  new Chart(srvCtx, {
    type: 'doughnut',
    data: {
      labels: ['ซ่อมแอร์', 'ซ่อมประปา', 'ซ่อมไฟฟ้า', 'ต่อเติมบ้าน', 'อื่นๆ'],
      datasets: [{
        data: [45, 25, 20, 7, 3],
        backgroundColor: [
          '#4f46e5', // Indigo
          '#10b981', // Emerald
          '#f59e0b', // Amber
          '#ef4444', // Rose
          '#94a3b8'  // Muted
        ],
        borderWidth: 0,
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '75%', // Modern thin donut
      plugins: {
        legend: { position: 'right', labels: { usePointStyle: true, padding: 20 } }
      }
    }
  });
}
