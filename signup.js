// ===== CONFIGURATION =====
const SUPABASE_URL = "https://uqcjajmqtlchftpqwsrp.supabase.co";
const SUPABASE_KEY = "sb_publishable_yWZiH8l1idY0QWGuj6p9sg_GqXPONGX";

// ===== SUPABASE CLIENT =====
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ===== SIGNUP FUNCTION =====
/**
 * Handle signup form submission
 */
async function handleSignup(e) {
  e.preventDefault();

  const name = document.getElementById("name").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const confirmPassword = document.getElementById("confirmPassword").value;
  const signupBtn = document.getElementById("signupBtn");
  const errorMessage = document.getElementById("errorMessage");

  // Validation
  if (!name || !phone || !email || !password || !confirmPassword) {
    showError("กรุณากรอกข้อมูลให้ครบถ้วน");
    return;
  }

  if (password.length < 6) {
    showError("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
    return;
  }

  if (password !== confirmPassword) {
    showError("รหัสผ่านไม่ตรงกัน");
    return;
  }

  // Disable button and show loading state
  signupBtn.disabled = true;
  signupBtn.innerText = "กำลังสร้างบัญชี...";
  errorMessage.classList.remove("show");

  try {
    console.log('🔐 Attempting signup with:', email);

    // Sign up user
    const { data: { user }, error: signupError } = await supabaseClient.auth.signUp({
      email: email,
      password: password
    });

    if (signupError) {
      console.error("❌ Signup error:", signupError);
      showError(signupError.message);
      return;
    }

    console.log("✅ Signup successful:", user.email);

    // 1. Create entry in profiles table for authentication role check (Default to customer)
    const { error: authProfileError } = await supabaseClient
      .from("profiles")
      .insert([{
        id: user.id,
        role: "customer"
      }]);

    if (authProfileError) {
      console.error("❌ Profiles creation error:", authProfileError);
    }

    // 2. Create customer profile
    const { error: profileError } = await supabaseClient
      .from("customers")
      .insert([{
        id: user.id,
        name: name,
        phone: phone,
        avatar_url: null
      }]);

    if (profileError) {
      console.error("❌ Customer creation error:", profileError);
    }

    // Redirect to login with success message
    setTimeout(() => {
      window.location.href = "login.html?signup=success";
    }, 500);

  } catch (err) {
    console.error("❌ Unexpected error:", err);
    showError("เกิดข้อผิดพลาด: " + (err.message || "ไม่ทราบสาเหตุ"));
  } finally {
    // Re-enable button
    signupBtn.disabled = false;
    signupBtn.innerText = "สร้างบัญชี";
  }
}

/**
 * Display error message
 */
function showError(message) {
  const errorMessage = document.getElementById("errorMessage");
  errorMessage.innerText = message;
  errorMessage.classList.add("show");
  
  // Auto-hide error after 5 seconds
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
      btn.innerHTML = `<img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="Google" width="20" style="margin-right: 8px;"> สมัครสมาชิกด้วย Google`;
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
      btn.innerHTML = `<img src="https://upload.wikimedia.org/wikipedia/commons/4/41/LINE_logo.svg" alt="LINE" width="20" style="margin-right: 8px;"> สมัครสมาชิกด้วย LINE`;
    }
  }
}

/**
 * Check if user is already logged in
 */
async function checkExistingSession() {
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    if (session) {
      console.log("✅ User already logged in, redirecting...");
      window.location.href = "Technician.html";
    }
  } catch (error) {
    console.error("❌ Session check error:", error);
  }
}

// ===== INITIALIZE =====
document.addEventListener("DOMContentLoaded", checkExistingSession);