const SUPABASE_URL = "https://uqcjajmqtlchftpqwsrp.supabase.co";
const SUPABASE_KEY = "sb_publishable_yWZiH8l1idY0QWGuj6p9sg_GqXPONGX";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser = null;
let currentConvId = null;
let conversations = [];
let messagesSubscription = null;
let convSubscription = null;

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
  }

  const menuToggle = document.getElementById('menuToggle');
  const menuClose = document.getElementById('menuClose');
  if (menuToggle) menuToggle.addEventListener('click', toggleSidebar);
  if (menuClose) menuClose.addEventListener('click', toggleSidebar);
  overlay.addEventListener('click', toggleSidebar);

  // Search Chat Event
  const searchInput = document.querySelector('.search-box input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const term = e.target.value.toLowerCase().trim();
      if (!term) {
        renderConversations(conversations);
        return;
      }
      const filtered = conversations.filter(c => {
        const p = c.customer || {};
        const name = (p.name || '').toLowerCase();
        const phone = (p.phone || '').toLowerCase();
        const email = (p.email || '').toLowerCase();
        return name.includes(term) || phone.includes(term) || email.includes(term);
      });
      renderConversations(filtered);
    });
  }
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
  toast.innerHTML += `<div class="toast-body"><h4>${title}</h4><p>${message}</p></div>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(20px)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

async function checkAuthAndLoadData() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = "login.html";
    return;
  }
  currentUser = session.user;

  const { data: profile } = await supabaseClient.from("profiles").select("role").eq("id", currentUser.id).maybeSingle();
  if (!profile || profile.role !== "admin") {
    alert("Unauthorized access");
    window.location.href = "index.html";
    return;
  }

  await loadConversations();
  setupConversationsRealtime();
}

async function loadConversations() {
  const { data, error } = await supabaseClient
    .from('admin_conversations')
    .select('id, created_at, customer_id')
    .order('created_at', { ascending: false });

  if (error) {
    console.error("Error loading conversations", error);
    showToast("Error", "ไม่สามารถดึงข้อมูลแชทได้", true);
    return;
  }

  let convs = data || [];
  if (convs.length > 0) {
    const customerIds = [...new Set(convs.map(c => c.customer_id))].filter(Boolean);
    if (customerIds.length > 0) {
      const { data: customersData } = await supabaseClient
        .from('customers')
        .select('id, name, phone, email, avatar_url')
        .in('id', customerIds);
      
      const customerMap = {};
      (customersData || []).forEach(c => { customerMap[c.id] = c; });
      
      convs = convs.map(c => {
        return {
          ...c,
          customer: customerMap[c.customer_id] || null
        };
      });
    }
  }

  conversations = convs;
  renderConversations();
}

function renderConversations(dataList = conversations) {
  const list = document.getElementById('convList');
  list.innerHTML = '';

  if (dataList.length === 0) {
    list.innerHTML = `<div class="text-center p-4 text-muted">ไม่มีประวัติการสนทนา หรือไม่พบผลลัพธ์</div>`;
    return;
  }

  dataList.forEach(conv => {
    const p = conv.customer || {};
    const customerName = p.name || 'ลูกค้าที่ไม่ระบุชื่อ';
    const init = customerName.charAt(0).toUpperCase();
    
    const d = new Date(conv.created_at);
    const timeStr = d.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit' }) + ' ' + d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

    const contactInfo = [p.phone, p.email].filter(Boolean).join(' • ');
    const displaySubtitle = contactInfo || 'แตะเพื่อดูข้อความ...';

    const item = document.createElement('div');
    item.className = `chat-list-item ${currentConvId === conv.id ? 'active' : ''}`;
    item.onclick = () => selectConversation(conv.id, p);
    
    let avatarHtml = `<div class="chat-avatar">${init}</div>`;
    if (p.avatar_url) avatarHtml = `<img src="${p.avatar_url}" class="chat-avatar" style="object-fit:cover;">`;

    item.innerHTML = `
      ${avatarHtml}
      <div class="chat-preview">
        <div class="chat-preview-header">
          <div class="chat-preview-name">${customerName}</div>
          <div class="chat-preview-time">${timeStr}</div>
        </div>
        <div class="chat-preview-msg" style="font-size: 12.5px; margin-top: 2px;">${displaySubtitle}</div>
      </div>
    `;
    list.appendChild(item);
  });
}

async function selectConversation(convId, customer) {
  currentConvId = convId;
  renderConversations();

  document.getElementById('noChatSelected').style.display = 'none';
  document.getElementById('chatMain').style.display = 'flex';

  const customerName = customer.name || 'ลูกค้าที่ไม่ระบุชื่อ';
  const contactInfo = [customer.phone, customer.email].filter(Boolean).join(' • ');
  
  document.getElementById('activeChatTitle').innerHTML = `
    <div style="display: flex; flex-direction: column; line-height: 1.2;">
      <span>${customerName}</span>
      ${contactInfo ? `<span style="font-size:13.5px; font-weight:normal; color:var(--text-muted); margin-top:4px;"><i class="fa-solid fa-address-card" style="margin-right:4px;"></i> ${contactInfo}</span>` : ''}
    </div>
  `;

  await loadMessages(convId);
  setupMessagesRealtime(convId);
}

async function loadMessages(convId) {
  const container = document.getElementById('messagesContainer');
  container.innerHTML = '<div class="text-center p-4"><i class="fa-solid fa-spinner fa-spin text-primary"></i></div>';

  const { data, error } = await supabaseClient
    .from('admin_messages')
    .select('*')
    .eq('conversation_id', convId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error(error);
    container.innerHTML = '<div class="text-center p-4 text-rose">โหลดข้อความไม่สำเร็จ</div>';
    return;
  }

  container.innerHTML = '';
  if (data.length === 0) {
    container.innerHTML = '<div class="text-center p-4 text-muted">ยังไม่มีข้อความ (เริ่มพิมพ์เพื่อทักทาย)</div>';
    return;
  }

  data.forEach(msg => appendMessageUI(msg));
  scrollToBottom();
}

function appendMessageUI(msg) {
  const container = document.getElementById('messagesContainer');
  
  if (container.innerHTML.includes('ยังไม่มีข้อความ') || container.innerHTML.includes('fa-spinner')) {
    container.innerHTML = '';
  }

  const isSentByMe = msg.sender_id === currentUser.id;
  const md = new Date(msg.created_at);
  const time = md.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit' }) + ' ' + md.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

  const wrapper = document.createElement('div');
  wrapper.className = `msg-wrapper ${isSentByMe ? 'sent' : 'received'}`;
  
  let contentHtml = '';
  const msgText = msg.message_text || '';
  if (msgText.startsWith('http') && msgText.includes('chat_images')) {
    contentHtml = `<img src="${msgText}" class="msg-img" onclick="window.open('${msgText}', '_blank')">`;
  } else {
    // Basic sanitization
    contentHtml = msgText.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  wrapper.innerHTML = `
    <div style="max-width: 100%;">
      <div class="msg-bubble">${contentHtml}</div>
      <div class="msg-time">${time}</div>
    </div>
  `;
  container.appendChild(wrapper);
}

function scrollToBottom() {
  const container = document.getElementById('messagesContainer');
  container.scrollTop = container.scrollHeight;
}

window.handleKeyPress = function(e) {
  if (e.key === 'Enter') {
    sendAdminMessage();
  }
};

window.sendAdminMessage = async function() {
  if (!currentConvId) return;
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text) return;

  input.value = '';
  
  const { error } = await supabaseClient.from('admin_messages').insert([{
    conversation_id: currentConvId,
    sender_id: currentUser.id,
    message_text: text
  }]);

  if (error) {
    console.error(error);
    showToast("Error", "ส่งข้อความไม่สำเร็จ", true);
  }
};

window.handleAdminChatImageUpload = async function(evt) {
  if (!currentConvId) return;
  const file = evt.target.files[0];
  if (!file) return;

  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}.${fileExt}`;
  const filePath = `admin_chats/${currentConvId}/${fileName}`;

  showToast("Uploading", "กำลังส่งรูปภาพ...");

  const { error: uploadError } = await supabaseClient.storage.from('chat_images').upload(filePath, file);
  if (uploadError) {
    showToast("Error", "อัปโหลดรูปล้มเหลว", true);
    return;
  }

  const { data: publicUrlData } = supabaseClient.storage.from('chat_images').getPublicUrl(filePath);
  const imageUrl = publicUrlData.publicUrl;

  const { error: insertError } = await supabaseClient.from('admin_messages').insert([{
    conversation_id: currentConvId,
    sender_id: currentUser.id,
    message_text: imageUrl
  }]);

  if (insertError) {
    showToast("Error", "ส่งรูปภาพไม่สำเร็จ", true);
  }
  
  document.getElementById('chatImageInput').value = "";
};

function setupConversationsRealtime() {
  if (convSubscription) supabaseClient.removeChannel(convSubscription);
  
  convSubscription = supabaseClient.channel('admin_conversations_all')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_conversations' }, payload => {
      loadConversations();
    })
    .subscribe();
}

function setupMessagesRealtime(convId) {
  if (messagesSubscription) supabaseClient.removeChannel(messagesSubscription);

  messagesSubscription = supabaseClient.channel('admin_messages_active')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'admin_messages', filter: `conversation_id=eq.${convId}` }, payload => {
      appendMessageUI(payload.new);
      scrollToBottom();
    })
    .subscribe();
}

window.logout = async function() {
  await supabaseClient.auth.signOut();
  window.location.href = "login.html";
};
