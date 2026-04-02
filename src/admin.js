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
  const totalStudentsDisplay = document.getElementById('stat-total-students');
  const batchFilter = document.getElementById('batch-filter');
  const adminTableBody = document.getElementById('admin-table-body');
  
  const printDateEl = document.getElementById('admin-print-date');
  if(printDateEl) printDateEl.textContent = new Date().toLocaleDateString('ar-SA');

  let currentSettingsId = 1;
  let allStudents = [];
  let allScores = {};

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
      // 1. Load settings (status and current batch)
      const { data: settingsData, error } = await supabase.from('settings').select('*').single();
      if(error) throw error;

      if(settingsData) {
        currentSettingsId = settingsData.id;
        currentBatchDisplay.textContent = settingsData.current_batch;
        regStatusDisplay.textContent = settingsData.is_registration_open ? 'مفتوح 🟢' : 'مغلق (مكتمل) 🔴';
        regStatusDisplay.style.color = settingsData.is_registration_open ? '#16a34a' : '#dc2626';
      }

      // 2. Fetch all students across all batches
      const { data: stds, error: stdErr } = await supabase.from('registrations').select('*').order('created_at', { ascending: true });
      if(stdErr) throw stdErr;
      
      allStudents = stds || [];
      totalStudentsDisplay.textContent = allStudents.length;

      // 3. Populate Filter Dropdown
      const batches = [...new Set(allStudents.map(s => s.batch_number))].sort((a,b) => a-b);
      batchFilter.innerHTML = '<option value="all">الكل (إظهار الأرشيف كاملاً)</option>';
      batches.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b;
        let txt = `الدفعة رقم ${b}`;
        if(settingsData && b === settingsData.current_batch) txt += ' (الحالية)';
        opt.textContent = txt;
        batchFilter.appendChild(opt);
      });

      // 4. Fetch all evaluations to calculate global scores
      const { data: evals, error: evalErr } = await supabase.from('evaluations').select('*');
      if (evalErr) throw evalErr;

      allScores = {};
      (evals || []).forEach(ev => {
        if (!allScores[ev.student_id]) allScores[ev.student_id] = 0;
        if (ev.performance === 'ممتاز') allScores[ev.student_id] += 3;
        else if (ev.performance === 'جيد جداً') allScores[ev.student_id] += 2;
        else if (ev.performance === 'جيد') allScores[ev.student_id] += 1;
      });

      // 5. Initial Render
      renderTable('all');

    } catch(err) {
      console.error(err);
      alert('فشل في تحميل الإعدادات وبيانات الأرشيف.');
    }
  }

  batchFilter.addEventListener('change', (e) => {
    renderTable(e.target.value);
  });

  function renderTable(filterBatch) {
    adminTableBody.innerHTML = '';
    
    let filtered = allStudents;
    if(filterBatch !== 'all') {
      const bn = parseInt(filterBatch);
      filtered = allStudents.filter(s => s.batch_number === bn);
    }

    if (filtered.length === 0) {
      adminTableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">لا يوجد بيانات للعرض.</td></tr>';
      return;
    }

    // Sort by points to identify the best in the batch/school
    filtered.sort((a, b) => {
      const scoreA = allScores[a.id] || 0;
      const scoreB = allScores[b.id] || 0;
      return scoreB - scoreA;
    });

    let rank = 1;
    filtered.forEach(student => {
      const score = allScores[student.id] || 0;
      let finalEval = 'جيد وحافظ';
      if(score > 60) finalEval = 'متميز ومتقن لحفظه';
      else if(score > 30) finalEval = 'جيد جداً وثابت';
      else if(score === 0) finalEval = 'لم يستكمل التقييم';
      
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
           <strong>${rank}- ${student.full_name}</strong><br>
           <span style="font-size:0.85rem; color:#666;">${student.grade} - فصل ${student.class_number}</span>
        </td>
        <td>${student.national_id}</td>
        <td dir="ltr" style="text-align:right;">${student.parent_phone}</td>
        <td style="font-weight:bold; color:var(--color-primary-dark); text-align:center; font-size:1.1rem;">${student.batch_number}</td>
        <td style="text-align:center;">
           <span style="display:block; font-weight:bold; color:var(--color-gold-dark);">${score} نقطة</span>
           <span style="font-size:0.9rem;">${finalEval}</span>
        </td>
      `;
      adminTableBody.appendChild(tr);
      rank++;
    });
  }

  endBatchBtn.addEventListener('click', async () => {
    const confirmAction = confirm('إنهاء هذه الدفعة يعني أنه سيتم فتح التسجيل لطلاب جدد للدفعة القادمة والصعود للمرحلة التالية. هل أنت متأكد؟');
    
    if(!confirmAction) return;

    endBatchBtn.disabled = true;
    endBatchBtn.textContent = 'جاري أرشفة الدفعة والتحديث...';

    try {
      const currentBatchNum = parseInt(currentBatchDisplay.textContent);
      const nextBatch = currentBatchNum + 1;

      // Update settings: new batch & open registration
      const { error } = await supabase
        .from('settings')
        .update({ current_batch: nextBatch, is_registration_open: true })
        .eq('id', currentSettingsId);

      if (error) throw error;

      alert(`لقد تم الأمر بنجاح! تم أرشفت الطلاب، وتم نقل النظام إلى الدفعة رقم ${nextBatch}\nوتم فتح بوابة التسجيل للجمهور مجدداً.`);
      await loadAdminDashboard();

    } catch(err) {
      console.error(err);
      alert('حدث خطأ أثناء محاولة التحديث. تأكد من إعطاء الصلاحيات لجدول الإعدادات.');
    } finally {
      endBatchBtn.textContent = '🛑 أرشفة الدفعة الحالية وفتح تسجيل جديد';
      endBatchBtn.disabled = false;
    }
  });
});
