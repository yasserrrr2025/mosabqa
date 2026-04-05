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
      parent_phone: formData.get('parentPhone').trim(),
      parent_national_id: formData.get('parentNationalId').trim()
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

  const performInquiry = async (val) => {
    if (!val) { 
      inquiryResult.innerHTML = `<div class="feedback-message feedback-error" style="display:block;">يرجى إدخال رقم الهوية</div>`;
      inquiryResult.style.display = 'block';
      return; 
    }

    inquirySubmit.disabled = true;
    inquirySubmit.innerHTML = '⏳ جاري البحث...';
    inquiryResult.style.display = 'none';

    try {
      const { data: settingsData } = await supabase.from('settings').select('current_batch').single();
      const currentBatch = settingsData ? settingsData.current_batch : 1;

      // Search by Student ID OR Parent ID in ALL batches
      const { data: students, error } = await supabase
        .from('registrations')
        .select('*')
        .or(`national_id.eq.${val},parent_national_id.eq.${val}`)
        .order('batch_number', { ascending: false }) // Newest batch first
        .order('created_at', { ascending: false });

      if (error || !students || students.length === 0) {
        inquiryResult.innerHTML = `
          <div style="background: linear-gradient(145deg, #fff5f5, #fff0f0); color:#991b1b; padding:32px 25px; border-radius:24px; border:2.5px dashed #fecaca; text-align:center; animation: slideUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1); box-shadow: 0 10px 25px rgba(220, 38, 38, 0.05);">
            <div style="background:#fecaca; color:#dc2626; width:70px; height:70px; border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto 20px; font-size:2.2rem; box-shadow: 0 5px 15px rgba(220, 38, 38, 0.1);">🔍</div>
            <h3 style="margin-bottom:12px; font-family:'Amiri', serif; font-size:1.6rem; color:#7f1d1d;">عفواً.. لم نجد سجلاً!</h3>
            <p style="color:#991b1b; font-size:1rem; line-height:1.7; margin-bottom:20px;">
              رقم الهوية (<strong>${val}</strong>) غير مسجل حالياً في الدفعة رقم (<strong>${currentBatch}</strong>).<br>
              <span style="font-size:0.9rem; opacity:0.8;">تأكد من الرقم أو بادر بتسجيل بيانات الطالب الآن.</span>
            </p>
            <button id="go-to-register" class="submit-btn" style="background:#dc2626; border:none; padding:12px 25px; border-radius:14px; cursor:pointer; font-weight:bold; font-family:inherit; box-shadow: 0 4px 12px rgba(220, 38, 38, 0.2); width:100%;">📝 البدء بتسجيل الطالب الآن</button>
          </div>`;
        setTimeout(() => {
          document.getElementById('go-to-register')?.addEventListener('click', () => switchTab('register'));
        }, 50);
      } else {
        inquiryResult.innerHTML = '';
        inquiryResult.style.display = 'block';

        if (students.length > 1) {
           inquiryResult.innerHTML = `
            <div style="background:#fff; border:1.5px solid var(--color-primary-dark); padding:25px; border-radius:20px; animation: fadeIn 0.4s ease-out;">
              <h3 style="color:var(--color-primary-dark); font-family:'Amiri', serif; font-size:1.4rem; text-align:center; margin-bottom:15px;">كشف الأبناء المسجلين 👨‍👩‍👦</h3>
              <p style="text-align:center; color:#666; font-size:0.85rem; margin-bottom:20px;">تم العثور على ${students.length} طلاب مرتبطين برقم الهوية هذا:</p>
              <div id="children-list" style="display:flex; flex-direction:column; gap:10px;"></div>
            </div>`;
           const list = inquiryResult.querySelector('#children-list');
           students.forEach(s => {
              const btn = document.createElement('button');
              btn.className = 'submit-btn';
              btn.style.cssText = 'background:#f8fafc; color:#1e293b; border:1px solid #e2e8f0; font-size:0.92rem; text-align:right; justify-content:space-between; box-shadow:none;';
              const statusTag = (s.status === 'active' || s.status === 'accepted') ? '<span style="color:#16a34a;">أساسي ✅</span>' : '<span style="color:#f59e0b;">احتياط ⏳</span>';
              btn.innerHTML = `<span>${s.full_name}</span> ${statusTag}`;
              btn.onclick = () => {
                if (s.status === 'active' || s.status === 'accepted') window.location.href = `/parent.html?id=${s.national_id}`;
                else alert('الطالب في قائمة الاحتياط، التقارير تظهر بعد القبول النهائي.');
              };
              list.appendChild(btn);
           });
        } else {
           const student = students[0];
           if (!student.parent_national_id) {
             inquiryResult.innerHTML = `
               <div style="background:#fff7ed; border:2.5px dashed #fcd34d; padding:25px; border-radius:20px; text-align:center; animation: bounceIn 0.5s cubic-bezier(0.68, -0.55, 0.27, 1.55);">
                 <div style="font-size:3rem; margin-bottom:10px;">⚠️</div>
                 <h3 style="color:#92400e; font-family:'Amiri', serif; font-size:1.5rem; margin-bottom:5px;">إكمال البيانات مطلوب</h3>
                 <p style="color:#b45309; font-size:0.9rem; margin-bottom:20px;">نعتذر يا <strong>${student.full_name}</strong>، يجب تزويدنا برقم هوية ولي الأمر لإتمام ربط حسابك بالخدمات المتاحة حالياً.</p>
                 <input type="text" id="new-parent-id" placeholder="أدخل رقم هوية ولي الأمر (10 أرقام)" style="width:100%; padding:12px; border-radius:10px; border:1.5px solid #fcd34d; margin-bottom:15px; text-align:center; font-family:inherit;" maxlength="10" inputmode="numeric">
                 <button id="save-parent-id-btn" class="submit-btn" style="background:#d97706;">💾 حفظ البيانات والمتابعة</button>
                 <div id="save-error" style="color:#dc2626; font-size:0.8rem; margin-top:8px; display:none;">يرجى إدخال 10 أرقام صحيحة</div>
               </div>`;
             
             document.getElementById('save-parent-id-btn').onclick = async () => {
                const pid = document.getElementById('new-parent-id').value.trim();
                if (pid.length !== 10) { document.getElementById('save-error').style.display='block'; return; }
                
                document.getElementById('save-parent-id-btn').disabled = true;
                document.getElementById('save-parent-id-btn').textContent = '⏳ جاري الحفظ...';

                const { error: upError } = await supabase.from('registrations').update({ parent_national_id: pid }).eq('id', student.id);
                if (upError) { alert('حدث خطأ أثناء الحفظ.'); return; }
                
                // If active, go to parent portal directly
                if (student.status === 'active' || student.status === 'accepted') {
                   window.location.href = `/parent.html?id=${student.national_id}`;
                } else {
                   // Otherwise refresh inquiry to show waitlist status
                   performInquiry(student.national_id);
                }
             };
           } 
           else if (student.status === 'active' || student.status === 'accepted') {
              inquiryResult.innerHTML = `
                <div style="background:#f0fdf4; border:2px solid #bbfcce; padding:30px; border-radius:20px; text-align:center; animation: fadeIn 0.5s ease-out;">
                  <div class="loader" style="margin: 0 auto 15px; width: 40px; height: 40px;"></div>
                  <h3 style="color:#16a34a; font-family:'Amiri', serif; font-size:1.6rem; margin-bottom:10px;">تم التحقق بنجاح 🎉</h3>
                  <p style="color:#15803d; margin-bottom:5px; font-weight:bold;">مرحباً بك، ${student.full_name}</p>
                  <p style="color:#15803d; font-size:0.9rem;">جاري تحويلك الآن لمتابعة منجزاتك وتقاريرك...</p>
                </div>`;
              setTimeout(() => window.location.href = `/parent.html?id=${student.national_id}`, 1800);
           } else {
             const { count: rank } = await supabase
               .from('registrations')
               .select('*', { count: 'exact', head: true })
               .eq('batch_number', student.batch_number)
               .eq('status', 'waitlisted')
               .lte('created_at', student.created_at);

             inquiryResult.innerHTML = `
               <div style="background: linear-gradient(145deg, #fffbeb, #fef3c7); border:2px solid #fcd34d; padding:25px; border-radius:20px; text-align:center; box-shadow: 0 10px 20px rgba(245, 158, 11, 0.1); animation: slideUp 0.5s ease-out;">
                 <div style="background:#f59e0b; color:#fff; width:60px; height:60px; border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto 20px; font-size:1.8rem;">⏳</div>
                 <h3 style="color:#92400e; font-family:'Amiri', serif; font-size:1.5rem; margin-bottom:8px;">حالة الطالب: قائمة الاحتياط</h3>
                 <div style="color:#b45309; font-weight:600; font-size:1.1rem; margin-bottom:15px; background:rgba(255,255,255,0.7); display:inline-block; padding:8px 20px; border-radius:20px; border:1px solid rgba(245,158,11,0.2);">${student.full_name}</div>
                 <div style="background: #fff; padding:20px; border-radius:18px; border:1px dashed #f59e0b; margin-bottom:15px;">
                   <p style="color:#6b7280; font-size:0.9rem; margin-bottom:5px;">رقم ترتيبك في الانتظار:</p>
                   <div style="font-size:3.5rem; font-weight:800; color:#d97706; font-family:'Cairo', sans-serif; line-height:1;">${rank}</div>
                 </div>
                 <p style="color:#92400e; font-size:0.9rem; line-height:1.6; padding: 0 10px;">نعتذر لعدم وجود مقعد شاغر حالياً، وسيتم التواصل معك فور توفر مقعد بإذن الله.</p>
               </div>`;
           }
        }
      }
      inquiryResult.style.display = 'block';
    } catch (err) {
      console.error(err);
      inquiryResult.innerHTML = `<div class="feedback-message feedback-error" style="display:block;">حدث خطأ غير متوقع. حاول مرة أخرى.</div>`;
      inquiryResult.style.display = 'block';
    } finally {
      inquirySubmit.disabled = false;
      inquirySubmit.innerHTML = '<span>استعلام الآن</span> <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>';
    }
  };

  inquirySubmit.addEventListener('click', () => performInquiry(inquiryInput.value.trim()));
});
