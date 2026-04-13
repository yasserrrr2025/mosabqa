// Using global 'supabase' from CDN
const supabaseUrl = 'https://oypfhzkbibrpobrvzwtn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95cGZoemtiaWJycG9icnZ6d3RuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxMDY3ODAsImV4cCI6MjA5MDY4Mjc4MH0.pgHCJdvOxOD-btGMmpSIiRblk8o82VxQ2Z36rd7HyGg';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

document.addEventListener('DOMContentLoaded', () => {
  const loginBtn = document.getElementById('login-btn');
  const passwordInput = document.getElementById('teacherPassword');
  const loginSection = document.getElementById('login-section');
  const dashboardSection = document.getElementById('dashboard-section');
  const errorMsg = document.getElementById('login-error');
  const currentBatchBadge = document.getElementById('batch-number-badge');
  
  // Display today's date
  const dateDisp = document.getElementById('current-date-display');
  if (dateDisp) {
      dateDisp.textContent = new Date().toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }

  loginBtn.addEventListener('click', async () => {
    // Simple frontend protection
    if (passwordInput.value === '1214') { 
      loginSection.style.display = 'none';
      dashboardSection.style.display = 'block';
      await loadDashboard();
    } else {
      errorMsg.style.display = 'block';
    }
  });

  async function loadDashboard() {
    try {
      // 0. Date Handling
      let selectedDate = document.getElementById('eval-date-picker').value;
      if (!selectedDate) {
          selectedDate = getSaudiDateStr();
          document.getElementById('eval-date-picker').value = selectedDate;
      }
      
      const dateObj = new Date(selectedDate);
      const displayDay = dateObj.toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      document.getElementById('current-date-badge').textContent = selectedDate;
      document.getElementById('info-bar-day').textContent = dateObj.toLocaleDateString('ar-SA', { weekday: 'long' });

      // 1. Fetch Settings
      const { data: sData, error: sErr } = await supabase.from('settings').select('*').limit(1);
      if (sErr) throw new Error(`خطأ في جدول الإعدادات: ${sErr.message}`);
      
      const settings = (sData && sData.length > 0) ? sData[0] : { current_batch: 1 };
      const batchNum = settings.current_batch;

      document.getElementById('batch-number-badge').textContent = batchNum;

      // 2. Fetch Students
      const { data: students, error: stdErr } = await supabase.from('registrations')
        .select('*')
        .eq('batch_number', batchNum)
        .order('full_name', { ascending: true });
      
      if (stdErr) throw new Error(`خطأ في جدول التسجيلات: ${stdErr.message}`);

      const activeStudents = students.filter(s => s.status === 'active' || s.status === 'accepted');
      const waitlistStudents = students.filter(s => s.status === 'waitlisted').sort((a,b) => new Date(a.created_at) - new Date(b.created_at));
      
      document.getElementById('active-count-badge').textContent = activeStudents.length;

      // 3. Fetch Evaluations
      const { data: evals, error: evalErr } = await supabase.from('evaluations').select('*');
      if (evalErr) throw new Error(`خطأ في جدول التقييمات: ${evalErr.message}`);

      const scores = {};
      (evals || []).forEach(ev => {
        if (!scores[ev.student_id]) scores[ev.student_id] = 0;
        scores[ev.student_id] += calculateDayScore(ev.performance, ev.pages_count);
      });
      
      window.currentScores = scores;
      window.currentStudents = activeStudents;
      window.allStudents = students;

      renderEvaluationGrid(activeStudents, evals, scores, selectedDate);
      renderManagementSection(activeStudents, waitlistStudents);

    } catch (err) {
      console.error(err);
      alert('خطأ تقني: ' + err.message);
    }
  }

  function renderEvaluationGrid(students, evals, scores, targetDate) {
      const studentsGrid = document.getElementById('students-grid');
      studentsGrid.innerHTML = '';
      
      const targetMap = {};
      (evals || []).forEach(e => {
         const eDate = e.eval_date || new Date(e.created_at).toISOString().split('T')[0];
         if (eDate === targetDate) targetMap[e.student_id] = e;
      });
      
      students.forEach((student, i) => {
        const totalScore = scores[student.id] || 0;
        const currentEval = targetMap[student.id] || {};
        
        const att = currentEval.attendance_status || 'حاضر';
        const perf = currentEval.performance || 'ممتاز';
        const track = currentEval.track || 'حفظ أجزاء';
        const pages = currentEval.pages_count || 0;
        const note = currentEval.notes || '';
        const memo = currentEval.memorized_part || '';
        
        const card = document.createElement('div');
        card.className = 'student-eval-card';
        card.id = `card-${student.id}`;
        card.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: start;">
            <h3 style="margin:0; font-size:1.1rem; color:var(--color-primary-dark);">${i+1}. ${student.full_name}</h3>
            <span style="background: #fffbeb; color: #b45309; border: 1px solid #fde68a; padding: 4px 10px; border-radius: 12px; font-weight: 800; font-size: 0.85rem;">الإجمالي: ${totalScore}</span>
          </div>
          <div style="margin: 8px 0 18px; font-size: 0.85rem; color: #64748b; font-weight:600;">
             ${student.grade} - فصل ${student.class_number}
          </div>

          <div class="eval-card-row">
            <label style="color:#64748b; font-weight:700;">حالة الحضور:</label>
            <div class="pill-group">
              <input type="radio" name="att-${student.id}" id="att-p-${student.id}" class="pill-radio att-present" value="حاضر" ${att==='حاضر'?'checked':''}>
              <label for="att-p-${student.id}" class="pill-label">حاضر</label>
              <input type="radio" name="att-${student.id}" id="att-e-${student.id}" class="pill-radio att-excused" value="مستأذن" ${att==='مستأذن'?'checked':''}>
              <label for="att-e-${student.id}" class="pill-label">مستأذن</label>
              <input type="radio" name="att-${student.id}" id="att-a-${student.id}" class="pill-radio att-absent" value="غائب" ${att==='غائب'?'checked':''}>
              <label for="att-a-${student.id}" class="pill-label">غائب</label>
            </div>
          </div>

          <div class="eval-card-row">
            <label style="color:#64748b; font-weight:700;">المسار الحالي:</label>
            <div class="pill-group">
              <input type="radio" name="track-${student.id}" id="tr-p-${student.id}" class="pill-radio" value="حفظ أجزاء" ${track==='حفظ أجزاء'?'checked':''}>
              <label for="tr-p-${student.id}" class="pill-label">أجزاء</label>
              <input type="radio" name="track-${student.id}" id="tr-f-${student.id}" class="pill-radio" value="فضائل السور" ${track==='فضائل السور'?'checked':''}>
              <label for="tr-f-${student.id}" class="pill-label">فضائل</label>
              <input type="radio" name="track-${student.id}" id="tr-t-${student.id}" class="pill-radio" value="تحسين تلاوة" ${track==='تحسين تلاوة'?'checked':''}>
              <label for="tr-t-${student.id}" class="pill-label">تلاوة</label>
            </div>
          </div>

          <div class="eval-card-row">
            <label style="color:#64748b; font-weight:700;">الأداء اليومي:</label>
            <div class="pill-group">
              <input type="radio" name="perf-${student.id}" id="p-ex-${student.id}" class="pill-radio perf-excellent" value="ممتاز" ${perf==='ممتاز'?'checked':''}>
              <label for="p-ex-${student.id}" class="pill-label">ممتاز</label>
              <input type="radio" name="perf-${student.id}" id="p-vg-${student.id}" class="pill-radio perf-vgood" value="جيد جداً" ${perf==='جيد جداً'?'checked':''}>
              <label for="p-vg-${student.id}" class="pill-label">جيد جداً</label>
              <input type="radio" name="perf-${student.id}" id="p-g-${student.id}" class="pill-radio perf-good" value="جيد" ${perf==='جيد'?'checked':''}>
              <label for="p-g-${student.id}" class="pill-label">جيد</label>
            </div>
          </div>

          <div class="eval-card-row">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <label style="color:#64748b; font-weight:700;">عدد الصفحات المنجزة:</label>
                <span style="background:#f1f5f9; padding:2px 10px; border-radius:10px; font-weight:bold; font-size:0.8rem; color:var(--color-accent);">نقاط الإنجاز: +${calculateDayScore(perf, pages)}</span>
            </div>
            <div class="page-pills">
              ${[0,1,2,3,4,5,6,7,8,9,10,12].map(n => `
                <input type="radio" name="pages-${student.id}" id="pg-${n}-${student.id}" class="page-radio" value="${n}" ${pages==n?'checked':''}>
                <label for="pg-${n}-${student.id}" class="page-label">${n||'❌'}</label>
              `).join('')}
            </div>
          </div>

          <div class="eval-card-row" style="margin-top:20px; border-top: 1px solid #f1f5f9; padding-top:20px; display:flex; flex-direction:column; gap:12px;">
            <input type="text" class="notes-input" id="memo-${student.id}" placeholder="📖 السورة والآيات التي تم تسميعها.." value="${memo}">
            <input type="text" class="notes-input" id="note-${student.id}" placeholder="💡 ملاحظات توجيهية لولي الأمر.." value="${note}">
            <button class="save-btn" onclick="window.saveEval('${student.id}')" id="btn-${student.id}">✅ اعتماد التقييم</button>
          </div>
        `;
        studentsGrid.appendChild(card);
      });
  }

  function renderManagementSection(active, waitlist) {
      const activeBody = document.getElementById('mgmt-active-body');
      const waitBody = document.getElementById('mgmt-waitlist-body');
      if(!activeBody) return;

      activeBody.innerHTML = active.map((s, i) => `
        <tr>
          <td><strong>${i+1}. ${s.full_name}</strong></td>
          <td style="text-align:center;">${s.grade}</td>
          <td style="text-align:center;">
            <button onclick="window.teacherDeleteStudent('${s.id}', '${s.full_name}')" style="background:#fee2e2; color:#dc2626; border:none; padding:6px 12px; border-radius:8px; cursor:pointer; font-weight:bold;">🗑️ حذف</button>
          </td>
        </tr>
      `).join('');

      waitBody.innerHTML = waitlist.length ? waitlist.map((s, i) => `
      <tr>
        <td style="text-align:center;"><span style="background:#f59e0b; color:#fff; padding:2px 8px; border-radius:5px; font-weight:bold;">${i+1}</span></td>
        <td><strong>${s.full_name}</strong><br><small style="color:#999; font-size:0.75rem;">🗓️ ${new Date(s.created_at).toLocaleDateString('ar-SA')}</small></td>
        <td style="text-align:center;">${s.grade || '-'}</td>
        <td style="text-align:center;">${s.class_number || '-'}</td>
        <td style="text-align:center; display:flex; gap:5px; justify-content:center;">
          <button onclick="window.teacherPromoteStudent('${s.id}', '${s.full_name}')" style="background:#16a34a; color:#fff; border:none; padding:6px 10px; border-radius:8px; cursor:pointer; font-weight:bold; font-size:0.75rem;">✅ ترقية</button>
          <button onclick="window.teacherDeleteStudent('${s.id}', '${s.full_name}')" style="background:#fee2e2; color:#dc2626; border:none; padding:6px 10px; border-radius:8px; cursor:pointer; font-weight:bold; font-size:0.75rem;">🗑️ حذف</button>
        </td>
      </tr>
    `).join('') : '<tr><td colspan="5" style="text-align:center; padding:20px; color:#999;">لا يوجد طلاب احتياط حالياً</td></tr>';
  }

  // Toggle logic
  document.getElementById('toggle-mgmt-btn')?.addEventListener('click', () => {
      const evalSec = document.getElementById('eval-section');
      const mgmtSec = document.getElementById('mgmt-section');
      const btn = document.getElementById('toggle-mgmt-btn');
      const isShowingMgmt = mgmtSec.style.display === 'block';

      if (isShowingMgmt) {
          mgmtSec.style.display = 'none';
          evalSec.style.display = 'block';
          btn.innerHTML = '⚙️ إدارة الطلاب';
          btn.style.background = 'linear-gradient(135deg, #4f46e5, #4338ca)';
      } else {
          evalSec.style.display = 'none';
          mgmtSec.style.display = 'block';
          btn.innerHTML = '📚 العودة للتقييم';
          btn.style.background = 'linear-gradient(135deg, #6b7280, #4b5563)';
      }
  });

  window.teacherDeleteStudent = async function(id, name) {
      if (!confirm(`تحذير: هل أنت متأكد من حذف الطالب "${name}"؟\nسيتم حذفه نهائياً من كافة السجلات واللوحات.`)) return;
      
      try {
          // 1. Check current status
          const { data: stdData, error: fetchErr } = await supabase.from('registrations').select('status, batch_number').eq('id', id).single();
          if (fetchErr) throw fetchErr;

          const wasActive = stdData && (stdData.status === 'active' || stdData.status === 'accepted');
          const batchNum = stdData ? stdData.batch_number : null;

          // 2. Perform Delete
          // In Supabase, delete might succeed (no error) but affect 0 rows if RLS is restrictive.
          const { error, count } = await supabase.from('registrations')
            .delete({ count: 'exact' })
            .eq('id', id);

          if (error) throw error;
          
          if (count === 0) {
              alert('عذراً، لم يتم حذف الطالب. قد لا تملك الصلاحية الكافية لحذف هذا السجل من قاعدة البيانات.');
              return;
          }
          
          alert('تم حذف الطالب من النظام بنجاح وتفريغ مقعده.');
          
          // 3. Auto-Promote Waitlist if seat was freed
          if (wasActive && batchNum) {
              const { data: waitlisted } = await supabase.from('registrations')
                .select('*')
                .eq('batch_number', batchNum)
                .eq('status', 'waitlisted')
                .order('created_at', { ascending: true })
                .limit(1);

              if (waitlisted && waitlisted.length > 0) {
                  if (confirm(`تم إفراغ مقعد! هل تريد ترقية الطالب "${waitlisted[0].full_name}" من قائمة الاحتياط الآن؟`)) {
                      await window.teacherPromoteStudent(waitlisted[0].id, waitlisted[0].full_name);
                  }
              }
          }

          // 4. Force UI Reload
          await loadDashboard();

      } catch(err) { 
          console.error("Delete Student Error:", err);
          alert('عذراً، حدث خطأ أثناء الحذف: ' + (err.message || 'قد لا تملك صلاحية حذف هذا السجل.')); 
      }
  };

  window.teacherPromoteStudent = async function(id, name) {
      try {
          const { error } = await supabase.from('registrations').update({ status: 'active' }).eq('id', id);
          if (error) throw error;
          alert(`تمت ترقية "${name}" بنجاح!`);
          loadDashboard();
      } catch(err) { alert('خطأ في الترقية.'); }
  };

  function calculateDayScore(perf, pages) {
      let p = 0;
      if (perf === 'ممتاز') p = 3;
      else if (perf === 'جيد جداً') p = 2;
      else if (perf === 'جيد') p = 1;
      return p + (parseInt(pages) || 0);
  }

  window.saveEval = async function(studentId) {
    const btn = document.getElementById(`btn-${studentId}`);
    const origText = btn.textContent;
    btn.textContent = '⏳ جاري الحفظ...';
    btn.disabled = true;

    const attendance = document.querySelector(`input[name="att-${studentId}"]:checked`)?.value || 'حاضر';
    const performance = document.querySelector(`input[name="perf-${studentId}"]:checked`)?.value || 'ممتاز';
    const track = document.querySelector(`input[name="track-${studentId}"]:checked`)?.value || 'حفظ أجزاء';
    const pages = document.querySelector(`input[name="pages-${studentId}"]:checked`)?.value || 0;
    const tajweedVal = document.querySelector(`input[name="tajweed-${studentId}"]:checked`)?.value || 'متقن للأحكام';
    const note = document.getElementById(`note-${studentId}`).value;
    const memo = document.getElementById(`memo-${studentId}`).value;
    
    // Use the date from the picker so we can edit old days correctly
    const todayStr = document.getElementById('eval-date-picker').value || getSaudiDateStr();
    const payload = {
      attendance_status: attendance,
      performance: performance,
      track: track,
      pages_count: parseInt(pages),
      tajweed: tajweedVal,
      notes: note,
      memorized_part: memo
    };

    try {
      const { data: existingEval } = await supabase.from('evaluations').select('id').eq('student_id', studentId).eq('eval_date', todayStr).maybeSingle();
      if (existingEval) {
        const { error } = await supabase.from('evaluations').update(payload).eq('id', existingEval.id);
        if(error) throw error;
      } else {
        const { error } = await supabase.from('evaluations').insert([{ ...payload, student_id: studentId, eval_date: todayStr }]);
        if(error) throw error;
      }
      
      btn.style.background = '#16a34a'; // Success green
      btn.textContent = 'تم التوثيق ✓';
      setTimeout(() => {
        btn.style.background = 'linear-gradient(135deg, var(--color-success), #15803d)';
        btn.textContent = origText;
        btn.disabled = false;
      }, 2000);

    } catch (error) {
      console.error(error);
      alert('حدث خطأ أثناء حفظ التقييم. راجع قاعدة البيانات.');
      btn.textContent = 'إعادة المحاولة';
      btn.disabled = false;
    }
  };

  /**
   * Helper to get Current Date in Saudi Arabia (KSA) as YYYY-MM-DD
   */
  function getSaudiDateStr() {
      const today = new Date();
      const saudiTime = new Date(today.toLocaleString("en-US", {timeZone: "Asia/Riyadh"}));
      const Y = saudiTime.getFullYear();
      const M = String(saudiTime.getMonth() + 1).padStart(2, '0');
      const D = String(saudiTime.getDate()).padStart(2, '0');
      return `${Y}-${M}-${D}`;
  }

  // ======= Shared print utilities =======
  function _printCSS() {
    return [
      '@page { margin: 8mm; size: A4 portrait; }',
      '* { box-sizing: border-box; margin: 0; padding: 0; }',
      "body { font-family: Cairo, sans-serif; background: #fff; color: #111; direction: rtl; }",
      '.header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 12px; border-bottom: 2px solid #ccc; margin-bottom: 15px; }',
      '.header-side { font-weight: bold; font-size: 10pt; line-height: 1.8; }',
      '.header-center { text-align: center; flex-grow: 1; }',
      '.header-center img { height: 65px; object-fit: contain; }',
      '.report-title { text-align: center; margin: 10px 0 15px; }',
      '.report-title h2 { font-size: 16pt; display: inline-block; border-bottom: 2px solid #888; padding-bottom: 6px; }',
      'table { width: 100%; border-collapse: collapse; }',
      'thead { display: table-header-group; }',
      'tr { page-break-inside: avoid; }',
      'th { background-color: #f1f5f9 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-weight: 800; font-size: 11pt; padding: 10px 8px; border: 1px solid #a0aec0; text-align: center; }',
      'td { padding: 9px 8px; border: 1px solid #a0aec0; font-size: 10pt; text-align: center; vertical-align: middle; }',
      'td.name-cell { text-align: right; }',
      'tbody tr:nth-child(even) { background-color: #f8fafc !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }',
      '.signature { display: flex; justify-content: space-between; margin-top: 45px; padding: 0 10px; font-size: 11pt; font-weight: bold; page-break-inside: avoid; }',
      '.signature div { text-align: center; line-height: 4; }'
    ].join(' ');
  }

  function _printHeader(batchNum, dateStr) {
    return '<div class="header">' +
      '<div class="header-side" style="text-align:right;">' +
        'المملكة العربية السعودية<br>وزارة التعليم<br>إدارة التعليم بمحافظة جدة<br>مدرسة عماد الدين زنكي المتوسطة' +
      '</div>' +
      '<div class="header-center"><img src="/new-logo.png" alt="logo"></div>' +
      '<div class="header-side" style="text-align:left;">' +
        'رقم الدفعة: ' + batchNum + '<br>تاريخ التقرير: ' + dateStr +
      '</div>' +
    '</div>';
  }

  function _printSignature() {
    return '<div class="signature">' +
      '<div>المعلم<br>فهد علي آل رده</div>' +
      '<div>الختم الرسمي<br>....................</div>' +
      '<div>مدير المدرسة<br>عابد عبيد الجدعاني</div>' +
    '</div>';
  }

  function _openPrintWin(titleText, bodyContent) {
    const gFont = 'https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;800&family=Amiri:wght@400;700&display=swap';
    const html = '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>' + titleText + '</title>' +
      '<link href="' + gFont + '" rel="stylesheet">' +
      '<style>' + _printCSS() + '</style></head><body>' + bodyContent +
      '<scr' + 'ipt>window.onload=function(){window.print();window.onafterprint=function(){window.close();};};<' + '/script>' +
      '</body></html>';
    const w = window.open('', '_blank', 'width=900,height=700');
    w.document.open(); w.document.write(html); w.document.close();
  }

  function _buildPages(theadHTML, rowsArr) {
    const perPage = 9;
    if (!rowsArr || rowsArr.length === 0) {
      return '<table><thead>' + theadHTML + '</thead><tbody><tr><td colspan="10" style="text-align:center;color:#999;padding:40px;">لا يوجد بيانات للعرض</td></tr></tbody></table>';
    }
    const chunks = [];
    for (let i = 0; i < rowsArr.length; i += perPage) chunks.push(rowsArr.slice(i, i + perPage));
    return chunks.map((chunk, idx) => `
      <div style="page-break-after: ${idx === chunks.length - 1 ? 'auto' : 'always'};">
        <table><thead>${theadHTML}</thead><tbody>${chunk.join('')}</tbody></table>
      </div>
    `).join('');
  }

  function _openPrintWin(titleText, bodyContent) {
    // Mobile-friendly inline printing approach
    const container = document.getElementById('print-report-area');
    container.innerHTML = bodyContent;
    
    // Temporarily title the page for print
    const oldTitle = document.title;
    document.title = titleText;
    
    // Add class to body to hide everything else
    document.body.classList.add('is-printing');
    
    // Trigger print
    window.print();
    
    // Cleanup after printing dialog closes
    setTimeout(() => {
      document.body.classList.remove('is-printing');
      document.title = oldTitle;
      container.innerHTML = '';
    }, 1000);
  }

  window.preparePrint = async function(type) {
    if (!window.currentStudents || window.currentStudents.length === 0) return alert('لا يوجد طلاب للطباعة.');
    const bEl = document.getElementById('batch-number-badge');
    const batchNum = bEl ? bEl.textContent.trim() : '';
    const today = new Date().toLocaleDateString('ar-SA-u-nu-latn');

    if (type === 'daily') {
      const rowsArr = window.currentStudents.map(function(s, i) {
        return '<tr><td class="name-cell"><strong>' + (i+1) + '- ' + s.full_name + '</strong></td>' +
          '<td>....................</td><td>....................</td><td>................................</td></tr>';
      });
      const thead = '<tr>' +
        '<th style="width:30%;text-align:right;padding-right:10px;">اسم الطالب</th>' +
        '<th style="width:20%;">التحضير والتسميع</th>' +
        '<th style="width:20%;">مستوى التجويد</th>' +
        '<th style="width:30%;">ملاحظات وإنجاز</th></tr>';
      _openPrintWin('كشف الحضور اليومي',
        _printHeader(batchNum, today) +
        '<div class="report-title"><h2>كشف الحضور والتحضير اليومي للحلقة</h2></div>' +
        _buildPages(thead, rowsArr) + _printSignature()
      );

    } else if (type === 'final') {
      const rowsArr = window.currentStudents.map(function(s, i) {
        const score = (window.currentScores || {})[s.id] || 0;
        let ev = 'جيد';
        if (score > 60) ev = 'ممتاز ومتقن';
        else if (score > 30) ev = 'جيد جداً وثابت';
        return '<tr><td class="name-cell"><strong>' + (i+1) + '- ' + s.full_name + '</strong></td>' +
          '<td>' + ev + '</td><td>مُقيَّم</td><td><strong>' + score + ' نقطة</strong></td></tr>';
      });
      const thead = '<tr>' +
        '<th style="width:30%;text-align:right;padding-right:10px;">اسم الطالب</th>' +
        '<th style="width:25%;">التقييم العام</th>' +
        '<th style="width:15%;">الحالة</th>' +
        '<th style="width:30%;">مجموع النقاط</th></tr>';
      _openPrintWin('التقرير الختامي',
        _printHeader(batchNum, today) +
        '<div class="report-title"><h2>التقرير الختامي المقيَّم والمجمَّع لطلاب الحلقة</h2></div>' +
        _buildPages(thead, rowsArr) + _printSignature()
      );

    } else if (type === 'roster') {
      const sorted = window.currentStudents.slice().sort(function(a, b) {
        if ((a.grade||'') === (b.grade||'')) return (a.class_number||'').toString().localeCompare((b.class_number||'').toString());
        return (a.grade||'').localeCompare(b.grade||'');
      });
      const rowsArr = sorted.map(function(s, i) {
        return '<tr><td class="name-cell"><strong>' + (i+1) + '- ' + s.full_name + '</strong></td>' +
          '<td dir="ltr">' + (s.national_id||'-') + '</td>' +
          '<td>' + (s.grade||'-') + '</td>' +
          '<td>' + (s.class_number||'-') + '</td>' +
          '<td>' + (s.nationality||'-') + '</td></tr>';
      });
      const thead = '<tr>' +
        '<th style="width:28%;text-align:right;padding-right:10px;">اسم الطالب</th>' +
        '<th style="width:22%;">الهوية الوطنية</th>' +
        '<th style="width:17%;">الصف</th>' +
        '<th style="width:17%;">الفصل</th>' +
        '<th style="width:16%;">الجنسية</th></tr>';
      _openPrintWin('بيان المشاركين',
        _printHeader(batchNum, today) +
        '<div class="report-title"><h2>بيان بأسماء الطلاب المشاركين في الدفعة</h2></div>' +
        _buildPages(thead, rowsArr) + _printSignature()
      );
    } else if (type === 'waitlist') {
      const waitlist = window.allStudents.filter(s => s.status === 'waitlisted').sort((a,b) => new Date(a.created_at) - new Date(b.created_at));
      if (waitlist.length === 0) return alert('قائمة الاحتياط فارغة حالياً.');
      
      const rowsArr = waitlist.map(function(s, i) {
        return '<tr><td>' + (i+1) + '</td><td class="name-cell"><strong>' + s.full_name + '</strong></td>' +
          '<td>' + (s.phone || '-') + '</td>' +
          '<td>' + (s.grade || '-') + '</td>' +
          '<td>' + (s.class_number || '-') + '</td>' +
          '<td>' + new Date(s.created_at).toLocaleDateString('ar-SA') + '</td></tr>';
      });
      const thead = '<tr>' +
        '<th style="width:10%;">الأولوية</th>' +
        '<th style="width:30%;text-align:right;padding-right:10px;">اسم الطالب</th>' +
        '<th style="width:20%;">رقم الجوال</th>' +
        '<th style="width:13%;">الصف</th>' +
        '<th style="width:12%;">الفصل</th>' +
        '<th style="width:15%;">تاريخ التسجيل</th></tr>';
      _openPrintWin('قائمة الاحتياط',
        _printHeader(batchNum, today) +
        '<div class="report-title"><h2>قائمة الطلاب في قائمة الاحتياط (بالترتيب)</h2></div>' +
        _buildPages(thead, rowsArr) + _printSignature()
      );
    } else if (type === 'individual_reports') {
      const studentIds = window.currentStudents.map(s => s.id);
      const { data: allEvals, error: evErr } = await supabase
        .from('evaluations')
        .select('*')
        .in('student_id', studentIds)
        .order('eval_date', { ascending: true });

      if (evErr) return alert('خطأ في تحميل سجلات الطلاب.');
      if (!allEvals || allEvals.length === 0) return alert('لا توجد سجلات تقييم منجزة حالياً.');

      // Group by student
      const evalMap = {};
      allEvals.forEach(ev => {
        if (!evalMap[ev.student_id]) evalMap[ev.student_id] = [];
        evalMap[ev.student_id].push(ev);
      });

      let fullContentHTML = '';
      window.currentStudents.forEach((student, idx) => {
        const studentEvals = evalMap[student.id] || [];
        const rowsArr = studentEvals.map(ev => `
          <tr>
            <td>${ev.eval_date}</td>
            <td>${ev.attendance_status || 'حاضر'}</td>
            <td>${ev.track || '-'}</td>
            <td>${ev.performance || '-'}</td>
            <td>${ev.tajweed || '-'}</td>
            <td>${ev.pages_count || '0'}</td>
            <td class="name-cell">${ev.memorized_part || '-'}</td>
            <td class="name-cell">${ev.notes || '-'}</td>
          </tr>
        `);

        const thead = `
          <tr>
            <th style="width:10%;">التاريخ</th>
            <th style="width:10%;">الحضور</th>
            <th style="width:12%;">المسار</th>
            <th style="width:10%;">الأداء</th>
            <th style="width:12%;">رتبة التجويد</th>
            <th style="width:8%;">الصفحات</th>
            <th style="width:19%;">السور والآيات</th>
            <th style="width:19%;">الملاحظات</th>
          </tr>
        `;

        // Each student on a new page
        fullContentHTML += `
          <div style="page-break-after: always; padding-top: 10px;">
            ${_printHeader(batchNum, today)}
            <div class="report-title">
              <h2>تقرير سجل إنجاز الطالب: ${student.full_name}</h2>
              <p style="margin-top:5px; font-weight:bold; color:#555;">الصف: ${student.grade || '-'} | الفصل: ${student.class_number || '-'}</p>
            </div>
            <table>
              <thead>${thead}</thead>
              <tbody>${rowsArr.length ? rowsArr.join('') : '<tr><td colspan="8" style="padding:30px;">لا يوجد سجلات تقييم لهذا الطالب حتى الآن</td></tr>'}</tbody>
            </table>
            ${_printSignature()}
          </div>
        `;
      });

      _openPrintWin('تقارير إنجاز الطلاب التفصيلية', fullContentHTML);
    }
  };

  /**
   * Export currently loaded students to Excel-compatible CSV format
   */
  window.exportToExcel = function() {
    if (!window.currentStudents || window.currentStudents.length === 0) {
      return alert('لا يوجد طلاب محملون للتصدير حالياً.');
    }

    if (typeof XLSX === 'undefined') {
       return alert('جاري تحميل المكتبة، يرجى المحاولة بعد لحظة.');
    }

    const headers = [
      'رقم الهوية',
      'اسم الطالب',
      'الجنسية',
      'الصف',
      'اسم الحلقة',
      'اسم المعلم',
      'اسم المسجد',
      'رقم هوية ولي الأمر'
    ];

    const mosque = 'مدرسة عماد الدين زنكي المتوسطة';
    const teacherInput = 'فهد علي آل رده';
    const circle = 'أبو بكر الصديق رضي الله عنه';

    // Prepare data
    const dataRows = window.currentStudents.map(s => [
      s.national_id || '-',
      s.full_name || '-',
      s.nationality || 'سعودي',
      s.grade || '-',
      circle,
      teacherInput,
      mosque,
      s.parent_national_id || '-'
    ]);

    // Create Worksheet
    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
    
    // Set column widths 
    const wscols = [
      {wch: 15}, {wch: 35}, {wch: 12}, {wch: 15}, {wch: 22}, {wch: 20}, {wch: 30}, {wch: 15}
    ];
    worksheet['!cols'] = wscols;

    // Set Sheet to Right-to-Left
    if(!worksheet['!views']) worksheet['!views'] = [{}];
    worksheet['!views'][0].rtl = true;

    // Create Workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "تقرير الطلاب");

    // Download
    const filename = `تقرير_طلاب_الحلقة_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, filename);
  };

  /**
   * Random Student Picker Logic
   */
  let randomPool = [];
  let currentPickedStudent = null;

  window.pickRandomStudent = function() {
      if (!window.currentStudents || window.currentStudents.length === 0) return alert('لا يوجد طلاب محملون حالياً.');
      
      const todayDate = document.getElementById('eval-date-picker').value || getSaudiDateStr();
      
      // Filter out students marked as 'غائب' for today from the initial list
      // Note: We'll check the current UI state or the targetMap
      const validStudents = window.currentStudents.filter(s => {
          const attInput = document.querySelector(`input[name="att-${s.id}"]:checked`);
          return !attInput || attInput.value !== 'غائب';
      });

      if (validStudents.length === 0) return alert('جميع الطلاب مسجلون غياب أو لا يوجد طلاب متاحون.');

      // Initialize or refill pool if empty
      if (randomPool.length === 0) {
          randomPool = [...validStudents];
      } else {
          // Sync pool to remove newly marked absentees
          randomPool = randomPool.filter(s => {
              const attInput = document.querySelector(`input[name="att-${s.id}"]:checked`);
              return !attInput || attInput.value !== 'غائب';
          });
          if (randomPool.length === 0) randomPool = [...validStudents];
      }

      const randomIndex = Math.floor(Math.random() * randomPool.length);
      currentPickedStudent = randomPool.splice(randomIndex, 1)[0];

      // Show Result Modal
      document.getElementById('picker-modal').style.display = 'flex';
      document.getElementById('picked-student-name').textContent = currentPickedStudent.full_name;
  };

  window.goToEvaluation = function() {
      if (!currentPickedStudent) return;
      document.getElementById('picker-modal').style.display = 'none';
      
      const card = document.getElementById(`card-${currentPickedStudent.id}`);
      if (card) {
          card.scrollIntoView({ behavior: 'smooth', block: 'center' });
          card.style.transition = 'all 0.5s ease';
          card.style.boxShadow = '0 0 40px rgba(59, 130, 246, 0.8)';
          card.style.border = '4px solid var(--color-accent)';
          card.style.transform = 'scale(1.05)';
          
          setTimeout(() => {
              card.style.boxShadow = '';
              card.style.border = '';
              card.style.transform = '';
          }, 3000);
      }
  };

  window.markAbsentFromPicker = function() {
      if (!currentPickedStudent) return;
      if (!confirm(`هل أنت متأكد من تسجيل الطالب "${currentPickedStudent.full_name}" غائب لهذا اليوم؟`)) return;

      const studentId = currentPickedStudent.id;
      // 1. Update UI Radio
      const absentRadio = document.getElementById(`att-a-${studentId}`);
      if (absentRadio) absentRadio.checked = true;

      // 2. Perform Save
      window.saveEval(studentId);
      
      // 3. Close Modal
      document.getElementById('picker-modal').style.display = 'none';
      
      // 4. Remove from current pool if present
      randomPool = randomPool.filter(s => s.id !== studentId);
  };

  /**
   * Honor Roll Poster Generator (Canvas)
   */
  window.generateHonorPoster = async function() {
      if (!window.currentStudents || window.currentStudents.length === 0) return alert('لا يوجد طلاب.');
      
      const modal = document.getElementById('poster-modal');
      const canvas = document.getElementById('honor-canvas');
      const ctx = canvas.getContext('2d');
      
      // Calculate scores on the fly if missing or stale
      if (!window.currentScores || Object.keys(window.currentScores).length === 0) {
        const { data: evs } = await supabase.from('evaluations').select('student_id, performance, pages_count');
        const scores = {};
        (evs || []).forEach(ev => {
            if (!scores[ev.student_id]) scores[ev.student_id] = 0;
            scores[ev.student_id] += calculateDayScore(ev.performance, ev.pages_count);
        });
        window.currentScores = scores;
      }

      // Get top 3
      const sorted = [...window.currentStudents]
        .filter(s => (window.currentScores[s.id] || 0) > 0) // Only those with points
        .sort((a,b) => (window.currentScores[b.id]||0) - (window.currentScores[a.id]||0))
        .slice(0, 3);
        
      if (sorted.length === 0) return alert('لا توجد نقاط مسجلة للطلاب لتوليد قائمة المتفوقين حالياً.');

      modal.style.display = 'flex';
      
      // Wait for fonts to be ready
      await document.fonts.ready;

      // --- DRAW POSTER ---
      ctx.clearRect(0,0,600,800);
      
      // 1. Background Gradient
      const grad = ctx.createLinearGradient(0, 0, 0, 800);
      grad.addColorStop(0, '#1e293b');
      grad.addColorStop(1, '#0f172a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 600, 800);

      // 2. Ornaments
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.15)';
      ctx.lineWidth = 1;
      for(let i=0; i<800; i+=40) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 800); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(600, i); ctx.stroke();
      }

      // 3. Gold Frame
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 8;
      ctx.strokeRect(20, 20, 560, 760);
      ctx.lineWidth = 2;
      ctx.strokeRect(30,30, 540, 740);

      // 4. Header
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 36px Cairo, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🏆 فرسان التميز للأسبوع 🏆', 300, 100);
      
      ctx.fillStyle = '#fff';
      ctx.font = '22px Cairo, sans-serif';
      ctx.fillText('حلقة أجيال القرآن - مدرسة عماد الدين زنكي', 300, 150);
      
      // 5. Draw Top Students
      const colors = ['#fbbf24', '#cbd5e1', '#cd7f32']; // Gold, Silver, Bronze
      const icons = ['🥇', '🥈', '🥉'];
      
      sorted.forEach((s, idx) => {
          const y = 300 + (idx * 160);
          const score = window.currentScores[s.id] || 0;
          
          // Background Bar
          ctx.fillStyle = 'rgba(255,255,255,0.08)';
          ctx.fillRect(60, y-60, 480, 130);
          
          // Medal Icon
          ctx.font = '50px serif';
          ctx.fillText(icons[idx], 300, y - 10);
          
          // Name
          ctx.fillStyle = colors[idx];
          ctx.font = 'bold 32px Cairo, sans-serif';
          ctx.fillText(s.full_name, 300, y + 35);
          
          // Score
          ctx.fillStyle = 'rgba(255,255,255,0.8)';
          ctx.font = '20px Cairo, sans-serif';
          ctx.fillText(`بمجموع نقاط: ${score} نقطة`, 300, y + 65);
      });

      // 6. Footer
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.font = '16px Cairo, sans-serif';
      const today = new Date().toLocaleDateString('ar-SA');
      ctx.fillText(`تاريخ الإصدار: ${today}`, 300, 730);
      ctx.font = 'bold 18px Cairo, sans-serif';
      ctx.fillStyle = '#fbbf24';
      ctx.fillText('بارك الله في جهودكم يا أشبال القرآن', 300, 760);
  };

  /**
   * Filter students by search query
   */
  window.filterStudents = function() {
      const q = document.getElementById('student-search').value.toLowerCase().trim();
      const cards = document.querySelectorAll('.student-eval-card');
      
      cards.forEach(card => {
          const name = card.querySelector('h3').textContent.toLowerCase();
          const info = card.querySelector('div[style*="font-size: 0.85rem"]').textContent.toLowerCase();
          
          if (name.includes(q) || info.includes(q)) {
              card.style.display = 'block';
          } else {
              card.style.display = 'none';
          }
      });
  };

  /**
   * Download the generated canvas as PNG
   */
  window.downloadPoster = function() {
      const canvas = document.getElementById('honor-canvas');
      const link = document.createElement('a');
      link.download = `honor-roll-${new Date().getTime()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
  };
 });

