/**
 * admin-reviews.js
 * Logic for managing reviews via Admin Dashboard
 */

const SUPABASE_URL = "https://uqcjajmqtlchftpqwsrp.supabase.co";
const SUPABASE_KEY = "sb_publishable_yWZiH8l1idY0QWGuj6p9sg_GqXPONGX"; // In production, this would be an env var
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let allReviews = [];

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

  // Search & Rating filters
  const searchInput = document.getElementById('searchInput');
  const ratingFilter = document.getElementById('ratingFilter');

  function applyFilters() {
    let filtered = allReviews;
    
    if (searchInput) {
      const term = searchInput.value.toLowerCase();
      if (term) {
        filtered = filtered.filter(r => 
          (r.customer_name && r.customer_name.toLowerCase().includes(term)) || 
          (r.comment && r.comment.toLowerCase().includes(term)) ||
          (r.tech_name && r.tech_name.toLowerCase().includes(term))
        );
      }
    }

    if (ratingFilter) {
      const rating = ratingFilter.value;
      if (rating !== 'all') {
        filtered = filtered.filter(r => {
          if (rating === '5') return r.rating === 5;
          if (rating === '4') return r.rating >= 4;
          if (rating === '3') return r.rating >= 3;
          if (rating === 'bad') return r.rating < 3;
          return true;
        });
      }
    }

    renderReviewsTable(filtered);
  }

  if (searchInput) searchInput.addEventListener('keyup', applyFilters);
  if (ratingFilter) ratingFilter.addEventListener('change', applyFilters);
}

function showToast(title, message, isError = false) {
  const container = document.getElementById('toastContainer');
  if (!container) return;
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
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  }, 10);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(20px)';
    setTimeout(() => toast.remove(), 300);
  }, 6000);
}

async function checkAuthAndLoadData() {
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
        window.location.href = "login.html";
        return;
    }

    const { data: profile, error } = await supabaseClient.from("profiles").select("role").eq("id", session.user.id).maybeSingle();

    if (error || !profile || profile.role !== "admin") {
      alert("Unauthorized access");
      window.location.href = "index.html";
      return;
    }

    if (document.getElementById('adminNameDisplay')) document.getElementById('adminNameDisplay').innerText = "System Admin";

    await loadReviews();
    
    // Subscribe to real-time additions/deletions
    supabaseClient.channel('admin-reviews-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reviews' }, payload => {
        loadReviews();
      })
      .subscribe();
  } catch (err) {
    console.error(err);
  }
}

async function logout() {
  await supabaseClient.auth.signOut();
  window.location.href = "login.html";
}

async function loadReviews() {
  try {
    // 1. Fetch reviews
    const { data: reviews, error: reviewError } = await supabaseClient
      .from('reviews')
      .select(`
        *,
        technician:technician_id(name)
      `)
      .order('created_at', { ascending: false });

    if (reviewError) throw reviewError;

    allReviews = reviews.map(r => ({
        ...r,
        tech_name: r.technician ? r.technician.name : 'Unknown Tech'
    }));
    
    renderReviewsTable(allReviews);
  } catch(e) {
    console.error(e);
    showToast("Error", "ไม่สามารถดึงข้อมูลรีวิวได้: " + e.message, true);
  }
}

function renderReviewsTable(reviews) {
  const tbody = document.getElementById('reviewsTableBody');
  const countSpan = document.getElementById('totalReviewsCount');
  
  if (countSpan) countSpan.innerText = reviews.length.toLocaleString();
  if (!tbody) return;

  if (reviews.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-5 text-muted">ไม่พบข้อมูลรีวิว</td></tr>`;
    return;
  }

  tbody.innerHTML = reviews.map(r => {
    const date = new Date(r.created_at).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const stars = '⭐'.repeat(r.rating || 0);
    
    return `
      <tr>
        <td class="text-muted text-sm">${date}</td>
        <td>
          <div style="font-weight:700; color:var(--primary);">${r.tech_name}</div>
          <div style="font-size:11px; color:var(--text-muted);">ID: ${String(r.technician_id || '').substring(0,8)}...</div>
        </td>
        <td>
          <div style="font-weight:600;">${r.customer_name || 'Anonymous'}</div>
          <div style="font-size:11px; color:var(--text-muted);">Booking: ${r.booking_id || '-'}</div>
        </td>
        <td>
          <div style="display:flex; align-items:center; gap:4px;">
            <span style="color:#f59e0b;">${stars}</span>
            <span style="font-weight:700; color:var(--text-main);">${Number(r.rating || 0).toFixed(1)}</span>
          </div>
        </td>
        <td style="max-width: 300px; white-space: normal; line-height: 1.4;">
            <div style="font-size: 13px; color: var(--text-main);">${r.comment || '<i class="text-muted">ไม่มีความเห็น</i>'}</div>
        </td>
        <td>
          <button class="action-btn delete" title="ลบรีวิวนี้" onclick="deleteReview('${r.id}')" style="background:#fee2e2; color:#ef4444; border:1px solid #fecaca; width:34px; height:34px; border-radius:8px; cursor:pointer;">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

window.deleteReview = async function(id) {
    if (!confirm("คุณแน่ใจหรือไม่ว่าต้องการลบรีวิวนี้? การลบไม่สามารถเรียกคืนได้")) return;

    try {
        const { error } = await supabaseClient
            .from('reviews')
            .delete()
            .eq('id', id);

        if (error) throw error;

        showToast("สำเร็จ", "ลบรีวิวเรียบร้อยแล้ว");
        await loadReviews();
    } catch (err) {
        console.error(err);
        showToast("Error", "ไม่สามารถลบรีวิวได้: " + err.message, true);
    }
}

// Universal CSV Export
window.exportToCSV = function() {
    let filename = document.title.split('|')[0].trim().replace(/s+/g, '_') + '.csv';
    let activeTable = document.querySelector('table');
    if(!activeTable) {
       showToast("ข้อผิดพลาด", "ไม่พบตารางข้อมูลสำหรับส่งออก", true);
       return;
    }
    
    let csv = [];
    let rows = activeTable.querySelectorAll('tr');
    
    for (let i = 0; i < rows.length; i++) {
        let row = [], cols = rows[i].querySelectorAll('td, th');
        
        // Skip rows with "Loading" or "No data"
        if(cols.length === 1 && cols[0].colSpan > 1) continue;
        
        // Skip the last column (Actions)
        let colCount = (i === 0) ? cols.length - 1 : cols.length; 
        if(cols[cols.length-1].querySelector('button')) colCount = cols.length - 1;

        for (let j = 0; j < colCount; j++) {
            let data = cols[j].innerText.trim()
                .replace(/r?n|r/g, ' ') // remove newlines
                .replace(/"/g, '""'); // escape double quotes
            
            row.push('"' + data + '"');
        }
        csv.push(row.join(','));
    }
    
    // Add BOM for Excel Thai language support
    let csvContent = "data:text/csv;charset=utf-8,uFEFF" + csv.join('n');
    let encodedUri = encodeURI(csvContent);
    let link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast("สำเร็จ", "ดาวน์โหลดรายงาน Excel เรียบร้อยแล้ว");
};
