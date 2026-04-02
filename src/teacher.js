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

      if (!students || students.length === 0) {
        document.getElementById('students-grid').innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding: 2rem;">لا يوجد طلاب مسجلون في هذه الدفعة بعد.</div>';
        return;
      }

      const studentsGrid = document.getElementById('students-grid');
      const printTableBody = document.getElementById('print-table-body');
      
      studentsGrid.innerHTML = '';
      if(printTableBody) printTableBody.innerHTML = '';
      
      let rank = 1;

      students.forEach(student => {
        const score = scores[student.id] || 0;
        
        // 1. Interactive Card
        const card = document.createElement('div');
        card.className = 'student-eval-card';
        card.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: start;">
            <h3>${rank}. ${student.full_name}</h3>
            <span style="background: rgba(198,162,86,0.1); color: var(--color-gold-dark); padding: 4px 10px; border-radius: 10px; font-weight: bold; font-size: 0.85rem;">نقاط: ${score}</span>
          </div>
          <p style="color: #666; font-size: 0.9rem; margin-top: -5px; margin-bottom: 15px;">${student.grade} - فصل ${student.class_number}</p>
          
          <div class="eval-card-row">
            <label>حالة التحضير:</label>
            <div class="pill-group">
              <input type="radio" name="att-${student.id}" id="att-present-${student.id}" class="pill-radio" value="حاضر" checked>
              <label for="att-present-${student.id}" class="pill-label">حاضر</label>
              
              <input type="radio" name="att-${student.id}" id="att-late-${student.id}" class="pill-radio" value="مستأذن">
              <label for="att-late-${student.id}" class="pill-label">مستأذن</label>
              
              <input type="radio" name="att-${student.id}" id="att-absent-${student.id}" class="pill-radio" value="غائب">
              <label for="att-absent-${student.id}" class="pill-label">غائب</label>
            </div>
          </div>
          
          <div class="eval-card-row">
            <label>مستوى التسميع والحفظ:</label>
            <div class="pill-group">
              <input type="radio" name="perf-${student.id}" id="perf-exc-${student.id}" class="pill-radio perf-excellent" value="ممتاز" checked>
              <label for="perf-exc-${student.id}" class="pill-label">ممتاز</label>
              
              <input type="radio" name="perf-${student.id}" id="perf-vg-${student.id}" class="pill-radio perf-vgood" value="جيد جداً">
              <label for="perf-vg-${student.id}" class="pill-label">جيد جداً</label>
              
              <input type="radio" name="perf-${student.id}" id="perf-g-${student.id}" class="pill-radio perf-good" value="جيد">
              <label for="perf-g-${student.id}" class="pill-label">جيد</label>
              
              <input type="radio" name="perf-${student.id}" id="perf-w-${student.id}" class="pill-radio perf-weak" value="ضعيف">
              <label for="perf-w-${student.id}" class="pill-label">ضعيف</label>
            </div>
          </div>

          <div class="eval-card-row" style="margin-top: 15px;">
            <input type="text" class="notes-input" id="note-${student.id}" placeholder="اكتب ملاحظاتك على الإنجاز..." style="margin-bottom: 15px;">
            <button class="save-btn" style="width: 100%; border-radius: 20px;" onclick="window.saveEval('${student.id}')" id="btn-${student.id}">تأكيد المهارات وحفظ</button>
          </div>
        `;
        studentsGrid.appendChild(card);

        // 2. Print Row (Static for the print layout)
        if(printTableBody) {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td><strong>${rank}- ${student.full_name}</strong></td>
            <td>....................</td>
            <td>....................</td>
            <td>........................................</td>
          `;
          printTableBody.appendChild(tr);
        }

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
    btn.disabled = true;
    btn.textContent = '...';

    const attendanceEl = document.querySelector(`input[name="att-${studentId}"]:checked`);
    const performanceEl = document.querySelector(`input[name="perf-${studentId}"]:checked`);
    
    const attendance = attendanceEl ? attendanceEl.value : 'حاضر';
    const performance = performanceEl ? performanceEl.value : 'ممتاز';
    const note = document.getElementById(`note-${studentId}`).value;

    const payload = {
      student_id: studentId,
      attendance_status: attendance,
      performance: performance,
      notes: note
    };

    try {
      const { error } = await supabase.from('evaluations').insert([payload]);
      
      // If it's a unique constraint violation (already evaluated today)
      if (error && error.code === '23505') {
        alert('لقد قمت بتقييم هذا الطالب اليوم مسبقاً!');
        btn.textContent = 'حفظ';
        btn.disabled = false;
        return;
      }
      if (error) throw error;

      btn.textContent = 'تم ✓';
      btn.style.backgroundColor = '#d1d5db';
      btn.style.color = '#374151';

    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء الحفظ.');
      btn.disabled = false;
      btn.textContent = 'حفظ';
    }
  };
});
