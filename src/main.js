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
      // Re-check count before inserting
      const isFull = await checkRegistrationStatus(false);
      if (isFull) {
         resetBtn();
         return; // UI already updated by checkRegistrationStatus
      }

      // Insert data
      const { error } = await supabase
        .from('registrations')
        .insert([data]);

      if (error) {
        if (error.code === '23505') {
          showFeedback('عذراً، لا يمكن تكرار التسجيل! (هذا الطالب أو رقم الجوال مسجل مسبقاً).', 'error');
          return;
        }
        throw error;
      }

      // Success
      showFeedback('تم تسجيل الطالب بنجاح! شكراً لك.', 'success');
      form.reset();
      
      // Update count
      await checkRegistrationStatus(false);

    } catch (error) {
      console.error("Submission error:", error);
      showFeedback('حدث خطأ أثناء التسجيل. قد يكون هناك مشكلة في الاتصال.', 'error');
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
    // In production with RLS, you might call a special RPC function:
    // const { data, error } = await supabase.rpc('get_registration_count')
    
    // For simple implementation without RPC:
    const { count, error } = await supabase
      .from('registrations')
      .select('*', { count: 'exact', head: true });

    if (error) {
      // If we haven't configured supabase yet, we mock for demo purposes if URL is dummy
      if(supabaseUrl === 'YOUR_SUPABASE_URL') {
         console.warn("Using dummy Supabase config! Mocking response.");
         return handleStatusUpdate(0, initialLoad); // Mock 0 registrations
      }
      throw error;
    }

    return handleStatusUpdate(count || 0, initialLoad);
  }

  function handleStatusUpdate(count, initialLoad) {
    if(registeredCountEl) registeredCountEl.textContent = count;

    if (initialLoad) {
      loadingScreen.style.display = 'none';
      mainContent.style.display = 'block';
    }

    if (count >= REGISTRATION_LIMIT) {
      formContainer.style.display = 'none';
      limitReachedContainer.style.display = 'block';
      return true; // is full
    } else {
      formContainer.style.display = 'block';
      limitReachedContainer.style.display = 'none';
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
