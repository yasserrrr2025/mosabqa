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
  let currentBatch = 1;

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
        currentBatch = settingsData.current_batch;
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

  function buildRoster(batchNum) {
    const rosterGradeFilter = document.getElementById('roster-grade-filter');
    const rosterTableBody = document.getElementById('roster-table-body');
    if (!rosterGradeFilter || !rosterTableBody) return;

    // Filter to current batch only
    const currentStudents = allStudents.filter(s => s.batch_number === batchNum);

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
    window._rosterBatch = batchNum;
  }

  window.printRoster = function() {
    const filter = document.getElementById('roster-grade-filter') ? document.getElementById('roster-grade-filter').value : 'all';
    const students = filter === 'all'
      ? (window._rosterStudents || [])
      : (window._rosterStudents || []).filter(function(s) { return s.grade === filter; });

    const batchNum = window._rosterBatch || '';
    const today = new Date().toLocaleDateString('ar-SA-u-nu-latn');
    const title = filter === 'all'
      ? 'بيان بأسماء جميع الطلاب المشاركين'
      : ('بيان طلاب ' + filter + ' المشاركين');

    const rowsArr = students.map(function(s, i) {
      return '<tr>' +
        '<td style="text-align:right;"><strong>' + (i+1) + '- ' + s.full_name + '</strong></td>' +
        '<td>' + (s.grade||'-') + '</td>' +
        '<td>' + (s.class_number||'-') + '</td>' +
      '</tr>';
    });

    const theadHTML = '<tr>' +
      '<th style="width:60%;text-align:right;padding-right:10px;">اسم الطالب</th>' +
      '<th style="width:20%;">الصف</th>' +
      '<th style="width:20%;">الفصل</th>' +
    '</tr>';

    function buildPages(thead, rows) {
      var perPage = 9;
      if (!rows || rows.length === 0) {
        return '<table><thead>' + thead + '</thead><tbody>' +
          '<tr><td colspan="3" style="text-align:center;color:#999;">لا يوجد بيانات</td></tr>' +
          '</tbody></table>';
      }
      var pages = [];
      for (var i = 0; i < rows.length; i += perPage) pages.push(rows.slice(i, i + perPage));
      return pages.map(function(chunk, idx) {
        var isLast = idx === pages.length - 1;
        return '<div style="page-break-after:' + (isLast ? 'auto' : 'always') + ';">' +
          '<table><thead>' + thead + '</thead><tbody>' + chunk.join('') + '</tbody></table></div>';
      }).join('');
    }

    const gFont = 'https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;800&family=Amiri:wght@400;700&display=swap';
    const css = [
      '@page { margin: 8mm; size: A4 portrait; }',
      '* { box-sizing: border-box; margin: 0; padding: 0; }',
      'body { font-family: Cairo, sans-serif; background: #fff; color: #111; direction: rtl; }',
      '.header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 12px; border-bottom: 2px solid #ccc; margin-bottom: 15px; }',
      '.header-side { font-weight: bold; font-size: 10pt; line-height: 1.8; }',
      '.header-center { text-align: center; flex-grow: 1; }',
      '.header-center img { height: 65px; object-fit: contain; }',
      '.report-title { text-align: center; margin: 10px 0 15px; }',
      '.report-title h2 { font-size: 15pt; display: inline-block; border-bottom: 2px solid #888; padding-bottom: 6px; }',
      'table { width: 100%; border-collapse: collapse; }',
      'th { background-color: #f1f5f9 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-weight: 800; font-size: 11pt; padding: 10px 8px; border: 1px solid #a0aec0; text-align: center; }',
      'td { padding: 9px 8px; border: 1px solid #a0aec0; font-size: 10pt; vertical-align: middle; text-align: center; }',
      'tr { page-break-inside: avoid; }',
      'tbody tr:nth-child(even) { background-color: #f8fafc !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }',
      '.signature { display: flex; justify-content: space-between; margin-top: 45px; padding: 0 10px; font-size: 11pt; font-weight: bold; page-break-inside: avoid; }',
      '.signature div { text-align: center; line-height: 4; }'
    ].join(' ');

    const header = '<div class="header">' +
      '<div class="header-side" style="text-align:right;">' +
        'المملكة العربية السعودية<br>' +
        'وزارة التعليم<br>' +
        'إدارة التعليم بمحافظة جدة<br>' +
        'مدرسة عماد الدين زنكي المتوسطة' +
      '</div>' +
      '<div class="header-center"><img src="/new-logo.png" alt="logo"></div>' +
      '<div class="header-side" style="text-align:left;">' +
        'رقم الدفعة: ' + batchNum + '<br>' +
        'تاريخ التقرير: ' + today +
      '</div></div>';

    const sig = '<div class="signature">' +
      '<div>المعلم<br>فهد علي آل رده</div>' +
      '<div>الختم الرسمي<br>....................</div>' +
      '<div>مدير المدرسة<br>عابد عبيد الجدعاني</div>' +
    '</div>';

    const bodyContent = header +
      '<div class="report-title"><h2>' + title + '</h2></div>' +
      buildPages(theadHTML, rowsArr) + sig;

    const htmlDoc = '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>' + title + '</title>' +
      '<link href="' + gFont + '" rel="stylesheet">' +
      '<style>' + css + '</style></head><body>' + bodyContent +
      '<scr' + 'ipt>window.onload=function(){window.print();window.onafterprint=function(){window.close();};};<' + '/script>' +
      '</body></html>';

    const win = window.open('', '_blank', 'width=900,height=700');
    win.document.open(); win.document.write(htmlDoc); win.document.close();
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
      adminTableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px; color:#999;">لا يوجد بيانات للعرض.</td></tr>';
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
       // Remove the fixed height so names don't get clipped
       podiumContainer.style.height = 'auto';
       podiumContainer.style.minHeight = '80px';
       podiumContainer.style.alignItems = 'stretch';

       const top3 = filtered.slice(0, 3);
       const medals = ['🥇', '🥈', '🥉'];
       const labels = ['المركز الأول', 'المركز الثاني', 'المركز الثالث'];
       const colors = ['#f59e0b', '#9ca3af', '#b45309'];
       const bgColors = ['rgba(245,158,11,0.08)', 'rgba(156,163,175,0.08)', 'rgba(180,83,9,0.08)'];
       
       if(top3.length > 0) {
         podiumContainer.innerHTML = top3.map((s, index) => `
           <div style="text-align:center; padding: 12px 8px; background:${bgColors[index]}; border-radius:10px; border-bottom:3px solid ${colors[index]}; width:30%; display:flex; flex-direction:column; justify-content:center; gap:4px;">
             <div style="font-size: 1.4rem;">${medals[index]}</div>
             <div style="font-size: 0.78rem; color:#666; margin-bottom:2px;">${labels[index]}</div>
             <div style="font-weight:bold; font-size: 0.9rem; line-height:1.4; word-break:break-word; white-space:normal;">${s.full_name}</div>
             <div style="color:var(--color-primary-dark); font-weight:bold; font-size:0.88rem; margin-top:4px;">${allScores[s.id]||0} نقطة</div>
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
        <td class="no-print" style="text-align:center;">
          <button class="del-btn" data-id="${student.id}" data-name="${student.full_name}">🗑️ حذف</button>
        </td>
      `;
      // Delete handler
      tr.querySelector('.del-btn').addEventListener('click', () => deleteStudent(student.id, student.full_name));
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

  // ===== DELETE STUDENT =====
  async function deleteStudent(id, name) {
    if (!confirm(`هل تريد حذف الطالب "${name}" بشكل نهائي؟\nسيتم حذف جميع تقييماته أيضاً.`)) return;
    try {
      // Delete evaluations first
      await supabase.from('evaluations').delete().eq('student_id', id);
      // Delete student
      const { error } = await supabase.from('registrations').delete().eq('id', id);
      if (error) throw error;
      await loadAdminDashboard();
    } catch(err) {
      console.error(err);
      alert('حدث خطأ أثناء الحذف: ' + err.message);
    }
  }

  // ===== ADD STUDENT MODAL =====
  const addStudentBtn  = document.getElementById('add-student-btn');
  const modal          = document.getElementById('add-student-modal');
  const modalCloseBtn  = document.getElementById('modal-close-btn');
  const modalCancelBtn = document.getElementById('modal-cancel-btn');
  const addStudentForm = document.getElementById('add-student-form');
  const modalError     = document.getElementById('modal-error');
  const modalSubmitBtn = document.getElementById('modal-submit-btn');

  function openModal() {
    addStudentForm.reset();
    document.getElementById('m-nationality').value = 'سعودي';
    modalError.style.display = 'none';
    modal.style.display = 'flex';
    document.getElementById('m-name').focus();
  }
  function closeModal() {
    modal.style.display = 'none';
  }

  if (addStudentBtn) addStudentBtn.addEventListener('click', openModal);
  if (modalCloseBtn)  modalCloseBtn.addEventListener('click',  closeModal);
  if (modalCancelBtn) modalCancelBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  addStudentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    modalError.style.display = 'none';

    const name       = document.getElementById('m-name').value.trim();
    const nationalId = document.getElementById('m-national-id').value.trim();
    const phone      = document.getElementById('m-phone').value.trim();
    const grade      = document.getElementById('m-grade').value;
    const classNum   = document.getElementById('m-class').value.trim();
    const nationality= document.getElementById('m-nationality').value.trim() || 'سعودي';

    if (!name || !nationalId || !phone || !grade || !classNum) {
      modalError.style.display = 'block';
      return;
    }

    modalSubmitBtn.disabled = true;
    modalSubmitBtn.textContent = '⏳ جاري الحفظ...';

    try {
      const { error } = await supabase.from('registrations').insert([{
        full_name:    name,
        national_id:  nationalId,
        parent_phone: phone,
        grade:        grade,
        class_number: parseInt(classNum),
        nationality:  nationality,
        batch_number: currentBatch
      }]);
      if (error) throw error;
      closeModal();
      await loadAdminDashboard();
    } catch(err) {
      console.error(err);
      modalError.textContent = '❌ خطأ: ' + (err.message || 'فشل في الحفظ');
      modalError.style.display = 'block';
    } finally {
      modalSubmitBtn.disabled = false;
      modalSubmitBtn.textContent = '💾 حفظ الطالب';
    }
  });

  window.printAdminArchive = function() {
    if (!allStudents || allStudents.length === 0) return alert('لا يوجد بيانات للطباعة.');
    const filterEl = document.getElementById('batch-filter');
    const filterVal = filterEl ? filterEl.value : 'all';
    const filterLabel = filterVal === 'all' ? 'السجل التاريخي الشامل' : ('دفعة ' + filterVal);
    const today = new Date().toLocaleDateString('ar-SA-u-nu-latn');

    // Build rows from data (not DOM innerHTML) to avoid CSS variable issues
    let filtered = allStudents;
    if (filterVal !== 'all') {
      const bn = parseInt(filterVal);
      filtered = allStudents.filter(function(s) { return s.batch_number === bn; });
    }
    filtered = filtered.slice().sort(function(a, b) {
      return ((allScores[b.id]||0) - (allScores[a.id]||0));
    });

    const rowsArr = filtered.map(function(s, i) {
      const score = allScores[s.id] || 0;
      let eval_ = 'جيد وحافظ';
      if (score > 60) eval_ = 'متميز ومتقن';
      else if (score > 30) eval_ = 'جيد جداً وثابت';
      else if (score === 0) eval_ = 'لم يستكمل التقييم';
      return '<tr>' +
        '<td style="text-align:right;"><strong>' + (i+1) + '- ' + s.full_name + '</strong><br>' +
        '<small style="color:#666;">' + (s.grade||'') + ' - فصل ' + (s.class_number||'') + '</small></td>' +
        '<td style="text-align:center;">' + (s.national_id||'-') + '</td>' +
        '<td style="direction:ltr;text-align:right;">' + (s.parent_phone||'-') + '</td>' +
        '<td style="text-align:center;font-weight:bold;">' + (s.batch_number||'-') + '</td>' +
        '<td style="text-align:center;"><strong>' + score + ' نقطة</strong><br><small>' + eval_ + '</small></td>' +
        '</tr>';
    });

    const theadHTML = '<tr>' +
      '<th style="width:30%;text-align:right;padding-right:8px;">الطالب</th>' +
      '<th style="width:15%;">الهوية</th>' +
      '<th style="width:15%;">الجوال</th>' +
      '<th style="width:10%;">رقم الدفعة</th>' +
      '<th style="width:30%;">التقييم والنقاط</th>' +
      '</tr>';

    function buildPages(thead, rows) {
      var perPage = 9;
      var pages = [];
      for (var i = 0; i < rows.length; i += perPage) pages.push(rows.slice(i, i + perPage));
      return pages.map(function(chunk, idx) {
        var isLast = idx === pages.length - 1;
        return '<div style="page-break-after:' + (isLast ? 'auto' : 'always') + ';">' +
          '<table><thead>' + thead + '</thead><tbody>' + chunk.join('') + '</tbody></table></div>';
      }).join('');
    }

    const gFont = 'https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;800&family=Amiri:wght@400;700&display=swap';
    const css = [
      '@page { margin: 8mm; size: A4 portrait; }',
      '* { box-sizing: border-box; margin: 0; padding: 0; }',
      'body { font-family: Cairo, sans-serif; background: #fff; color: #111; direction: rtl; }',
      '.header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 12px; border-bottom: 2px solid #ccc; margin-bottom: 15px; }',
      '.header-side { font-weight: bold; font-size: 10pt; line-height: 1.8; }',
      '.header-center { text-align: center; flex-grow: 1; }',
      '.header-center img { height: 65px; object-fit: contain; }',
      '.report-title { text-align: center; margin: 10px 0 15px; }',
      '.report-title h2 { font-size: 15pt; display: inline-block; border-bottom: 2px solid #888; padding-bottom: 6px; }',
      'table { width: 100%; border-collapse: collapse; margin-bottom: 0; }',
      'th { background-color: #f1f5f9 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-weight: 800; font-size: 10pt; padding: 9px 6px; border: 1px solid #a0aec0; text-align: center; }',
      'td { padding: 8px 6px; border: 1px solid #a0aec0; font-size: 9.5pt; vertical-align: middle; }',
      'tr { page-break-inside: avoid; }',
      'tbody tr:nth-child(even) { background-color: #f8fafc !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }',
      '.signature { display: flex; justify-content: space-between; margin-top: 45px; padding: 0 10px; font-size: 11pt; font-weight: bold; page-break-inside: avoid; }',
      '.signature div { text-align: center; line-height: 4; }'
    ].join(' ');

    const header = '<div class="header">' +
      '<div class="header-side" style="text-align:right;">' +
        'المملكة العربية السعودية<br>' +
        'وزارة التعليم<br>' +
        'إدارة التعليم بمحافظة جدة<br>' +
        'مدرسة عماد الدين زنكي المتوسطة' +
      '</div>' +
      '<div class="header-center"><img src="/new-logo.png" alt="logo"></div>' +
      '<div class="header-side" style="text-align:left;">' +
        'السجل: ' + filterLabel + '<br>تاريخ: ' + today +
      '</div></div>';

    const sig = '<div class="signature">' +
      '<div>معلم الحلقة<br>فهد علي آل رده</div>' +
      '<div>الختم الرسمي<br>....................</div>' +
      '<div>مدير المدرسة<br>عابد عبيد الجدعاني</div>' +
    '</div>';

    const body = header +
      '<div class="report-title"><h2>السجل الشامل لخريجي حلقة تحفيظ القرآن الكريم</h2></div>' +
      buildPages(theadHTML, rowsArr) + sig;

    const htmlDoc = '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8">' +
      '<title>السجل الشامل</title>' +
      '<link href="' + gFont + '" rel="stylesheet">' +
      '<style>' + css + '</style></head><body>' + body +
      '<scr' + 'ipt>window.onload=function(){window.print();window.onafterprint=function(){window.close();};};<' + '/script>' +
      '</body></html>';

    const w = window.open('', '_blank', 'width=900,height=700');
    w.document.open(); w.document.write(htmlDoc); w.document.close();
  };
});
