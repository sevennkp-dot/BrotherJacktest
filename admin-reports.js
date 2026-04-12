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

    // Load real data instead of mock
    fetchAndRenderCharts();
    loadPendingSlipsCount();
    
    // Subscribe to changes
    supabaseClient.channel('reports-live')
      .on('postgres_changes', { event: '*', schema: 'public' }, () => { 
        loadPendingSlipsCount(); 
        fetchAndRenderCharts(); // Refresh charts on new data
      })
      .subscribe();
  } catch (err) {
    console.error(err);
    enableMockMode("System Error: " + err.message);
  }
}

function enableMockMode(reason) {
  isMockMode = true;
  showToast("Preview Mode", reason + " - ข้อมูลจำลอง");
  renderMockCharts();
}

async function logout() {
  if (!isMockMode) await supabaseClient.auth.signOut();
  window.location.href = "login.html";
}

// Global chart instances
let revenueChartInstance = null;
let servicesChartInstance = null;

// ===== REAL DATA CHARTS & GRAPHS =====
async function fetchAndRenderCharts() {
  try {
    const today = new Date();
    // Start date: 6 months ago, 1st day of the month
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(today.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    const startDateString = sixMonthsAgo.toISOString();

    // 1. Fetch Revenue Data (Orders & Bookings)
    // Only successful/in-progress items
    const [ordersRes, bookingsRes] = await Promise.all([
      supabaseClient.from('orders').select('created_at, total_price, payment_amount, deposit_amount').gte('created_at', startDateString).in('status', ['เสร็จสิ้น', 'กำลังดำเนินการ', 'ยืนยันแล้ว']),
      supabaseClient.from('bookings').select('created_at, total_price, payment_amount, deposit_amount').gte('created_at', startDateString).in('status', ['เสร็จสิ้น', 'ยืนยันแล้ว'])
    ]);

    // Setup 6 buckets
    const monthNames = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    let monthsBucket = [];
    for (let i = 5; i >= 0; i--) {
      let d = new Date();
      d.setMonth(today.getMonth() - i);
      let mKey = `${d.getFullYear()}-${d.getMonth()}`;
      monthsBucket.push({ key: mKey, label: monthNames[d.getMonth()] + ' ' + d.getFullYear().toString().substring(2), total: 0 });
    }

    const processItems = (items) => {
      (items || []).forEach(item => {
        const d = new Date(item.created_at);
        const mKey = `${d.getFullYear()}-${d.getMonth()}`;
        let target = monthsBucket.find(m => m.key === mKey);
        if (target) {
           let r = parseFloat(item.total_price) || parseFloat(item.payment_amount) || parseFloat(item.deposit_amount) || 0;
           target.total += r;
        }
      });
    };

    processItems(ordersRes.data);
    processItems(bookingsRes.data);

    const revLabels = monthsBucket.map(m => m.label);
    const revData = monthsBucket.map(m => Math.floor(m.total));

    // 2. Fetch Services Category Data (Doughnut)
    // We get all bookings to classify job_type/category
    const { data: servicesData } = await supabaseClient.from('bookings').select('category, job_type, technicians(category)').not('status', 'eq', 'ยกเลิก');
    
    let serviceCounts = {};
    (servicesData || []).forEach(item => {
       const rawCat = item.category || item.job_type || (item.technicians ? item.technicians.category : null) || 'บริการทั่วไป';
       serviceCounts[rawCat] = (serviceCounts[rawCat] || 0) + 1;
    });

    const sortedCats = Object.entries(serviceCounts).sort((a,b) => b[1] - a[1]);
    let finalCatLabels = [];
    let finalCatData = [];
    let otherCount = 0;
    
    sortedCats.forEach((c, index) => {
        if(index < 4) { finalCatLabels.push(c[0]); finalCatData.push(c[1]); } 
        else { otherCount += c[1]; }
    });
    if(otherCount > 0) { finalCatLabels.push('อื่นๆ'); finalCatData.push(otherCount); }

    if(finalCatLabels.length === 0) {
        finalCatLabels = ['ยังไม่มีการจอง'];
        finalCatData = [1];
    }

    // 3. Dynamic Stats (Completion Rate & Technician Rating)
    let totalBookings = 0;
    let completedBookings = 0;
    (bookingsRes.data || []).forEach(b => {
      totalBookings++;
      if(b.status === 'เสร็จสิ้น') completedBookings++;
    });
    const completionRate = totalBookings > 0 ? Math.round((completedBookings / totalBookings) * 100) : 0;

    const { data: techs } = await supabaseClient.from('technicians').select('rating');
    let totalRating = 0;
    let techCount = 0;
    (techs || []).forEach(t => {
      if(t.rating) { totalRating += parseFloat(t.rating); techCount++; }
    });
    const avgRating = techCount > 0 ? (totalRating / techCount).toFixed(1) : 0;

    // Update UI elements manually if they exist
    const statRateEl = document.querySelector('.list-item:nth-child(1) .text-lg');
    if(statRateEl) statRateEl.innerText = `${completionRate}%`;

    const statRatingEl = document.querySelector('.list-item:nth-child(2) .text-lg');
    if(statRatingEl) statRatingEl.innerText = `${avgRating}/5`;

    renderChartsUI(revLabels, revData, finalCatLabels, finalCatData);

  } catch(e) {
    console.error("Failed to fetch real analytics:", e);
    renderMockCharts();
  }
}

function renderChartsUI(revLabels, revData, srvLabels, srvData) {
  Chart.defaults.font.family = "'Outfit', 'Sarabun', sans-serif";
  Chart.defaults.color = '#64748b';
  
  // 1. Revenue Chart
  const revCtx = document.getElementById('revenueChart').getContext('2d');
  if (revenueChartInstance) revenueChartInstance.destroy();
  
  let gradient = revCtx.createLinearGradient(0, 0, 0, 300);
  gradient.addColorStop(0, 'rgba(79, 70, 229, 0.4)');
  gradient.addColorStop(1, 'rgba(79, 70, 229, 0.0)');
  
  revenueChartInstance = new Chart(revCtx, {
    type: 'line',
    data: {
      labels: revLabels,
      datasets: [{
        label: 'รายได้จริง (THB)',
        data: revData,
        fill: true,
        backgroundColor: gradient,
        borderColor: '#4f46e5',
        borderWidth: 3,
        tension: 0.4,
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
      plugins: { legend: { display: false } },
      scales: {
        y: { 
          beginAtZero: true, 
          grid: { color: '#f1f5f9', drawBorder: false },
          ticks: { callback: function(val) { return '฿' + (val/1000).toFixed(1) + 'k'; } }
        },
        x: { grid: { display: false, drawBorder: false } }
      }
    }
  });

  // 2. Services Chart (Doughnut)
  const srvCtx = document.getElementById('servicesChart').getContext('2d');
  if (servicesChartInstance) servicesChartInstance.destroy();
  
  servicesChartInstance = new Chart(srvCtx, {
    type: 'doughnut',
    data: {
      labels: srvLabels,
      datasets: [{
        data: srvData,
        backgroundColor: ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#94a3b8'],
        borderWidth: 0,
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '75%',
      plugins: {
        legend: { position: 'right', labels: { usePointStyle: true, padding: 20 } }
      }
    }
  });
}

function renderMockCharts() {
   renderChartsUI(
      ['ต.ค.', 'พ.ย.', 'ธ.ค.', 'ม.ค.', 'ก.พ.', 'มี.ค.'],
      [420000, 480000, 600000, 520000, 680000, 845000],
      ['ซ่อมแอร์', 'ซ่อมประปา', 'ซ่อมไฟฟ้า', 'ต่อเติมบ้าน', 'อื่นๆ'],
      [45, 25, 20, 7, 3]
   );
}

async function loadPendingSlipsCount() {
  const countEl = document.getElementById('pendingSlipsCount');
  if(!countEl) return;
  
  if(isMockMode) {
    countEl.innerText = "12";
    return;
  }

  try {
    const tables = ['orders', 'interests', 'bookings'];
    let total = 0;
    
    for(const table of tables) {
      const { count, error } = await supabaseClient
        .from(table)
        .select('*', { count: 'exact', head: true })
        .eq('payment_status', 'pending_verification');
      
      if(!error) total += (count || 0);
    }
    
    countEl.innerText = total;
    
    // Visual highlight if > 0
    if(total > 0) {
      countEl.style.color = '#e11d48';
      document.getElementById('pendingSlipsItem').style.background = '#fff1f2';
    } else {
      countEl.style.color = '';
      document.getElementById('pendingSlipsItem').style.background = '';
    }
  } catch(err) {
    console.error("Error loading pending slips count:", err);
  }
}
