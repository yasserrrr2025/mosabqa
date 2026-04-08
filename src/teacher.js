import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://oypfhzkbibrpobrvzwtn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95cGZoemtiaWJycG9icnZ6d3RuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxMDY3ODAsImV4cCI6MjA5MDY4Mjc4MH0.pgHCJdvOxOD-btGMmpSIiRblk8o82VxQ2Z36rd7HyGg';
const supabase = createClient(supabaseUrl, supabaseKey);

document.addEventListener('DOMContentLoaded', () => {
  const loginBtn = document.getElementById('login-btn');
  const passwordInput = document.getElementById('teacherPassword');
  const loginSection = document.getElementById('login-section');
  const dashboardSection = document.getElementById('dashboard-section');
  const errorMsg = document.getElementById('login-error');
  const currentBatchBadge = document.getElementById('batch-number-badge');
  
  // Display today's date
  document.getElementById('current-date-display').textContent = new Date().toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

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
      // 1. Fetch Settings
      const { data: sData, error: sErr } = await supabase.from('settings').select('*').limit(1);
      if (sErr) throw new Error(`خطأ في جدول الإعدادات: ${sErr.message}`);
      
      const settings = (sData && sData.length > 0) ? sData[0] : { current_batch: 1 };
      const batchNum = settings.current_batch;

      document.getElementById('batch-number-badge').textContent = batchNum;
      if (document.getElementById('print-batch-number')) document.getElementById('print-batch-number').textContent = batchNum;

      // 2. Fetch Students
      const { data: students, error: stdErr } = await supabase.from('registrations')
        .select('*')
        .eq('batch_number', batchNum)
        .order('full_name', { ascending: true });
      
      if (stdErr) throw new Error(`خطأ في جدول التسجيلات: ${stdErr.message}`);

      const activeStudents = students.filter(s => s.status === 'active' || s.status === 'accepted');
      const waitlistStudents = students.filter(s => s.status === 'waitlisted').sort((a,b) => new Date(a.created_at) - new Date(b.created_at));

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

      renderEvaluationGrid(activeStudents, evals, scores);
      renderManagementSection(activeStudents, waitlistStudents);

    } catch (err) {
      console.error(err);
      alert('خطأ تقني: ' + err.message);
    }
  }

  function renderEvaluationGrid(students, evals, scores) {
      const studentsGrid = document.getElementById('students-grid');
      const printTableBody = document.getElementById('print-table-body');
      studentsGrid.innerHTML = '';
      if(printTableBody) printTableBody.innerHTML = '';
      
      const todayStr = getSaudiDateStr();
      const todayMap = {};
      (evals || []).forEach(e => {
         const eDate = e.eval_date || new Date(e.created_at).toISOString().split('T')[0];
         if (eDate === todayStr) todayMap[e.student_id] = e;
      });
      
      students.forEach((student, i) => {
        const score = scores[student.id] || 0;
        const currentEval = todayMap[student.id] || {};
        const att = currentEval.attendance_status || 'حاضر';
        const perf = currentEval.performance || 'ممتاز';
        const track = currentEval.track || 'حفظ أجزاء';
        const pages = currentEval.pages_count || 0;
        const taj = currentEval.tajweed || 'متقن للأحكام';
        const note = currentEval.notes || '';
        const memo = currentEval.memorized_part || '';
        
        const card = document.createElement('div');
        card.className = 'student-eval-card';
        card.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: start;">
            <h3 style="margin:0;">${i+1}. ${student.full_name}</h3>
            <span style="background: rgba(198,162,86,0.1); color: var(--color-gold-dark); padding: 4px 10px; border-radius: 10px; font-weight: bold; font-size: 0.85rem;">إجمالي: ${score} ن</span>
          </div>
          <div style="margin: 5px 0 15px; font-size: 0.85rem; color: #666;">
            ${student.grade} - فصل ${student.class_number}
            <div style="display:flex; gap:8px; margin-top:4px;">
               <span class="status-badge" style="background:#e0f2fe; color:#0369a1;">${track}</span>
               <span class="status-badge" style="background:#fef3c7; color:#92400e;">نقاط اليوم: <span id="today-score-${student.id}" style="font-weight:bold;">${calculateDayScore(perf, pages)}</span></span>
            </div>
          </div>
          <div class="eval-card-row">
            <label>حالة الحضور:</label>
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
            <label>المسار:</label>
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
            <label>الأداء:</label>
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
            <label>عدد الصفحات:</label>
            <div class="page-pills">
              ${[0,1,2,3,4,5,6,7,8,9,10].map(n => `
                <input type="radio" name="pages-${student.id}" id="pg-${n}-${student.id}" class="page-radio" value="${n}" ${pages==n?'checked':''}>
                <label for="pg-${n}-${student.id}" class="page-label">${n||'❌'}</label>
              `).join('')}
            </div>
          </div>
          <div class="eval-card-row" style="margin-top:15px; display:flex; flex-direction:column; gap:8px;">
            <input type="text" class="notes-input" id="memo-${student.id}" placeholder="السورة والآيات.." value="${memo}">
            <input type="text" class="notes-input" id="note-${student.id}" placeholder="ملاحظات توجيهية.." value="${note}">
            <button class="save-btn" onclick="window.saveEval('${student.id}')" id="btn-${student.id}">✅ حفظ التقييم</button>
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
        <td><strong>${s.full_name}</strong><br><small style="color:#999;">${new Date(s.created_at).toLocaleDateString('ar-SA')}</small></td>
        <td style="text-align:center;">
          ${i === 0 
            ? `<button onclick="window.teacherPromoteStudent('${s.id}', '${s.full_name}')" style="background:#16a34a; color:#fff; border:none; padding:8px 14px; border-radius:8px; cursor:pointer; font-weight:bold; width:100%;">✅ ترقية (الأولوية)</button>` 
            : `<span style="color:#999; font-size:0.8rem;">بانتظار المقعد..</span>`
          }
        </td>
      </tr>
    `).join('') : '<tr><td colspan="3" style="text-align:center; padding:20px; color:#999;">لا يوجد طلاب احتياط حالياً</td></tr>';
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
      if (!confirm(`تحذير: هل أنت متأكد من حذف الطالب "${name}"؟ هذا الإجراء لا يمكن التراجع عنه وسيتم حذفه من كافة اللوحات.`)) return;
      try {
          const { data: stdData } = await supabase.from('registrations').select('status, batch_number').eq('id', id).single();
          const wasActive = stdData && (stdData.status === 'active' || stdData.status === 'accepted');
          const batchNum = stdData ? stdData.batch_number : null;

          const { error } = await supabase.from('registrations').delete().eq('id', id);
          if (error) throw error;

          alert('تم حذف الطالب بنجاح.');
          
          if (wasActive && batchNum) {
              const { data: waitlisted } = await supabase.from('registrations').select('*').eq('batch_number', batchNum).eq('status', 'waitlisted').order('created_at', { ascending: true }).limit(1);
              if (waitlisted && waitlisted.length > 0) {
                  if (confirm(`تم إفراغ مقعد! هل تريد ترقية الطالب "${waitlisted[0].full_name}" من الاحتياط تلقائياً؟`)) {
                      await window.teacherPromoteStudent(waitlisted[0].id, waitlisted[0].full_name);
                  }
              }
          }
          loadDashboard();
      } catch(err) { alert('خطأ أثناء الحذف.'); }
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
    
    const todayStr = getSaudiDateStr();
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
      /* page splitting handled by JS */
      '.signature { display: flex; justify-content: space-between; margin-top: 45px; padding: 0 10px; font-size: 11pt; font-weight: bold; page-break-inside: avoid; }',
      '.signature div { text-align: center; line-height: 4; }'
    ].join(' ');
  }

  function _printHeader(batchNum, dateStr) {
    return '<div class="header">' +
      '<div class="header-side" style="text-align:right;">' +
        'المملكة العربية السعودية<br>' +
        'وزارة التعليم<br>' +
        'إدارة التعليم بمحافظة جدة<br>' +
        'مدرسة عماد الدين زنكي المتوسطة' +
      '</div>' +
      '<div class="header-center"><img src="/new-logo.png" alt="logo"></div>' +
      '<div class="header-side" style="text-align:left;">' +
        'رقم الدفعة: ' + batchNum + '<br>' +
        'تاريخ التقرير: ' + dateStr +
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


  function _buildPages(theadHTML, rowsArr, perPage) {
    perPage = perPage || 9;
    if (!rowsArr || rowsArr.length === 0) {
      return '<table><thead>' + theadHTML + '</thead><tbody>' +
        '<tr><td colspan="10" style="text-align:center;color:#999;">لا يوجد بيانات</td></tr>' +
        '</tbody></table>';
    }
    var pages = [];
    for (var i = 0; i < rowsArr.length; i += perPage) {
      pages.push(rowsArr.slice(i, i + perPage));
    }
    return pages.map(function(chunk, idx) {
      var isLast = idx === pages.length - 1;
      return '<div style="page-break-after:' + (isLast ? 'auto' : 'always') + ';">' +
        '<table><thead>' + theadHTML + '</thead>' +
        '<tbody>' + chunk.join('') + '</tbody></table>' +
        '</div>';
    }).join('');
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
    var perPage = 9;
    if (!rowsArr || rowsArr.length === 0) {
      return '<table><thead>' + theadHTML + '</thead><tbody>' +
        '<tr><td colspan="10" style="text-align:center;color:#999;">لا يوجد بيانات</td></tr>' +
        '</tbody></table>';
    }
    var pages = [];
    for (var i = 0; i < rowsArr.length; i += perPage) pages.push(rowsArr.slice(i, i + perPage));
    return pages.map(function(chunk, idx) {
      var isLast = idx === pages.length - 1;
      return '<div style="page-break-after:' + (isLast ? 'auto' : 'always') + ';">' +
        '<table><thead>' + theadHTML + '</thead>' +
        '<tbody>' + chunk.join('') + '</tbody></table></div>';
    }).join('');
  }

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
      'th { background-color: #f1f5f9 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-weight: 800; font-size: 11pt; padding: 10px 8px; border: 1px solid #a0aec0; text-align: center; }',
      'td { padding: 9px 8px; border: 1px solid #a0aec0; font-size: 10pt; text-align: center; vertical-align: middle; }',
      'td.name-cell { text-align: right; }',
      'tr { page-break-inside: avoid; }',
      'tbody tr:nth-child(even) { background-color: #f8fafc !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }',
      '.signature { display: flex; justify-content: space-between; margin-top: 45px; padding: 0 10px; font-size: 11pt; font-weight: bold; page-break-inside: avoid; }',
      '.signature div { text-align: center; line-height: 4; }'
    ].join(' ');
  }

  function _printHeader(batchNum, dateStr) {
    return '<div class="header">' +
      '<div class="header-side" style="text-align:right;">' +
        'المملكة العربية السعودية<br>' +
        'وزارة التعليم<br>' +
        'إدارة التعليم بمحافظة جدة<br>' +
        'مدرسة عماد الدين زنكي المتوسطة' +
      '</div>' +
      '<div class="header-center"><img src="/new-logo.png" alt="logo"></div>' +
      '<div class="header-side" style="text-align:left;">' +
        'رقم الدفعة: ' + batchNum + '<br>' +
        'تاريخ التقرير: ' + dateStr +
      '</div></div>';
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

  window.preparePrint = function(type) {
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
 });

