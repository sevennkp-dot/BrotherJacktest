const SUPABASE_URL = "https://uqcjajmqtlchftpqwsrp.supabase.co";
const SUPABASE_KEY = "sb_publishable_yWZiH8l1idY0QWGuj6p9sg_GqXPONGX";

// สร้าง Supabase client เพียงครั้งเดียว
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUserSessionId = null;

document.getElementById('applyForm').addEventListener('submit', async function(e) {
  e.preventDefault();

  if (!currentUserSessionId) {
    Swal.fire({
      icon: 'warning',
      title: 'กรุณาเข้าสู่ระบบก่อนสมัคร',
      text: 'คุณต้องสมัครสมาชิกเป็นลูกค้าและเข้าสู่ระบบก่อน เพื่อนำ UID ของคุณไปเชื่อมต่อกับใบสมัครช่าง',
      confirmButtonText: 'ไปหน้าเข้าสู่ระบบ',
      confirmButtonColor: '#0066cc'
    }).then(() => {
      window.location.href = "login.html";
    });
    return;
  }

  const position = document.getElementById('position').value;
  const experienceYears = document.getElementById('experienceYears').value;
  const fullname = document.getElementById('fullname').value;
  const phone = document.getElementById('phone').value;
  const province = document.getElementById('province').value;
  const serviceArea = document.getElementById('serviceArea').value;
  const teamSize = document.getElementById('teamSize').value;
  const vehicle = document.getElementById('vehicle').value;
  const dailyRate = document.getElementById('dailyRate').value;
  const availability = document.getElementById('availability').value;
  const email = document.getElementById('email').value;
  const lineId = document.getElementById('lineId').value;
  const tools = document.getElementById('tools').value;
  const experience = document.getElementById('experience').value;
  const portfolio = document.getElementById('portfolio').value;

  const profileImageFile = document.getElementById('profileImage').files[0];
  const portfolioFiles = document.getElementById('portfolioImages').files;
  
  const idCardImageFile = document.getElementById('idCardImage').files[0];
  const trainingCertImageFile = document.getElementById('trainingCertImage').files[0];
  const certificateImageFile = document.getElementById('certificateImage').files[0];
  const licenseImageFile = document.getElementById('licenseImage').files[0];

  if(!position || !fullname || !phone || !province || !experienceYears) {
    Swal.fire({
      icon: 'warning',
      title: 'ข้อมูลไม่ครบถ้วน',
      text: 'กรุณากรอกข้อมูลที่จำเป็นให้ครบ',
      confirmButtonColor: '#0066cc'
    });
    return;
  }

  // ตรวจสอบขนาดไฟล์รูป (ไม่เกิน 5MB)
  const MAX_SIZE = 5 * 1024 * 1024;
  const allSingleFiles = [
    { file: profileImageFile, name: 'รูปโปรไฟล์' },
    { file: idCardImageFile, name: 'รูปบัตรประชาชน' },
    { file: trainingCertImageFile, name: 'รูปใบรับรองอบรม' },
    { file: certificateImageFile, name: 'รูปใบประกาศนียบัตร' },
    { file: licenseImageFile, name: 'รูปใบอนุญาตช่าง' }
  ];

  for (let item of allSingleFiles) {
    if (item.file && item.file.size > MAX_SIZE) {
      Swal.fire({ 
        icon: 'warning', 
        title: 'ไฟล์ใหญ่เกินไป', 
        text: `${item.name} ต้องมีขนาดไม่เกิน 5MB`, 
        confirmButtonColor: '#0066cc' 
      });
      return;
    }
  }

  if (portfolioFiles.length > 0) {
    for (let file of portfolioFiles) {
      if (file.size > MAX_SIZE) {
        Swal.fire({ 
          icon: 'warning', 
          title: 'ไฟล์ใหญ่เกินไป', 
          text: `รูปผลงาน "${file.name}" มีขนาดเกิน 5MB`, 
          confirmButtonColor: '#0066cc' 
        });
        return;
      }
    }
  }

  const submitBtn = document.getElementById('submitBtn');
  submitBtn.disabled = true;
  submitBtn.innerText = 'กำลังส่งข้อมูล...';

  Swal.fire({
    title: 'กำลังส่งข้อมูล...',
    text: 'กรุณารอสักครู่ เรากำลังอัปโหลดข้อมูลและรูปภาพของคุณ',
    allowOutsideClick: false,
    didOpen: () => {
      Swal.showLoading();
    }
  });

  try {
    const uploadSingleFile = async (file, prefix) => {
      if (!file) return null;
      const ext = file.name.split('.').pop();
      const fileName = `technicians/${prefix}_${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
      const { error } = await supabaseClient.storage.from('technician-images').upload(fileName, file);
      if (error) throw new Error(`อัปโหลดไฟล์ล้มเหลว: ${error.message}`);
      return `${SUPABASE_URL}/storage/v1/object/public/technician-images/${fileName}`;
    };

    let profileImageUrl = await uploadSingleFile(profileImageFile, 'profile');
    let idCardImageUrl = await uploadSingleFile(idCardImageFile, 'idcard');
    let trainingCertImageUrl = await uploadSingleFile(trainingCertImageFile, 'training');
    let certificateImageUrl = await uploadSingleFile(certificateImageFile, 'cert');
    let licenseImageUrl = await uploadSingleFile(licenseImageFile, 'license');
    
    let portfolioImageUrls = [];

    // ===== Upload portfolio images =====
    if(portfolioFiles.length > 0){
      for (let file of portfolioFiles) {
        const ext = file.name.split('.').pop();
        const fileName = `technicians/work_${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;

        const { error: uploadError } = await supabaseClient.storage
          .from('technician-images')
          .upload(fileName, file);

        if(!uploadError){
          const url = `${SUPABASE_URL}/storage/v1/object/public/technician-images/${fileName}`;
          portfolioImageUrls.push(url);
        } else {
          console.warn(`อัปโหลดรูปผลงานล้มเหลว: ${file.name}`, uploadError);
        }
      }
    }

    const { error } = await supabaseClient
      .from('job_applications')
      .insert([{
        user_id: currentUserSessionId,
        position: position,
        experience_years: experienceYears,
        fullname: fullname,
        phone: phone,
        province: province,
        service_area: serviceArea,
        team_size: teamSize,
        vehicle: vehicle,
        daily_rate: dailyRate,
        availability: availability,
        email: email,
        line_id: lineId,
        tools: tools,
        experience: experience,
        portfolio: portfolio,
        profile_image: profileImageUrl,
        portfolio_images: portfolioImageUrls,
        id_card_image: idCardImageUrl,
        training_cert_image: trainingCertImageUrl,
        certificate_image: certificateImageUrl,
        license_image: licenseImageUrl
      }]);

    if(error){
      throw error;
    }

    Swal.fire({
      icon: 'success',
      title: 'ส่งใบสมัครสำเร็จ!',
      text: 'ข้อมูลถูกบันทึกเรียบร้อย ทีมงานจะติดต่อกลับเร็วๆนี้',
      confirmButtonColor: '#0066cc'
    }).then(()=>{
      document.getElementById('applyForm').reset();
    });

  } catch (err) {
    Swal.fire({
      icon: 'error',
      title: 'เกิดข้อผิดพลาด',
      text: err.message || 'ไม่สามารถส่งข้อมูลได้ กรุณาลองใหม่อีกครั้ง',
      confirmButtonColor: '#0066cc'
    });
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerText = 'สมัครเป็นช่างกับ FixHouse 🚀';
  }
});

// ===== Authentication Functions =====
async function checkAuth() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  
  if (session) {
    const user = session.user;
    currentUserSessionId = user.id;
    const { data: customer } = await supabaseClient
      .from("customers")
      .select("name")
      .eq("id", user.id)
      .single();
    
    const userName = customer?.name || user.email;
    const initial = userName.charAt(0).toUpperCase();
    
    document.getElementById("authUserInfo").style.display = "block";
    document.getElementById("authLoginBtn").style.display = "none";
    document.getElementById("userName").innerText = userName;
    document.getElementById("userInitial").innerText = initial;
  } else {
    document.getElementById("authUserInfo").style.display = "none";
    document.getElementById("authLoginBtn").style.display = "block";
  }
}

async function logout() {
  await supabaseClient.auth.signOut();
  window.location.href = "login.html";
}

// Run on page load
document.addEventListener('DOMContentLoaded', checkAuth);