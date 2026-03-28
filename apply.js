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
  const skillLevel = document.getElementById('skillLevel').value;
  const experienceYears = document.getElementById('experienceYears').value;
  const expertise = document.getElementById('expertise').value;
  const fullname = document.getElementById('fullname').value;
  const phone = document.getElementById('phone').value;
  const subdistrict = document.getElementById('subdistrict').value;
  const district = document.getElementById('district').value;
  const province = document.getElementById('province').value;
  const serviceArea = document.getElementById('serviceArea').value;
  const serviceDistance = document.getElementById('serviceDistance').value;
  const latitude = document.getElementById('latitude').value;
  const longitude = document.getElementById('longitude').value;
  const teamSize = document.getElementById('teamSize').value;
  const vehicleChecks = Array.from(document.querySelectorAll('input[name="vehicle"]:checked')).map(cb => cb.value);
  let vehicle = vehicleChecks.join(', ');
  if (vehicleChecks.length === 0) {
    vehicle = 'ไม่มี';
  }
  const rateType = document.getElementById('rateType').value;
  const dailyRate = document.getElementById('dailyRate').value;
  const availabilityChecks = Array.from(document.querySelectorAll('input[name="availability"]:checked')).map(cb => cb.value);
  let availabilityUrgency = availabilityChecks.join(', ');
  if (availabilityChecks.length === 2) {
    availabilityUrgency = 'รับงานล่วงหน้า ,รับงานทันที';
  } else if (availabilityChecks.length === 0) {
    availabilityUrgency = 'รับงานล่วงหน้า'; // Default if none selected
  }
  const workHours = Array.from(document.querySelectorAll('input[name="workHours"]:checked')).map(cb => cb.value).join(', ');
  const pastWorkCount = document.getElementById('pastWorkCount').value;
  const pastWorkTypes = Array.from(document.querySelectorAll('input[name="pastWorkTypes"]:checked')).map(cb => cb.value).join(', ');
  const email = document.getElementById('email').value;
  const lineId = document.getElementById('lineId').value;
  const tools = Array.from(document.querySelectorAll('input[name="tools"]:checked')).map(cb => cb.value).join(', ');
  const sellingPoints = Array.from(document.querySelectorAll('input[name="sellingPoints"]:checked')).map(cb => cb.value).join(', ');
  const experience = document.getElementById('experience').value;
  const portfolio = document.getElementById('portfolio').value;
  const portfolioCategory = document.getElementById('portfolioCategory').value;

  const profileImageFile = document.getElementById('profileImage').files[0];
  const portfolioFiles = document.getElementById('portfolioImages').files;
  
  const idCardImageFile = document.getElementById('idCardImage').files[0];
  const selfieImageFile = document.getElementById('selfieImage').files[0];
  const trainingCertImageFile = document.getElementById('trainingCertImage').files[0];
  const certificateImageFile = document.getElementById('certificateImage').files[0];
  const licenseImageFile = document.getElementById('licenseImage').files[0];

  if(!position || !skillLevel || !fullname || !phone || !subdistrict || !district || !province || !experienceYears || !rateType || !portfolioCategory) {
    Swal.fire({
      icon: 'warning',
      title: 'ข้อมูลไม่ครบถ้วน',
      text: 'กรุณากรอกข้อมูลที่จำเป็นให้ครบ',
      confirmButtonColor: '#0066cc'
    });
    return;
  }

  if (!idCardImageFile || !selfieImageFile) {
    Swal.fire({
      icon: 'warning',
      title: 'รูปภาพไม่ครบ',
      text: 'กรุณาอัปโหลดรูปภาพบัตรประชาชน และภาพ Selfie คู่บัตร',
      confirmButtonColor: '#0066cc'
    });
    return;
  }

  if (portfolioFiles.length === 0) {
    Swal.fire({
      icon: 'warning',
      title: 'รูปผลงานไม่ครบ',
      text: 'กรุณาอัปโหลดรูปผลงานอย่างน้อย 1 รูป',
      confirmButtonColor: '#0066cc'
    });
    return;
  }

  // ตรวจสอบขนาดไฟล์รูป (ไม่เกิน 5MB)
  const MAX_SIZE = 5 * 1024 * 1024;
  const allSingleFiles = [
    { file: profileImageFile, name: 'รูปโปรไฟล์' },
    { file: idCardImageFile, name: 'รูปบัตรประชาชน' },
    { file: selfieImageFile, name: 'รูป Selfie คู่บัตร' },
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
    let selfieImageUrl = await uploadSingleFile(selfieImageFile, 'selfie');
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
        skill_level: skillLevel,
        experience_years: experienceYears,
        expertise: expertise,
        fullname: fullname,
        phone: phone,
        subdistrict: subdistrict,
        district: district,
        province: province,
        service_area: serviceArea,
        service_distance: serviceDistance || null,
        latitude: latitude || null,
        longitude: longitude || null,
        team_size: teamSize,
        vehicle: vehicle,
        rate_type: rateType,
        daily_rate: dailyRate,
        availability_urgency: availabilityUrgency,
        work_hours: workHours,
        past_work_count: pastWorkCount || null,
        past_work_types: pastWorkTypes,
        email: email,
        line_id: lineId,
        tools: tools,
        selling_points: sellingPoints,
        experience: experience,
        portfolio: portfolio,
        portfolio_category: portfolioCategory,
        profile_image: profileImageUrl,
        portfolio_images: portfolioImageUrls,
        id_card_image: idCardImageUrl,
        selfie_image: selfieImageUrl,
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

// ===== Geolocation =====
function getLocation() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        document.getElementById('latitude').value = position.coords.latitude;
        document.getElementById('longitude').value = position.coords.longitude;
      },
      (error) => {
        Swal.fire({
          icon: 'error',
          title: 'ไม่สามารถดึงตำแหน่งได้',
          text: 'กรุณาอนุญาตการเข้าถึงตำแหน่งที่ตั้ง'
        });
      }
    );
  } else {
    Swal.fire({
      icon: 'error',
      title: 'เบราว์เซอร์ไม่รองรับ',
      text: 'เบราว์เซอร์ของคุณไม่รองรับการดึงตำแหน่งที่ตั้ง'
    });
  }
}

// Run on page load
document.addEventListener('DOMContentLoaded', checkAuth);