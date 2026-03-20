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
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const confirmPassword = document.getElementById("confirmPassword").value;
  const signupBtn = document.getElementById("signupBtn");
  const errorMessage = document.getElementById("errorMessage");

  // Validation
  if (!name || !email || !password || !confirmPassword) {
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
        phone: "",
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