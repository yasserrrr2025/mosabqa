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
      // 1. Fetch Custom Settings (Batch & Status)
      const { data: sData, error: sErr } = await supabase.from('settings').select('*').limit(1);
      if(sErr) throw sErr;
      
      const settingsData = (sData && sData.length > 0) ? sData[0] : { current_batch: 1, is_registration_open: true, max_capacity: 25 };
      
      currentSettingsId = settingsData ? settingsData.id : null;
      currentBatchDisplay.textContent = settingsData.current_batch;
      regStatusDisplay.textContent = settingsData.is_registration_open ? 'مفتوح 🟢' : 'مغلق (مكتمل) 🔴';
      regStatusDisplay.style.color = settingsData.is_registration_open ? '#16a34a' : '#dc2626';
      if(capacityInput) capacityInput.value = settingsData.max_capacity || 25;
      currentBatch = settingsData.current_batch;

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
      console.error('تحذير من لوحة الإدارة:', err);
      alert('خطأ تقني عند تحميل البيانات: ' + (err.message || 'خطأ غير معروف'));
    }
  }

  async function buildRoster(batchNum) {
    if (!batchNum) return;
    
    const currentStudents = allStudents.filter(s => s.batch_number === batchNum);
    const rosterTableBody = document.getElementById('roster-table-body');
    const rosterGradeFilter = document.getElementById('roster-grade-filter');
    const rosterSearch = document.getElementById('roster-search');
    const rosterTitle = document.getElementById('roster-title');
    const rosterSubtitle = document.getElementById('roster-subtitle');
    const tabActiveBtn = document.getElementById('show-active-tabs');
    const tabWaitlistBtn = document.getElementById('show-waitlist-tabs');

    if (!rosterTableBody) return;

    // Tab Listeners
    tabActiveBtn.onclick = () => {
      currentRosterTab = 'active';
      updateTabUI();
      renderRosterPreview(rosterGradeFilter.value, rosterSearch.value);
    };
    tabWaitlistBtn.onclick = () => {
      currentRosterTab = 'waitlist';
      updateTabUI();
      renderRosterPreview(rosterGradeFilter.value, rosterSearch.value);
    };

    function updateTabUI() {
      if (currentRosterTab === 'active') {
        tabActiveBtn.style.background = 'var(--color-primary)';
        tabActiveBtn.style.color = '#fff';
        tabWaitlistBtn.style.background = 'transparent';
        tabWaitlistBtn.style.color = '#666';
        rosterTitle.textContent = '📋 تقرير المشاركين - الدفعة الحالية';
        rosterSubtitle.textContent = 'إدارة بيانات ومعلومات الطلاب في الدورة الحالية';
      } else {
        tabWaitlistBtn.style.background = 'var(--color-primary)';
        tabWaitlistBtn.style.color = '#fff';
        tabActiveBtn.style.background = 'transparent';
        tabActiveBtn.style.color = '#666';
        rosterTitle.textContent = '⏳ الطلاب الاحتياط - الدفعة الحالية';
        rosterSubtitle.textContent = 'قائمة الانتظار مرتبة حسب أولوية التسجيل (من الأقدم للأحدث)';
      }
    }

    // Populate grade dropdown
    const grades = [...new Set(currentStudents.map(s => s.grade).filter(Boolean))].sort();
    rosterGradeFilter.innerHTML = '<option value="all">جميع الصفوف</option>';
    grades.forEach(g => {
      const opt = document.createElement('option');
      opt.value = g;
      opt.textContent = g;
      rosterGradeFilter.appendChild(opt);
    });

    const renderRosterPreview = (gradeFilter, searchFilter = '') => {
      const isWaitMode = currentRosterTab === 'waitlist';
      
      let filtered = currentStudents.filter(s => {
        const matchesStatus = isWaitMode ? (s.status === 'waitlisted') : (s.status === 'active');
        const matchesGrade = gradeFilter === 'all' || s.grade === gradeFilter;
        const matchesSearch = !searchFilter || 
                             s.full_name.toLowerCase().includes(searchFilter.toLowerCase()) || 
                             (s.national_id && s.national_id.includes(searchFilter));
        return matchesStatus && matchesGrade && matchesSearch;
      });

      // Sort Waitlist by CreatedAt (Oldest first)
      if (isWaitMode) {
        filtered.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      } else {
        filtered.sort((a, b) => {
          if ((a.grade || '') === (b.grade || '')) {
            return (a.class_number || '').toString().localeCompare((b.class_number || '').toString());
          }
          return (a.grade || '').localeCompare(b.grade || '');
        });
      }

      // Update Table Headers
      const headerRow = document.getElementById('roster-table-header');
      if (isWaitMode) {
        headerRow.innerHTML = `
          <th width="10%">ترتيب</th>
          <th width="35%">اسم الطالب</th>
          <th width="15%">وقت التسجيل</th>
          <th width="20%">الصف / الفصل</th>
          <th width="20%">إجراء</th>
        `;
      } else {
        headerRow.innerHTML = `
          <th width="40%">اسم الطالب</th>
          <th width="20%">الصف</th>
          <th width="20%">الفصل</th>
          <th width="20%">إجراء</th>
        `;
      }

      rosterTableBody.innerHTML = '';
      if (filtered.length === 0) {
        const colspan = isWaitMode ? 5 : 4;
        rosterTableBody.innerHTML = `<tr><td colspan="${colspan}" style="text-align:center; padding:30px; color:#999;">لا يوجد طلاب في هذه القائمة حالياً</td></tr>`;
        return;
      }

      filtered.forEach((s, i) => {
        const tr = document.createElement('tr');
        if (isWaitMode) {
          tr.innerHTML = `
            <td style="text-align:center;"><span style="background:var(--color-gold); color:#fff; font-weight:bold; padding:2px 10px; border-radius:8px;">${i + 1}</span></td>
            <td><strong>${s.full_name}</strong></td>
            <td style="text-align:center; font-size:0.8rem;">${new Date(s.created_at).toLocaleTimeString('ar-SA', {hour:'2-digit', minute:'2-digit'})}</td>
            <td style="text-align:center;">${s.grade || '-'} - ${s.class_number || '-'}</td>
            <td style="text-align:center;">
              <button class="promote-btn" style="background:#16a34a;color:#fff;border:none;padding:5px 12px;border-radius:6px;font-size:0.8rem;cursor:pointer;font-weight:700;">✅ ترقية</button>
            </td>
          `;
          tr.querySelector('.promote-btn').addEventListener('click', () => promoteStudent(s.id, s.full_name));
        } else {
          tr.innerHTML = `
            <td><strong>${i + 1}- ${s.full_name}</strong></td>
            <td style="text-align:center;">${s.grade || '-'}</td>
            <td style="text-align:center;">${s.class_number || '-'}</td>
            <td style="text-align:center;">
              <button class="del-btn" style="background:#dc2626;color:#fff;border:none;padding:5px 12px;border-radius:6px;font-size:0.8rem;cursor:pointer;font-weight:700;">🗑️ حذف</button>
            </td>
          `;
          tr.querySelector('.del-btn').addEventListener('click', () => deleteStudent(s.id, s.full_name));
        }
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

    // 1. Separate Active and Waitlisted
    const activeStudents = filtered.filter(s => s.status !== 'waitlisted');
    const waitlistedStudents = filtered.filter(s => s.status === 'waitlisted');
    
    // 2. Sort Active by Points
    activeStudents.sort((a, b) => {
      const scoreA = allScores[a.id] || 0;
      const scoreB = allScores[b.id] || 0;
      return scoreB - scoreA;
    });

    // 3. Sort Waitlist by Registration Date (Oldest First)
    waitlistedStudents.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    // ========== Analytics: Podium & Best Batch ==========
    if(podiumContainer) {
       podiumContainer.innerHTML = '';
       // Remove the fixed height so names don't get clipped
       podiumContainer.style.height = 'auto';
       podiumContainer.style.minHeight = '80px';
       podiumContainer.style.alignItems = 'stretch';

       const top3 = activeStudents.slice(0, 3);
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

    // Clear both tables first
    adminTableBody.innerHTML = '';
    const waitlistTableBody = document.getElementById('waitlist-table-body');
    if(waitlistTableBody) waitlistTableBody.innerHTML = '';

    // Render Active Students (Table 1)
    let rank = 1;
    activeStudents.forEach(student => {
      const score = allScores[student.id] || 0;
      let finalEval = 'جيد وحافظ';
      if(score > 60) finalEval = 'متميز ومتقن لحفظه';
      else if(score > 30) finalEval = 'جيد جداً وثابت';
      else if(score === 0) finalEval = 'لم يستكمل التقييم';
      
      const tr = document.createElement('tr');
      const dateObj = new Date(student.created_at);
      const formattedDate = dateObj.toLocaleDateString('ar-SA', { day: '2-digit', month: '2-digit' });
      const formattedTime = dateObj.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', hour12: true });
      
      tr.innerHTML = `
        <td>
           <strong>${rank}- ${student.full_name}</strong><br>
           <span style="font-size:0.85rem; color:#666;">${student.grade} - فصل ${student.class_number}</span>
        </td>
        <td style="text-align:center;">${student.national_id}</td>
        <td dir="ltr" style="text-align:center;">${student.parent_phone}</td>
        <td style="text-align:center;">
           <div style="font-size:0.85rem; font-weight:bold;">${formattedDate}</div>
           <div style="font-size:0.75rem; color:#666;">${formattedTime}</div>
        </td>
        <td style="font-weight:bold; color:var(--color-primary-dark); text-align:center; font-size:1.1rem;">${student.batch_number}</td>
        <td style="text-align:center;">
           <span style="display:block; font-weight:bold; color:var(--color-gold-dark);">${score} نقطة</span>
           <span style="font-size:0.9rem;">${finalEval}</span>
        </td>
        <td style="text-align:center; padding:6px; vertical-align:middle;">
          <button class="del-btn" data-id="${student.id}"
            style="background:linear-gradient(135deg,#ef4444,#dc2626);color:#fff;border:none;padding:7px 14px;border-radius:8px;font-size:0.85rem;cursor:pointer;font-weight:700;font-family:inherit;white-space:nowrap;display:inline-block;">
            🗑️ حذف
          </button>
        </td>
      `;
      tr.querySelector('.del-btn').addEventListener('click', () => deleteStudent(student.id, student.full_name));
      adminTableBody.appendChild(tr);
      rank++;
    });

    // Render Waitlist Students (Table 2)
    const waitlistSection = document.getElementById('waitlist-section');
    if (waitlistTableBody) {
      if (waitlistedStudents.length > 0) {
        if(waitlistSection) waitlistSection.style.display = 'block';
        waitlistedStudents.forEach((student, index) => {
          const tr = document.createElement('tr');
          const dateObj = new Date(student.created_at);
          const formattedDate = dateObj.toLocaleDateString('ar-SA', { day: '2-digit', month: '2-digit' });
          const formattedTime = dateObj.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', hour12: true });
          
          tr.innerHTML = `
            <td style="text-align:center;">
              <span style="background:var(--color-gold); color:#fff; font-weight:bold; padding:4px 12px; border-radius:10px; font-size:1.1rem;">${index + 1}</span>
            </td>
            <td><strong>${student.full_name}</strong><br><span style="font-size:0.8rem; color:#666;">رقم الهوية: ${student.national_id}</span></td>
            <td style="text-align:center;">
              <div style="font-size:0.85rem; font-weight:bold;">${formattedDate}</div>
              <div style="font-size:0.75rem; color:#666;">${formattedTime}</div>
            </td>
            <td style="text-align:center;">${student.grade} - ${student.class_number}</td>
            <td dir="ltr" style="text-align:center;">${student.parent_phone}</td>
            <td style="text-align:center; padding:6px; vertical-align:middle;">
              <div style="display:flex; gap:5px; justify-content:center;">
                <button class="promote-btn" style="background:#16a34a;color:#fff;border:none;padding:7px 10px;border-radius:8px;font-size:0.8rem;cursor:pointer;font-weight:700;font-family:inherit;">✅ ترقية</button>
                <button class="del-btn" style="background:#dc2626;color:#fff;border:none;padding:7px 10px;border-radius:8px;font-size:0.8rem;cursor:pointer;font-weight:700;font-family:inherit;">🗑️ حذف</button>
              </div>
            </td>
          `;
          tr.querySelector('.promote-btn').addEventListener('click', () => promoteStudent(student.id, student.full_name));
          tr.querySelector('.del-btn').addEventListener('click', () => deleteStudent(student.id, student.full_name));
          waitlistTableBody.appendChild(tr);
        });
      } else {
        if(waitlistSection) waitlistSection.style.display = 'none';
      }
    }
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
    if (!confirm(`هل تريد حذف الطالب "${name}" بشكل نهائي؟`)) return;
    try {
      // Get current status/batch for promotion check
      const { data: stdData } = await supabase.from('registrations').select('status, batch_number').eq('id', id).single();
      const wasActive = stdData && stdData.status === 'active';
      const batchNum = stdData ? stdData.batch_number : null;

      // Delete student (Database will automatically delete evaluations via CASCADE)
      const { error } = await supabase.from('registrations').delete().eq('id', id);
      if (error) throw error;

      // Automatically offer to promote from waitlist if an active student was removed
      if (wasActive && batchNum) {
          const { data: waitlisted } = await supabase
            .from('registrations')
            .select('*')
            .eq('batch_number', batchNum)
            .eq('status', 'waitlisted')
            .order('created_at', { ascending: true })
            .limit(1);

          if (waitlisted && waitlisted.length > 0) {
              const nextStudent = waitlisted[0];
              if (confirm(`تم إفراغ مقعد! هل تريد ترقية الطالب "${nextStudent.full_name}" من قائمة الاحتياط تلقائياً؟`)) {
                  await promoteStudent(nextStudent.id, nextStudent.full_name);
              }
          }
      }

      await loadAdminDashboard();
    } catch(err) {
      console.error(err);
      alert('حدث خطأ أثناء الحذف: ' + err.message);
    }
  }

  async function promoteStudent(id, name) {
      try {
          const { error } = await supabase
            .from('registrations')
            .update({ status: 'active' })
            .eq('id', id);
          
          if (error) throw error;
          alert(`تمت ترقية الطالب "${name}" ليكون طالباً أساسياً بنجاح!`);
          await loadAdminDashboard();
      } catch(err) {
          console.error(err);
          alert('خطأ في الترقية: ' + err.message);
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
    const classNum   = document.getElementById('m-class').value;
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
