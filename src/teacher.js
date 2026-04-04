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
      // 1. Get current batch from settings
      const { data: settingsData } = await supabase.from('settings').select('current_batch').single();
      const currentBatch = settingsData ? settingsData.current_batch : 1;
      currentBatchBadge.textContent = currentBatch;
      
      const printBatchEl = document.getElementById('print-batch-number');
      const printDateEl = document.getElementById('print-date');
      if (printBatchEl) printBatchEl.textContent = currentBatch;
      if (printDateEl) printDateEl.textContent = new Date().toLocaleDateString('ar-SA');

      // 2. Load students for current batch
      const { data: students, error } = await supabase
        .from('registrations')
        .select('*'); 
      
      if (error) throw error;

      // 3. Load all evaluations to figure out ranking
      const { data: evals, error: evalErr } = await supabase.from('evaluations').select('*');
      if (evalErr) throw evalErr;

      // Calculate scores
      const scores = {};
      (evals || []).forEach(ev => {
        if (!scores[ev.student_id]) scores[ev.student_id] = 0;
        if (ev.performance === 'ممتاز') scores[ev.student_id] += 3;
        else if (ev.performance === 'جيد جداً') scores[ev.student_id] += 2;
        else if (ev.performance === 'جيد') scores[ev.student_id] += 1;
      });

      // Sort students by score descending
      students.sort((a, b) => {
        const scoreA = scores[a.id] || 0;
        const scoreB = scores[b.id] || 0;
        return scoreB - scoreA;
      });
      
      window.currentStudents = students;
      window.currentScores = scores;

      if (!students || students.length === 0) {
        document.getElementById('students-grid').innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding: 2rem;">لا يوجد طلاب مسجلون في هذه الدفعة بعد.</div>';
        return;
      }

      const studentsGrid = document.getElementById('students-grid');
      const printTableBody = document.getElementById('print-table-body');
      
      studentsGrid.innerHTML = '';
      if(printTableBody) printTableBody.innerHTML = '';
      
      // Get today's Saudi date to fetch pre-existing evaluations for today
      function getSaudiDateStr() {
         const today = new Date();
         const offset = 3 * 60; 
         const saudiTime = new Date(today.getTime() + offset * 60 * 1000);
         return saudiTime.toISOString().split('T')[0];
      }
      const saudiToday = getSaudiDateStr();
      
      const todayMap = {};
      (evals || []).forEach(e => {
         const eDate = e.eval_date || new Date(e.created_at).toISOString().split('T')[0];
         if (eDate === saudiToday) {
            todayMap[e.student_id] = e;
         }
      });
      
      let rank = 1;

      students.forEach(student => {
        const score = scores[student.id] || 0;
        const currentEval = todayMap[student.id] || {};
        
        const att = currentEval.attendance_status || 'حاضر';
        const perf = currentEval.performance || 'ممتاز';
        const taj = currentEval.tajweed || 'متقن للأحكام';
        const note = currentEval.notes || '';
        const memo = currentEval.memorized_part || '';
        
        // 1. Interactive Card
        const card = document.createElement('div');
        card.className = 'student-eval-card';
        card.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: start;">
            <h3>${rank}. ${student.full_name}</h3>
            <span style="background: rgba(198,162,86,0.1); color: var(--color-gold-dark); padding: 4px 10px; border-radius: 10px; font-weight: bold; font-size: 0.85rem;">نقاط: ${score}</span>
          </div>
          <p style="color: #666; font-size: 0.9rem; margin-top: -5px; margin-bottom: 15px;">${student.grade} - فصل ${student.class_number}
            <div style="margin-top: 5px;">
              <span class="status-badge">النقاط التراكمية: <span id="dyn-score-${student.id}" style="font-weight:bold;">${scores[student.id] || 0}</span></span>
            </div>
          </p>
          
          <div class="eval-card-row">
            <label>حالة التحضير:</label>
            <div class="pill-group">
              <input type="radio" name="att-${student.id}" id="att-pres-${student.id}" class="pill-radio att-present" value="حاضر" ${att==='حاضر'?'checked':''}>
              <label for="att-pres-${student.id}" class="pill-label">حاضر</label>
              
              <input type="radio" name="att-${student.id}" id="att-exc-${student.id}" class="pill-radio att-excused" value="مستأذن" ${att==='مستأذن'?'checked':''}>
              <label for="att-exc-${student.id}" class="pill-label">مستأذن</label>
              
              <input type="radio" name="att-${student.id}" id="att-abs-${student.id}" class="pill-radio att-absent" value="غائب" ${att==='غائب'?'checked':''}>
              <label for="att-abs-${student.id}" class="pill-label">غائب</label>
            </div>
          </div>
          
          <div class="eval-card-row">
            <label>مستوى التسميع والحفظ:</label>
            <div class="pill-group">
              <input type="radio" name="perf-${student.id}" id="perf-exc-${student.id}" class="pill-radio perf-excellent" value="ممتاز" ${perf.includes('ممتاز')?'checked':''}>
              <label for="perf-exc-${student.id}" class="pill-label">ممتاز</label>
              
              <input type="radio" name="perf-${student.id}" id="perf-vg-${student.id}" class="pill-radio perf-vgood" value="جيد جداً" ${perf.includes('جيد جداً')?'checked':''}>
              <label for="perf-vg-${student.id}" class="pill-label">جيد جداً</label>
              
              <input type="radio" name="perf-${student.id}" id="perf-g-${student.id}" class="pill-radio perf-good" value="جيد" ${(perf==='جيد')?'checked':''}>
              <label for="perf-g-${student.id}" class="pill-label">جيد</label>
              
              <input type="radio" name="perf-${student.id}" id="perf-w-${student.id}" class="pill-radio perf-weak" value="ضعيف" ${perf.includes('ضعيف')?'checked':''}>
              <label for="perf-w-${student.id}" class="pill-label">ضعيف</label>
            </div>
          </div>
          
          <div class="eval-card-row">
            <label>مستوى التجويد:</label>
            <div class="pill-group">
              <input type="radio" name="tajweed-${student.id}" id="taj-exc-${student.id}" class="pill-radio perf-excellent" value="متقن للأحكام" ${taj.includes('متقن')?'checked':''}>
              <label for="taj-exc-${student.id}" class="pill-label">متقن للأحكام</label>
              
              <input type="radio" name="tajweed-${student.id}" id="taj-vg-${student.id}" class="pill-radio perf-vgood" value="يُطبق الأغلب" ${taj.includes('الأغلب')?'checked':''}>
              <label for="taj-vg-${student.id}" class="pill-label">يُطبق الأغلب</label>
              
              <input type="radio" name="tajweed-${student.id}" id="taj-g-${student.id}" class="pill-radio perf-good" value="بحاجة لتطوير" ${taj.includes('تطوير')?'checked':''}>
              <label for="taj-g-${student.id}" class="pill-label">بحاجة لتطوير</label>
              
              <input type="radio" name="tajweed-${student.id}" id="taj-w-${student.id}" class="pill-radio perf-weak" value="لم يتقن" ${taj.includes('لم يتقن')?'checked':''}>
              <label for="taj-w-${student.id}" class="pill-label">لم يتقن</label>
            </div>
          </div>

          <div class="eval-card-row" style="margin-top: 15px;">
            <input type="text" class="notes-input" id="memo-${student.id}" placeholder="تحديد المحفوظ المنجز (مثال: سورة الكهف، الجزء 29).." style="margin-bottom: 10px; border-color: var(--color-gold);" value="${memo}">
            <input type="text" class="notes-input" id="note-${student.id}" placeholder="إضافة أي ملاحظات أو توجيهات للطالب..." style="margin-bottom: 15px;" value="${note}">
            <button class="save-btn" style="width: 100%; border-radius: 20px;" onclick="window.saveEval('${student.id}')" id="btn-${student.id}">تأكيد الحفظ لليوم وحساب النقاط</button>
          </div>
        `;
        studentsGrid.appendChild(card);
        rank++;
      });

    } catch (err) {
      console.error(err);
      alert('حدث خطأ في تحميل بيانات الطلاب. يرجى التأكد من تجهيز جداول قاعدة البيانات.');
    }
  }

  // Global function for the inline onclick handler
  window.saveEval = async function(studentId) {
    const btn = document.getElementById(`btn-${studentId}`);
    const origText = btn.textContent;
    btn.textContent = 'جاري التوثيق...';
    btn.disabled = true;

    const attendanceEl = document.querySelector(`input[name="att-${studentId}"]:checked`);
    const performanceEl = document.querySelector(`input[name="perf-${studentId}"]:checked`);
    const tajweedEl = document.querySelector(`input[name="tajweed-${studentId}"]:checked`);
    
    const attendance = attendanceEl ? attendanceEl.value : 'حاضر';
    const performance = performanceEl ? performanceEl.value : 'ممتاز';
    const tajweedVal = tajweedEl ? tajweedEl.value : 'متقن للأحكام';
    const note = document.getElementById(`note-${studentId}`).value;
    const memo = document.getElementById(`memo-${studentId}`).value;
    
    // YYYY-MM-DD
    function getSaudiDate() {
       const today = new Date();
       const offset = 3 * 60; 
       const saudiTime = new Date(today.getTime() + offset * 60 * 1000);
       return saudiTime.toISOString().split('T')[0];
    }
    const todayStr = getSaudiDate();

    const payload = {
      attendance_status: attendance,
      performance: performance,
      tajweed: tajweedVal,
      notes: note,
      memorized_part: memo
    };

    try {
      // Check if evaluated today
      const { data: existingEval } = await supabase
        .from('evaluations')
        .select('id')
        .eq('student_id', studentId)
        .eq('eval_date', todayStr)
        .maybeSingle();

      if (existingEval) {
        const { error } = await supabase.from('evaluations').update(payload).eq('id', existingEval.id);
        if(error) throw error;
      } else {
        const { error } = await supabase.from('evaluations').insert([{ ...payload, student_id: studentId, eval_date: todayStr }]);
        if(error) throw error;
      }
      
      // Calculate new score instantly
      const { data: evals } = await supabase.from('evaluations').select('*').eq('student_id', studentId);
      let sPoints = 0;
      (evals || []).forEach(ev => {
        if (ev.performance === 'ممتاز') sPoints += 3;
        else if (ev.performance === 'جيد جداً') sPoints += 2;
        else if (ev.performance === 'جيد') sPoints += 1;
      });
      // Update DOM Score
      const dynScore = document.getElementById(`dyn-score-${studentId}`);
      if(dynScore) {
         dynScore.textContent = sPoints;
         dynScore.style.transform = "scale(1.5)";
         dynScore.style.transition = "all 0.3s";
         setTimeout(() => { dynScore.style.transform = "scale(1)"; }, 300);
      }
      // Update global context
      if(window.currentScores) window.currentScores[studentId] = sPoints;

      btn.style.background = 'var(--color-success)';
      btn.textContent = 'تم توثيق اليوم ✓';
      setTimeout(() => {
        btn.style.background = 'var(--color-primary-dark)';
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
});

