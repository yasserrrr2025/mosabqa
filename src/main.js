import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://oypfhzkbibrpobrvzwtn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95cGZoemtiaWJycG9icnZ6d3RuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxMDY3ODAsImV4cCI6MjA5MDY4Mjc4MH0.pgHCJdvOxOD-btGMmpSIiRblk8o82VxQ2Z36rd7HyGg';
const supabase = createClient(supabaseUrl, supabaseKey);

const REGISTRATION_LIMIT = 25;

document.addEventListener('DOMContentLoaded', async () => {
  const loadingScreen = document.getElementById('loading-screen');
  const mainContent = document.getElementById('main-content');
  const formContainer = document.getElementById('registration-form-container');
  const limitReachedContainer = document.getElementById('limit-reached-container');
  const registeredCountEl = document.getElementById('registered-count');
  const form = document.getElementById('sebaq-form');
  const feedbackMessage = document.getElementById('form-feedback');
  const submitBtn = document.getElementById('submit-btn');

  // Check for tab parameter in URL
  const urlParams = new URLSearchParams(window.location.search);
  const targetTab = urlParams.get('tab');
  if (targetTab === 'inquiry') {
    // We need to wait for elements to be ready, but they are since it's DOMContentLoaded
    setTimeout(() => {
        const tabInquiryBtn = document.getElementById('tab-inquiry-btn');
        if (tabInquiryBtn) tabInquiryBtn.click();
    }, 100);
  }

  // Initial check of registration count
  try {
    await checkRegistrationStatus();
  } catch (error) {
    console.error("Error fetching status:", error);
    showFeedback('عذراً، حدث خطأ في الاتصال بالخادم. يرجى المحاولة لاحقاً.', 'error');
    // Hide loading anyway to show error
    loadingScreen.style.display = 'none';
    mainContent.style.display = 'block';
  }

  // Handle Form Submission
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Disable button to prevent double submission
    const originalBtnText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="loader" style="width: 20px; height: 20px; border-width: 2px; margin: 0;"></span> جاري التسجيل...';
    hideFeedback();

    const formData = new FormData(form);
    const data = {
      full_name: formData.get('fullName').trim(),
      national_id: formData.get('nationalId').trim(),
      nationality: formData.get('nationality').trim(),
      grade: formData.get('grade'),
      class_number: formData.get('classNumber'),
      parent_phone: formData.get('parentPhone').trim()
    };

    // Extra validation for phone (in case HTML5 validation is bypassed)
    if (!/^05\d{8}$/.test(data.parent_phone)) {
      showFeedback('رقم الجوال يجب أن يبدأ بـ 05 ويتكون من 10 أرقام.', 'error');
      resetBtn();
      return;
    }

    try {
      // Re-get settings to ensure we have current capacity and batch
      const { data: settingsData } = await supabase.from('settings').select('*').single();
      const currentBatch = settingsData ? settingsData.current_batch : 1;
      const maxCapacity = settingsData && settingsData.max_capacity ? settingsData.max_capacity : 25;
      const forceOpen = settingsData ? settingsData.is_registration_open : true;

      if (!forceOpen) {
          showFeedback('عذراً، التسجيل مغلق حالياً بقرار من الإدارة.', 'error');
          resetBtn();
          return;
      }

      // Check current active count
      const { count: activeCount } = await supabase
        .from('registrations')
        .select('*', { count: 'exact', head: true })
        .eq('batch_number', currentBatch)
        .eq('status', 'active');

      const isWaitlist = activeCount >= maxCapacity;
      const registrationStatus = isWaitlist ? 'waitlisted' : 'active';

      // Insert data
      const { error } = await supabase
        .from('registrations')
        .insert([{ ...data, batch_number: currentBatch, status: registrationStatus }]);

      if (error) {
        if (error.code === '23505' || error.message?.includes('unique_national_id')) {
          showFeedback('عذراً، هذا الرقم المدني مسجل مسبقاً في الدفعة الحالية.', 'error');
          return;
        }
        throw error;
      }

      // Success
      document.getElementById('registration-form-container').style.display = 'none';
      const successTitle = document.getElementById('success-title');
      const successMsg = document.getElementById('success-student-name');
      
      if (isWaitlist) {
          // Calculate waitlist rank
          const { count: waitlistRank } = await supabase
            .from('registrations')
            .select('*', { count: 'exact', head: true })
            .eq('batch_number', currentBatch)
            .eq('status', 'waitlisted');

          successTitle.textContent = 'تم الإضافة لقائمة الاحتياط ⏳';
          successTitle.style.color = '#b45309';
          successMsg.innerHTML = `تم تسجيل الطالب <strong>"${data.full_name}"</strong> بنجاح.<br><br><div style="background:#fff7ed; padding:15px; border-radius:12px; border:1px solid #ffedd5; color:#c2410c;">أنت الآن الطالب رقم <strong>(${waitlistRank})</strong> في قائمة الاحتياط.<br>سنقوم بالتواصل معكم فور توفر مقعد شاغر.</div>`;
      } else {
          successTitle.textContent = 'تم التسجيل بنجاح! ✅';
          successTitle.style.color = 'var(--color-success)';
          successMsg.textContent = `بشرى سارة! تم تسجيل الطالب "${data.full_name}" بنجاح كطالب أساسي في الحلقة.. شكراً لثقتكم.`;
      }
      
      document.getElementById('success-container').style.display = 'block';

    } catch (error) {
      console.error("Submission error:", error);
      showFeedback('حدث خطأ أثناء التسجيل. يرجى المحاولة مرة أخرى.', 'error');
    } finally {
      resetBtn();
    }

    function resetBtn() {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnText;
    }
  });

  // Check how many students are registered
  async function checkRegistrationStatus(initialLoad = true) {
    try {
      // Fetch Custom Settings (Batch & Status)
      const { data: settingsData, error: settingsErr } = await supabase.from('settings').select('*').single();
      const currentBatch = settingsData ? settingsData.current_batch : 1;
      const forceOpen = settingsData ? settingsData.is_registration_open : true;
      const maxCapacity = settingsData && settingsData.max_capacity ? settingsData.max_capacity : 25;
      
      form.dataset.batch = currentBatch;

      if (!forceOpen) {
        if (initialLoad) {
          loadingScreen.style.display = 'none';
          mainContent.style.display = 'block';
        }
        formContainer.style.display = 'none';
        limitReachedContainer.style.display = 'block';
        return true;
      }

      const { count, error } = await supabase
        .from('registrations')
        .select('*', { count: 'exact', head: true })
        .eq('batch_number', currentBatch)
        .eq('status', 'active');

      if (error) throw error;

      return handleStatusUpdate(count || 0, maxCapacity, initialLoad);

      return handleStatusUpdate(count || 0, maxCapacity, initialLoad);
    } catch (error) {
      console.error("Error in checkRegistrationStatus:", error);
      throw error;
    }
  }

  function handleStatusUpdate(count, maxCapacity, initialLoad) {
    if(registeredCountEl) {
      document.getElementById('counter-badge').innerHTML = `<span class="pulse-dot"></span>تحديث مباشر: <strong id="registered-count">${count}</strong> / ${maxCapacity} مسجل`;
    }

    if (initialLoad) {
      loadingScreen.style.display = 'none';
      mainContent.style.display = 'block';
    }

    const waitlistBanner = document.getElementById('waitlist-banner');
    if (count >= maxCapacity) {
      waitlistBanner.style.display = 'block';
      return true; // is full
    } else {
      waitlistBanner.style.display = 'none';
      return false; // not full
    }
  }

  function showFeedback(msg, type) {
    feedbackMessage.textContent = msg;
    feedbackMessage.className = `feedback-message feedback-${type}`;
  }

  function hideFeedback() {
    feedbackMessage.style.display = 'none';
    feedbackMessage.className = 'feedback-message';
  }

  // ===== NEW: Tab & Inquiry Logic =====
  const tabRegisterBtn = document.getElementById('tab-register-btn');
  const tabInquiryBtn  = document.getElementById('tab-inquiry-btn');
  const registerSection = document.getElementById('register-section');
  const inquirySection = document.getElementById('inquiry-section');
  const inquiryResult = document.getElementById('inquiry-result');
  const inquiryInput = document.getElementById('inquiry-id');
  const inquirySubmit = document.getElementById('inquiry-btn');

  function switchTab(target) {
    if (target === 'register') {
      tabRegisterBtn.classList.add('active');
      tabRegisterBtn.style.background = 'var(--color-primary)';
      tabRegisterBtn.style.color = '#fff';
      tabInquiryBtn.classList.remove('active');
      tabInquiryBtn.style.background = '#f3f4f6';
      tabInquiryBtn.style.color = '#666';
      registerSection.style.display = 'block';
      inquirySection.style.display = 'none';
    } else {
      tabInquiryBtn.classList.add('active');
      tabInquiryBtn.style.background = 'var(--color-primary)';
      tabInquiryBtn.style.color = '#fff';
      tabRegisterBtn.classList.remove('active');
      tabRegisterBtn.style.background = '#f3f4f6';
      tabRegisterBtn.style.color = '#666';
      inquirySection.style.display = 'block';
      registerSection.style.display = 'none';
    }
  }

  tabRegisterBtn.addEventListener('click', () => switchTab('register'));
  tabInquiryBtn.addEventListener('click', () => switchTab('inquiry'));

  inquirySubmit.addEventListener('click', async () => {
    const nationalId = inquiryInput.value.trim();
    if (!nationalId) { 
      inquiryResult.innerHTML = `<div class="feedback-message feedback-error" style="display:block;">يرجى إدخال رقم الهوية</div>`;
      inquiryResult.style.display = 'block';
      return; 
    }

    inquirySubmit.disabled = true;
    inquirySubmit.innerHTML = '⏳ جاري البحث...';
    inquiryResult.style.display = 'none';

    try {
      // Re-get current batch to ensure we search correctly
      const { data: settingsData } = await supabase.from('settings').select('current_batch').single();
      const currentBatch = settingsData ? settingsData.current_batch : 1;

      const { data: student, error } = await supabase
        .from('registrations')
        .select('*')
        .eq('national_id', nationalId)
        .eq('batch_number', currentBatch)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !student) {
        inquiryResult.innerHTML = `
          <div style="background:#fee2e2; color:#b91c1c; padding:25px; border-radius:18px; border:1px solid #fecaca; text-align:center; animation: slideUp 0.4s ease-out;">
            <div style="font-size:3.5rem; margin-bottom:15px;">🔍</div>
            <h3 style="margin-bottom:10px; font-family:'Amiri', serif; font-size:1.5rem;">عذراً، الطالب غير مسجل!</h3>
            <p style="color:#7f1d1d; font-size:0.95rem; line-height:1.6;">
              لم يتم العثور على أي سجل برقم الهوية (<strong>${nationalId}</strong>) في الدورة الحالية.<br>
              يرجى التأكد من الرقم أو البدء بتسجيل طالب جديد.
            </p>
            <button id="go-to-register" style="margin-top:20px; background:#b91c1c; color:#fff; border:none; padding:10px 20px; border-radius:10px; cursor:pointer; font-weight:bold; font-family:inherit;">العودة لصفحة التسجيل</button>
          </div>`;
          
        setTimeout(() => {
          document.getElementById('go-to-register')?.addEventListener('click', () => switchTab('register'));
        }, 0);
      } else {
        const isActive = student.status === 'active';
        
        if (isActive) {
           // Redirect to parent page as it contains everything
           inquiryResult.innerHTML = `
            <div style="background:#f0fdf4; border:2px solid #bbfcce; padding:30px; border-radius:20px; text-align:center; animation: fadeIn 0.5s ease-out; box-shadow: 0 10px 25px rgba(22, 163, 74, 0.05);">
              <div class="loader" style="margin: 0 auto 15px; width: 40px; height: 40px;"></div>
              <h3 style="color:#16a34a; font-family:'Amiri', serif; font-size:1.6rem; margin-bottom:10px;">تم العثور على الطالب 🎉</h3>
              <p style="color:#15803d; margin-bottom:5px; font-weight:bold;">مرحباً بك، ${student.full_name}</p>
              <p style="color:#15803d; font-size:0.9rem;">جاري تحويلك الآن إلى بوابة ولي الأمر للاطلاع على كامل التقارير والمنجزات...</p>
            </div>`;
            inquiryResult.style.display = 'block';
            setTimeout(() => {
              window.location.href = `/parent.html?id=${nationalId}`;
            }, 1800);
            return;
        } else {
          // Waitlist Card
          const { count: rank } = await supabase
            .from('registrations')
            .select('*', { count: 'exact', head: true })
            .eq('batch_number', student.batch_number)
            .eq('status', 'waitlisted')
            .lte('created_at', student.created_at);

          inquiryResult.innerHTML = `
            <div style="background: linear-gradient(145deg, #fffbeb, #fef3c7); border:2px solid #fcd34d; padding:25px; border-radius:20px; text-align:center; box-shadow: 0 10px 20px rgba(245, 158, 11, 0.1); animation: slideUp 0.5s ease-out;">
              <div style="background:#f59e0b; color:#fff; width:60px; height:60px; border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto 20px; font-size:1.8rem; box-shadow:0 5px 15px rgba(245, 158, 11, 0.3);">⏳</div>
              <h3 style="color:#92400e; font-family:'Amiri', serif; font-size:1.5rem; margin-bottom:8px;">حالة الطالب: قائمة الاحتياط</h3>
              <div style="color:#b45309; font-weight:600; font-size:1.1rem; margin-bottom:15px; background:rgba(255,255,255,0.7); display:inline-block; padding:8px 20px; border-radius:20px; border:1px solid rgba(245, 158, 11, 0.2);">
                ${student.full_name}
              </div>
              <div style="background: #fff; padding:20px; border-radius:18px; border:1px dashed #f59e0b; margin-bottom:15px; position:relative;">
                <p style="color:#6b7280; font-size:0.9rem; margin-bottom:5px;">رقم ترتيبك في قائمة الانتظار:</p>
                <div style="font-size:3.5rem; font-weight:800; color:#d97706; font-family:'Cairo', sans-serif; line-height:1;">${rank}</div>
                <div style="position:absolute; top:-10px; right:-10px; background:#f59e0b; color:#fff; padding:2px 10px; border-radius:10px; font-size:0.7rem;">تحديث حي</div>
              </div>
              <p style="color:#92400e; font-size:0.9rem; line-height:1.6; padding: 0 10px;">نعتذر لعدم وجود مقعد شاغر حالياً، وسيتم التواصل معكم فوراً عند انسحاب أي طالب أو زيادة الطاقة الاستيعابية.</p>
              <div style="margin-top:20px; display:flex; justify-content:space-between; align-items:center; font-size:0.75rem; color:#b45309; opacity:0.7; padding-top:15px; border-top:1px solid rgba(245, 158, 11, 0.1);">
                <span>تاريخ التسجيل: ${new Date(student.created_at).toLocaleDateString('ar-SA')}</span>
                <span>الدفعة: ${student.batch_number}</span>
              </div>
            </div>`;
        }
      }
      inquiryResult.style.display = 'block';
    } catch (err) {
      console.error(err);
      inquiryResult.innerHTML = `<div class="feedback-message feedback-error" style="display:block;">حدث خطأ أثناء الاستعلام. يرجى المحاولة لاحقاً.</div>`;
      inquiryResult.style.display = 'block';
    } finally {
      inquirySubmit.disabled = false;
      inquirySubmit.innerHTML = '<span>استعلام الآن</span> <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>';
    }
  });
});
