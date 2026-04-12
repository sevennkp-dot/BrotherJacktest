
/**
 * admin-requests.js
 * Manage customer build orders ('orders') and property inquiries ('interests')
 */
const SUPABASE_URL = "https://uqcjajmqtlchftpqwsrp.supabase.co";
const SUPABASE_KEY = "sb_publishable_yWZiH8l1idY0QWGuj6p9sg_GqXPONGX";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser = null;
let currentTab = 'orders';
let allItems = [];
let currentEditId = null;

const TABLE_MAP = {
  'orders': 'orders',
  'interests': 'interests',
  'bookings': 'bookings'
};

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

  document.getElementById('menuToggle')?.addEventListener('click', toggleSidebar);
  document.getElementById('menuClose')?.addEventListener('click', toggleSidebar);
  overlay.addEventListener('click', toggleSidebar);
}

function showToast(title, message, isError = false) {
  const container = document.getElementById('toastContainer');
  if(!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = isError 
    ? `<i class="fa-solid fa-circle-xmark" style="color: var(--rose);"></i><div class="toast-body"><h4>${title}</h4><p>${message}</p></div>`
    : `<i class="fa-solid fa-bell" style="color: var(--primary);"></i><div class="toast-body"><h4>${title}</h4><p>${message}</p></div>`;
  if(isError) toast.style.borderLeftColor = 'var(--rose)';
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
    if (!session) return window.location.href = "login.html";

    const { data: profile } = await supabaseClient.from("profiles").select("role").eq("id", session.user.id).maybeSingle();
    if (!profile || profile.role !== "admin") showToast("สิทธิ์ไม่เพียงพอ", "รับชมโครงสร้าง UI จำลอง");
    
    // Auto-refresh generic fallback
    supabaseClient.channel('admin-req-live').on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => { loadData(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'interests' }, () => { loadData(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => { loadData(); }).subscribe();

    loadData();
  } catch (err) { console.error(err); }
}

async function logout() {
  await supabaseClient.auth.signOut();
  window.location.href = "login.html";
}

window.switchTab = function(tabName) {
  currentTab = tabName;
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
  event.currentTarget.classList.add('active');
  document.getElementById(`tab-${tabName}`).classList.add('active');
  loadData();
};

async function loadData() {
  const tbodyId = currentTab === 'orders' ? 'ordersTableBody' : 
                  currentTab === 'interests' ? 'interestsTableBody' : 'bookingsTableBody';
  
  const colSpan = currentTab === 'bookings' ? 8 : 9;
  document.getElementById(tbodyId).innerHTML = `<tr><td colspan="${colSpan}" class="text-center py-5"><i class="fa-solid fa-circle-notch fa-spin text-primary"></i> <p class="mt-2 text-muted">Loading...</p></td></tr>`;
  
  try {
    const tableName = TABLE_MAP[currentTab];
    let result;
    let invoicesMap = {};
    
    // Attempt data fetch with joins for better display
    if(currentTab === 'interests') {
      result = await supabaseClient.from('interests').select('*, properties(title)').order('created_at', { ascending: false }).limit(50);
      if(result.error) {
        console.warn("Join failed for interests, falling back to simple select:", result.error.message);
        result = await supabaseClient.from('interests').select('*').order('created_at', { ascending: false }).limit(50);
      }
    } else if(currentTab === 'bookings') {
      result = await supabaseClient.from('bookings').select('*, technicians(name, category, phone)').order('created_at', { ascending: false }).limit(50);
      if(result.error) {
        console.warn("Join failed for bookings, falling back to simple select:", result.error.message);
        result = await supabaseClient.from('bookings').select('*').order('created_at', { ascending: false }).limit(50);
      }
      // Load linked invoices to display completion slips side-by-side with deposits
      if (!result.error && result.data && result.data.length > 0) {
          const bIds = result.data.map(b => b.id);
          const { data: invData } = await supabaseClient.from('invoices').select('*').in('booking_id', bIds);
          if (invData) invData.forEach(inv => invoicesMap[inv.booking_id] = inv);
      }
    } else {
      result = await supabaseClient.from(tableName).select('*').order('created_at', { ascending: false }).limit(50);
    }

    if(result.error) throw result.error;
    
    allItems = result.data || [];
    if (currentTab === 'bookings') {
        allItems.forEach(item => { if (invoicesMap[item.id]) item.invoice = invoicesMap[item.id]; });
    }
    renderTable();
  } catch(e) {
    document.getElementById(tbodyId).innerHTML = `<tr><td colspan="9" class="text-center py-5 text-danger"><b>ตารางยังไม่สมบูรณ์ หรือ ไม่มีสิทธิ์เข้าถึง (RLS)</b><br>โปรดตรวจสอบตาราง ${TABLE_MAP[currentTab]}<br><small>${e.message}</small></td></tr>`;
  }
}

function renderTable() {
  const isOrders = currentTab === 'orders';
  const isInterests = currentTab === 'interests';
  const isBookings = currentTab === 'bookings';
  
  const tbodyId = isOrders ? 'ordersTableBody' : 
                  isInterests ? 'interestsTableBody' : 'bookingsTableBody';
  const tbody = document.getElementById(tbodyId);
  
  if (allItems.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="text-center py-5 text-muted">ยังไม่มีข้อมูลในระบบ</td></tr>`;
    return;
  }

  tbody.innerHTML = allItems.map(item => {
    // Basic status badge
    let badgeStyle = 'pending';
    if(['เสร็จสิ้น', 'ปิดการขาย', 'ยืนยันแล้ว'].includes(item.status)) badgeStyle = 'completed';
    else if(['ยกเลิก', 'ยกเลิกแล้ว'].includes(item.status)) badgeStyle = 'rejected';
    else if(['กำลังดำเนินการ', 'ติดต่อแล้ว', 'กำลังไป'].includes(item.status)) badgeStyle = 'in-progress';
    
    // Payment/Slip badge
    let pBadge = '';
    if(item.slip_url) {
      if(['verified', 'paid', 'success'].includes(item.payment_status)) {
        const amountVal = item.payment_amount || item.deposit_amount;
        const amt = amountVal ? ' ฿' + formatNumber(amountVal) : '';
        pBadge = `<div class="mt-1"><span class="badge-status verified text-xs" style="padding: 4px 8px;"><i class="fa-solid fa-check-double mr-1"></i> จ่ายมัดจำแล้ว${amt}</span></div>`;
      } else if(item.payment_status === 'invalid' || item.payment_status === 'rejected') {
        pBadge = `<div class="mt-1"><span class="badge-status rejected text-xs" style="padding: 4px 8px;"><i class="fa-solid fa-circle-xmark mr-1"></i> สลิปไม่ถูกต้อง</span></div>`;
      } else {
        pBadge = `<div class="mt-1"><span class="badge-status pending text-xs" style="padding: 4px 8px; cursor:pointer;" onclick="viewItem('${item.id}')"><i class="fa-solid fa-clock-rotate-left mr-1"></i> รอตีสลิป</span></div>`;
      }
    }

    if(isOrders) {
      return `<tr>
        <td>
          <div class="table-date-group">
            <span class="table-date-main">${new Date(item.created_at).toLocaleDateString('th-TH')}</span>
            <span class="table-date-sub">${new Date(item.created_at).toLocaleTimeString('th-TH', {hour:'2-digit', minute:'2-digit'})} น.</span>
          </div>
        </td>
        <td class="font-weight-bold text-xs">#ORD-${item.id.substring(0,8)}...</td>
        <td>
          <div class="table-customer-info">
             <div class="table-avatar"><i class="fa-solid fa-user"></i></div>
             <div><div class="font-weight-bold" style="color:#1e293b;">${item.customer_name || item.name || '-'}</div><div class="text-xs text-muted">${item.customer_phone || item.phone || '-'}</div></div>
          </div>
        </td>
        <td class="text-indigo font-weight-bold">${item.house_name || item.house_model || '-'}</td>
        <td class="text-muted text-xs" style="max-width:150px; overflow:hidden; text-overflow:ellipsis;" title="${item.address || '-'}">${item.address || '-'}</td>
        <td><span class="badge-status ${badgeStyle}">${item.status || 'รอดำเนินการ'}</span> ${pBadge}</td>
        <td style="white-space:nowrap;">
          ${item.payment_amount || item.deposit_amount ? `<div class="text-xs mb-1"><span class="text-muted">มัดจำ:</span> <span class="font-weight-bold text-emerald">฿${formatNumber(item.payment_amount || item.deposit_amount)}</span></div>` : `<div class="text-xs text-muted mb-1">มัดจำ: -</div>`}
          ${item.invoice && (item.invoice.total_amount || item.invoice.amount) ? `<div class="text-xs"><span class="text-muted">ส่วนที่เหลือ:</span> <span class="font-weight-bold text-primary">฿${formatNumber(item.invoice.total_amount || item.invoice.amount)}</span></div>` : ''}
          ${item.total_price || item.price ? `<div class="text-xs mt-1 pt-1" style="border-top:1px solid #e2e8f0;"><span class="text-muted">ยอดรวม:</span> <span class="font-weight-bold text-indigo">฿${formatNumber(item.total_price || item.price)}</span></div>` : ''}
        </td>
        <td class="text-center">
          <div style="display:flex; justify-content:center; align-items:flex-start; gap:12px;">
             ${item.slip_url ? `
                <div style="display:flex; flex-direction:column; align-items:center; gap:6px;">
                  <span class="text-xs" style="color:var(--text-main); font-weight:600; margin-bottom:-4px; white-space:nowrap;">มัดจำ</span>
                  <div class="slip-thumb-wrapper" style="position:relative; display:inline-block;">
                    <div onclick="viewSlip('${item.slip_url}', '${item.id}', 'order_deposit')">
                      <img src="${item.slip_url}" crossorigin="anonymous" class="rounded shadow-sm" style="width: 44px; height: 44px; object-fit: cover; border: 2px solid white; cursor: zoom-in;" title="ดูสลิปมัดจำ">
                    </div>
                  </div>
                  <div id="qr-result-dep-${item.id}" style="font-size:10px; color:var(--text-muted); line-height:1;"><i class="fa-solid fa-spinner fa-spin"></i></div>
                </div>
              ` : ''}
              
             ${item.invoice?.slip_url ? `
                <div style="display:flex; flex-direction:column; align-items:center; gap:6px;">
                  <span class="text-xs" style="color:var(--primary); font-weight:600; margin-bottom:-4px; white-space:nowrap;">เสร็จสิ้น</span>
                  <div class="slip-thumb-wrapper" style="position:relative; display:inline-block;">
                    <div onclick="viewSlip('${item.invoice.slip_url}', '${item.invoice.id}', 'order_invoice')">
                      <img src="${item.invoice.slip_url}" crossorigin="anonymous" class="rounded shadow-sm" style="width: 44px; height: 44px; object-fit: cover; border: 2px solid white; cursor: zoom-in;" title="ดูสลิปบิลเสร็จสิ้น">
                    </div>
                  </div>
                  <div id="qr-result-inv-${item.id}" style="font-size:10px; color:var(--text-muted); line-height:1;"><i class="fa-solid fa-spinner fa-spin"></i></div>
                </div>
              ` : (item.slip_url ? `<div style="display:flex; flex-direction:column; align-items:center; gap:6px; opacity:0.5;"><span class="text-xs" style="color:var(--text-main); font-weight:600; margin-bottom:-4px; white-space:nowrap;">เสร็จสิ้น</span><div style="width:44px;height:44px;border-radius:6px;background:#f8fafc;border:1px dashed #cbd5e1;display:flex;align-items:center;justify-content:center;"><i class="fa-solid fa-image text-muted" style="font-size:14px;"></i></div></div>` : '')}
             
             ${!item.slip_url && !item.invoice?.slip_url ? `<span class="text-muted text-xs p-2 bg-light rounded shadow-sm border" style="opacity:0.6; white-space:nowrap;">ยังไม่มีสลิป</span>` : ''}
          </div>
        </td>
        <td style="white-space:nowrap;">
          <div class="action-buttons">
            <button class="action-btn view" onclick="viewItem('${item.id}')" title="รายละเอียดใบสั่งสร้าง"><i class="fa-solid fa-file-contract"></i></button>
            <button class="action-btn edit" onclick="editItemStatus('${item.id}')" title="อัปเดตสถานะ"><i class="fa-solid fa-pen"></i></button>
          </div>
        </td>
      </tr>`;
    } else if(isInterests) {
      return `<tr>
        <td>
          <div class="table-date-group">
            <span class="table-date-main">${new Date(item.created_at).toLocaleDateString('th-TH')}</span>
            <span class="table-date-sub">${new Date(item.created_at).toLocaleTimeString('th-TH', {hour:'2-digit', minute:'2-digit'})} น.</span>
          </div>
        </td>
        <td>
          <div class="table-customer-info">
             <div class="table-avatar"><i class="fa-solid fa-user"></i></div>
             <div>
                <div class="font-weight-bold" style="color:#1e293b;">${item.customer_name || item.name || '-'}</div>
                <div class="text-xs text-muted"><i class="fa-solid fa-phone mr-1"></i>${item.customer_phone || item.phone || '-'}</div>
             </div>
          </div>
        </td>
        <td>
          <span class="prop-title-truncate" title="${item.properties?.title || item.property_title || item.property_name || '-'}">
            ${item.properties?.title || item.property_title || item.property_name || '-'}
          </span>
        </td>
        <td><span class="badge-status in-progress">${item.interest_type || item.type || '-'}</span></td>
        <td class="text-xs font-weight-bold text-success">${item.ready_date || '-'}</td>
        <td>
          <span class="badge-status ${badgeStyle}">${item.status || 'รอติดต่อกลับ'}</span>
          ${pBadge}
        </td>
        <td style="white-space:nowrap;">
          ${item.payment_amount || item.deposit_amount ? `<div class="text-xs mb-1"><span class="text-muted">มัดจำ:</span> <span class="font-weight-bold text-emerald">฿${formatNumber(item.payment_amount || item.deposit_amount)}</span></div>` : `<div class="text-xs text-muted mb-1">มัดจำ: -</div>`}
          ${item.invoice && (item.invoice.total_amount || item.invoice.amount) ? `<div class="text-xs"><span class="text-muted">ส่วนที่เหลือ:</span> <span class="font-weight-bold text-primary">฿${formatNumber(item.invoice.total_amount || item.invoice.amount)}</span></div>` : ''}
          ${item.total_price || item.price ? `<div class="text-xs mt-1 pt-1" style="border-top:1px solid #e2e8f0;"><span class="text-muted">ยอดรวม:</span> <span class="font-weight-bold text-indigo">฿${formatNumber(item.total_price || item.price)}</span></div>` : ''}
        </td>
        <td class="text-center">
          <div style="display:flex; justify-content:center; align-items:flex-start; gap:12px;">
             ${item.slip_url ? `
                <div style="display:flex; flex-direction:column; align-items:center; gap:6px;">
                  <span class="text-xs" style="color:var(--text-main); font-weight:600; margin-bottom:-4px; white-space:nowrap;">มัดจำ</span>
                  <div class="slip-thumb-wrapper" style="position:relative; display:inline-block;">
                    <div onclick="viewSlip('${item.slip_url}', '${item.id}', 'interest_deposit')">
                      <img src="${item.slip_url}" crossorigin="anonymous" class="rounded shadow-sm" style="width: 44px; height: 44px; object-fit: cover; border: 2px solid white; cursor: zoom-in;" title="ดูสลิปมัดจำ">
                    </div>
                  </div>
                  <div id="qr-result-dep-${item.id}" style="font-size:10px; color:var(--text-muted); line-height:1;"><i class="fa-solid fa-spinner fa-spin"></i></div>
                </div>
              ` : ''}
              
             ${item.invoice?.slip_url ? `
                <div style="display:flex; flex-direction:column; align-items:center; gap:6px;">
                  <span class="text-xs" style="color:var(--primary); font-weight:600; margin-bottom:-4px; white-space:nowrap;">เสร็จสิ้น</span>
                  <div class="slip-thumb-wrapper" style="position:relative; display:inline-block;">
                    <div onclick="viewSlip('${item.invoice.slip_url}', '${item.invoice.id}', 'interest_invoice')">
                      <img src="${item.invoice.slip_url}" crossorigin="anonymous" class="rounded shadow-sm" style="width: 44px; height: 44px; object-fit: cover; border: 2px solid white; cursor: zoom-in;" title="ดูสลิปบิลเสร็จสิ้น">
                    </div>
                  </div>
                  <div id="qr-result-inv-${item.id}" style="font-size:10px; color:var(--text-muted); line-height:1;"><i class="fa-solid fa-spinner fa-spin"></i></div>
                </div>
              ` : (item.slip_url ? `<div style="display:flex; flex-direction:column; align-items:center; gap:6px; opacity:0.5;"><span class="text-xs" style="color:var(--text-main); font-weight:600; margin-bottom:-4px; white-space:nowrap;">เสร็จสิ้น</span><div style="width:44px;height:44px;border-radius:6px;background:#f8fafc;border:1px dashed #cbd5e1;display:flex;align-items:center;justify-content:center;"><i class="fa-solid fa-image text-muted" style="font-size:14px;"></i></div></div>` : '')}
             
             ${!item.slip_url && !item.invoice?.slip_url ? `<span class="text-muted text-xs p-2 bg-light rounded shadow-sm border" style="opacity:0.6; white-space:nowrap;">ยังไม่มีสลิป</span>` : ''}
          </div>
        </td>
        <td style="white-space:nowrap;">
          <div class="action-buttons">
            <button class="action-btn view" onclick="viewItem('${item.id}')" title="รายละเอียด"><i class="fa-solid fa-eye"></i></button>
            <button class="action-btn edit" onclick="editItemStatus('${item.id}')" title="อัปเดตสถานะ"><i class="fa-solid fa-pen"></i></button>
          </div>
        </td>
      </tr>`;
    } else if(isBookings) {
      return `<tr>
        <td>
          <div class="table-date-group">
            <span class="table-date-main">${new Date(item.created_at).toLocaleDateString('th-TH')}</span>
            <span class="table-date-sub">${new Date(item.created_at).toLocaleTimeString('th-TH', {hour:'2-digit', minute:'2-digit'})} น.</span>
          </div>
        </td>
        <td>
          <div class="table-customer-info">
             <div class="table-avatar"><i class="fa-solid fa-user"></i></div>
             <div>
                <div class="font-weight-bold" style="color:#1e293b;">${item.customer_name || item.fullname || '-'}</div>
                <div class="text-xs text-muted"><i class="fa-solid fa-phone mr-1"></i>${item.customer_phone || '-'}</div>
             </div>
          </div>
        </td>
        <td style="white-space:nowrap;">
          <div class="table-customer-info">
             <div class="table-avatar" style="background:#eef2ff; color:var(--primary);"><i class="fa-solid fa-user-gear"></i></div>
             <div>
                <div class="font-weight-bold">${item.technicians?.name || item.tech_name || '-'}</div>
                <div class="text-xs text-indigo">${item.technicians?.category || item.category || '-'}</div>
                <div class="text-xs text-muted" style="margin-top:2px; font-weight:600;"><i class="fa-solid fa-phone mr-1" style="font-size:10px; opacity:0.7;"></i>${item.technicians?.phone || item.tech_phone || item.technician_phone || 'ไม่มีข้อมูลเบอร์ช่าง'}</div>
             </div>
          </div>
        </td>
        <td class="text-muted text-xs" style="white-space:nowrap;">
          <div class="font-weight-bold" style="color:#0f172a;"><i class="fa-regular fa-calendar-check mr-1"></i> ${(() => {
             let dStr = item.service_date || '';
             if(!dStr) return '-';
             if(dStr.includes('-')) {
                 const [y, m, d] = dStr.split('-');
                 const mths = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
                 return `${parseInt(d)} ${mths[parseInt(m)-1]} ${parseInt(y)+543}`;
             }
             return dStr;
          })()}</div>
          <div><i class="fa-regular fa-clock mr-1"></i> ${item.service_time ? item.service_time.substring(0,5) : ''} น.</div>
        </td>
        <td>
          <span class="badge-status ${badgeStyle}">${item.status || 'รอดำเนินการ'}</span>
          ${pBadge}
        </td>
        <td class="text-center font-weight-bold" style="color:var(--emerald);">
          ${(() => {
              let t = (item.invoice && (item.invoice.total_amount || item.invoice.amount)) || item.total_price || item.price || item.payment_amount || item.deposit_amount;
              return t ? '฿' + formatNumber(t) : '-';
          })()}
        </td>
        <td class="text-center">
          <div style="display:flex; justify-content:center; align-items:flex-start; gap:12px;">
             ${item.slip_url ? `
                <div style="display:flex; flex-direction:column; align-items:center; gap:6px;">
                  <span class="text-xs" style="color:var(--text-main); font-weight:600; margin-bottom:-4px; white-space:nowrap;">มัดจำ</span>
                  <div class="slip-thumb-wrapper" style="position:relative; display:inline-block;">
                    <div onclick="viewSlip('${item.slip_url}', '${item.id}', 'booking_deposit')">
                      <img src="${item.slip_url}" crossorigin="anonymous" class="rounded shadow-sm" style="width: 44px; height: 44px; object-fit: cover; border: 2px solid white; cursor: zoom-in;" title="ดูสลิปมัดจำ">
                    </div>
                  </div>
                  <div id="qr-result-dep-${item.id}" style="font-size:10px; color:var(--text-muted); line-height:1;"><i class="fa-solid fa-spinner fa-spin"></i></div>
                </div>
              ` : ''}
              
             ${item.invoice?.slip_url ? `
                <div style="display:flex; flex-direction:column; align-items:center; gap:6px;">
                  <span class="text-xs" style="color:var(--primary); font-weight:600; margin-bottom:-4px; white-space:nowrap;">เสร็จสิ้น</span>
                  <div class="slip-thumb-wrapper" style="position:relative; display:inline-block;">
                    <div onclick="viewSlip('${item.invoice.slip_url}', '${item.invoice.id}', 'booking_invoice')">
                      <img src="${item.invoice.slip_url}" crossorigin="anonymous" class="rounded shadow-sm" style="width: 44px; height: 44px; object-fit: cover; border: 2px solid white; cursor: zoom-in;" title="ดูสลิปบิลแจ้งชำระ">
                    </div>
                  </div>
                  <div id="qr-result-inv-${item.id}" style="font-size:10px; color:var(--text-muted); line-height:1;"><i class="fa-solid fa-spinner fa-spin"></i></div>
                </div>
              ` : (item.slip_url ? `<div style="display:flex; flex-direction:column; align-items:center; gap:6px; opacity:0.5;"><span class="text-xs" style="color:var(--text-main); font-weight:600; margin-bottom:-4px; white-space:nowrap;">เสร็จสิ้น</span><div style="width:44px;height:44px;border-radius:6px;background:#f8fafc;border:1px dashed #cbd5e1;display:flex;align-items:center;justify-content:center;"><i class="fa-solid fa-image text-muted" style="font-size:14px;"></i></div></div>` : '')}
             
             ${!item.slip_url && !item.invoice?.slip_url ? `<span class="text-muted text-xs p-2 bg-light rounded shadow-sm border" style="opacity:0.6; white-space:nowrap;">ยังไม่มีสลิป</span>` : ''}
          </div>
        </td>
        <td style="white-space:nowrap;">
          <div class="action-buttons">
            <button class="action-btn view" onclick="viewItem('${item.id}')" title="รายละเอียดการจอง"><i class="fa-solid fa-eye"></i></button>
            ${(item.status === 'เสร็จสิ้น' || item.status === 'รอชำระ' || item.slip_url) ? `<button class="action-btn" style="color:var(--primary); border-color:var(--primary-light);" onclick="viewReceipt('${item.id}')" title="ดูใบแจ้งชำระเงิน/ใบเสร็จ"><i class="fa-solid fa-file-invoice-dollar"></i></button>` : ''}
            <button class="action-btn edit" onclick="editItemStatus('${item.id}')" title="อัปเดตสถานะ"><i class="fa-solid fa-pen"></i></button>
          </div>
        </td>
      </tr>`;
    }
  }).join('');
  
  // Run background QR scans for all rendered items
  setTimeout(() => {
      allItems.forEach(item => {
          if (item.slip_url) scanSlipQRRow(item.slip_url, `qr-result-dep-${item.id}`);
          if (item.invoice && item.invoice.slip_url) scanSlipQRRow(item.invoice.slip_url, `qr-result-inv-${item.id}`);
      });
  }, 500);
}

window.viewItem = async function(id) {
    const item = allItems.find(x => x.id == id);
    if(!item) return;
    const isOrder = currentTab === 'orders';
    const isInterest = currentTab === 'interests';
    const isBooking = currentTab === 'bookings';
    
    document.getElementById('modalTitleItem').innerText = isOrder ? "รายละเอียดใบสั่งสร้างบ้าน (Order)" : 
                                                          isInterest ? "รายละเอียดคำขอเช่า/ซื้อ (Interest)" : "รายละเอียดการจองช่าง (Booking)";
    
    let html = `<div style="display:flex; flex-direction:column; gap:20px;">`;
    
    // Detailed Order/Request Info
    html += `<div class="p-4 bg-light rounded shadow-sm">`;
    const labelMap = {
      'customer_name': 'ชื่อลูกค้า',
      'customer_phone': 'เบอร์โทร',
      'customer_line': 'Line ID',
      'line_id': 'Line ID',
      'property_title': 'ชื่ออสังหาฯ',
      'interest_type': 'ประเภทความสนใจ',
      'ready_date': 'วันที่สะดวก',
      'payment_status': 'สถานะการเงิน',
      'payment_amount': 'ยอดมัดจำที่แจ้ง',
      'status': 'สถานะปัจจุบัน',
      'tech_name': 'ชื่อช่าง',
      'category': 'ประเภทงานช่าง',
      'service_date': 'วันที่นัดหมาย',
      'service_time': 'เวลานัดหมาย',
      'province': 'จังหวัด',
      'district': 'อำเภอ',
      'subdistrict': 'ตำบล',
      'problem_detail': 'รายละเอียดปัญหา',
      'house_name': 'แบบบ้านที่ต้องการ',
      'house_model': 'แบบบ้านที่เลือก',
      'address': 'ที่ตั้งโครงการ/หน้างาน',
      'location': 'สถานที่',
      'budget': 'งบประมาณ',
      'land_size_wa': 'พื้นที่ดิน (ตร.ว.)',
      'land_size_ngan': 'พื้นที่ดิน (งาน)',
      'land_size_rai': 'พื้นที่ดิน (ไร่)',
      'gps_link': 'พิกัด Google Maps',
      'notes': 'หมายเหตุเพิ่มเติม',
      'description': 'รายละเอียดคำสั่ง',
      'promo_code': 'โค้ดส่วนลดที่ลูกค้าใช้',
      'discount_amount': 'มูลค่าส่วนลด'
    };

    for(let key in item) {
       if(['id', 'slip_url', 'created_at', 'customer_id', 'property_id', 'technician_id', 'problem_image', 'land_photo'].includes(key)) continue;
       let val = item[key];
       if(val === null || val === '') val = '-';
       
       if(key === 'payment_amount' || key === 'budget' || (key === 'discount_amount' && val !== '-')) {
          val = '฿' + formatNumber(val);
          if (key === 'discount_amount') val = `<span class="text-rose font-weight-bold">-${val}</span>`;
       }
       if(key === 'promo_code' && val !== '-') val = `<span class="badge" style="background:#f1f5f9; color:var(--primary); font-family:monospace; padding:4px 8px;">${val}</span>`;
       
       if(key === 'gps_link' && val !== '-') {
          val = `<a href="${val}" target="_blank" class="text-primary" style="text-decoration:underline;"><i class="fa-solid fa-location-dot mr-1"></i> เปิดแผนที่</a>`;
       }
       
       html += `<div style="margin-bottom:10px; border-bottom:1px solid rgba(0,0,0,0.05); padding-bottom:6px; display:flex; justify-content:space-between; align-items:flex-start;">
                  <span class="text-muted small" style="flex-shrink:0;">${labelMap[key] || key}:</span> 
                  <strong style="text-align:right; margin-left:15px; word-break:break-word;">${val}</strong>
                </div>`;
    }
    
    // LAND PHOTO / PROBLEM IMAGE
    const photoUrl = item.land_photo || item.problem_image;
    if(photoUrl) {
       html += `
         <div class="mt-3">
            <span class="text-muted small">${isOrder ? 'รูปที่ดิน/หน้างาน:' : 'รูปปัญหา:'}</span>
            <div class="mt-2" style="text-align:center;">
               <img src="${photoUrl}" style="max-width:100%; border-radius:8px; box-shadow:0 2px 8px rgba(0,0,0,0.1); cursor:zoom-in;" onclick="window.open('${photoUrl}', '_blank')">
            </div>
         </div>
       `;
    }
    
    html += `</div>`;

    // PROPERTY DETAILS SECTION (For Interests)
    if(isInterest && item.property_id) {
       const { data: prop, error } = await supabaseClient
         .from('properties')
         .select('*')
         .eq('id', item.property_id)
         .single();
       
       if(prop) {
         html += `
           <div class="p-4 rounded shadow-sm" style="background: #f8fafc; border: 1px solid #e2e8f0;">
             <h5 class="mb-3 text-indigo"><i class="fa-solid fa-house-chimney mr-2"></i> ข้อมูลอสังหาริมทรัพย์แบบละเอียด</h5>
             <div class="grid-details" style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                <div class="detail-item"><span class="text-muted small">ชื่อ:</span> <strong>${prop.title}</strong></div>
                <div class="detail-item"><span class="text-muted small">ราคา:</span> <strong class="text-success">฿${formatNumber(prop.price)}</strong></div>
                <div class="detail-item"><span class="text-muted small">พื้นที่ใช้สอย:</span> <strong>${prop.usable_area || prop.area || '-'} ตร.ม.</strong></div>
                <div class="detail-item"><span class="text-muted small">ขนาดที่ดิน:</span> <strong>${prop.land_area_wa || '-'} ตร.ว.</strong></div>
                <div class="detail-item"><span class="text-muted small">ห้องนอน:</span> <strong>${prop.bedrooms || '0'}</strong></div>
                <div class="detail-item"><span class="text-muted small">ห้องน้ำ:</span> <strong>${prop.bathrooms || '0'}</strong></div>
                <div class="detail-item"><span class="text-muted small">ที่จอดรถ:</span> <strong>${prop.parking || '0'}</strong></div>
                <div class="detail-item"><span class="text-muted small">อายุทรัพย์:</span> <strong>${prop.property_age || '-'} ปี</strong></div>
                <div class="detail-item"><span class="text-muted small">ค่าส่วนกลาง:</span> <strong>฿${formatNumber(prop.common_fee)}</strong></div>
                <div class="detail-item"><span class="text-muted small">ประเภทโฉนด:</span> <strong>${prop.deed_type || '-'}</strong></div>
                <div class="detail-item" style="grid-column: span 2;"><span class="text-muted small">ทำเล:</span> <strong>${prop.subdistrict} ${prop.district} ${prop.province}</strong></div>
                <div class="detail-item" style="grid-column: span 2; border-top:1px solid #e2e8f0; padding-top:8px;">
                  <span class="text-muted small">รายละเอียดบ้าน:</span><br>
                  <p class="mb-0" style="font-size:13px; color:#475569;">${prop.description || prop.nearby_places || '-'}</p>
                </div>
             </div>
           </div>
         `;
       }
    }

    // SLIP SECTION
    if(item.slip_url) {
       html += `
         <div class="slip-verification-panel p-4" style="background:#f0f9ff; border:2px solid #bae6fd; border-radius:12px;">
            <h4 style="color:#0369a1; margin-bottom:15px; display:flex; align-items:center; gap:8px;">
              <i class="fa-solid fa-receipt"></i> ตรวจสอบสลิปการโอนเงิน (ค่าจอง)
            </h4>
            <div style="text-align:center; margin-bottom:15px; background:white; padding:10px; border-radius:8px;">
               <img src="${item.slip_url}" style="max-width:100%; max-height:400px; border-radius:4px; box-shadow:0 4px 12px rgba(0,0,0,0.1); cursor:zoom-in;" onclick="viewSlip('${item.slip_url}')">
               <p class="text-muted mt-2 small">คลิกที่รูปเพื่อเปิดดูแบบเต็มจอ</p>
            </div>`;
            
        const isVerified = ['verified', 'paid', 'success'].includes(item.payment_status);
        const isRejected = ['invalid', 'rejected'].includes(item.payment_status);
        
        if (isVerified) {
            html += `<div class="mt-4 text-center p-3 rounded" style="background:var(--emerald-light); color:var(--emerald); font-weight:bold; border:1px dashed var(--emerald);"><i class="fa-solid fa-check-circle mr-2"></i> อนุมัติสลิปเรียบร้อยแล้ว</div></div>`;
        } else if (isRejected) {
            html += `<div class="mt-4 text-center p-3 rounded" style="background:#ffe4e6; color:var(--rose); font-weight:bold; border:1px dashed #fda4af;"><i class="fa-solid fa-times-circle mr-2"></i> ไม่อนุมัติ (สลิปไม่ถูกต้อง)</div></div>`;
        } else {
            html += `<div style="display:flex; gap:10px; margin-top:20px;">
               <button class="btn btn-success" style="flex:1; padding:12px; font-weight:600;" onclick="handlePaymentStatus('${item.id}', 'paid')">✅ ยืนยันยอดมัดจำ (Verify)</button>
               <button class="btn btn-danger" style="flex:1; padding:12px; font-weight:600; background:#e11d48; border:none;" onclick="handlePaymentStatus('${item.id}', 'invalid')">❌ หลักฐานผิด (Invalid)</button>
            </div></div>`;
        }
    }
    
    html += `</div>`;
    
    document.getElementById('modalBodyItem').innerHTML = html;
    document.getElementById('saveItemBtn').style.display = 'none';
    
    const m = document.getElementById('itemModalOverlay');
    m.style.display = 'flex';
    setTimeout(() => m.classList.add('active'), 10);
};

window.handlePaymentStatus = async function(id, newStatus) {
    if(!confirm(`ยืนยันการตั้งค่าสถานะการชำระเงินเป็น: ${newStatus === 'paid' ? 'จ่ายมัดจำแล้ว' : 'หลักฐานไม่ถูกต้อง'}?`)) return;
    
    try {
        const tableName = TABLE_MAP[currentTab];
        const item = allItems.find(x => x.id == id);
        
        const { error } = await supabaseClient
            .from(tableName)
            .update({ payment_status: newStatus })
            .eq('id', id);
            
        if(error) throw error;

        showToast("สำเร็จ", `อัปเดตสถานะการเงินเรียบร้อยแล้ว`);
        closeItemModal();
        loadData();
    } catch(err) {
        showToast("Error", err.message, true);
    }
};

window.editItemStatus = function(id) {
    const item = allItems.find(x => x.id == id);
    if (!item) return;
    currentEditId = id;
    const isOrder = currentTab === 'orders';
    document.getElementById('modalTitleItem').innerText = "อัปเดตสถานะคำขอ";
    
    let options = '';
    if (currentTab === 'orders') {
      options = `<option value="รอดำเนินการ">รอดำเนินการ (Pending)</option>
                 <option value="กำลังดำเนินการ">กำลังดำเนินการ (Processing)</option>
                 <option value="เสร็จสิ้น">เสร็จสิ้น (Completed)</option>
                 <option value="ยกเลิก">ยกเลิก (Cancelled)</option>`;
    } else if (currentTab === 'interests') {
      options = `<option value="รอติดต่อกลับ">รอติดต่อกลับ (Pending)</option>
                 <option value="ติดต่อแล้ว">ติดต่อแล้ว (Contacted)</option>
                 <option value="ปิดการขาย">ปิดดีลเช่า/ซื้อ (Closed)</option>
                 <option value="ยกเลิก">ยกเลิก (Cancelled)</option>`;
    } else {
      options = `<option value="รอดำเนินการ">รอดำเนินการ (Pending)</option>
                 <option value="ยืนยันแล้ว">ยืนยันแล้ว (Confirmed)</option>
                 <option value="เสร็จสิ้น">เสร็จสิ้น (Completed)</option>
                 <option value="ยกเลิก">ยกเลิก (Cancelled)</option>`;
    }

    const pBadge = item.payment_status === 'paid' 
        ? `<span class="badge-status verified text-xs py-1 px-2"><i class="fa-solid fa-check-double mr-1"></i> จ่ายค่าจองแล้ว${item.payment_amount ? ' ฿' + formatNumber(item.payment_amount) : ''}</span>` 
        : '';

    document.getElementById('modalBodyItem').innerHTML = `
      <div class="form-group mb-4">
         <label>เลือกสถานะล่าสุด</label>
         <select id="updateStatusInput" class="form-control">${options}</select>
      </div>
      ${pBadge}
      <p class="text-muted text-sm"><i class="fa-solid fa-circle-info"></i> แจ้งเตือน: ระบบจะนำไอดี ${id} ไปอัปเดตค่าความคืบหน้าในตาราง ${currentTab} ทันที</p>
    `;
    
    // Quick preselect
    setTimeout(() => {
       if(item.status) {
         let sel = document.getElementById('updateStatusInput');
         for(let i=0; i<sel.options.length; i++){
            if(sel.options[i].value === item.status) sel.selectedIndex = i;
         }
       }
    }, 10);
    
    const saveBtn = document.getElementById('saveItemBtn');
    saveBtn.style.display = 'block';
    saveBtn.onclick = () => saveItemStatus();
    
    const m = document.getElementById('itemModalOverlay');
    m.style.display = 'flex';
    setTimeout(() => m.classList.add('active'), 10);
};

window.saveItemStatus = async function() {
    if(!currentEditId) return;
    const tableName = TABLE_MAP[currentTab];
    const newStatus = document.getElementById('updateStatusInput').value;
    const item = allItems.find(x => x.id == currentEditId);
    
    const saveBtn = document.getElementById('saveItemBtn');
    const oldText = saveBtn.innerText;
    saveBtn.innerText = "กำลังอัปเดต..."; saveBtn.disabled = true;

    try {
        const { error } = await supabaseClient.from(tableName).update({ status: newStatus }).eq('id', currentEditId);
        if(error) throw error;

        // Logic to RESTORE property/technician if status is 'ยกเลิก'
        if(newStatus === 'ยกเลิก') {
           if(currentTab === 'interests' && item?.property_id) {
              const originalStatus = (item.interest_type === 'เช่า' || item.type === 'เช่า') ? 'เช่า' : 'ขาย';
              await supabaseClient.from('properties').update({ status: originalStatus }).eq('id', item.property_id);
           } else if(currentTab === 'bookings' && item?.technician_id) {
              await supabaseClient.from('technicians').update({ is_online: true }).eq('id', item.technician_uuid || item.technician_id);
           }
        }

        showToast("สำเร็จ", "อัปเดตสถานะเรียบร้อยแล้ว");
        closeItemModal();
        loadData();
    } catch(err) {
        showToast("ล้มเหลว", err.message, true);
    } finally {
        saveBtn.innerText = oldText; saveBtn.disabled = false;
    }
}

window.deleteItem = async function(id) {
    const item = allItems.find(x => x.id == id);
    if(!item) return;

    if(['paid', 'verified', 'success'].includes(item.payment_status)) {
        showToast("ไม่สามารถลบได้", "รายการที่ชำระมัดจำแล้วจะไม่สามารถลบออกจากระบบได้ เพื่อความปลอดภัยของข้อมูลการเงิน", true);
        return;
    }
    
    if(!confirm('คุณแน่ใจหรือไม่ว่าต้องการลบรายการนี้?')) return;

    try {
        const tableName = TABLE_MAP[currentTab];
        if(!['เสร็จสิ้น', 'ยกเลิก', 'ปิดการขาย'].includes(item.status)) {
            if(currentTab === 'interests' && item.property_id) {
                const originalStatus = (item.interest_type === 'เช่า' || item.type === 'เช่า') ? 'เช่า' : 'ขาย';
                await supabaseClient.from('properties').update({ status: originalStatus }).eq('id', item.property_id);
            } else if(currentTab === 'bookings' && item.technician_id) {
                await supabaseClient.from('technicians').update({ is_online: true }).eq('id', item.technician_uuid || item.technician_id);
            }
        }

        const { error } = await supabaseClient.from(tableName).delete().eq('id', id);
        if(error) throw error;
        
        showToast("สำเร็จ", "ลบข้อมูลเรียบร้อยแล้ว");
        loadData();
    } catch(err) {
        showToast("ล้มเหลว", err.message, true);
    }
};

window.closeItemModal = function(e) {
    if (e && e.target !== e.currentTarget) return;
    const m = document.getElementById('itemModalOverlay');
    m.classList.remove('active');
    setTimeout(() => m.style.display = 'none', 300);
}

window.viewSlip = function(url, itemId = null, slipType = null) {
    if(!url) return;
    const img = document.getElementById('slipFullImage');
    const m = document.getElementById('slipModalOverlay');
    const resultBox = document.getElementById('slipVerifyResult');
    const footer = document.getElementById('slipModalFooter');
    
    // Set global context for approval actions
    window.currentSlipActionId = itemId;
    window.currentSlipActionType = slipType;
    
    if (footer) {
        let shouldShowButtons = false;
        if (itemId && slipType) {
            let pStatus = null;
            if (slipType === 'booking_invoice' || slipType === 'interest_invoice' || slipType === 'order_invoice') {
                const parentItem = allItems.find(x => x.invoice && x.invoice.id == itemId);
                if (parentItem) pStatus = parentItem.invoice.status;
                shouldShowButtons = pStatus !== 'รับรองยอดแล้ว';
            } else {
                const item = allItems.find(x => x.id == itemId);
                if (item) pStatus = item.payment_status;
                const isVerified = ['verified', 'paid', 'success'].includes(pStatus);
                const isRejected = ['invalid', 'rejected'].includes(pStatus);
                shouldShowButtons = !(isVerified || isRejected);
            }
        }
        footer.style.display = shouldShowButtons ? 'flex' : 'none';
    }
    
    // Reset state
    img.src = url;
    resultBox.style.display = 'block';
    resultBox.innerHTML = '<div style="color:var(--text-muted); text-align:center;"><i class="fa-solid fa-spinner fa-spin mr-2"></i>กำลังสแกน QR Code เพื่อดึงข้อมูล...</div>';
    
    m.style.display = 'flex';
    setTimeout(() => m.classList.add('active'), 10);
    
    // Trigger Scan
    setTimeout(() => scanSlipQR(url), 500); // slight delay to let modal open
};

window.approveSlip = async function() {
    if (!window.currentSlipActionId || !window.currentSlipActionType) return;
    await processSlipAction('verified');
};

window.rejectSlip = async function() {
    if (!window.currentSlipActionId || !window.currentSlipActionType) return;
    if (!confirm('ยืนยันไม่อนุมัติสลิปนี้?')) return;
    await processSlipAction('invalid');
};

async function processSlipAction(paymentStatus) {
    const id = window.currentSlipActionId;
    const type = window.currentSlipActionType;
    let table = '';
    let updates = { payment_status: paymentStatus };

    if (type === 'order' || type === 'order_deposit') {
        table = 'orders';
        if (paymentStatus === 'verified') updates.status = 'กำลังดำเนินการ';
    } else if (type === 'interest' || type === 'interest_deposit') {
        table = 'interests';
        if (paymentStatus === 'verified') updates.status = 'กำลังดำเนินการ';
    } else if (type === 'booking_deposit') {
        table = 'bookings';
    } else if (type === 'booking_invoice' || type === 'interest_invoice' || type === 'order_invoice') {
        table = 'invoices';
        delete updates.payment_status; // ลบฟิลด์นี้ออกเพราะตาราง invoices ไม่มีคอลัมน์นี้
        if (paymentStatus === 'verified') updates.status = 'รับรองยอดแล้ว';
        else updates.status = 'รอชำระ';
    }
    
    const footer = document.getElementById('slipModalFooter');
    if (footer) footer.style.opacity = '0.5';

    try {
        const { error } = await supabaseClient.from(table).update(updates).eq('id', id);
        if (error) throw error;
        showToast('สำเร็จ', 'อัปเดตสถานะสลิปเรียบร้อยแล้ว');
        closeSlipModal();
        loadData();
    } catch(err) {
        showToast('ล้มเหลว', err.message, true);
    } finally {
        if (footer) footer.style.opacity = '1';
    }
}

// --- QR VERIFICATION LOGIC ---
window.scanSlipQRRow = function(imageUrl, targetId) {
    const el = document.getElementById(targetId);
    if (!el) return;
    
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width; canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, img.width, img.height);
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        
        if (typeof jsQR !== 'undefined') {
            const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });
            if (code && code.data) {
                const info = extractPromptPayInfo(code.data);
                if (info) {
                    const amtStr = info.amount === 'ไม่ระบุ' ? '?' : Number(info.amount).toLocaleString('th-TH');
                    el.innerHTML = `<span style="color:var(--emerald); background:var(--emerald-light); padding:2px 8px; border-radius:12px; font-weight:700;"><i class="fa-solid fa-check"></i> ${amtStr} ฿</span>`;
                } else {
                    el.innerHTML = `<span style="color:var(--amber); background:#fef3c7; padding:2px 8px; border-radius:12px; font-weight:600;"><i class="fa-solid fa-triangle-exclamation"></i> ฟอร์แมตผิด</span>`;
                }
            } else {
                el.innerHTML = `<span style="color:var(--text-muted); background:#f1f5f9; padding:2px 8px; border-radius:12px; font-weight:600;"><i class="fa-solid fa-xmark"></i> ไม่พบ QR</span>`;
            }
        } else {
            el.innerHTML = '';
        }
    };
    img.onerror = () => {
        el.innerHTML = `<span style="color:var(--rose); background:#ffe4e6; padding:2px 8px; border-radius:12px; font-weight:600;"><i class="fa-solid fa-image"></i> โหลดไม่ได้</span>`;
    };
    img.src = imageUrl;
};

window.scanSlipQR = function(imageUrl, targetBoxId = 'slipVerifyResult') {
    const resultBox = document.getElementById(targetBoxId);
    if (!resultBox) return;
    
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        context.drawImage(img, 0, 0, img.width, img.height);
        const imageData = context.getImageData(0, 0, img.width, img.height);
        
        // Ensure jsQR is loaded
        if (typeof jsQR !== 'undefined') {
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: "dontInvert",
            });
            
            if (code && code.data) {
                const info = extractPromptPayInfo(code.data);
                if (info) {
                    resultBox.innerHTML = `
                        <div style="display:flex; align-items:flex-start; gap:12px;">
                            <div style="width:40px; height:40px; border-radius:50%; background:var(--emerald-light); color:var(--emerald); display:flex; align-items:center; justify-content:center; font-size:20px; flex-shrink:0;">
                                <i class="fa-solid fa-qrcode"></i>
                            </div>
                            <div>
                                <h4 style="margin:0 0 4px 0; font-size:14px; font-weight:700; color:var(--text-main);">พบข้อมูล QR Code จากสลิป</h4>
                                <div style="font-size:13px; color:var(--text-muted); margin-bottom:4px;">
                                    <span style="display:inline-block; width:80px; font-weight:600;">ยอดเงินโอน:</span> 
                                    <strong style="color:var(--primary); font-size:15px;">${info.amount === 'ไม่ระบุ' ? info.amount : Number(info.amount).toLocaleString('th-TH') + ' บาท'}</strong>
                                </div>
                                <div style="font-size:13px; color:var(--text-muted);">
                                    <span style="display:inline-block; width:80px; font-weight:600;">บัญชีปลายทาง:</span> 
                                    <span>${info.receiver}</span>
                                </div>
                                <div style="margin-top:8px; font-size:11px; color:var(--amber); font-weight:500;">
                                    <i class="fa-solid fa-circle-info mr-1"></i> แอดมินโปรดตรวจสอบยอดเงินในบัญชีจริงอีกครั้ง
                                </div>
                            </div>
                        </div>
                    `;
                } else {
                    resultBox.innerHTML = `<div style="color:var(--amber);"><i class="fa-solid fa-triangle-exclamation mr-2"></i>พบ QR Code แต่ไม่ใช่รูปแบบ PromptPay มาตรฐาน</div>`;
                }
            } else {
                resultBox.innerHTML = `<div style="color:var(--text-muted);"><i class="fa-solid fa-qrcode mr-2"></i>ไม่พบ QR Code หรือภาพไม่ชัดเจน (กรุณาตรวจสอบยอดเงินในบัญชีด้วยตนเอง)</div>`;
            }
        } else {
            resultBox.innerHTML = `<div style="color:var(--rose);"><i class="fa-solid fa-triangle-exclamation mr-2"></i>ระบบสแกนขัดข้อง (ไม่พบ jsQR script)</div>`;
        }
    };
    img.onerror = () => {
        resultBox.innerHTML = `<div style="color:var(--rose);"><i class="fa-solid fa-triangle-exclamation mr-2"></i>ไม่สามารถโหลดรูปภาพเพื่อสแกนได้ (อาจติดปัญหา CORS หรือไฟล์หมดอายุ)</div>`;
    };
    img.src = imageUrl;
};

// Simple EMVCo parser for Thai PromptPay
function parsePromptPay(payload) {
    if (!payload || payload.length < 4) return null;
    let idx = 0;
    const data = {};
    while (idx < payload.length) {
        if (idx + 4 > payload.length) break;
        const id = payload.substring(idx, idx + 2);
        const lenStr = payload.substring(idx + 2, idx + 4);
        const len = parseInt(lenStr, 10);
        if (isNaN(len) || idx + 4 + len > payload.length) {
            // invalid format, break to prevent infinite loop or out of bounds
            break; 
        }
        data[id] = payload.substring(idx + 4, idx + 4 + len);
        idx += 4 + len;
    }
    return Object.keys(data).length > 0 ? data : null;
}

function extractPromptPayInfo(payload) {
   const tags = parsePromptPay(payload);
   if (!tags) return null;
   
   let amount = tags['54'] || 'ไม่ระบุ';
   let receiver = 'ไม่ทราบข้อมูลผู้รับ';
   
   // Check tags 29, 30, 31 for Merchant Account Info
   const merchantTag = tags['29'] || tags['30'] || tags['31'];
   if (merchantTag) {
       const subTags = parsePromptPay(merchantTag);
       if (subTags) {
           if (subTags['01']) {
               receiver = subTags['01'];
               // Format phone number if it starts with 0066
               if (receiver.startsWith('0066')) {
                   receiver = '0' + receiver.substring(4);
               } else if (receiver.startsWith('66')) {
                   receiver = '0' + receiver.substring(2);
               }
           } else if (subTags['02']) {
               receiver = subTags['02'] + ' (เลขบัตร ปชช./นิติบุคคล)';
           } else if (subTags['03']) {
               receiver = subTags['03'] + ' (E-Wallet)';
           }
       }
   }
   
   // Return payload data, return null if it really doesn't look like EMVCo
   if (amount === 'ไม่ระบุ' && receiver === 'ไม่ทราบข้อมูลผู้รับ') {
       return null;
   }
   
   return { amount, receiver };
}
// ------------------------------

window.closeSlipModal = function(e) {
    if (e && e.target !== e.currentTarget) return;
    const slipOverlay = document.getElementById('slipModalOverlay');
  if(!slipOverlay) return;
  slipOverlay.classList.remove('active');
  setTimeout(() => slipOverlay.style.visibility = 'hidden', 300);
}

window.viewReceipt = async function(bookingId) {
    const overlay = document.getElementById('receiptModalOverlay');
    const modalBody = document.getElementById('modalBodyReceipt');
    
    // Show modal loading state
    overlay.style.visibility = 'visible';
    overlay.style.opacity = '1';
    overlay.classList.add('active');
    modalBody.innerHTML = '<div class="text-center text-muted py-5"><i class="fa-solid fa-spinner fa-spin fa-2x"></i><p class="mt-2">กำลังดึงข้อมูลใบเสร็จ...</p></div>';

    try {
        const { data: inv, error } = await supabaseClient.from('invoices').select('*').eq('booking_id', bookingId).single();
        if (error) throw error;
        if (!inv) throw new Error("ไม่พบข้อมูลใบเสร็จสำหรับรายการนี้ (ช่างอาจจะยังไม่ได้สร้างบิล)");

        // Fetch booking details for context
        const booking = allItems.find(x => x.id == bookingId);
        
        // Build the invoice HTML matching the technician side aesthetic
        let html = `
            <div class="receipt-box" id="printArea">
                <div class="receipt-title">
                    <h4>FixHouse</h4>
                    <p style="font-weight: 600;">เลขที่บิล: ${inv.invoice_no || `INV-${bookingId}`}</p>
                </div>
                
                <div style="margin-bottom: 20px; font-size: 13px;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                        <span style="color: #64748b;">รหัสการจอง:</span>
                        <span style="font-weight:600;">#JOB-${bookingId}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                        <span style="color: #64748b;">ช่างรับผิดชอบ:</span>
                        <span style="font-weight:600;">${inv.technician_name || booking?.technicians?.name || '-'}</span>
                    </div>
                </div>
                
                <div class="receipt-row">
                    <span style="color: #64748b;">ลูกค้า:</span>
                    <span>${inv.customer_name || booking?.customer_name || 'ไม่ระบุ'}</span>
                </div>
                <div class="receipt-row" style="margin-bottom: 20px;">
                    <span style="color: #64748b;">วันที่ออกบิล:</span>
                    <span>${new Date(inv.created_at || Date.now()).toLocaleDateString('th-TH')}</span>
                </div>
                
                <div style="font-weight:700; margin-bottom:12px; font-size:14px; color:#0f172a;">📋 รายการค่าใช้จ่าย</div>
                
                <div class="receipt-row">
                    <span style="color: #64748b;">ค่าแรง:</span>
                    <span>${Number(inv.labor_cost || 0).toLocaleString('th-TH')} บาท</span>
                </div>`;
                
        // Materials Detail
        if(inv.materials_detail && inv.materials_detail.length > 0) {
            html += `<div style="margin: 8px 0; padding: 8px 0; border-top: 1px dashed #e2e8f0; border-bottom: 1px dashed #e2e8f0;">
                       <span style="color: #64748b; font-size:13px; font-weight:600; display:block; margin-bottom:6px;">ค่าวัสดุ อุปกรณ์:</span>`;
            inv.materials_detail.forEach(mat => {
                html += `<div class="receipt-row" style="padding-left: 10px; font-size: 13px;">
                           <span style="color: #64748b;">- ${mat.name}</span>
                           <span>${Number(mat.price).toLocaleString('th-TH')} บาท</span>
                         </div>`;
            });
            html += `<div style="text-align:right; font-size:13px; margin-top:6px;">
                        <span style="color:var(--primary); font-weight:600;">รวมวัสดุ: ${Number(inv.material_cost || 0).toLocaleString('th-TH')} บาท</span>
                     </div></div>`;
        }

        html += `
                <div class="receipt-row">
                    <span style="color: #64748b;">ค่าเดินทาง:</span>
                    <span>${Number(inv.travel_cost || 0).toLocaleString('th-TH')} บาท</span>
                </div>
                <div class="receipt-row">
                    <span style="color: #64748b;">ค่าบริการ (Service):</span>
                    <span>${Number(inv.service_fee || 0).toLocaleString('th-TH')} บาท</span>
                </div>
                
                <div class="receipt-total">
                    <span>💰 ยอดรวมทั้งสิ้น:</span>
                    <span style="color:var(--primary); font-size:20px;">${Number(inv.total_amount || 0).toLocaleString('th-TH')} <span style="font-size:14px; font-weight:normal;">บาท</span></span>
                </div>
                
                <div class="receipt-row" style="margin-top:20px;">
                    <span style="color: #64748b; font-weight:600;">สถานะการชำระ:</span>
                    <span style="color:${inv.status === 'ชำระเงินแล้ว' ? 'var(--emerald)' : 'var(--warning)'}; font-weight:700;">${inv.status || 'รอชำระ'}</span>
                </div>
                ${inv.note ? `<div style="margin-top:12px; font-size:13px; padding:10px; background:#f8fafc; border-radius:6px; color:#475569;"><strong>หมายเหตุ:</strong> ${inv.note}</div>` : ''}
            </div>
            ${inv.slip_url ? `
                <div class="text-center mt-4">
                    <p style="font-size:13px; font-weight:600; color:var(--text-muted); margin-bottom:8px;">สลิปโอนเงินแนบ</p>
                    <div id="invoiceSlipVerifyResult" style="margin-bottom:12px; text-align:left; background:#f8fafc; border-radius:8px; padding:12px; border:1px solid #e2e8f0;">
                       <div style="color:var(--text-muted); text-align:center;"><i class="fa-solid fa-spinner fa-spin mr-2"></i>กำลังสแกน QR Code เพื่อดึงข้อมูล...</div>
                    </div>
                    <img src="${inv.slip_url}" style="max-width:100%; max-height:200px; border-radius:8px; box-shadow:0 2px 8px rgba(0,0,0,0.1); border:1px solid #e2e8f0; cursor:zoom-in;" onclick="window.open('${inv.slip_url}', '_blank')">
                </div>
            ` : ''}
        `;
        
        modalBody.innerHTML = html;
        
        // Trigger QR scan if slip exists
        if (inv.slip_url) {
            setTimeout(() => scanSlipQR(inv.slip_url, 'invoiceSlipVerifyResult'), 500);
        }

    } catch (err) {
        modalBody.innerHTML = `
            <div class="text-center py-5">
                <i class="fa-solid fa-file-excel fa-3x" style="color: var(--rose); margin-bottom: 16px;"></i>
                <h4 style="font-weight:600; color:var(--text-main);">ไม่พบใบเสร็จ</h4>
                <p style="color:var(--text-muted); font-size:14px;">${err.message}</p>
                <button class="btn btn-outline mt-3" onclick="closeReceiptModal()">ปิดหน้าต่าง</button>
            </div>
        `;
    }
}

window.closeReceiptModal = function() {
    const overlay = document.getElementById('receiptModalOverlay');
    if(!overlay) return;
    overlay.classList.remove('active');
    setTimeout(() => {
        overlay.style.visibility = 'hidden';
        overlay.style.opacity = '0';
    }, 300);
};

window.exportToCSV = function() {
    let filename = document.title.split('|')[0].trim().replace(/\s+/g, '_') + '.csv';
    let activeTable = document.querySelector('.tab-content.active table') || document.querySelector('table');
    if(!activeTable) return;
    
    let csv = [];
    let rows = activeTable.querySelectorAll('tr');
    for (let i = 0; i < rows.length; i++) {
        let row = [], cols = rows[i].querySelectorAll('td, th');
        if(cols.length === 1 && cols[0].colSpan > 1) continue;
        let colCount = (cols[cols.length-1].innerText.trim() === '' || cols[cols.length-1].querySelector('.action-buttons')) ? cols.length - 1 : cols.length;
        for (let j = 0; j < colCount; j++) {
            let data = cols[j].innerText.trim().replace(/\r?\n|\r/g, ' ').replace(/"/g, '""');
            row.push('"' + data + '"');
        }
        csv.push(row.join(','));
    }
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF" + csv.join('\n');
    let encodedUri = encodeURI(csvContent);
    let link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

function formatNumber(num) {
  if(!num) return '0';
  return Number(num).toLocaleString();
}
