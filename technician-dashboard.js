// ===== CONFIGURATION =====
const SUPABASE_URL = "https://uqcjajmqtlchftpqwsrp.supabase.co";
const SUPABASE_KEY = "sb_publishable_yWZiH8l1idY0QWGuj6p9sg_GqXPONGX";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ===== STATE =====
let currentUser = null;

// ===== CHAT LOGIC =====
let currentChatConversationId = null;
let chatSubscription = null;
let globalChatSubscription = null;
let currentChatCustomerId = null;
let unreadCount = 0;

window.updateUnreadBadge = async function() {
    if (!currentUser) return;
    try {
        const {count} = await supabaseClient
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('receiver_id', currentUser.id)
            .eq('is_read', false);
            
        unreadCount = count || 0;
        const badge = document.getElementById('chatBadge');
        if (badge) {
            if (unreadCount > 0) {
                badge.innerText = unreadCount > 99 ? '99+' : unreadCount;
                badge.style.display = 'flex';
                badge.style.animation = 'pulse 2s infinite';
            } else {
                badge.style.display = 'none';
            }
        }
    } catch(err) {
        console.warn("Could not fetch unread count:", err);
    }
};

window.listenForGlobalMessages = function() {
    if (!currentUser || globalChatSubscription) return;
    
    globalChatSubscription = supabaseClient.channel('global-chat-notifications')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${currentUser.id}` }, async payload => {
            const newMsg = payload.new;
            
            // If the chat modal is currently open AND looking at THIS conversation, mark as read immediately
            if (currentChatConversationId === newMsg.conversation_id && document.getElementById('chatModalOverlay').style.display === 'flex') {
                await supabaseClient.from('messages').update({ is_read: true }).eq('id', newMsg.id);
            } else {
                // Otherwise it's unread, increment badge and show toast
                updateUnreadBadge();
                
                // Show Toast Notification
                Swal.fire({
                    toast: true,
                    position: 'top-end',
                    icon: 'info',
                    title: 'ข้อความใหม่จากลูกค้า',
                    text: newMsg.message_text.length > 30 ? newMsg.message_text.substring(0, 30) + '...' : newMsg.message_text,
                    showConfirmButton: false,
                    timer: 4000,
                    timerProgressBar: true,
                    didOpen: (toast) => {
                        toast.addEventListener('mouseenter', Swal.stopTimer)
                        toast.addEventListener('mouseleave', Swal.resumeTimer)
                    }
                });
                
                // Play notification sound
                try {
                   const audio = new Audio('https://cdn.pixabay.com/download/audio/2021/08/04/audio_0625c1539c.mp3?filename=success-1-6297.mp3');
                   audio.play().catch(e => {}); // Ignore autoplay errors
                } catch(e) {}
            }
        }).subscribe();
};

window.openChat = async function (customerId, customerName) {
  if (!customerId || customerId === 'null') {
    Swal.fire({
      icon: 'warning',
      title: 'ไม่สามารถแชทได้',
      text: 'ลูกค้ารายนี้ไม่ได้เข้าสู่ระบบตอนจองงาน ทำให้ไม่มีบัญชีสำหรับแชทครับ',
      confirmButtonColor: 'var(--primary)'
    });
    return;
  }

  currentChatCustomerId = customerId;
  document.getElementById('chatModalTitle').innerHTML = `
      <div style="display:flex; align-items:center;">
         <div style="width:36px; height:36px; border-radius:50%; background:#e4e6eb; margin-right:10px; display:flex; justify-content:center; align-items:center; color:#65676b; font-size:16px;">
            <i class="fa-solid fa-user"></i>
         </div>
         <div>
             <div style="font-size:15px; font-weight:700; color:#050505; line-height:1.2;">${customerName}</div>
             <div style="font-size:12px; font-weight:normal; color:#65676b;">กำลังใช้งาน</div>
         </div>
      </div>
    `;
  document.getElementById('chatMessages').innerHTML = '<div style="text-align:center; color:#65676b; margin-top:40px;"><i class="fa-solid fa-spinner fa-spin" style="margin-right:6px;"></i> กำลังโหลดข้อความ...</div>';

  // Auto close Job Modal/Chat List Modal (optional) but we can just overlay chat.
  if(typeof closeChatList === 'function') closeChatList();
  
  const overlay = document.getElementById('chatModalOverlay');
  overlay.style.display = 'flex';
  setTimeout(() => overlay.classList.add('active'), 10);

  try {
    // Find conversation
    const { data: convs, error: fetchErr } = await supabaseClient.from('conversations')
      .select('*')
      .eq('technician_id', currentUser.id)
      .eq('customer_id', customerId);

    if (fetchErr) throw fetchErr;

    if (convs && convs.length > 0) {
      currentChatConversationId = convs[0].id;
    } else {
      // Create new conversation
      const { data: newConv, error: insertErr } = await supabaseClient.from('conversations')
        .insert([{ technician_id: currentUser.id, customer_id: customerId }])
        .select();
      if (insertErr) throw insertErr;
      currentChatConversationId = newConv[0].id;
    }

    await loadChatMessages();
    
    // Mark messages as read since we just opened the chat
    await supabaseClient.from('messages')
         .update({ is_read: true })
         .eq('conversation_id', currentChatConversationId)
         .eq('receiver_id', currentUser.id)
         .eq('is_read', false);
         
    updateUnreadBadge();

    // Subscription
    if (chatSubscription) chatSubscription.unsubscribe();
    chatSubscription = supabaseClient.channel(`chat_${currentChatConversationId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${currentChatConversationId}` }, payload => {
        appendMessageToUI(payload.new);
      }).subscribe();

  } catch (err) {
    document.getElementById('chatMessages').innerHTML = `<div style="color:red; text-align:center;">เกิดข้อผิดพลาด: ${err.message}</div>`;
  }
};

window.loadChatMessages = async function () {
  const { data: msgs, error } = await supabaseClient.from('messages')
    .select('*')
    .eq('conversation_id', currentChatConversationId)
    .order('created_at', { ascending: true });

  const container = document.getElementById('chatMessages');
  container.innerHTML = '';

  if (msgs && msgs.length > 0) {
    let lastDate = null;
    msgs.forEach(msg => {
      const msgDate = new Date(msg.created_at).toLocaleDateString('th-TH', { month: 'short', day: 'numeric', year: 'numeric' });
      if (msgDate !== lastDate) {
        const dateDivider = document.createElement('div');
        dateDivider.style.textAlign = 'center';
        dateDivider.style.margin = '16px 0 8px 0';
        dateDivider.style.fontSize = '12px';
        dateDivider.style.color = '#8A8D91';
        dateDivider.style.fontWeight = '500';
        dateDivider.innerText = msgDate;
        container.appendChild(dateDivider);
        lastDate = msgDate;
      }
      appendMessageToUI(msg);
    });
  } else {
    container.innerHTML = `
           <div style="text-align:center; margin-top:60px;">
              <div style="width:60px; height:60px; border-radius:50%; background:#e4e6eb; margin:0 auto 12px auto; display:flex; justify-content:center; align-items:center; color:#65676b; font-size:24px;">
                 <i class="fa-solid fa-user"></i>
              </div>
              <div style="color:#050505; font-size:16px; font-weight:600;">เริ่มต้นสนทนา</div>
              <div style="color:#65676b; font-size:13px; margin-top:4px;">คุณเชื่อมต่อกับลูกค้าบน FixHouse แล้ว</div>
           </div>
        `;
  }
  scrollToBottom();
};

window.appendMessageToUI = function (msg) {
  const container = document.getElementById('chatMessages');
  const isMe = msg.sender_id === currentUser.id;

  // Facebook Messenger Colors
  const FB_BLUE = '#0084ff';
  const FB_GRAY = '#e4e6eb';
  const FB_TEXT_DARK = '#050505';

  if (container.innerHTML.includes('เริ่มต้นสนทนา')) container.innerHTML = '';

  const div = document.createElement('div');
  div.style.display = 'flex';
  div.style.flexDirection = isMe ? 'row-reverse' : 'row';
  div.style.alignItems = 'flex-end';
  div.style.marginBottom = '2px';
  div.style.marginTop = '6px';
  div.style.animation = 'fadeIn 0.2s ease';

  // Avatar for customer
  let avatarHTML = '';
  if (!isMe) {
    avatarHTML = `
           <div style="width:28px; height:28px; border-radius:50%; background:#e4e6eb; margin-right:8px; display:flex; justify-content:center; align-items:center; color:#65676b; font-size:12px; flex-shrink:0;">
              <i class="fa-solid fa-user"></i>
           </div>
        `;
  }

  const bubbleWrapper = document.createElement('div');
  bubbleWrapper.style.maxWidth = '70%';
  bubbleWrapper.style.display = 'flex';
  bubbleWrapper.style.flexDirection = 'column';
  bubbleWrapper.style.alignItems = isMe ? 'flex-end' : 'flex-start';

  const bubble = document.createElement('div');
  bubble.style.padding = '8px 12px';
  bubble.style.borderRadius = isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px';
  bubble.style.wordBreak = 'break-word';
  bubble.style.backgroundColor = isMe ? FB_BLUE : FB_GRAY;
  bubble.style.color = isMe ? '#fff' : FB_TEXT_DARK;
  bubble.style.fontSize = '15px';
  bubble.style.lineHeight = '1.3';
  bubble.innerText = msg.message_text;

  const time = document.createElement('div');
  time.style.fontSize = '11px';
  time.style.color = '#bcc0c4';
  time.style.marginTop = '2px';
  time.style.padding = isMe ? '0 4px 0 0' : '0 0 0 4px';
  time.innerText = new Date(msg.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

  bubbleWrapper.appendChild(bubble);
  bubbleWrapper.appendChild(time);

  if (!isMe) {
    div.innerHTML = avatarHTML;
    div.appendChild(bubbleWrapper);
  } else {
    div.appendChild(bubbleWrapper);
  }

  container.appendChild(div);
  scrollToBottom();
};

window.scrollToBottom = function () {
  const container = document.getElementById('chatMessages');
  container.scrollTop = container.scrollHeight;
};

window.sendChatMessage = async function () {
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text || !currentChatConversationId) return;

  input.value = '';

  const { error } = await supabaseClient.from('messages').insert([{
    conversation_id: currentChatConversationId,
    sender_id: currentUser.id,
    receiver_id: currentChatCustomerId,
    message_text: text
  }]);

  if (error) {
    Swal.fire({ icon: 'error', title: 'ส่งข้อความไม่สำเร็จ', text: error.message });
  }
};

window.closeChatModal = function () {
  const overlay = document.getElementById('chatModalOverlay');
  overlay.classList.remove('active');
  setTimeout(() => overlay.style.display = 'none', 300);
  if (chatSubscription) {
    chatSubscription.unsubscribe();
    chatSubscription = null;
  }
};

window.toggleChatList = async function() {
    const listOverlay = document.getElementById('chatListModalOverlay');
    listOverlay.style.display = 'flex';
    setTimeout(() => listOverlay.classList.add('active'), 10);

    document.getElementById('chatListContainer').innerHTML = '<div style="text-align:center; padding:30px; color:#65676b;"><i class="fa-solid fa-spinner fa-spin" style="font-size:24px;"></i><div style="margin-top:12px;">กำลังโหลดห้องแชท...</div></div>';

    try {
        const { data: convs, error } = await supabaseClient
             .from('conversations')
             .select('*')
             .eq('technician_id', currentUser.id)
             .order('updated_at', { ascending: false });
             
        if (error) throw error;
             
        if (convs && convs.length > 0) {
            let html = '';
            for (let c of convs) {
               let cName = "ลูกค้า (ไม่ระบุชื่อ)";
               
               // Try to fetch customer name from customers table
               const {data: cProfile} = await supabaseClient.from('customers').select('name').eq('id', c.customer_id).maybeSingle();
               if(cProfile && cProfile.name) cName = cProfile.name;
               
               // Fetch unread count
               const {count} = await supabaseClient.from('messages').select('*', {count:'exact', head:true}).eq('conversation_id', c.id).eq('receiver_id', currentUser.id).eq('is_read', false);
               
               let unreadBadge = count > 0 ? `<div style="background:#0084ff; color:#fff; border-radius:50%; min-width:20px; height:20px; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:bold; padding:0 6px;">${count}</div>` : '';
               let titleWeight = count > 0 ? '700' : '500';
               let titleColor = count > 0 ? '#050505' : '#1c1e21';
               
               html += `
                 <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 16px; border-bottom:1px solid #f0f2f5; cursor:pointer; transition:background 0.2s;" onmouseover="this.style.background='#f0f2f5'" onmouseout="this.style.background='#fff'" onclick="openChat('${c.customer_id}', '${cName}')">
                    <div style="display:flex; align-items:center; gap:12px;">
                       <div style="width:50px; height:50px; border-radius:50%; background:#e4e6eb; display:flex; justify-content:center; align-items:center; color:#65676b; font-size:20px; flex-shrink:0;">
                          <i class="fa-solid fa-user"></i>
                       </div>
                       <div>
                          <div style="font-weight:${titleWeight}; color:${titleColor}; font-size:15px; margin-bottom:2px;">${cName}</div>
                          <div style="font-size:13px; color:${count > 0 ? '#0084ff' : '#65676b'}; font-weight:${count > 0 ? '600' : 'normal'};">แตะเพื่อเปิดแชท</div>
                       </div>
                    </div>
                    ${unreadBadge}
                 </div>
               `;
            }
            document.getElementById('chatListContainer').innerHTML = html;
        } else {
            document.getElementById('chatListContainer').innerHTML = `
              <div style="text-align:center; padding:40px 20px; color:#65676b;">
                 <i class="fa-solid fa-box-open" style="font-size:36px; margin-bottom:12px; color:#bcc0c4;"></i>
                 <div style="font-size:15px; font-weight:600; color:#050505;">ยังไม่มีรายการแชท</div>
                 <div style="font-size:13px; margin-top:4px;">คุณจะเห็นการสนทนากับลูกค้าที่นี่</div>
              </div>
            `;
        }
    } catch(err) {
        document.getElementById('chatListContainer').innerHTML = `<div style="padding:20px; text-align:center; color:red;">เกิดข้อผิดพลาด: ${err.message}</div>`;
    }
};

window.closeChatList = function() {
    const listOverlay = document.getElementById('chatListModalOverlay');
    listOverlay.classList.remove('active');
    setTimeout(() => listOverlay.style.display = 'none', 300);
};

// ===== INITIALIZE =====
document.addEventListener('DOMContentLoaded', () => {
  setupSidebar();
  checkAuth();
});

// ===== UI SETUP =====
function setupSidebar() {
  const sidebar = document.getElementById('sidebar');
  const menuToggleBtn = document.getElementById('menuToggleBtn');
  const closeSidebarBtn = document.getElementById('closeSidebarBtn');

  const overlay = document.createElement('div');
  overlay.className = 'sidebar-overlay';
  document.body.appendChild(overlay);

  function toggleSidebar() {
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
    document.body.style.overflow = sidebar.classList.contains('active') ? 'hidden' : '';
  }

  if (menuToggleBtn) menuToggleBtn.addEventListener('click', toggleSidebar);
  if (closeSidebarBtn) closeSidebarBtn.addEventListener('click', toggleSidebar);
  overlay.addEventListener('click', toggleSidebar);
}

// ===== AUTHENTICATION =====
async function checkAuth() {
  const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();

  if (sessionError || !session) {
    Swal.fire({
      icon: 'error',
      title: 'ยังไม่ได้เข้าสู่ระบบ',
      text: 'กรุณาเข้าสู่ระบบก่อนเข้าใช้งาน',
      confirmButtonColor: 'var(--primary)'
    }).then(() => {
      window.location.href = "login.html";
    });
    return;
  }

  currentUser = session.user;

  // Try profiles first, then fallback to customers
  let displayName = currentUser.email || "ช่างเทคนิค";
  const { data: profile } = await supabaseClient.from("profiles").select("full_name").eq("id", currentUser.id).maybeSingle();
  if (profile && profile.full_name) {
    displayName = profile.full_name;
  } else {
    const { data: customer } = await supabaseClient.from("customers").select("name").eq("id", currentUser.id).maybeSingle();
    if (customer && customer.name) displayName = customer.name;
  }

  document.getElementById("navUserName").innerText = displayName;

  // Real-time listener for bookings
  supabaseClient.channel('tech-jobs-live').on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, payload => {
    console.log("Job Update:", payload);
    loadDashboardData();
  }).subscribe();

  // Initialize Chat Notifications
  updateUnreadBadge();
  listenForGlobalMessages();

  loadDashboardData();
}

window.logout = async function () {
  const result = await Swal.fire({
    title: 'ออกจากระบบ?',
    text: "คุณต้องการออกจากระบบใช่หรือไม่",
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: 'var(--danger)',
    cancelButtonColor: '#cbd5e1',
    confirmButtonText: 'ออกจากระบบ',
    cancelButtonText: 'ยกเลิก'
  });

  if (result.isConfirmed) {
    await supabaseClient.auth.signOut();
    window.location.href = "login.html";
  }
};

// ===== DATA LOADING =====
let currentJobs = [];

async function loadDashboardData() {
  try {
    let techName = document.getElementById("navUserName").innerText;

    // Mapping technician ID from technicians table using name
    let techId = null;
    if (techName && techName !== "ช่างเทคนิค") {
      const { data: techRows } = await supabaseClient.from("technicians").select("id").eq("name", techName);
      if (techRows && techRows.length > 0) {
        techId = techRows[0].id;
      }
    }

    let query = supabaseClient.from("bookings").select("*").order("created_at", { ascending: false });

    // Filter by techId if found. If not found, show all so they don't see an empty screen while testing
    if (techId) {
      query = query.eq("technician_id", techId);
    }

    const { data: jobs, error } = await query;

    if (error) throw error;

    currentJobs = jobs || [];
    const pendingJobs = currentJobs.filter(j => j.status === "รอดำเนินการ" || j.status === "รอรับงาน" || !j.status);
    const inProgressJobs = currentJobs.filter(j => j.status === "กำลังดำเนินการ");
    const completedJobs = currentJobs.filter(j => j.status === "เสร็จสิ้น");

    document.getElementById("statTotalJobs").innerText = currentJobs.length;
    document.getElementById("statActiveJobs").innerText = inProgressJobs.length + pendingJobs.length;
    document.getElementById("statCompleted").innerText = completedJobs.length;

    const estimatedIncome = completedJobs.reduce((sum, j) => sum + (Number(j.price) || 0), 0);
    const incomeEl = document.getElementById("statIncome");
    if (incomeEl) incomeEl.innerText = "฿" + estimatedIncome.toLocaleString();

    // Render table
    const tbody = document.getElementById("jobsTableBody");
    tbody.innerHTML = "";

    // Sync calendar events if calendar is active
    if (typeof calendar !== 'undefined' && calendar) {
      calendar.removeAllEvents();
      calendar.addEventSource(getCalendarEvents());
    }

    if (currentJobs.length === 0) {
      tbody.innerHTML = "<tr><td colspan='6' class='text-center text-muted'>ยังไม่มีงานในขณะนี้</td></tr>";
      return;
    }

    currentJobs.slice(0, 10).forEach(job => {
      let statusClass = "pending";
      if (job.status === "กำลังดำเนินการ") statusClass = "in-progress";
      if (job.status === "เสร็จสิ้น") statusClass = "completed";
      if (job.status === "ยกเลิกแล้ว") statusClass = "rejected";

      const row = document.createElement("tr");
      row.innerHTML = `
        <td class="fw-bold">#JOB-${job.id}</td>
        <td>
            <div class="fw-bold">${job.customer_name || 'ไม่ระบุ'}</div>
            <div class="text-sm text-muted" style="font-size: 13px;"><i class="fa-solid fa-phone"></i> ${job.customer_phone || '-'}</div>
        </td>
        <td style="max-width:200px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
            <div class="text-xs text-primary bg-primary-light px-2 py-1 rounded d-inline-block mb-1" style="font-size: 12px; border-radius: 4px; background: #e0e7ff; color: #4f46e5;">${job.category || 'ทั่วไป'}</div><br>
            <span style="font-size: 13px;">${job.problem_detail || '-'}</span>
        </td>
        <td style="font-size: 13px;">
           <div><i class="fa-regular fa-calendar text-muted"></i> ${job.service_date ? new Date(job.service_date).toLocaleDateString('th-TH') : '-'}</div>
           <div class="text-muted"><i class="fa-regular fa-clock"></i> ${job.service_time || '-'}</div>
        </td>
        <td><span class="badge-status ${statusClass}">${job.status || 'รอดำเนินการ'}</span></td>
        <td>
          <button class="action-btn" title="ดูรายละเอียด/อัปเดต" onclick="viewJob('${job.id}')"><i class="fa-solid fa-eye"></i></button>
        </td>
      `;
      tbody.appendChild(row);
    });
  } catch (err) {
    console.error("Error loading dashboard:", err);
    document.getElementById("jobsTableBody").innerHTML = "<tr><td colspan='6' class='text-center text-danger'>เกิดข้อผิดพลาดในการโหลดข้อมูล</td></tr>";
  }
}

// ===== CALENDAR LOGIC =====
let calendar = null;

window.switchView = function (viewId) {
  const dashboardView = document.getElementById('dashboardView');
  const calendarView = document.getElementById('calendarView');
  const btnDash = document.getElementById('btnViewDashboard');
  const btnCal = document.getElementById('btnViewCalendar');

  // Update sidebar navigation active state
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

  if (viewId === 'calendar') {
    dashboardView.style.display = 'none';
    calendarView.style.display = 'block';

    btnDash.className = 'btn-outline';
    btnDash.style.background = '#fff';
    btnCal.className = 'btn-primary';
    btnCal.style.background = ''; // reset inline

    // Highlight sidebar nav
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
      if (link.innerText.includes('ตารางงาน')) link.parentElement.classList.add('active');
    });

    // Initialize or re-render calendar
    if (!calendar) {
      initCalendar();
    } else {
      calendar.render();
    }
  } else {
    dashboardView.style.display = 'block';
    calendarView.style.display = 'none';

    btnDash.className = 'btn-primary';
    btnDash.style.background = '';
    btnCal.className = 'btn-outline';
    btnCal.style.background = '#fff';

    // Highlight sidebar nav
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
      if (link.innerText.includes('ภาพรวมแผงควบคุม')) link.parentElement.classList.add('active');
    });
  }
};

window.initCalendar = function () {
  const calendarEl = document.getElementById('calendar');
  calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    locale: 'th',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,timeGridDay'
    },
    height: 'auto',
    events: getCalendarEvents(),
    eventClick: function (info) {
      viewJob(info.event.id);
    }
  });
  calendar.render();
};

window.getCalendarEvents = function () {
  return currentJobs.map(job => {
    let color = '#3b82f6'; // default blue
    if (job.status === 'เสร็จสิ้น') color = '#10b981'; // green
    if (job.status === 'รอชำระ') color = '#f59e0b'; // warning
    if (job.status === 'ยกเลิกแล้ว') color = '#ef4444'; // danger
    if (job.status === 'รอดำเนินการ' || job.status === 'รอรับงาน') color = '#64748b'; // gray

    return {
      id: job.id,
      title: `[#JOB-${job.id}] ${job.customer_name || 'ไม่ระบุชื่อ'}`,
      start: job.service_date || new Date().toISOString(),
      backgroundColor: color,
      borderColor: color
    };
  }).filter(event => event.start);
};

// ===== JOB MODAL LOGIC =====
let currentEditingJobId = null;

window.viewJob = async function (jobId) {
  const job = currentJobs.find(j => j.id == jobId);
  if (!job) return;

  currentEditingJobId = jobId;
  const techName = document.getElementById("navUserName").innerText;

  let inv = null;
  if (job.status === 'เสร็จสิ้น') {
    try {
      const { data } = await supabaseClient.from('invoices').select('*').eq('booking_id', jobId).single();
      inv = data;
    } catch (e) { console.warn("No invoice found yet for this complete job"); }
  }

  let dateStr = job.service_date ? new Date(job.service_date).toLocaleDateString('th-TH') : "-";

  const modalBody = document.getElementById('jobModalBody');
  modalBody.innerHTML = `
    <div style="background:#f8fafc; padding:16px; border-radius:8px; margin-bottom:16px; border:1px solid #e2e8f0;">
      <h4 style="margin:0 0 12px 0; color:#0f172a; display:flex; justify-content:space-between;">
        <span>#JOB-${job.id}</span>
        <span style="font-size:13px; font-weight:normal; color:#64748b; background: #e0e7ff; padding: 2px 8px; border-radius: 4px;">${job.category || 'ทั่วไป'}</span>
      </h4>
      <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
        <span style="color:#64748b;">ชื่อลูกค้า:</span>
        <span style="font-weight:600;">${job.customer_name || '-'}</span>
      </div>
      <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
        <span style="color:#64748b;">เบอร์โทร:</span>
        <span style="font-weight:600;">${job.customer_phone || '-'}</span>
      </div>
      <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
        <span style="color:#64748b;">เวลานัดหมาย:</span>
        <span style="font-weight:600;">${dateStr} | ${job.service_time || '-'}</span>
      </div>
      <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
        <span style="color:#64748b;">พื้นที่เขต:</span>
        <span style="font-weight:600;">${job.province || '-'}</span>
      </div>
      <div style="border-top:1px dashed #cbd5e1; margin-top:12px; padding-top:12px;">
        <p style="color:#64748b; margin-bottom:4px; font-size:13px;">รายละเอียดอาการ:</p>
        <p style="margin:0; line-height:1.5;">${job.problem_detail || '-'}</p>
      </div>
    </div>
    
    <div class="form-group">
      <label class="form-label">อัปเดตสถานะงาน (Status)</label>
      <select id="editJobStatus" class="form-select" onchange="togglePriceInput(this.value)">
         <option value="รอรับงาน" ${(!job.status || job.status === 'รอรับงาน' || job.status === 'รอดำเนินการ') ? 'selected' : ''}>รอดำเนินการ (Pending)</option>
         <option value="กำลังดำเนินการ" ${job.status === 'กำลังดำเนินการ' ? 'selected' : ''}>กำลังซ่อมแซม (In Progress)</option>
         <option value="เสร็จสิ้น" ${job.status === 'เสร็จสิ้น' ? 'selected' : ''}>งานเสร็จสมบูรณ์ (Completed)</option>
         <option value="ยกเลิกแล้ว" ${job.status === 'ยกเลิกแล้ว' ? 'selected' : ''}>ยกเลิกงาน (Cancelled)</option>
      </select>
    </div>
    
    <div id="priceInputGroup" style="display: ${job.status === 'เสร็จสิ้น' ? 'block' : 'none'}; margin-top: 24px;">
      <div class="receipt-box">
        <div class="receipt-title">
          <h4>FixHouse</h4>
          <p style="font-weight: 600;">เลขที่บิล: INV-${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, '0')}${new Date().getDate().toString().padStart(2, '0')}-${String(job.id).padStart(4, '0')}</p>
        </div>
        
        <!-- Technician Info -->
        <div style="margin-bottom: 20px; font-size: 13px;">
          <strong style="display:block; margin-bottom:6px;">ข้อมูลติดต่อช่าง :</strong>
          <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
            <span style="color: #64748b;">ช่าง :</span>
            <span style="font-weight:600;">${techName}</span>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="color: #64748b;">โทร :</span>
            <input type="text" id="techPhoneInput" class="receipt-input-small" style="width:140px; text-align:left;" placeholder="เบอร์โทรช่าง">
          </div>
        </div>
        
        <!-- Invoice Header -->
        <div style="text-align:center; font-weight:700; font-size:15px; margin-bottom:16px; border-top:2px dashed #cbd5e1; padding-top:16px;">
          🧾 ใบแจ้งชำระเงิน
        </div>
        
        <div class="receipt-row">
          <span style="color: #64748b;">งาน:</span>
          <span>${job.category || 'ทั่วไป'}</span>
        </div>
        <div class="receipt-row">
          <span style="color: #64748b;">ลูกค้า:</span>
          <span>${job.customer_name || 'ไม่ระบุ'}</span>
        </div>
        <div class="receipt-row" style="margin-bottom: 20px;">
          <span style="color: #64748b;">วันที่:</span>
          <span>${new Date().toLocaleDateString('th-TH')}</span>
        </div>
        
        <!-- Cost Breakdown -->
        <div style="font-weight:700; margin-bottom:12px; font-size:14px; color:#0f172a;">📋 รายการค่าใช้จ่าย</div>
        
        <div class="receipt-row" style="align-items:center;">
          <span style="color: #64748b;">ค่าแรง:</span>
          <div><input type="number" id="costLabor" class="receipt-input-small" placeholder="0" oninput="calculateTotal()" value="${inv ? inv.labor_cost : ''}"> <span style="margin-left:4px;">บาท</span></div>
        </div>
        
        <div style="margin-bottom:12px; padding-bottom:12px; border-bottom:1px dashed #e2e8f0;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <span style="color: #64748b;">ค่าวัสดุ อุปกรณ์:</span>
            <span style="font-size:12px; color:var(--primary); cursor:pointer; font-weight:600;" onclick="addMaterialField()">+ เพิ่มรายการ</span>
          </div>
          <div id="materialListContainer" style="background:#f8fafc; padding:8px; border-radius:6px; margin-bottom:8px;">
             ${inv && inv.materials_detail && inv.materials_detail.length > 0 ?
      inv.materials_detail.map(m => `
                 <div class="material-item" style="display:flex; gap:8px; margin-bottom:8px;">
                    <input type="text" class="receipt-input-small mat-name" style="flex:1; text-align:left;" placeholder="ชื่อวัสดุ" value="${m.name}">
                    <input type="number" class="receipt-input-small mat-price" style="width:70px;" placeholder="ราคา" oninput="calculateTotal()" value="${m.price}">
                    <button class="action-btn" style="width:28px; height:28px; padding:0; color:white; background:var(--danger); border:none;" onclick="this.parentElement.remove(); calculateTotal();"><i class="fa-solid fa-trash" style="font-size:12px;"></i></button>
                 </div>
                `).join('')
      :
      `<div class="material-item" style="display:flex; gap:8px; margin-bottom:8px;">
                    <input type="text" class="receipt-input-small mat-name" style="flex:1; text-align:left;" placeholder="ชื่อวัสดุ">
                    <input type="number" class="receipt-input-small mat-price" style="width:70px;" placeholder="ราคา" oninput="calculateTotal()">
                 </div>`
    }
          </div>
          <div style="text-align:right; font-size:13px;">
             <span style="color:#64748b;">รวมค่าวัสดุ: </span>
             <span id="costMaterialTotal" style="font-weight:700; color:#0f172a;">${inv ? Number(inv.material_cost).toLocaleString('th-TH') : '0'}</span> <span>บาท</span>
          </div>
        </div>

        <div class="receipt-row" style="align-items:center;">
          <span style="color: #64748b;">ค่าเดินทาง:</span>
          <div><input type="number" id="costTravel" class="receipt-input-small" placeholder="0" oninput="calculateTotal()" value="${inv ? inv.travel_cost : ''}"> <span style="margin-left:4px;">บาท</span></div>
        </div>
        <div class="receipt-row" style="align-items:center;">
          <span style="color: #64748b;">ค่าบริการ (Service):</span>
          <div><input type="number" id="costService" class="receipt-input-small" placeholder="0" oninput="calculateTotal()" value="${inv ? inv.service_fee : ''}"> <span style="margin-left:4px;">บาท</span></div>
        </div>
        
        <!-- Total -->
        <div class="receipt-total" style="align-items:center;">
          <span>💰 รวมทั้งหมด:</span>
          <div>
             <span id="labelTotalCost" style="color:var(--primary); font-size:22px;">${inv ? Number(inv.total_amount).toLocaleString('th-TH') : '0'}</span> 
             <span style="font-size:14px; font-weight:normal; margin-left:4px;">บาท</span>
          </div>
          <input type="hidden" id="editJobPrice" value="${inv ? inv.total_amount : '0'}">
        </div>
        
        <!-- Status & Note -->
        <div class="receipt-row" style="margin-top:20px;">
          <span style="color: #64748b; font-weight:600;">สถานะ:</span>
          <span id="receiptStatusLabel" style="color:var(--warning); font-weight:700;">${inv ? inv.status : 'รอชำระ'}</span>
        </div>
        <div style="margin-top:12px; font-size:13px;">
          <span style="color: #64748b; display:block; margin-bottom:6px; font-weight:600;">หมายเหตุ:</span>
          <textarea id="jobNote" rows="2" style="width:100%; padding:10px; border:1px solid var(--border); border-radius:6px; font-family:inherit; font-size:13px;" placeholder="ระบุหมายเหตุเพิ่มเติม (ถ้ามี)">${inv ? inv.note : ''}</textarea>
        </div>
      </div>
    </div>
  `;

  document.getElementById('jobModalFooter').innerHTML = `
    <div style="width:100%; display:flex; justify-content:${job.status === 'เสร็จสิ้น' ? 'space-between' : 'flex-end'}; align-items:center;">
      ${job.status === 'เสร็จสิ้น' ? `
          <button class="btn" style="background:#10b981; color:white; border:none; padding:8px 16px; font-weight:600; border-radius:6px; cursor:pointer;" onclick="showPromptPayQR(${inv ? inv.total_amount : 0}, '${jobId}')">
            <i class="fa-solid fa-qrcode" style="margin-right:6px;"></i> แสดงใบเสร็จ / QR
          </button>
      ` : ''}
      <div style="display:flex; gap:8px;">
         <button class="btn" style="background:#e0e7ff; color:var(--primary); border:1px solid var(--primary); padding:8px 16px; font-weight:600; border-radius:6px; cursor:pointer;" onclick="openChat('${job.customer_id}', '${job.customer_name}')">
            <i class="fa-solid fa-comment-dots" style="margin-right:6px;"></i> แชทพูดคุย
         </button>
         <button class="btn btn-outline" onclick="closeJobModal()">ปิดงาน</button>
         <button class="btn btn-primary" onclick="saveJobStatus()">บันทึกอัปเดต</button>
      </div>
    </div>
  `;

  const overlay = document.getElementById('jobModalOverlay');
  overlay.style.display = 'flex';
  setTimeout(() => overlay.classList.add('active'), 10);
};

window.togglePriceInput = function (status) {
  const priceGroup = document.getElementById('priceInputGroup');
  if (priceGroup) {
    priceGroup.style.display = (status === 'เสร็จสิ้น') ? 'block' : 'none';
  }
};

window.closeJobModal = function () {
  const overlay = document.getElementById('jobModalOverlay');
  overlay.classList.remove('active');
  setTimeout(() => overlay.style.display = 'none', 300);
};

window.showPromptPayQR = function (amount, jobId) {
  // Replace this placeholder with the actual PromptPay ID, e.g. Phone number or Citizen ID
  const promptPayID = "0821724514"; // using their number from the screenshot previously as a placeholder
  const qrUrl = `https://promptpay.io/${promptPayID}/${amount}.png`;

  const modalBody = document.getElementById('jobModalBody');
  const modalFooter = document.getElementById('jobModalFooter');

  modalBody.innerHTML = `
    <div style="text-align:center; padding: 20px 0;">
       <h3 style="color:var(--text-main); margin-bottom:8px; font-weight:700;">สแกนเพื่อชำระเงิน</h3>
       <p style="color:var(--text-muted); font-size:14px; margin-bottom:20px;">รหัสงาน: #JOB-${jobId}</p>
       
       <div style="background:white; padding:16px; border-radius:12px; display:inline-block; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); margin-bottom:24px; border:1px solid var(--border);">
          <img src="${qrUrl}" alt="PromptPay QR" style="width:220px; height:220px; display:block;">
       </div>
       
       <h2 style="color:var(--primary); font-weight:700; font-size:28px; margin:0;">${Number(amount).toLocaleString('th-TH')} บาท</h2>
       <p style="color:var(--text-muted); font-size:14px; margin-top:8px; display:flex; justify-content:center; align-items:center; gap:6px;">
          <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/PromptPay_logo.svg/1024px-PromptPay_logo.svg.png" style="height:20px;" alt="PromptPay">
       </p>

       <!-- Slip Upload Section -->
       <div style="margin-top:24px; padding-top:20px; border-top:1px dashed var(--border);">
          <input type="file" id="slipInput" accept="image/*" style="display:none;" onchange="handleSlipUpload(event, '${jobId}')">
          <button class="btn btn-outline" style="width:100%; justify-content:center; border-style:dashed; color:var(--primary); border-color:var(--primary);" onclick="document.getElementById('slipInput').click()">
             <i class="fa-solid fa-cloud-arrow-up" style="margin-right:8px;"></i> คลิกเพื่ออัปโหลดสลิป
          </button>
          <div id="slipStatus" style="font-size:13px; color:var(--text-muted); margin-top:12px;"></div>
       </div>
    </div>
  `;

  modalFooter.innerHTML = `
    <button class="btn btn-primary" onclick="closeJobModal()" style="width:100%; justify-content:center; padding:12px; font-size:16px;">เสร็จสิ้น / ปิดหน้าต่าง</button>
  `;
};

window.handleSlipUpload = async function (event, jobId) {
  const file = event.target.files[0];
  if (!file) return;

  const statusEl = document.getElementById('slipStatus');
  statusEl.innerHTML = '<span style="color:var(--warning)"><i class="fa-solid fa-spinner fa-spin" style="margin-right:4px;"></i> กำลังอัปโหลด...</span>';

  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `slip_${jobId}_${Date.now()}.${fileExt}`;

    // 1. Upload to Supabase Storage (Bucket: payment_slips)
    const { data, error } = await supabaseClient.storage
      .from('payment_slips')
      .upload(fileName, file);

    if (error) {
      if (error.message.includes('Bucket not found')) {
        throw new Error("ยังไม่ได้สร้าง Storage Bucket ชื่อ 'payment_slips'");
      }
      throw error;
    }

    // 2. Get Public URL
    const { data: publicUrlData } = supabaseClient.storage
      .from('payment_slips')
      .getPublicUrl(fileName);

    const slipUrl = publicUrlData.publicUrl;

    // 3. Update status in Database
    await supabaseClient.from('invoices').update({ status: 'ชำระเงินแล้ว', slip_url: slipUrl }).eq('booking_id', jobId);
    await supabaseClient.from('bookings').update({ status: 'ชำระเงินแล้ว' }).eq('id', jobId);

    statusEl.innerHTML = `
           <span style="color:var(--success); font-weight:600;"><i class="fa-solid fa-check-circle"></i> อัปโหลดและยืนยันการชำระเงินสำเร็จ!</span><br>
           <img src="${slipUrl}" style="margin-top:12px; max-width:80%; height:160px; object-fit:cover; border-radius:8px; border:1px solid var(--border); box-shadow:var(--shadow-sm);">
        `;

    loadDashboardData();

  } catch (err) {
    console.error("Upload error:", err);
    statusEl.innerHTML = `<span style="color:var(--danger)"><i class="fa-solid fa-circle-exclamation"></i> อัปโหลดไม่สำเร็จ: ${err.message}</span>`;
  }
};

window.togglePriceInput = function (status) {
  const priceGroup = document.getElementById('priceInputGroup');
  if (priceGroup) {
    priceGroup.style.display = (status === 'เสร็จสิ้น') ? 'block' : 'none';
  }

  const recStatus = document.getElementById('receiptStatusLabel');
  if (recStatus) {
    if (status === 'เสร็จสิ้น') {
      recStatus.innerText = 'รอชำระ';
      recStatus.style.color = 'var(--warning)';
    }
  }
};

window.calculateTotal = function () {
  const labor = Number(document.getElementById('costLabor').value) || 0;
  const travel = Number(document.getElementById('costTravel').value) || 0;
  const service = Number(document.getElementById('costService').value) || 0;

  let materialTotal = 0;
  const matPrices = document.querySelectorAll('.mat-price');
  matPrices.forEach(input => {
    materialTotal += (Number(input.value) || 0);
  });

  const matTotalEl = document.getElementById('costMaterialTotal');
  if (matTotalEl) matTotalEl.innerText = materialTotal.toLocaleString('th-TH');

  const total = labor + materialTotal + travel + service;

  document.getElementById('editJobPrice').value = total;
  document.getElementById('labelTotalCost').innerText = total.toLocaleString('th-TH');
};

window.addMaterialField = function () {
  const container = document.getElementById('materialListContainer');
  const div = document.createElement('div');
  div.className = 'material-item';
  div.style.display = 'flex';
  div.style.gap = '8px';
  div.style.marginBottom = '8px';
  div.innerHTML = `
    <input type="text" class="receipt-input-small mat-name" style="flex:1; text-align:left;" placeholder="ชื่อวัสดุ">
    <input type="number" class="receipt-input-small mat-price" style="width:70px;" placeholder="ราคา" oninput="calculateTotal()">
    <button class="action-btn" style="width:28px; height:28px; padding:0; color:white; background:var(--danger); border:none;" onclick="this.parentElement.remove(); calculateTotal();"><i class="fa-solid fa-trash" style="font-size:12px;"></i></button>
  `;
  container.appendChild(div);
};

window.saveJobStatus = async function () {
  if (!currentEditingJobId) return;
  const newStatus = document.getElementById('editJobStatus').value;
  let updateData = { status: newStatus };

  if (newStatus === 'เสร็จสิ้น') {
    const priceVal = document.getElementById('editJobPrice').value;
    if (!priceVal || isNaN(priceVal) || Number(priceVal) === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'ข้อมูลไม่ครบถ้วน',
        text: 'กรุณาระบุรายการค่าใช้จ่ายให้ครบถ้วน (ต้องมียอดรวมมากกว่า 0 บาท)',
        confirmButtonColor: 'var(--primary)'
      });
      return;
    }

    let materialsArr = [];
    let materialTotal = 0;
    const matItems = document.querySelectorAll('.material-item');
    matItems.forEach(item => {
      const name = item.querySelector('.mat-name').value;
      const price = Number(item.querySelector('.mat-price').value) || 0;
      if (name && price > 0) {
        materialsArr.push({ name, price });
        materialTotal += price;
      }
    });

    const labor = Number(document.getElementById('costLabor').value) || 0;
    const travel = Number(document.getElementById('costTravel').value) || 0;
    const service = Number(document.getElementById('costService').value) || 0;
    const noteVal = document.getElementById('jobNote').value;

    const job = currentJobs.find(j => j.id == currentEditingJobId);
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const invNo = `INV-${dateStr}-${String(currentEditingJobId).padStart(4, '0')}`;

    // Create invoice data matching SQL schema perfectly
    const invoiceData = {
      booking_id: currentEditingJobId,
      invoice_no: invNo,
      technician_name: document.getElementById("navUserName").innerText,
      customer_name: job ? job.customer_name : '-',
      labor_cost: labor,
      material_cost: materialTotal,
      travel_cost: travel,
      service_fee: service,
      total_amount: Number(priceVal),
      materials_detail: materialsArr,
      status: 'รอชำระ',
      note: noteVal || ''
    };

    if (invoiceData) {
      await supabaseClient.from('invoices').delete().eq('booking_id', currentEditingJobId);
      const { error: invError } = await supabaseClient.from('invoices').insert([invoiceData]);
      if (invError) {
        console.error("Table 'invoices' sync error:", invError.message);
      }
    }
  }

  try {
    const { error } = await supabaseClient
      .from('bookings')
      .update(updateData)
      .eq('id', currentEditingJobId);

    if (error) throw error;

    if (newStatus === 'เสร็จสิ้น') {
      const finalPrice = document.getElementById('editJobPrice').value;
      showPromptPayQR(Number(finalPrice), currentEditingJobId);
    } else {
      Swal.fire({
        icon: 'success',
        title: 'สำเร็จ!',
        text: 'อัปเดตสถานะงานและบิลสำเร็จ',
        timer: 2000,
        showConfirmButton: false
      });
      closeJobModal();
    }
    loadDashboardData();
  } catch (err) {
    Swal.fire({
      icon: 'error',
      title: 'เกิดข้อผิดพลาด',
      text: err.message,
      confirmButtonColor: 'var(--primary)'
    });
  }
};
