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
  
  const capacityInput = document.getElementById('capacity-input');
  const updateCapacityBtn = document.getElementById('update-capacity-btn');
  const podiumContainer = document.getElementById('podium-container');
  const bestBatchNameEl = document.getElementById('best-batch-name');
  
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
        if(capacityInput) capacityInput.value = settingsData.max_capacity || 25;
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

      // 6. Build Roster for current batch
      buildRoster(settingsData ? settingsData.current_batch : null);

    } catch(err) {
      console.error(err);
      alert('فشل في تحميل الإعدادات وبيانات الأرشيف.');
    }
  }

  function buildRoster(currentBatch) {
    const rosterGradeFilter = document.getElementById('roster-grade-filter');
    const rosterTableBody = document.getElementById('roster-table-body');
    if (!rosterGradeFilter || !rosterTableBody) return;

    // Filter to current batch only
    const currentStudents = allStudents.filter(s => s.batch_number === currentBatch);

    // Sort by grade then class
    currentStudents.sort((a, b) => {
      if ((a.grade || '') === (b.grade || '')) {
        return (a.class_number || '').toString().localeCompare((b.class_number || '').toString());
      }
      return (a.grade || '').localeCompare(b.grade || '');
    });

    // Populate grade dropdown
    const grades = [...new Set(currentStudents.map(s => s.grade).filter(Boolean))].sort();
    rosterGradeFilter.innerHTML = '<option value="all">جميع الصفوف</option>';
    grades.forEach(g => {
      const opt = document.createElement('option');
      opt.value = g;
      opt.textContent = g;
      rosterGradeFilter.appendChild(opt);
    });

    const renderRosterPreview = (filter) => {
      const filtered = filter === 'all' ? currentStudents : currentStudents.filter(s => s.grade === filter);
      rosterTableBody.innerHTML = '';
      if (filtered.length === 0) {
        rosterTableBody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:#999;">لا يوجد بيانات لهذا الفلتر</td></tr>';
        return;
      }
      filtered.forEach((s, i) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>${i + 1}- ${s.full_name}</strong></td>
          <td style="text-align:center;">${s.grade || '-'}</td>
          <td style="text-align:center;">${s.class_number || '-'}</td>
        `;
        rosterTableBody.appendChild(tr);
      });
    };

    // Initial render
    renderRosterPreview('all');

    // Filter change
    rosterGradeFilter.addEventListener('change', (e) => renderRosterPreview(e.target.value));

    // Store for print
    window._rosterStudents = currentStudents;
    window._rosterBatch = currentBatch;
  }

  window.printRoster = function() {
    const filter = document.getElementById('roster-grade-filter')?.value || 'all';
    const students = filter === 'all'
      ? (window._rosterStudents || [])
      : (window._rosterStudents || []).filter(s => s.grade === filter);

    const printBody = document.getElementById('roster-print-body');
    const printTitle = document.getElementById('roster-print-title');
    const printBatch = document.getElementById('roster-print-batch');
    const printDate = document.getElementById('roster-print-date');
    if (!printBody) return;

    printBatch.textContent = window._rosterBatch || '';
    printDate.textContent = new Date().toLocaleDateString('ar-SA-u-nu-latn');
    printTitle.textContent = filter === 'all'
      ? 'بيان بأسماء جميع الطلاب المشاركين'
      : `بيان طلاب ${filter} المشاركين`;

    printBody.innerHTML = '';
    students.forEach((s, i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${i + 1}- ${s.full_name}</strong></td>
        <td style="text-align:center;">${s.grade || '-'}</td>
        <td style="text-align:center;">${s.class_number || '-'}</td>
      `;
      printBody.appendChild(tr);
    });

    // Show print-only elements via body class
    document.body.classList.add('print-roster');
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        document.body.classList.remove('print-roster');
      }, 500);
    }, 150);
  };

  updateCapacityBtn.addEventListener('click', async () => {
    const newCap = parseInt(capacityInput.value);
    if(newCap <= 0) return alert('أدخل سعة صحيحة');
    
    updateCapacityBtn.disabled = true;
    updateCapacityBtn.textContent = '...';
    try {
      const { error } = await supabase
        .from('settings')
        .update({ max_capacity: newCap })
        .eq('id', currentSettingsId);
      
      if(error) throw error;
      alert('تم تحديث السعة الاستيعابية بنجاح! سينعكس ذلك فوراً على رابط التسجيل.');
    } catch(err) {
      console.error(err);
      alert('خطأ في الاتصال بقاعدة البيانات.');
    } finally {
      updateCapacityBtn.textContent = 'تحديث';
      updateCapacityBtn.disabled = false;
    }
  });

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

    // ========== Analytics: Podium & Best Batch ==========
    if(podiumContainer) {
       podiumContainer.innerHTML = '';
       const top3 = filtered.slice(0, 3);
       const medals = ['🥇 المركز الأول', '🥈 المركز الثاني', '🥉 المركز الثالث'];
       const colors = ['#f59e0b', '#9ca3af', '#b45309'];
       
       if(top3.length > 0) {
         podiumContainer.innerHTML = top3.map((s, index) => `
           <div style="text-align:center; padding: 10px; background: rgba(0,0,0,0.02); border-radius: 8px; border-bottom: 3px solid ${colors[index]}; width: 30%;">
             <div style="font-size: 1.1rem; margin-bottom: 5px;">${medals[index]}</div>
             <div style="font-weight:bold; font-size: 0.95rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${s.full_name}">${s.full_name.split(' ').slice(0,2).join(' ')}</div>
             <div style="color:var(--color-primary-dark); font-weight:bold;">${allScores[s.id]||0} نقطة</div>
           </div>
         `).join('');
       } else {
         podiumContainer.innerHTML = '<div style="color:#666;">لا يوجد بيانات للعرض</div>';
       }
    }

    if(bestBatchNameEl) {
       const batchStats = {};
       allStudents.forEach(s => {
         if(!batchStats[s.batch_number]) batchStats[s.batch_number] = { totalScore: 0, count: 0 };
         batchStats[s.batch_number].totalScore += (allScores[s.id] || 0);
         batchStats[s.batch_number].count += 1;
       });

       let bestBatchNum = null;
       let bestAverage = -1;
       
       for(const b in batchStats) {
         if(batchStats[b].count > 0) {
            const avg = batchStats[b].totalScore / batchStats[b].count;
            if(avg > bestAverage) {
              bestAverage = avg;
              bestBatchNum = b;
            }
         }
       }
       
       if(bestBatchNum && bestAverage > 0) {
          bestBatchNameEl.textContent = `الدفعة رقم (${bestBatchNum}) بمتوسط ${bestAverage.toFixed(1)} نقطة/طالب`;
       } else {
          bestBatchNameEl.textContent = 'البيانات غير كافية للقياس';
       }
    }
    // ===============================================

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
