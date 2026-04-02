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
  const tableBody = document.getElementById('students-table-body');
  
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
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">لا يوجد طلاب مسجلون في هذه الدفعة بعد.</td></tr>';
        return;
      }

      tableBody.innerHTML = '';
      let rank = 1;
      students.forEach(student => {
        const score = scores[student.id] || 0;
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>
            <strong><span class="print-text" style="display:inline-block!important; width:20px; color:#666;">${rank}-</span> ${student.full_name}</strong><br>
            <span style="font-size:0.8rem; color:#666;">${student.grade} - فصل ${student.class_number}</span>
            <span class="print-text" style="color:var(--color-primary-dark); font-size:0.9rem; font-weight:bold; margin-right: 10px;">(النقاط: ${score})</span>
          </td>
          <td>
            <select class="action-select" id="att-${student.id}">
              <option value="حاضر">حاضر</option>
              <option value="غائب">غائب</option>
              <option value="مستأذن">مستأذن</option>
            </select>
            <span class="print-text">............</span>
          </td>
          <td>
            <select class="action-select" id="perf-${student.id}">
              <option value="ممتاز">ممتاز</option>
              <option value="جيد جداً">جيد جداً</option>
              <option value="جيد">جيد</option>
              <option value="ضعيف">ضعيف</option>
            </select>
            <span class="print-text">............</span>
          </td>
          <td>
            <input type="text" class="notes-input" id="note-${student.id}" placeholder="مثال: أتم حفظ وجهين">
            <span class="print-text">........................</span>
          </td>
          <td>
            <button class="save-btn" onclick="window.saveEval('${student.id}')" id="btn-${student.id}">حفظ</button>
            <span class="print-text">........</span>
          </td>
        `;
        tableBody.appendChild(tr);
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

    const attendance = document.getElementById(`att-${studentId}`).value;
    const performance = document.getElementById(`perf-${studentId}`).value;
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
