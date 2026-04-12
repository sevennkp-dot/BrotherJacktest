// ===== CONFIGURATION =====
const SUPABASE_URL = "https://uqcjajmqtlchftpqwsrp.supabase.co";
const SUPABASE_KEY = "sb_publishable_yWZiH8l1idY0QWGuj6p9sg_GqXPONGX";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ===== STATE =====
let currentUser = null;
let currentUserPhone = null;

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

window.markAllMessagesAsRead = async function() {
    if (!currentUser) return;
    try {
        const { error } = await supabaseClient
            .from('messages')
            .update({ is_read: true })
            .eq('receiver_id', currentUser.id)
            .eq('is_read', false);
            
        if (error) throw error;
        
        // Refresh UI
        updateUnreadBadge();
        if (document.getElementById('chatListModalOverlay').style.display === 'flex') {
            toggleChatList(); // Refresh the list to remove bold names/badges
        }
        
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: 'อ่านทุกข้อความแล้ว',
            showConfirmButton: false,
            timer: 2000
        });
    } catch(err) {
        console.error("Error marking all as read:", err);
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
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${currentChatConversationId}` }, payload => {
        if (typeof updateMessageInUI === 'function') updateMessageInUI(payload.new);
      })
      .subscribe();

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
  
  if (msg.message_text && msg.message_text.startsWith('[IMAGE]')) {
    const imgUrl = msg.message_text.replace('[IMAGE]', '');
    bubble.style.backgroundColor = 'transparent';
    bubble.style.padding = '0';
    bubble.innerHTML = `<img src="${imgUrl}" style="max-width: 200px; max-height: 250px; border-radius: 12px; border: 1px solid #e4e6eb; object-fit: cover; cursor: pointer;" onclick="window.open('${imgUrl}', '_blank')">`;
  } else if (msg.image_url || (msg.message_text && (msg.message_text.startsWith('http') && (msg.message_text.includes('.jpg') || msg.message_text.includes('.png') || msg.message_text.includes('.webp') || msg.message_text.includes('.gif'))))) {
    const imgUrl = msg.image_url || msg.message_text;
    bubble.style.backgroundColor = 'transparent';
    bubble.style.padding = '0';
    bubble.innerHTML = `<img src="${imgUrl}" style="max-width: 200px; max-height: 250px; border-radius: 12px; border: 1px solid #e4e6eb; object-fit: cover; cursor: pointer;" onclick="window.open('${imgUrl}', '_blank')">`;
    
    // Add text if it's not just the URL
    if (msg.image_url && msg.message_text && msg.message_text !== '[IMAGE]' && !msg.message_text.startsWith('http')) {
        const textDiv = document.createElement('div');
        textDiv.style.marginTop = '4px';
        textDiv.style.padding = '8px 12px';
        textDiv.style.borderRadius = isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px';
        textDiv.style.backgroundColor = isMe ? FB_BLUE : FB_GRAY;
        textDiv.style.color = isMe ? '#fff' : FB_TEXT_DARK;
        textDiv.innerText = msg.message_text;
        bubble.appendChild(textDiv);
    }
  } else {
    bubble.innerText = msg.message_text;
  }
  
  // Set ID for the whole message row to allow safe removal/updating
  div.id = `msg-row-${msg.id}`;

  const time = document.createElement('div');
  time.style.fontSize = '11px';
  time.style.color = '#bcc0c4';
  time.style.marginTop = '2px';
  time.style.padding = isMe ? '0 4px 0 0' : '0 0 0 4px';
  time.style.display = 'flex';
  time.style.alignItems = 'center';
  time.style.gap = '4px';

  let readStatusHTML = '';
  if (msg.is_read) {
    readStatusHTML = `<span id="msg-status-${msg.id}" style="color: #bcc0c4; font-size: 10px;"><i class="fa-solid fa-check-double" style="color: #0084ff;"></i> อ่านแล้ว</span>`;
  } else {
    readStatusHTML = `<span id="msg-status-${msg.id}" style="color: #bcc0c4; font-size: 10px;"><i class="fa-solid fa-check"></i> ส่งแล้ว</span>`;
  }

  const timeText = new Date(msg.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  time.innerHTML = isMe ? `${timeText} ${readStatusHTML}` : `${timeText} ${readStatusHTML}`;

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

window.updateMessageInUI = function(msg) {
  const statusSpan = document.getElementById(`msg-status-${msg.id}`);
  if (statusSpan && msg.is_read) {
    statusSpan.innerHTML = '<i class="fa-solid fa-check-double" style="color: #0084ff;"></i> อ่านแล้ว';
  }
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

window.sendChatImage = async function (event) {
  const file = event.target.files[0];
  if (!file || !currentChatConversationId) return;

  const tempId = 'temp-' + Date.now();
  
  // Instant visual feedback: Show local preview
  const reader = new FileReader();
  reader.onload = function(e) {
    const loadingMsg = { 
        id: tempId, 
        sender_id: currentUser.id, 
        message_text: '[IMAGE]' + e.target.result, 
        created_at: new Date().toISOString(), 
        is_read: false 
    };
    appendMessageToUI(loadingMsg);
    // Add loading overlay to the preview
    const row = document.getElementById(`msg-row-${tempId}`);
    if (row) {
        const img = row.querySelector('img');
        if (img) {
            img.style.opacity = '0.5';
            img.parentElement.style.position = 'relative';
            const loader = document.createElement('div');
            loader.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
            loader.style.position = 'absolute';
            loader.style.top = '50%';
            loader.style.left = '50%';
            loader.style.transform = 'translate(-50%, -50%)';
            loader.style.color = 'white';
            loader.style.fontSize = '24px';
            img.parentElement.appendChild(loader);
        }
    }
  };
  reader.readAsDataURL(file);
  
  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `chat_${currentChatConversationId}_${Date.now()}.${fileExt}`;
    
    // Using chat_images bucket as requested by USER
    const { data, error } = await supabaseClient.storage.from('chat_images').upload(fileName, file);
    if (error) throw error;
    
    const { data: publicUrlData } = supabaseClient.storage.from('chat_images').getPublicUrl(fileName);
    const imageUrl = publicUrlData.publicUrl;

    // Remove the temp loading message safely
    const tempRow = document.getElementById(`msg-row-${tempId}`);
    if (tempRow) tempRow.remove();

    // Insert into DB - Explicitly including all fields to satisfy RLS
    const { error: dbError } = await supabaseClient.from('messages').insert([{
      conversation_id: currentChatConversationId,
      sender_id: currentUser.id,
      receiver_id: currentChatCustomerId,
      message_text: '[IMAGE]' + imageUrl,
      image_url: imageUrl, // Adding this explicitly too
      is_read: false
    }]);

    if (dbError) throw dbError;

  } catch (err) {
    const tempRow = document.getElementById(`msg-row-${tempId}`);
    if (tempRow) tempRow.remove();
    
    console.error("Chat Image Error:", err);
    if (err.message && err.message.includes('security policy')) {
       Swal.fire({ icon: 'error', title: 'RLS Permission Denied', text: 'ระบบไม่อนุญาตให้ช่างส่งรูปภาพในตอนนี้ (RLS Error) กรุณาแจ้งผู้ดูแลระบบครับ' });
    } else {
       Swal.fire({ icon: 'error', title: 'อัปโหลดภาพไม่สำเร็จ', text: err.message });
    }
  }
  
  document.getElementById('chatImageInput').value = '';
};

// Emoji Picker Simple Implementation
window.toggleEmojiPicker = function() {
    let picker = document.getElementById('emojiPickerOverlay');
    if (picker) {
        picker.remove();
        return;
    }
    
    const emojis = ['😊','😂','😍','🙏','👍','🙌','✨','🔥','✅','❌','🔧','🏠','💸','📦','📞','💬'];
    
    picker = document.createElement('div');
    picker.id = 'emojiPickerOverlay';
    picker.style.position = 'absolute';
    picker.style.bottom = '80px';
    picker.style.right = '20px';
    picker.style.background = 'white';
    picker.style.padding = '12px';
    picker.style.borderRadius = '12px';
    picker.style.boxShadow = '0 5px 15px rgba(0,0,0,0.1)';
    picker.style.display = 'grid';
    picker.style.gridTemplateColumns = 'repeat(4, 1fr)';
    picker.style.gap = '8px';
    picker.style.zIndex = '3000';
    picker.style.border = '1px solid #e4e6eb';
    
    emojis.forEach(emoji => {
        const btn = document.createElement('button');
        btn.innerText = emoji;
        btn.style.background = 'none';
        btn.style.border = 'none';
        btn.style.fontSize = '24px';
        btn.style.cursor = 'pointer';
        btn.style.padding = '4px';
        btn.onclick = () => {
            const input = document.getElementById('chatInput');
            input.value += emoji;
            input.focus();
            picker.remove();
        };
        picker.appendChild(btn);
    });
    
    document.getElementById('chatModalOverlay').appendChild(picker);
    
    // Close when clicking outside
    const closePicker = (e) => {
        if (!picker.contains(e.target) && !e.target.classList.contains('fa-face-smile')) {
            picker.remove();
            document.removeEventListener('click', closePicker);
        }
    };
    setTimeout(() => document.addEventListener('click', closePicker), 10);
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
               
               // 1. Try to fetch customer name from customers table
               const {data: cProfile} = await supabaseClient.from('customers').select('name').eq('id', c.customer_id).maybeSingle();
               if(cProfile && cProfile.name) {
                 cName = cProfile.name;
               } else {
                 // 2. Fallback to bookings table
                 const {data: bProfile} = await supabaseClient.from('bookings').select('customer_name, customer_phone').eq('customer_id', c.customer_id).order('created_at', {ascending: false}).limit(1).maybeSingle();
                 if(bProfile && bProfile.customer_name) {
                   cName = bProfile.customer_name;
                 } else if (bProfile && bProfile.customer_phone) {
                   cName = "ลูกค้า (" + bProfile.customer_phone + ")";
                 }
               }
               
                // Fetch last message
                const {data: lastMsg} = await supabaseClient.from('messages').select('message_text, created_at').eq('conversation_id', c.id).order('created_at', {ascending: false}).limit(1).maybeSingle();
                
                let lastText = "ยังไม่มีข้อความ";
                let lastTime = "";
                if (lastMsg) {
                    lastText = lastMsg.message_text;
                    if (lastText && lastText.startsWith('[IMAGE]')) lastText = "📷 ส่งรูปภาพ";
                    
                    const d = new Date(lastMsg.created_at);
                    lastTime = d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
                }

                // Fetch unread count
                const {count} = await supabaseClient.from('messages').select('*', {count:'exact', head:true}).eq('conversation_id', c.id).eq('receiver_id', currentUser.id).eq('is_read', false);
                
                let unreadBadge = count > 0 ? `<div style="background:#0084ff; color:#fff; border-radius:50%; min-width:20px; height:20px; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:bold; padding:0 6px; box-shadow: 0 2px 4px rgba(0,132,255,0.3);">${count}</div>` : '';
                let titleWeight = count > 0 ? '700' : '600';
                let msgWeight = count > 0 ? '600' : '400';
                let msgColor = count > 0 ? '#050505' : '#65676b';
                
                html += `
                  <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 16px; border-bottom:1px solid #f0f2f5; cursor:pointer; transition:background 0.2s;" onmouseover="this.style.background='#f0f2f5'" onmouseout="this.style.background='#fff'" onclick="openChat('${c.customer_id}', '${cName.replace(/'/g, "\\'")}')">
                     <div style="display:flex; align-items:center; gap:12px; flex:1; min-width:0;">
                        <div style="width:48px; height:48px; border-radius:50%; background: linear-gradient(135deg, #e4e6eb, #f0f2f5); display:flex; justify-content:center; align-items:center; color:#65676b; font-size:20px; flex-shrink:0; border: 1px solid #e4e6eb;">
                           <i class="fa-solid fa-user"></i>
                        </div>
                        <div style="flex:1; min-width:0;">
                           <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2px;">
                              <div style="font-weight:${titleWeight}; color:#050505; font-size:15px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${cName}</div>
                              <div style="font-size:11px; color:#65676b;">${lastTime}</div>
                           </div>
                           <div style="font-size:13px; color:${msgColor}; font-weight:${msgWeight}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; display:flex; justify-content:space-between; align-items:center;">
                              <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; flex:1;">${lastText}</span>
                              ${unreadBadge}
                           </div>
                        </div>
                     </div>
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

  // Try customers table for identity name (standard in this repo)
  let displayName = currentUser.email || "ช่างเทคนิค";
  let displayAvatar = null;

  const { data: customer } = await supabaseClient.from("customers").select("name").eq("id", currentUser.id).maybeSingle();
  if (customer && customer.name) {
    displayName = customer.name;
  }

  const { data: techProfile } = await supabaseClient.from("technicians").select("profile_image, phone").eq("id", currentUser.id).maybeSingle();
  if (techProfile) {
    if (techProfile.profile_image) {
      // Add cache busting to force refresh
      displayAvatar = techProfile.profile_image + '?t=' + Date.now();
    }
    if (techProfile.phone) {
      currentUserPhone = techProfile.phone;
    }
  }

  document.getElementById("navUserName").innerText = displayName;
  if (displayAvatar) {
    const navAvatar = document.querySelector('.tech-profile .avatar img');
    if (navAvatar) navAvatar.src = displayAvatar;
  } else {
    // Initials fallback
    const initials = displayName.charAt(0).toUpperCase();
    const navAvatar = document.querySelector('.tech-profile .avatar img');
    if (navAvatar) navAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=10b981&color=fff&bold=true`;
  }

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
    let techId = currentUser?.id || null;

    let query = supabaseClient.from("bookings").select("*").order("created_at", { ascending: false });

    // Filter by techId if found using technician_uuid (UUID column)
    if (techId) {
      query = query.eq("technician_uuid", techId);
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

    const estimatedIncome = completedJobs.reduce((sum, j) => sum + (Number(j.payment_amount) || 0), 0);
    const incomeEl = document.getElementById("statIncome");
    if (incomeEl) incomeEl.innerText = "฿" + estimatedIncome.toLocaleString();

    // Calendar Sidebar Stats (Current Month)
    const now = new Date();
    const currentMonthJobs = currentJobs.filter(j => {
      if (!j.service_date) return false;
      const jDate = new Date(j.service_date);
      return jDate.getMonth() === now.getMonth() && jDate.getFullYear() === now.getFullYear();
    });
    const calCompleted = currentMonthJobs.filter(j => j.status === "เสร็จสิ้น").length;
    const calPending = currentMonthJobs.filter(j => j.status === "รอดำเนินการ" || j.status === "กำลังดำเนินการ" || j.status === "รอรับงาน").length;

    const elCalTotal = document.getElementById("calTotalJobs");
    if (elCalTotal) elCalTotal.innerText = currentMonthJobs.length;
    const elCalComp = document.getElementById("calCompletedJobs");
    if (elCalComp) elCalComp.innerText = calCompleted;
    const elCalPend = document.getElementById("calPendingJobs");
    if (elCalPend) elCalPend.innerText = calPending;

    // Render table
    const tbody = document.getElementById("jobsTableBody");
    tbody.innerHTML = "";

    // Sync calendar events if calendar is active
    if (typeof calendar !== 'undefined' && calendar) {
      calendar.removeAllEvents();
      calendar.addEventSource(getCalendarEvents());
    }

    // Populate Today's Tasks Component
    const today = new Date().toISOString().split('T')[0];
    const todayTasks = currentJobs.filter(j => j.service_date === today && j.status !== "ยกเลิกแล้ว");
    
    // Default to the next nearest tasks if no tasks today (for display purposes)
    const upcomingTasks = currentJobs.filter(j => new Date(j.service_date) >= new Date(today) && j.status !== "ยกเลิกแล้ว" && j.status !== "เสร็จสิ้น").sort((a,b) => new Date(a.service_date) - new Date(b.service_date)).slice(0, 4);
    
    const displayTasks = todayTasks.length > 0 ? todayTasks : upcomingTasks;
    const taskListId = "todayTasksList";
    const tlEl = document.getElementById(taskListId);
    
    if (tlEl) {
      if (displayTasks.length === 0) {
        tlEl.innerHTML = '<li class="empty-timeline">ไม่มีคิวงานที่ต้องทำในช่วงนี้</li>';
      } else {
        tlEl.innerHTML = '';
        displayTasks.forEach(job => {
          let dotClass = "waiting";
          if (job.status === "กำลังดำเนินการ") dotClass = "urgent";
          if (job.status === "เสร็จสิ้น") dotClass = "success";
          
          const displayDate = job.service_date === today ? 'วันนี้' : new Date(job.service_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
          const time = job.service_time || 'ไม่ระบุเวลา';
          
          tlEl.innerHTML += `
            <li class="timeline-item">
              <div class="timeline-dot ${dotClass}"></div>
              <div class="timeline-time">${displayDate} &bull; ${time}</div>
              <div class="timeline-title">${job.category || 'งานซ่อมทั่วไป'} &bull; ${job.customer_name}</div>
              <div class="timeline-desc text-truncate" style="max-width: 250px;">${job.problem_detail || 'ไม่มีรายละเอียดเพิ่มเติม...'}</div>
            </li>
          `;
        });
      }
    }

    if (currentJobs.length === 0) {
      tbody.innerHTML = "<tr><td colspan='5' class='text-center text-muted'>ยังไม่มีงานในขณะนี้</td></tr>";
      return;
    }

    currentJobs.slice(0, 10).forEach(job => {
      let statusClass = "pending";
      if (job.status === "กำลังดำเนินการ") statusClass = "in-progress";
      if (job.status === "เสร็จสิ้น") statusClass = "completed";
      if (job.status === "ยกเลิกแล้ว") statusClass = "rejected";

      const row = document.createElement("tr");
      row.innerHTML = `
        <td style="font-size: 13px;">
           <div class="fw-bold text-main"><i class="fa-regular fa-calendar text-muted"></i> ${job.service_date ? new Date(job.service_date).toLocaleDateString('th-TH') : '-'}</div>
           <div class="text-muted"><i class="fa-regular fa-clock"></i> ${job.service_time || '-'}</div>
        </td>
        <td>
            <div class="fw-bold" style="color: var(--text-main); font-size: 14px;">${job.customer_name || 'ไม่ระบุ'}</div>
            <div class="text-sm text-muted" style="font-size: 12px;"><i class="fa-solid fa-phone"></i> ${job.customer_phone || '-'}</div>
        </td>
        <td>
            <div class="text-xs px-2 py-1 rounded d-inline-block" style="font-size: 12px; border-radius: 6px; background: #f1f5f9; color: #475569; font-weight: 600;">${job.category || 'ทั่วไป'}</div>
            <div style="font-size: 12px; margin-top: 4px; color: var(--text-muted); max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${job.problem_detail || '-'}</div>
        </td>
        <td><span class="badge-status ${statusClass}">${job.status || 'รอดำเนินการ'}</span></td>
        <td style="text-align: center;">
          <button class="action-btn" style="background: var(--primary-light); color: var(--primary);" title="ดูรายละเอียด/อัปเดต" onclick="viewJob('${job.id}')"><i class="fa-solid fa-arrow-right"></i></button>
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
  const incomeView = document.getElementById('incomeView');
  const btnDash = document.getElementById('btnViewDashboard');
  const btnCal = document.getElementById('btnViewCalendar');

  const mainHeader = document.getElementById('mainPageHeader');
  const mainTitle = document.getElementById('pageMainTitle');
  const mainSubTitle = document.getElementById('pageSubTitle');
  const headerBtns = document.getElementById('headerButtonsContainer');

  // Hide all views initially
  dashboardView.style.display = 'none';
  calendarView.style.display = 'none';
  incomeView.style.display = 'none';
  const profileView = document.getElementById('profileView');
  if (profileView) profileView.style.display = 'none';
  const settingsView = document.getElementById('settingsView');
  if (settingsView) settingsView.style.display = 'none';
  const reviewsView = document.getElementById('reviewsView');
  if (reviewsView) reviewsView.style.display = 'none';

  // Update sidebar navigation active state
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

  if (viewId === 'calendar') {
    calendarView.style.display = 'block';
    mainTitle.innerText = "📅 ตารางงานของคุณ (Schedule)";
    mainSubTitle.innerText = "ดูและจัดการคิวงานทั้งหมดของคุณได้ที่นี่";
    if (headerBtns) headerBtns.style.display = 'none';
    
    btnDash.className = 'btn-outline';
    btnCal.className = 'btn-primary';

    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
      if (link.innerText.includes('ตารางงาน')) link.parentElement.classList.add('active');
    });

    if (!calendar) {
      initCalendar();
    } else {
      calendar.render();
    }
  } else if (viewId === 'income') {
    incomeView.style.display = 'block';
    mainTitle.innerText = "💸 รายได้ของคุณ (Income)";
    mainSubTitle.innerText = "สรุปรายรับและประวัติการรับเงินทั้งหมด";
    if (headerBtns) headerBtns.style.display = 'none';
    
    loadIncomeData();
    btnDash.className = 'btn-outline';
    btnCal.className = 'btn-outline';

    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
      if (link.innerText.includes('รายได้')) link.parentElement.classList.add('active');
    });
  } else if (viewId === 'profile') {
    if (profileView) {
        profileView.style.display = 'block';
        if (mainHeader) mainHeader.style.display = 'none'; // Hide main header for profile as it has its own
    }
    loadProfileData();
    btnDash.className = 'btn-outline';
    btnCal.className = 'btn-outline';

    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
      if (link.innerText.includes('แก้ไขประวัติ')) link.parentElement.classList.add('active');
    });
  } else if (viewId === 'settings') {
    if (settingsView) {
        settingsView.style.display = 'block';
        if (mainHeader) mainHeader.style.display = 'none';
    }
    btnDash.className = 'btn-outline';
    btnCal.className = 'btn-outline';

    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
      if (link.innerText.includes('ตั้งค่าระบบ')) link.parentElement.classList.add('active');
    });
  } else if (viewId === 'reviews') {
    if (reviewsView) {
        reviewsView.style.display = 'block';
        if (mainHeader) mainHeader.style.display = 'flex';
    }
    loadReviewsData();
    btnDash.className = 'btn-outline';
    btnCal.className = 'btn-outline';

    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
      if (link.innerText.includes('รีวิว')) link.parentElement.classList.add('active');
    });
  } else {
    dashboardView.style.display = 'block';
    mainTitle.innerText = "สวัสดีช่าง, ยินดีต้อนรับ! 👋";
    mainSubTitle.innerText = "นี่คือข้อมูลสรุปงานและสถิติรายได้ของคุณในตอนนี้";
    if (headerBtns) headerBtns.style.display = 'flex';
    if (mainHeader) mainHeader.style.display = 'flex';
    
    btnDash.className = 'btn-primary';
    btnCal.className = 'btn-outline';

    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
      if (link.innerText.includes('ภาพรวมแผงควบคุม')) link.parentElement.classList.add('active');
    });
  }
};

window.updateStatusLabel = function(checkbox) {
  const label = document.getElementById('statusLabel');
  if (!label) return;
  if (checkbox.checked) {
    label.innerText = "Online";
    label.style.color = "#10b981";
  } else {
    label.innerText = "Offline";
    label.style.color = "#ef4444";
  }
};

window.initCalendar = function() {
    const calendarEl = document.getElementById('calendar');
    if (!calendarEl) return;
    
    calendar = new FullCalendar.Calendar(calendarEl, {
      initialView: 'dayGridMonth',
      headerToolbar: {
        left: 'prev,next today',
        center: 'title',
        right: 'dayGridMonth,timeGridWeek,listWeek'
      },
      locale: 'th',
      events: getCalendarEvents(),
      eventClick: function(info) {
        viewJob(info.event.id);
      }
    });
    calendar.render();
};

function getCalendarEvents() {
    return currentJobs.map(job => ({
       id: job.id,
       title: `${job.customer_name || 'งาน'} - ${job.category || 'ทั่วไป'}`,
       start: job.service_date,
       backgroundColor: job.status === 'เสร็จสิ้น' ? '#10b981' : (job.status === 'กำลังดำเนินการ' ? '#3b82f6' : '#f59e0b'),
       borderColor: 'transparent'
    }));
}

// ===== INCOME DATA =====
let currentIncomeFilter = 'today';

window.setIncomeFilter = function(filter) {
  currentIncomeFilter = filter;
  ['today','week','month','all'].forEach(f => {
    const id = 'filter' + f.charAt(0).toUpperCase() + f.slice(1);
    const btn = document.getElementById(id);
    if (btn) btn.classList.toggle('active', f === filter);
  });
  loadIncomeData();
};

window.loadIncomeData = function () {
  const allCompleted = currentJobs.filter(j => j.status === 'เสร็จสิ้น');

  const now = new Date();
  let filtered = allCompleted;
  if (currentIncomeFilter === 'today') {
    const todayStr = now.toDateString();
    filtered = allCompleted.filter(j => {
      const d = j.updated_at || j.service_date || j.created_at;
      return d && new Date(d).toDateString() === todayStr;
    });
  } else if (currentIncomeFilter === 'week') {
    const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7);
    filtered = allCompleted.filter(j => {
      const d = j.updated_at || j.service_date || j.created_at;
      return d && new Date(d) >= weekAgo;
    });
  } else if (currentIncomeFilter === 'month') {
    filtered = allCompleted.filter(j => {
      const d = j.updated_at || j.service_date || j.created_at;
      if (!d) return false;
      const jd = new Date(d);
      return jd.getMonth() === now.getMonth() && jd.getFullYear() === now.getFullYear();
    });
  }

  const totalAmount = filtered.reduce((sum, j) => sum + (Number(j.payment_amount) || 0), 0);
  const laborAmount = filtered.reduce((sum, j) => sum + (Number(j.labor_cost) || Math.round((Number(j.payment_amount) || 0) * 0.7)), 0);
  const materialAmount = totalAmount - laborAmount;
  const avgAmount = filtered.length > 0 ? Math.round(totalAmount / filtered.length) : 0;

  // Animate number counter
  const animateNum = (el, target, prefix) => {
    if (!el) return;
    const duration = 700;
    const startTime = performance.now();
    const step = t => {
      const p = Math.min((t - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      el.textContent = (prefix || '') + Math.round(target * ease).toLocaleString();
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  animateNum(document.getElementById('incomeTotalAmount'), totalAmount, '฿');
  animateNum(document.getElementById('incomeLaborAmount'), laborAmount, '฿');
  animateNum(document.getElementById('incomeAvgAmount'), avgAmount, '฿');

  const countEl = document.getElementById('incomeJobsCount');
  if (countEl) countEl.textContent = filtered.length;
  const trendEl = document.getElementById('incomeTrendText');
  if (trendEl) trendEl.textContent = filtered.length + ' งานเสร็จสิ้น';

  // Breakdown bars
  setTimeout(() => {
    const laborPct = totalAmount > 0 ? Math.round((laborAmount / totalAmount) * 100) : 70;
    const matPct = 100 - laborPct;
    const barLabor = document.getElementById('barLabor');
    const barMat = document.getElementById('barMaterial');
    if (barLabor) barLabor.style.width = laborPct + '%';
    if (barMat) barMat.style.width = matPct + '%';
    const el = id => document.getElementById(id);
    if (el('breakdownLaborPct')) el('breakdownLaborPct').textContent = laborPct + '%';
    if (el('breakdownMatPct')) el('breakdownMatPct').textContent = matPct + '%';
    if (el('breakdownLaborAmt')) el('breakdownLaborAmt').textContent = '฿' + laborAmount.toLocaleString();
    if (el('breakdownMatAmt')) el('breakdownMatAmt').textContent = '฿' + materialAmount.toLocaleString();
    if (el('breakdownTotal')) el('breakdownTotal').textContent = '฿' + totalAmount.toLocaleString();
  }, 100);

  // Bar chart
  renderIncomeBarChart(allCompleted);

  // Transaction table
  const tbody = document.getElementById('incomeTableBody');
  const countBadge = document.getElementById('incomeTransactionCount');
  if (countBadge) countBadge.textContent = filtered.length + ' รายการ';
  if (!tbody) return;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:60px 20px; color:var(--text-muted);">
      <i class="fa-solid fa-receipt" style="font-size:48px; color:#e2e8f0; display:block; margin-bottom:16px;"></i>
      <div style="font-size:16px; font-weight:700; color:var(--text-main); margin-bottom:6px;">ยังไม่มีข้อมูลรายได้</div>
      <div style="font-size:13px;">ในช่วงเวลาที่เลือก ยังไม่มีงานที่เสร็จสิ้น</div>
    </td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(job => {
    const dateStr = job.updated_at || job.service_date || job.created_at;
    const payDate = dateStr ? new Date(dateStr).toLocaleDateString('th-TH', {day:'numeric', month:'short', year:'2-digit'}) : '-';
    const total = Number(job.payment_amount) || 0;
    const labor = Number(job.labor_cost) || Math.round(total * 0.7);
    const mat = total - labor;
    const jobIdShort = String(job.id).substring(0, 6).toUpperCase();
    return `<tr>
      <td style="font-size:13px; color:var(--text-muted);">${payDate}</td>
      <td><span style="font-weight:700; font-size:13px; background:#f0f4ff; color:#4f46e5; padding:3px 8px; border-radius:6px;">#${jobIdShort}</span></td>
      <td>
        <div style="font-weight:600; font-size:13px;">${job.customer_name || 'ไม่ระบุ'}</div>
        <div style="font-size:12px; color:var(--text-muted);">${job.customer_phone || ''}</div>
      </td>
      <td><span style="font-size:12px; padding:3px 10px; border-radius:20px; background:#ede9fe; color:#7c3aed; font-weight:600;">${job.category || 'ทั่วไป'}</span></td>
      <td class="income-tx-amount-labor">฿${labor.toLocaleString()}</td>
      <td class="income-tx-amount-mat">฿${mat.toLocaleString()}</td>
      <td class="income-tx-amount-total">฿${total.toLocaleString()}</td>
      <td><span style="display:inline-flex; align-items:center; gap:5px; font-size:12px; font-weight:600; background:#d1fae5; color:#059669; padding:4px 10px; border-radius:20px;">
        <i class="fa-solid fa-circle-check" style="font-size:10px;"></i> รับเงินแล้ว
      </span></td>
    </tr>`;
  }).join('');
};

function renderIncomeBarChart(completedJobs) {
  const chartEl = document.getElementById('incomeBarChart');
  if (!chartEl) return;

  const dayNames = ['อา','จ','อ','พ','พฤ','ศ','ส'];
  const today = new Date();
  const days = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    days.push({ date: d, label: dayNames[d.getDay()], dateStr: d.toDateString(), amount: 0, isToday: i === 0 });
  }

  completedJobs.forEach(job => {
    const d = job.updated_at || job.service_date || job.created_at;
    if (!d) return;
    const ds = new Date(d).toDateString();
    const day = days.find(x => x.dateStr === ds);
    if (day) day.amount += Number(job.payment_amount) || 0;
  });

  const maxAmount = Math.max(...days.map(d => d.amount), 1);

  chartEl.innerHTML = days.map(day => {
    const pct = Math.round((day.amount / maxAmount) * 100);
    const heightPx = Math.max(pct, 4);
    const amtLabel = day.amount > 0 ? '฿' + (day.amount >= 1000 ? (day.amount / 1000).toFixed(1) + 'k' : day.amount) : '-';
    return `<div class="income-bar-day">
      <div class="income-bar-fill-wrap">
        <div class="income-bar-fill ${day.isToday ? 'today-bar' : ''}" style="height:4px;" data-target="${heightPx}" title="${day.label}: ${amtLabel}"></div>
      </div>
      <div class="income-bar-label" style="${day.isToday ? 'color:#0ea5e9;' : ''}">${day.label}</div>
      <div class="income-bar-amount">${amtLabel}</div>
    </div>`;
  }).join('');

  requestAnimationFrame(() => {
    chartEl.querySelectorAll('.income-bar-fill').forEach(bar => {
      const target = bar.dataset.target;
      setTimeout(() => { bar.style.height = target + 'px'; }, 50);
    });
  });
}



window.loadProfileData = async function() {
  if (!currentUser) return;
  
  try {
    // 1. Load identity from customers table (name, phone)
    const { data: customer } = await supabaseClient.from("customers").select("*").eq("id", currentUser.id).maybeSingle();
    
    // 2. Load professional details from technicians table
    let techData = null;
    const { data: techRows } = await supabaseClient.from("technicians").select("*").eq("id", currentUser.id).maybeSingle();
    
    if (techRows) {
        techData = techRows;
    } else {
        // Fallback search by name if ID was not linked yet
        const { data: techRowByName } = await supabaseClient.from("technicians").select("*").eq("name", customer?.name).maybeSingle();
        techData = techRowByName;
    }

    // --- Populate UI Sections ---
    
    // Section 1: Basic
    document.getElementById('editFullName').value = customer?.name || '';
    document.getElementById('editPhone').value = techData?.phone || customer?.phone || '';
    
    // Profile Image Preview (with cache busting)
    if (techData && techData.profile_image) {
        document.getElementById('profilePreview').src = techData.profile_image + '?t=' + Date.now();
    } else {
        document.getElementById('profilePreview').src = "https://ui-avatars.com/api/?name=" + encodeURIComponent(customer?.name || "ช่าง") + "&background=10b981&color=fff&bold=true";
    }
    
    // Section 2: Expertise
    document.getElementById('editCategory').value = techData?.category || 'ไฟฟ้า';
    document.getElementById('editSkillLevel').value = techData?.skill_level || 'ทั่วไป';
    document.getElementById('editExpYears').value = techData?.experience_years || '';
    document.getElementById('editExpertise').value = techData?.expertise || '';
    
    // Section 3: Location
    document.getElementById('editSubdistrict').value = techData?.subdistrict || '';
    document.getElementById('editDistrict').value = techData?.district || '';
    document.getElementById('editProvince').value = techData?.province || techData?.area || '';
    document.getElementById('editServiceArea').value = techData?.service_area || '';
    document.getElementById('editServiceDistance').value = techData?.service_distance || '';
    
    // GPS Coordinates (Aligned with Schema: latitude, longitude)
    document.getElementById('editLat').value = techData?.latitude || '';
    document.getElementById('editLng').value = techData?.longitude || '';
    
    // Section 4: Team & Rates
    document.getElementById('editTeamSize').value = techData?.team_size || '1';
    document.getElementById('editRateType').value = techData?.rate_type || 'รายวัน';
    document.getElementById('editDailyRate').value = techData?.daily_rate || '';
    
    // Checkboxes for Vehicle
    setCheckboxes('v_vehicle', techData?.vehicle);
    
    // Section 5: Tools & Points
    setCheckboxes('v_tools', techData?.tools);
    setCheckboxes('v_points', techData?.selling_points);
    
    // Section 6: Portfolio & Status
    document.getElementById('editPastWorkCount').value = techData?.past_work_count || '';
    document.getElementById('editPortfolio').value = techData?.portfolio || '';
    document.getElementById('editIsOnline').checked = techData?.is_online || false;
    
    if (techData && (techData.avatar_url || techData.profile_image)) {
        document.getElementById('profilePreview').src = techData.avatar_url || techData.profile_image;
    }
    
    updateStatusLabel(document.getElementById('editIsOnline'));
  } catch (err) {
    console.error("Error loading profile:", err);
  }
};

window.getCurrentLocation = function() {
  const btn = document.querySelector('button[onclick="getCurrentLocation()"]');
  const originalHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังรอพิกัด...';

  if (!navigator.geolocation) {
    Swal.fire({
      icon: 'error',
      title: 'ไม่รองรับ GPS',
      text: 'บราวเซอร์ของคุณไม่รองรับการดึงพิกัด GPS'
    });
    btn.disabled = false;
    btn.innerHTML = originalHtml;
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      document.getElementById('editLat').value = position.coords.latitude.toFixed(6);
      document.getElementById('editLng').value = position.coords.longitude.toFixed(6);
      
      Swal.fire({
        icon: 'success',
        title: 'ดึงพิกัดสำเร็จ!',
        text: 'เราได้ระบุตำแหน่งปัจจุบันของคุณเรียบร้อยแล้ว อย่าลืมกดบันทึกโปรไฟล์ด้วยนะครับ',
        timer: 3000,
        showConfirmButton: false
      });
      
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-check"></i> ดึงพิกัดสำเร็จ';
      setTimeout(() => {
          btn.innerHTML = originalHtml;
      }, 3000);
    },
    (error) => {
      let msg = "ไม่สามารถดึงพิกัดได้";
      if (error.code === 1) msg = "กรุณาอนุญาตให้เข้าถึงตำแหน่งที่ตั้ง (Location Permission)";
      
      Swal.fire({
        icon: 'error',
        title: 'เกิดข้อผิดพลาด',
        text: msg
      });
      btn.disabled = false;
      btn.innerHTML = originalHtml;
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
};

// Helper to set checkbox states from a DB string (commas)
function setCheckboxes(name, valueString) {
    if (!valueString) return;
    const values = valueString.split(',').map(v => v.trim());
    const checkboxes = document.querySelectorAll(`input[name="${name}"]`);
    checkboxes.forEach(cb => {
        cb.checked = values.includes(cb.value);
    });
}

// Helper to get selected checkbox values as a CSV string
function getCheckboxes(name) {
    const selected = Array.from(document.querySelectorAll(`input[name="${name}"]:checked`)).map(cb => cb.value);
    return selected.length > 0 ? selected.join(', ') : '';
}

// ===== REVIEWS DATA =====
window.loadReviewsData = async function () {
    const container = document.getElementById('reviewsContainer');
    if (!container) return;

    container.innerHTML = '<div style="text-align:center; padding:40px; color:#65676b;"><i class="fa-solid fa-spinner fa-spin" style="font-size:24px;"></i><div style="margin-top:12px;">กำลังโหลดรีวิว...</div></div>';

    try {
        const { data: reviews, error } = await supabaseClient
            .from('reviews')
            .select('*')
            .eq('technician_id', currentUser.id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (reviews && reviews.length > 0) {
            const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
            const avgRating = (totalRating / reviews.length).toFixed(1);

            document.getElementById('avgRatingValue').innerText = avgRating;
            document.getElementById('totalReviewsCount').innerText = reviews.length;

            let html = '<div style="display: flex; flex-direction: column; gap: 16px;">';
            reviews.forEach(r => {
                const date = new Date(r.created_at).toLocaleDateString('th-TH', { 
                    day: 'numeric', 
                    month: 'long', 
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
                const stars = '⭐'.repeat(r.rating);
                
                html += `
                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; transition: transform 0.2s; cursor: default;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                            <div style="display: flex; align-items: center; gap: 12px;">
                                <div style="width: 40px; height: 40px; border-radius: 50%; background: #e2e8f0; display: flex; align-items: center; justify-content: center; color: #64748b; font-weight: 700;">
                                    ${(r.customer_name || 'C').charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <div style="font-weight: 700; color: #1e293b; font-size: 15px;">${r.customer_name || 'ลูกค้าทั่วไป'}</div>
                                    <div style="font-size: 12px; color: #94a3b8;">${date}</div>
                                </div>
                            </div>
                            <div style="display: flex; align-items: center; gap: 4px; background: #fff7ed; padding: 4px 10px; border-radius: 20px; border: 1px solid #ffedd5;">
                                <span style="color: #f59e0b; font-size: 13px;">${stars}</span>
                                <span style="font-weight: 800; color: #ea580c; font-size: 13px;">${r.rating}.0</span>
                            </div>
                        </div>
                        <div style="color: #475569; font-size: 14px; line-height: 1.6; padding-left: 52px;">
                            ${r.comment || '<i style="color:#94a3b8">ไม่มีข้อความรีวิว</i>'}
                        </div>
                    </div>
                `;
            });
            html += '</div>';
            container.innerHTML = html;
        } else {
            document.getElementById('avgRatingValue').innerText = "0.0";
            document.getElementById('totalReviewsCount').innerText = "0";
            container.innerHTML = `
                <div style="text-align:center; padding:60px 20px; color:#94a3b8;">
                    <i class="fa-solid fa-star-half-stroke" style="font-size:48px; color:#e2e8f0; display:block; margin-bottom:16px;"></i>
                    <div style="font-size:16px; font-weight:700; color:#475569; margin-bottom:6px;">ยังไม่มีรีวิว</div>
                    <div style="font-size:13px;">รีวิวจากลูกค้าจะปรากฏที่นี่หลังจากงานเสร็จสิ้น</div>
                </div>
            `;
        }
    } catch (err) {
        console.error("Error loading reviews:", err);
        container.innerHTML = `<div style="padding:20px; text-align:center; color:#ef4444;">เกิดข้อผิดพลาด: ${err.message}</div>`;
    }
};

window.updateProfile = async function() {
  const btn = document.getElementById('btnSaveProfile');
  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังบันทึก...';
  
  const updates = {
    // Basic from profiles table
    full_name: document.getElementById('editFullName').value,
    
    // Tech details
    phone: document.getElementById('editPhone').value,
    category: document.getElementById('editCategory').value,
    skill_level: document.getElementById('editSkillLevel').value,
    experience_years: document.getElementById('editExpYears').value,
    expertise: document.getElementById('editExpertise').value,
    
    subdistrict: document.getElementById('editSubdistrict').value,
    district: document.getElementById('editDistrict').value,
    province: document.getElementById('editProvince').value,
    area: document.getElementById('editProvince').value, // legacy alignment
    service_area: document.getElementById('editServiceArea').value,
    service_distance: document.getElementById('editServiceDistance').value ? Number(document.getElementById('editServiceDistance').value) : null,
    
    // GPS (Aligned with Schema: latitude, longitude)
    latitude: document.getElementById('editLat').value ? Number(document.getElementById('editLat').value) : null,
    longitude: document.getElementById('editLng').value ? Number(document.getElementById('editLng').value) : null,
    
    team_size: document.getElementById('editTeamSize').value,
    vehicle: getCheckboxes('v_vehicle'),
    rate_type: document.getElementById('editRateType').value,
    daily_rate: document.getElementById('editDailyRate').value ? Number(document.getElementById('editDailyRate').value) : null,
    
    tools: getCheckboxes('v_tools'),
    selling_points: getCheckboxes('v_points'),
    
    past_work_count: document.getElementById('editPastWorkCount').value ? Number(document.getElementById('editPastWorkCount').value) : null,
    portfolio: document.getElementById('editPortfolio').value,
    is_online: document.getElementById('editIsOnline').checked
  };

  try {
    // 0. Handle Profile Image Upload (Storage)
    const avatarInput = document.getElementById('avatarInput');
    
    // Fetch current data to preserve existing image if no new one is uploaded
    const { data: existingTech } = await supabaseClient.from("technicians").select("profile_image").eq("id", currentUser.id).maybeSingle();
    let profileImageUrl = existingTech?.profile_image || null;
    
    if (avatarInput && avatarInput.files && avatarInput.files[0]) {
        const file = avatarInput.files[0];
        const fileExt = file.name.split('.').pop();
        const fileName = `profile_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `technicians/${fileName}`;

        const { error: uploadError } = await supabaseClient.storage
            .from('technician-images') // Correct bucket identified via subagent
            .upload(filePath, file);

        if (uploadError) {
            console.error("Storage Error:", uploadError);
            throw new Error("ไม่สามารถอัปโหลดรูปภาพได้: " + uploadError.message);
        }

        const { data: { publicUrl } } = supabaseClient.storage
            .from('technician-images')
            .getPublicUrl(filePath);
        
        profileImageUrl = publicUrl;
    }

    // 1. Update identity in customers table (Sync avatar_url for universal identity)
    const { error: customerErr } = await supabaseClient.from('customers').upsert({ 
        id: currentUser.id, 
        name: updates.full_name,
        phone: updates.phone,
        avatar_url: profileImageUrl, // Syncing with technicians.profile_image
        updated_at: new Date()
    });
    if (customerErr) throw customerErr;

    // 2. Update profiles table
    await supabaseClient.from('profiles').upsert({ id: currentUser.id, role: 'technician' });

    // 3. Update technicians table
    const techRecord = { ...updates, name: updates.full_name, profile_image: profileImageUrl };
    delete techRecord.full_name;

    const { data: techCheck } = await supabaseClient.from('technicians').select('id').eq('id', currentUser.id).maybeSingle();
    
    let techUpdateErr;
    if (techCheck) {
        const { error } = await supabaseClient.from('technicians').update(techRecord).eq('id', currentUser.id);
        techUpdateErr = error;
    } else {
        const { error } = await supabaseClient.from('technicians').upsert({ ...techRecord, id: currentUser.id });
        techUpdateErr = error;
    }
    
    if (techUpdateErr) throw techUpdateErr;

    // --- Post-Save UI Updates ---
    // Update Nav bar image and name immediately
    document.getElementById("navUserName").innerText = updates.full_name;
    const navAvatar = document.querySelector('.tech-profile .avatar img');
    if (navAvatar && profileImageUrl) {
        navAvatar.src = profileImageUrl + '?t=' + Date.now();
    }
    
    // Refresh form data
    await loadProfileData();

    Swal.fire({
      icon: 'success',
      title: 'บันทึกสำเร็จ',
      text: 'ข้อมูลโปรไฟล์มืออาชีพของคุณถูกอัปเดตเรียบร้อยแล้ว',
      timer: 2000,
      showConfirmButton: false
    });
    
    // Update top nav name
    document.getElementById("navUserName").innerText = updates.full_name;

  } catch (err) {
    console.error("Error updating profile:", err);
    Swal.fire({
      icon: 'error',
      title: 'ล้มเหลว',
      text: 'ไม่สามารถบันทึกข้อมูลได้: ' + err.message
    });
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
};

window.previewAvatar = function(event) {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      document.getElementById('profilePreview').src = e.target.result;
    };
    reader.readAsDataURL(file);
  }
};

window.updateStatusLabel = function(checkbox) {
  const label = document.getElementById('statusLabel');
  if (checkbox.checked) {
    label.innerText = 'Online (พร้อมรับงาน)';
    label.style.color = '#10b981';
  } else {
    label.innerText = 'Offline (ปิดรับงาน)';
    label.style.color = '#ef4444';
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

    let statusPrefix = job.status || 'รอดำเนินการ';
    let problemBrief = job.problem_detail ? ` - ${job.problem_detail.substring(0, 20)}${job.problem_detail.length > 20 ? '...' : ''}` : '';

    return {
      id: job.id,
      title: `[#${job.id}] [${statusPrefix}] ${job.customer_name || 'ไม่ระบุชื่อ'}${problemBrief}`,
      start: (job.service_date && job.service_time) ? `${job.service_date}T${job.service_time}` : (job.service_date || new Date().toISOString()),
      backgroundColor: color,
      borderColor: color,
      extendedProps: {
        status: statusPrefix,
        customer: job.customer_name,
        problem: job.problem_detail
      }
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

  const isLocked = !!(inv && inv.slip_url);
  let dateStr = job.service_date ? new Date(job.service_date).toLocaleDateString('th-TH') : "-";

  const modalBody = document.getElementById('jobModalBody');
  modalBody.innerHTML = `
    <div style="background:#f8fafc; padding:16px; border-radius:8px; margin-bottom:16px; border:1px solid #e2e8f0;">
      <h4 style="margin:0 0 12px 0; color:#0f172a; display:flex; justify-content:space-between;">
        <span>#JOB-${job.id}</span>
        <span style="font-size:13px; font-weight:normal; color:#64748b; background: #e0e7ff; padding: 2px 8px; border-radius: 4px;">${job.category || 'ทั่วไป'}</span>
      </h4>
      
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
        <div style="background:white; padding:10px; border-radius:8px; border:1px solid #f1f5f9;">
          <small style="color:#64748b; display:block; margin-bottom:4px;">ชื่อลูกค้า:</small>
          <span style="font-weight:600; display:block;">${job.customer_name || '-'}</span>
          <span style="font-size:12px; color:var(--primary); cursor:pointer;" onclick="window.open('tel:${job.customer_phone}')"><i class="fa-solid fa-phone"></i> ${job.customer_phone || '-'}</span>
        </div>
        <div style="background:white; padding:10px; border-radius:8px; border:1px solid #f1f5f9;">
          <small style="color:#64748b; display:block; margin-bottom:4px;">งบประมาณ/ราคา:</small>
          <span style="font-weight:700; color:#10b981; font-size:16px;">฿${(Number(job.payment_amount) || 0).toLocaleString()}</span>
        </div>
      </div>

      <div style="background:white; padding:10px; border-radius:8px; border:1px solid #f1f5f9; margin-bottom:12px;">
        <small style="color:#64748b; display:block; margin-bottom:4px;">เวลานัดหมาย:</small>
        <span style="font-weight:600;"><i class="fa-regular fa-calendar-check"></i> ${dateStr} | <i class="fa-regular fa-clock"></i> ${job.service_time || '-'}</span>
      </div>

      <div style="background:white; padding:10px; border-radius:8px; border:1px solid #f1f5f9; margin-bottom:12px;">
        <small style="color:#64748b; display:block; margin-bottom:4px;">สถานที่รับบริการ:</small>
        <span style="font-weight:600;"><i class="fa-solid fa-location-dot" style="color:#ef4444;"></i> ${job.subdistrict || '-'}, ${job.district || '-'}, ${job.province || '-'}</span>
      </div>

      <div style="border-top:1px dashed #cbd5e1; margin-top:12px; padding-top:12px;">
        <p style="color:#64748b; margin-bottom:8px; font-size:13px; font-weight:600;">รายละเอียดอาการ/สิ่งที่ต้องทำ:</p>
        <p style="margin:0 0 12px 0; line-height:1.5; color:#334155;">${job.problem_detail || '-'}</p>
        
        ${job.problem_image ? `
          <p style="color:#64748b; margin-bottom:8px; font-size:13px;">รูปภาพปัญหาจากลูกค้า:</p>
          <div style="cursor:pointer;" onclick="window.open('${job.problem_image}', '_blank')">
             <img src="${job.problem_image}" style="width:100%; max-height:200px; object-fit:cover; border-radius:8px; border:1px solid #e2e8f0;">
          </div>
        ` : ''}
      </div>
    </div>
    
    <div class="form-group">
      <label class="form-label">อัปเดตสถานะงาน (Status)</label>
      <select id="editJobStatus" class="form-select" onchange="togglePriceInput(this.value)" ${isLocked ? 'disabled' : ''}>
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
            <input type="text" id="techPhoneInput" class="receipt-input-small" style="width:140px; text-align:left;" placeholder="เบอร์โทรช่าง" value="${inv ? (inv.tech_phone || currentUserPhone || '') : (currentUserPhone || '')}" ${isLocked ? 'readonly' : ''}>
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
          <div><input type="number" id="costLabor" class="receipt-input-small" placeholder="0" oninput="calculateTotal()" value="${inv ? inv.labor_cost : ''}" ${isLocked ? 'readonly' : ''}> <span style="margin-left:4px;">บาท</span></div>
        </div>
        
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <span style="color: #64748b;">ค่าวัสดุ อุปกรณ์:</span>
            ${isLocked ? '' : `<span style="font-size:12px; color:var(--primary); cursor:pointer; font-weight:600;" onclick="addMaterialField()">+ เพิ่มรายการ</span>`}
          </div>
          <div id="materialListContainer" style="background:#f8fafc; padding:8px; border-radius:6px; margin-bottom:8px;">
             ${inv && inv.materials_detail && inv.materials_detail.length > 0 ?
      inv.materials_detail.map(m => `
                 <div class="material-item" style="display:flex; gap:8px; margin-bottom:8px;">
                    <input type="text" class="receipt-input-small mat-name" style="flex:1; text-align:left;" placeholder="ชื่อวัสดุ" value="${m.name}" ${isLocked ? 'readonly' : ''}>
                    <input type="number" class="receipt-input-small mat-price" style="width:70px;" placeholder="ราคา" oninput="calculateTotal()" value="${m.price}" ${isLocked ? 'readonly' : ''}>
                    ${isLocked ? '' : `<button class="action-btn" style="width:28px; height:28px; padding:0; color:white; background:var(--danger); border:none;" onclick="this.parentElement.remove(); calculateTotal();"><i class="fa-solid fa-trash" style="font-size:12px;"></i></button>`}
                 </div>
                `).join('')
      :
      `<div class="material-item" style="display:flex; gap:8px; margin-bottom:8px;">
                    <input type="text" class="receipt-input-small mat-name" style="flex:1; text-align:left;" placeholder="ชื่อวัสดุ" ${isLocked ? 'readonly' : ''}>
                    <input type="number" class="receipt-input-small mat-price" style="width:70px;" placeholder="ราคา" oninput="calculateTotal()" ${isLocked ? 'readonly' : ''}>
                 </div>`
    }
          </div>
          <div style="text-align:right; font-size:13px;">
             <span style="color:#64748b;">รวมค่าวัสดุ: </span>
             <span id="costMaterialTotal" style="font-weight:700; color:#0f172a;">${inv ? Number(inv.material_cost).toLocaleString('th-TH') : '0'}</span> <span>บาท</span>
          </div>


        <div class="receipt-row" style="align-items:center;">
          <span style="color: #64748b;">ค่าเดินทาง:</span>
          <div><input type="number" id="costTravel" class="receipt-input-small" placeholder="0" oninput="calculateTotal()" value="${inv ? inv.travel_cost : ''}" ${isLocked ? 'readonly' : ''}> <span style="margin-left:4px;">บาท</span></div>
        </div>
        <div class="receipt-row" style="align-items:center;">
          <span style="color: #64748b;">ค่าบริการ (Service):</span>
          <div><input type="number" id="costService" class="receipt-input-small" placeholder="0" oninput="calculateTotal()" value="${inv ? inv.service_fee : ''}" ${isLocked ? 'readonly' : ''}> <span style="margin-left:4px;">บาท</span></div>
        </div>
        
        <div style="border-top: 2px dashed #cbd5e1; padding-top: 16px; margin-top: 16px; background: #f1f5f9; padding: 12px; border-radius: 10px;">
           <!-- Discount (If Any) -->
           ${(job.discount_amount && job.discount_amount > 0) ? `
           <div class="receipt-row" style="margin-bottom: 10px; color: var(--danger); font-weight: 600; font-size: 14px;">
             <span>🏷️ ส่วนลด (${job.promo_code || 'โปรโมชั่น'}):</span>
             <span>- ฿${Number(job.discount_amount).toLocaleString('th-TH')}</span>
           </div>
           <input type="hidden" id="costDiscount" value="${job.discount_amount}">
           ` : '<input type="hidden" id="costDiscount" value="0">'}
           
           <!-- Total -->
           <div style="display: flex; justify-content: space-between; align-items: center;">
             <span style="font-size: 16px; font-weight: 700; color: #0f172a;">💰 รวมสุทธิ:</span>
             <div style="text-align: right;">
                <span id="labelTotalCost" style="color:var(--primary); font-size:24px; font-weight: 800;">${inv ? Number(inv.total_amount).toLocaleString('th-TH') : '0'}</span> 
                <span style="font-size:14px; font-weight: 700; margin-left:4px; color: var(--primary);">บาท</span>
             </div>
           </div>
           <input type="hidden" id="editJobPrice" value="${inv ? inv.total_amount : '0'}">
        </div>
        
        <!-- Status & Note -->
        <div class="receipt-row" style="margin-top:20px;">
          <span style="color: #64748b; font-weight:600;">สถานะ:</span>
          <span id="receiptStatusLabel" style="color:${(inv && inv.status === 'ชำระเงินแล้ว') ? 'var(--success)' : 'var(--warning)'}; font-weight:700;">${inv ? inv.status : 'รอชำระ'}</span>
        </div>
        <div style="margin-top:12px; font-size:13px;">
          <span style="color: #64748b; display:block; margin-bottom:6px; font-weight:600;">หมายเหตุ:</span>
          <textarea id="jobNote" rows="2" style="width:100%; padding:10px; border:1px solid var(--border); border-radius:6px; font-family:inherit; font-size:13px;" placeholder="ระบุหมายเหตุเพิ่มเติม (ถ้ามี)" ${isLocked ? 'readonly' : ''}>${inv ? inv.note : ''}</textarea>
        </div>
      </div>
    </div>
  `;

  document.getElementById('jobModalFooter').innerHTML = `
    <div style="width:100%; display:flex; justify-content:${job.status === 'เสร็จสิ้น' ? 'space-between' : 'flex-end'}; align-items:center;">
      ${job.status === 'เสร็จสิ้น' ? `
          <button class="btn" style="background:#10b981; color:white; border:none; padding:8px 16px; font-weight:600; border-radius:6px; cursor:pointer;" onclick="showPromptPayQR(${inv ? inv.total_amount : 0}, '${jobId}', '${inv ? (inv.slip_url || '') : ''}')">
            <i class="fa-solid fa-qrcode" style="margin-right:6px;"></i> แสดงใบเสร็จ / QR
          </button>
      ` : ''}
      <div style="display:flex; gap:8px;">
         <button class="btn" style="background:#e0e7ff; color:var(--primary); border:1px solid var(--primary); padding:8px 16px; font-weight:600; border-radius:6px; cursor:pointer;" onclick="openChat('${job.customer_id}', '${job.customer_name}')">
            <i class="fa-solid fa-comment-dots" style="margin-right:6px;"></i> แชทพูดคุย
         </button>
         <button class="btn btn-outline" onclick="closeJobModal()">${isLocked ? 'ปิดหน้าต่าง' : 'ปิดงาน'}</button>
         ${isLocked ? '' : `<button class="btn btn-primary" onclick="saveJobStatus()">บันทึกอัปเดต</button>`}
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

window.showPromptPayQR = function (amount, jobId, existingSlipUrl = '') {
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
          <img src="https://itp1.itopfile.com/ImageGallery/Itp1/Resources/prompt-pay-logo.png" style="height:24px;" alt="PromptPay">
       </p>

       <!-- Slip Upload Section -->
       <div style="margin-top:24px; padding-top:20px; border-top:1px dashed var(--border);">
          <input type="file" id="slipInput" accept="image/*" style="display:none;" onchange="handleSlipUpload(event, '${jobId}')">
          <button class="btn btn-outline" style="width:100%; justify-content:center; border-style:dashed; color:var(--primary); border-color:var(--primary);" onclick="document.getElementById('slipInput').click()">
             <i class="fa-solid fa-cloud-arrow-up" style="margin-right:8px;"></i> คลิกเพื่ออัปโหลดสลิป
          </button>
          <div id="slipStatus" style="font-size:13px; color:var(--text-muted); margin-top:12px;">
             ${existingSlipUrl ? `
               <div style="margin-top:10px;">
                 <span style="display:block; margin-bottom:8px; color:var(--success); font-weight:600;">✅ สลิปที่อัปโหลดแล้ว:</span>
                 <img src="${existingSlipUrl}" style="max-width:100%; height:200px; object-fit:contain; border-radius:8px; border:1px solid #e2e8f0; background:#f8fafc;">
               </div>
             ` : ''}
          </div>
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
    // Show local preview immediately
    const reader = new FileReader();
    reader.onload = function(e) {
      statusEl.innerHTML = `
        <div style="margin-top:10px;">
          <span style="display:block; margin-bottom:8px; color:var(--warning); font-weight:600;"><i class="fa-solid fa-spinner fa-spin"></i> กำลังเตรียมไฟล์...</span>
          <img src="${e.target.result}" style="max-width:100%; height:200px; object-fit:contain; border-radius:8px; border:1px solid #e2e8f0; opacity:0.6;">
        </div>
      `;
    };
    reader.readAsDataURL(file);

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
       <div style="margin-top:10px;">
         <span style="display:block; margin-bottom:8px; color:var(--success); font-weight:600;"><i class="fa-solid fa-check-circle"></i> อัปโหลดสลิปสำเร็จ!</span>
         <img src="${slipUrl}" style="max-width:100%; height:200px; object-fit:contain; border-radius:8px; border:2px solid var(--success); box-shadow:var(--shadow-md);">
       </div>
    `;

    // Update UI status color after slip upload if modal is open
    const recStatus = document.getElementById('receiptStatusLabel');
    if (recStatus) {
      recStatus.innerText = 'ชำระเงินแล้ว';
      recStatus.style.color = 'var(--success)';
    }

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
  const discount = Number(document.getElementById('costDiscount')?.value) || 0;

  let materialTotal = 0;
  const matPrices = document.querySelectorAll('.mat-price');
  matPrices.forEach(input => {
    materialTotal += (Number(input.value) || 0);
  });

  const matTotalEl = document.getElementById('costMaterialTotal');
  if (matTotalEl) matTotalEl.innerText = materialTotal.toLocaleString('th-TH');

  const subtotal = labor + materialTotal + travel + service;
  const total = Math.max(0, subtotal - discount);

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
    
    // Update the payment_amount in the bookings table updateData
    updateData.payment_amount = Number(priceVal);

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
      tech_phone: document.getElementById("techPhoneInput")?.value || null,
      promo_code: job ? job.promo_code : null,
      discount_amount: job ? (Number(job.discount_amount) || 0) : 0,
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

// ===== SETTINGS LOGIC =====

window.updatePassword = async function() {
  const newPwd = document.getElementById('settingNewPwd').value;
  const confirmPwd = document.getElementById('settingConfirmPwd').value;
  const btn = document.getElementById('btnUpdatePwd');

  if (!newPwd || !confirmPwd) {
    Swal.fire({ icon: 'warning', title: 'ข้อมูลไม่ครบถ้วน', text: 'กรุณากรอกรหัสผ่านใหม่ให้ครบถ้วน', confirmButtonColor: 'var(--primary)' });
    return;
  }

  if (newPwd !== confirmPwd) {
    Swal.fire({ icon: 'error', title: 'รหัสผ่านไม่ตรงกัน', text: 'กรุณายืนยันรหัสผ่านใหม่ให้ตรงกัน', confirmButtonColor: 'var(--primary)' });
    return;
  }

  if (newPwd.length < 6) {
    Swal.fire({ icon: 'warning', title: 'รหัสผ่านสั้นเกินไป', text: 'รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร', confirmButtonColor: 'var(--primary)' });
    return;
  }

  const originalContent = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังเปลี่ยนรหัสผ่าน...';

  try {
    const { error } = await supabaseClient.auth.updateUser({ password: newPwd });
    
    if (error) throw error;

    Swal.fire({
      icon: 'success',
      title: 'เปลี่ยนรหัสผ่านสำเร็จ',
      text: 'รหัสผ่านของคุณถูกอัปเดตเรียบร้อยแล้ว',
      confirmButtonColor: 'var(--success)'
    });
    
    document.getElementById('settingNewPwd').value = '';
    document.getElementById('settingConfirmPwd').value = '';

  } catch (err) {
    Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: err.message, confirmButtonColor: 'var(--primary)' });
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalContent;
  }
};

window.toggleSetting = function(type, isEnabled) {
  const stateStr = isEnabled ? "เปิดใช้งาน" : "ปิดใช้งาน";
  let title = "";
  if (type === 'chat') title = `💬 ${stateStr}แจ้งเตือนแชท`;
  if (type === 'email') title = `📧 ${stateStr}แจ้งเตือนอีเมล`;

  Swal.fire({
    toast: true,
    position: 'top-end',
    icon: 'success',
    title: title,
    showConfirmButton: false,
    timer: 2000,
    timerProgressBar: true
  });
};

window.changeLanguage = function(lang) {
  Swal.fire({
    icon: 'info',
    title: 'เร็วๆ นี้',
    text: 'ฟีเจอร์สลับภาษากำลังพัฒนา จะพร้อมใช้งานในอนาคตอันใกล้',
    confirmButtonColor: 'var(--primary)'
  });
};

window.deactivateAccount = function() {
  Swal.fire({
    icon: 'warning',
    title: 'ต้องการระงับบัญชีใช่หรือไม่?',
    text: 'การระงับบัญชีจะปิดการมองเห็นโปรไฟล์ของคุณจากลูกค้า หากต้องการระงับกรุณายืนยัน',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#cbd5e1',
    confirmButtonText: 'ระงับบัญชี',
    cancelButtonText: 'ยกเลิก'
  }).then((result) => {
    if (result.isConfirmed) {
      Swal.fire({
        icon: 'error',
        title: 'ระบบป้องกัน',
        text: 'กรุณาติดต่อแอดมินเพื่อระงับบัญชีของคุณอย่างถาวร',
        confirmButtonColor: 'var(--primary)'
      });
    }
  });
};
