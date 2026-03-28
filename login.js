// ===== CONFIGURATION =====
const SUPABASE_URL = "https://uqcjajmqtlchftpqwsrp.supabase.co";
const SUPABASE_KEY = "sb_publishable_yWZiH8l1idY0QWGuj6p9sg_GqXPONGX";

// ===== SUPABASE CLIENT =====
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ===== REDIRECT HELPER =====
function redirectByRole(userRole) {
  let redirectPage = "index.html";
  
  if (userRole === "admin") {
    redirectPage = "admin.html";
  } else if (userRole === "technician") {
    redirectPage = "technician-dashboard.html";
  }
  
  console.log("🎯 REDIRECTING TO:", redirectPage, "| ROLE:", userRole);
  window.location.href = redirectPage;
}

// ===== LOGIN FUNCTION =====
async function handleLogin(e) {
  e.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const loginBtn = document.getElementById("loginBtn");
  const errorMessage = document.getElementById("errorMessage");

  if (!email || !password) {
    showError("กรุณากรอกอีเมลและรหัสผ่าน");
    return;
  }

  loginBtn.disabled = true;
  loginBtn.innerText = "กำลังเข้าสู่ระบบ...";
  errorMessage.classList.remove("show");

  try {
    // 🔐 LOGIN
    console.log("📝 ATTEMPTING LOGIN WITH EMAIL:", email);
    
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      console.error("❌ AUTH ERROR:", error);
      showError("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
      return;
    }

    const user = data.user;
    console.log("✅ LOGIN SUCCESS");
    console.log("USER ID:", user.id);
    console.log("USER EMAIL:", user.email);

    // 👤 ดึง role จากตาราง profiles
    console.log("🔄 FETCHING PROFILE...");

    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    console.log("========== DEBUG LOGIN ==========");
    console.log("USER ID:", user.id);
    console.log("PROFILE DATA:", JSON.stringify(profile));
    console.log("PROFILE ERROR:", JSON.stringify(profileError));
    console.log("ROLE VALUE:", profile?.role || "UNDEFINED");
    console.log("================================");

    if (profileError) {
      console.error("❌ PROFILE FETCH FAILED:", profileError.message || profileError);
      console.error("ERROR DETAILS:", profileError);
    }

    // กำหนดค่าเริ่มต้น ถ้าหา role ไม่เจอให้ถือว่าเป็นลูกค้า (customer)
    let userRole = profile?.role || "customer";
    console.log("📍 FINAL ROLE:", userRole);

    // ✅ บันทึก flag เพื่อไม่ให้ checkExistingSession ทำงาน
    sessionStorage.setItem("justLoggedIn", "true");

    // 🎯 redirect ตาม role หลังจาก 300ms
    console.log("⏱️ SCHEDULING REDIRECT IN 300ms...");
    setTimeout(() => {
      redirectByRole(userRole);
    }, 300);

  } catch (err) {
    console.error("❌ CATCH ERROR:", err);
    console.error("ERROR STACK:", err.stack);
    showError("เกิดข้อผิดพลาด: " + (err.message || "ไม่ทราบสาเหตุ"));
  } finally {
    loginBtn.disabled = false;
    loginBtn.innerText = "เข้าสู่ระบบ";
  }
}

// ===== ERROR DISPLAY =====
function showError(message) {
  const errorMessage = document.getElementById("errorMessage");
  errorMessage.innerText = message;
  errorMessage.classList.add("show");

  setTimeout(() => {
    errorMessage.classList.remove("show");
  }, 5000);
}

// ===== GOOGLE LOGIN =====
async function signInWithGoogle() {
  const btn = document.querySelector('.btn-google');
  if(btn) {
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner" style="display:inline-block; margin-right:8px; width:16px; height:16px; border:2px solid #757575; border-top-color:transparent; border-radius:50%; animation:spin 1s linear infinite;"></span> กำลังเชื่อมต่อ Google...`;
  }
  
  try {
    const { data, error } = await supabaseClient.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/index.html'
      }
    });

    if (error) throw error;
  } catch (err) {
    console.error("❌ Google Login Error:", err);
    showError("เกิดข้อผิดพลาดในการเชื่อมต่อ Google");
    if(btn) {
      btn.disabled = false;
      btn.innerHTML = `<img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="Google" width="20" style="margin-right: 8px;"> เข้าสู่ระบบด้วย Google`;
    }
  }
}

// ===== LINE LOGIN =====
async function signInWithLine() {
  const btn = document.querySelector('.btn-line');
  if(btn) {
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner" style="display:inline-block; margin-right:8px; width:16px; height:16px; border:2px solid #fff; border-top-color:transparent; border-radius:50%; animation:spin 1s linear infinite;"></span> กำลังเชื่อมต่อ LINE...`;
  }
  
  try {
    const { data, error } = await supabaseClient.auth.signInWithOAuth({
      provider: 'custom:line',
      options: {
        redirectTo: window.location.origin + '/index.html'
      }
    });

    if (error) throw error;
  } catch (err) {
    console.error("❌ LINE Login Error:", err);
    showError("เกิดข้อผิดพลาดในการเชื่อมต่อ LINE");
    if(btn) {
      btn.disabled = false;
      btn.innerHTML = `<img src="https://upload.wikimedia.org/wikipedia/commons/4/41/LINE_logo.svg" alt="LINE" width="20" style="margin-right: 8px;"> เข้าสู่ระบบด้วย LINE`;
    }
  }
}

// ===== SESSION CHECK (for existing sessions only) =====
async function checkExistingSession() {
  console.log("🔍 CHECKING EXISTING SESSION...");

  // ✅ ข้ามการตรวจสอบถ้าเพิ่งเข้าสู่ระบบ
  if (sessionStorage.getItem("justLoggedIn") === "true") {
    sessionStorage.removeItem("justLoggedIn");
    console.log("⏭️ SKIPPING SESSION CHECK - JUST LOGGED IN");
    return;
  }

  try {
    const { data: { session } } = await supabaseClient.auth.getSession();

    if (!session) {
      console.log("ℹ️ NO EXISTING SESSION FOUND");
      return;
    }

    console.log("✅ EXISTING SESSION FOUND");
    console.log("USER ID:", session.user.id);
    console.log("USER EMAIL:", session.user.email);

    console.log("🔄 FETCHING SESSION PROFILE...");

    const { data: profile, error } = await supabaseClient
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .maybeSingle();

    console.log("========== DEBUG SESSION ==========");
    console.log("SESSION USER ID:", session.user.id);
    console.log("PROFILE DATA:", JSON.stringify(profile));
    console.log("PROFILE ERROR:", JSON.stringify(error));
    console.log("ROLE VALUE:", profile?.role || "UNDEFINED");
    console.log("==================================");

    if (error) {
      console.error("❌ SESSION PROFILE FETCH ERROR:", error.message || error);
      console.error("ERROR DETAILS:", error);
    }

    let userRole = profile?.role || "customer";
    console.log("📍 SESSION FINAL ROLE:", userRole);

    redirectByRole(userRole);

  } catch (error) {
    console.error("❌ SESSION CHECK ERROR:", error);
    console.error("ERROR STACK:", error.stack);
  }
}

// ===== INIT =====
document.addEventListener("DOMContentLoaded", () => {
  // ตรวจสอบว่ามาจากการสมัครสมาชิกหรือไม่
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('signup') === 'success') {
    const msgDiv = document.getElementById("errorMessage");
    msgDiv.innerText = "🎉 สมัครสมาชิกสำเร็จ! กรุณาตรวจสอบและยืนยันอีเมลของคุณก่อนเข้าสู่ระบบ";
    
    // ปรับแต่งให้เป็นข้อความสีเขียว (Success)
    msgDiv.style.backgroundColor = "rgba(40, 167, 69, 0.2)";
    msgDiv.style.color = "#2dfc52"; 
    msgDiv.style.border = "1px solid #2dfc52";
    msgDiv.classList.add("show");
    
    // ลบ signup=success ออกจาก URL เพื่อไม่ให้ข้อความแสดงซ้ำเมื่อรีเฟรชหน้า
    window.history.replaceState({}, document.title, window.location.pathname);
    
    setTimeout(() => {
      msgDiv.classList.remove("show");
      // คืนค่าสไตล์เดิมหลังจากซ่อนข้อความไปแล้ว เผื่อใช้แสดง error สีแดงต่อ
      setTimeout(() => {
        msgDiv.style.backgroundColor = "";
        msgDiv.style.color = "";
        msgDiv.style.border = "";
      }, 500);
    }, 8000); // แสดงข้อความ 8 วินาที
  }

  // ทำงานตรวจสอบ session ตามปกติ
  checkExistingSession();
});