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
      const { count } = await supabase
        .from('registrations')
        .select('*', { count: 'exact', head: true })
        .eq('batch_number', currentBatch)
        .eq('status', 'active');

      const isWaitlist = count >= maxCapacity;
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
          successTitle.textContent = 'تم الإضافة لقائمة الاحتياط ⏳';
          successTitle.style.color = '#b45309'; // Amber/Gold
          successMsg.textContent = `تم تسجيل الطالب "${data.full_name}" في قائمة الاحتياط بنجاح. سنقوم بالتواصل معكم في حال توفر مقعد شاغر.`;
      } else {
          successTitle.textContent = 'تم التسجيل بنجاح! ✅';
          successTitle.style.color = 'var(--color-success)';
          successMsg.textContent = `بشرى سارة! تم تسجيل الطالب "${data.full_name}" بنجاح.. شكراً لثقتكم.`;
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
});
