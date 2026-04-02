import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://oypfhzkbibrpobrvzwtn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95cGZoemtiaWJycG9icnZ6d3RuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxMDY3ODAsImV4cCI6MjA5MDY4Mjc4MH0.pgHCJdvOxOD-btGMmpSIiRblk8o82VxQ2Z36rd7HyGg';
const supabase = createClient(supabaseUrl, supabaseKey);

document.addEventListener('DOMContentLoaded', () => {
  const loginBtn = document.getElementById('login-btn');
  const passwordInput = document.getElementById('adminPassword');
  const loginSection = document.getElementById('login-section');
  const dashboardSection = document.getElementById('dashboard-section');
  const errorMsg = document.getElementById('login-error');
  
  const currentBatchDisplay = document.getElementById('current-batch-display');
  const regStatusDisplay = document.getElementById('registration-status');
  const endBatchBtn = document.getElementById('end-batch-btn');

  let currentSettingsId = 1;

  loginBtn.addEventListener('click', async () => {
    // Admin password
    if (passwordInput.value === '1214') { 
      loginSection.style.display = 'none';
      dashboardSection.style.display = 'block';
      await loadAdminDashboard();
    } else {
      errorMsg.style.display = 'block';
    }
  });

  async function loadAdminDashboard() {
    try {
      const { data: settingsData, error } = await supabase.from('settings').select('*').single();
      if(error) throw error;

      if(settingsData) {
        currentSettingsId = settingsData.id;
        currentBatchDisplay.textContent = settingsData.current_batch;
        regStatusDisplay.textContent = settingsData.is_registration_open ? 'مفتوح 🟢' : 'مغلق (مكتمل) 🔴';
        regStatusDisplay.style.color = settingsData.is_registration_open ? 'green' : 'red';
      }
    } catch(err) {
      console.error(err);
      alert('فشل في تحميل الإعدادات.');
    }
  }

  endBatchBtn.addEventListener('click', async () => {
    const confirmAction = confirm('إنهاء هذه الدفعة يعني أنه سيتم فتح التسجيل لطلاب جدد للدفعة القادمة والصعود للمرحلة التالية. هل أنت متأكد؟');
    
    if(!confirmAction) return;

    endBatchBtn.disabled = true;
    endBatchBtn.textContent = 'جاري التحديث...';

    try {
      const currentBatchNum = parseInt(currentBatchDisplay.textContent);
      const nextBatch = currentBatchNum + 1;

      // Update settings: new batch & open registration
      const { error } = await supabase
        .from('settings')
        .update({ current_batch: nextBatch, is_registration_open: true })
        .eq('id', currentSettingsId);

      if (error) throw error;

      alert(`تم بنجاح! تم نقل النظام إلى الدفعة رقم ${nextBatch} وفتح بوابة التسجيل للطلاب مجدداً.`);
      await loadAdminDashboard();

    } catch(err) {
      console.error(err);
      alert('حدث خطأ أثناء محاولة التحديث. تأكد من إعطاء الصلاحيات لجدول الإعدادات.');
    } finally {
      endBatchBtn.textContent = '🛑 إنهاء الدفعة الحالية وفتح تسجيل جديد';
      endBatchBtn.disabled = false;
    }
  });
});
