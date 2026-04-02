import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://oypfhzkbibrpobrvzwtn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95cGZoemtiaWJycG9icnZ6d3RuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxMDY3ODAsImV4cCI6MjA5MDY4Mjc4MH0.pgHCJdvOxOD-btGMmpSIiRblk8o82VxQ2Z36rd7HyGg';
const supabase = createClient(supabaseUrl, supabaseKey);

document.addEventListener('DOMContentLoaded', () => {
  const searchBtn = document.getElementById('search-btn');
  const nationalIdInput = document.getElementById('studentId');
  const searchSection = document.getElementById('search-section');
  const reportSection = document.getElementById('report-section');
  const errorMsg = document.getElementById('search-error');
  const evalsList = document.getElementById('evaluations-list');
  const downloadCertBtn = document.getElementById('download-cert-btn');

  searchBtn.addEventListener('click', async () => {
    const natId = nationalIdInput.value.trim();
    if (natId.length !== 10) {
      showError('يرجى إدخال رقم هوية صحيح مكون من 10 أرقام.');
      return;
    }

    searchBtn.disabled = true;
    searchBtn.textContent = 'جاري البحث...';
    errorMsg.style.display = 'none';

    try {
      // 1. Find Student by National ID
      const { data: students, error: stdErr } = await supabase
        .from('registrations')
        .select('*')
        .eq('national_id', natId)
        .limit(1);

      if (stdErr) throw stdErr;

      if (!students || students.length === 0) {
        showError('لم يتم العثور على طالب بهذا الرقم في النظام.');
        searchBtn.disabled = false;
        searchBtn.textContent = 'استعلام وعرض التقرير';
        return;
      }

      const student = students[0];
      
      // Populate student info
      document.getElementById('r-name').textContent = student.full_name;
      document.getElementById('r-grade').textContent = student.grade;
      document.getElementById('r-class').textContent = student.class_number;

      // 2. Fetch their evaluations
      const { data: evals, error: evalErr } = await supabase
        .from('evaluations')
        .select('*')
        .eq('student_id', student.id)
        .order('eval_date', { ascending: false });

      if (evalErr) throw evalErr;

      // Calculate score for certificate
      let totalScore = 0;
      (evals || []).forEach(ev => {
        if (ev.performance === 'ممتاز') totalScore += 3;
        else if (ev.performance === 'جيد جداً') totalScore += 2;
        else if (ev.performance === 'جيد') totalScore += 1;
      });

      // Populate Certificate
      document.getElementById('cert-student-name').textContent = student.full_name;
      document.getElementById('cert-student-score').textContent = totalScore;

      renderEvaluations(evals);

      // Show Report
      searchSection.style.display = 'none';
      reportSection.style.display = 'block';

    } catch (err) {
      console.error(err);
      showError('حدث خطأ في الاتصال بالخادم.');
      searchBtn.disabled = false;
      searchBtn.textContent = 'استعلام وعرض التقرير';
    }
  });

  function renderEvaluations(evals) {
    evalsList.innerHTML = '';
    if (!evals || evals.length === 0) {
      evalsList.innerHTML = '<p style="text-align:center; padding: 20px; color:#666;">لم يتم رصد أي تقييم أو تحضير لهذا الطالب حتى الآن.</p>';
      return;
    }

    evals.forEach(ev => {
      // Format Badge Color
      let perfClass = 'badge-weak';
      if (ev.performance === 'ممتاز') perfClass = 'badge-excellent';
      if (ev.performance.includes('جيد')) perfClass = 'badge-good';

      const div = document.createElement('div');
      div.className = 'evaluation-card';
      
      div.innerHTML = `
        <div style="flex:1;">
          <div class="eval-date">🗓️ ${ev.eval_date}</div>
          <div class="eval-notes">المسجل: ${ev.notes || 'لا يوجد ملاحظات إضافية'}</div>
        </div>
        <div style="text-align:left; display: flex; gap: 10px;">
           <span class="eval-badge" style="background: #e5e7eb; color: #374151;">${ev.attendance_status}</span>
           <span class="eval-badge ${perfClass}">${ev.performance}</span>
        </div>
      `;
      evalsList.appendChild(div);
    });
  }

  function showError(msg) {
    errorMsg.textContent = msg;
    errorMsg.style.display = 'block';
  }

  // Handle Certificate Download
  downloadCertBtn.addEventListener('click', async () => {
    const origText = downloadCertBtn.textContent;
    downloadCertBtn.textContent = 'جاري التوليد...';
    downloadCertBtn.disabled = true;

    try {
      const template = document.getElementById('certificate-template');
      const canvas = await html2canvas(template, {
        scale: 2, // High resolution
        useCORS: true // Allow remote images like top4top logo
      });
      
      const imgData = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = imgData;
      link.download = `شهادة_شكر_${document.getElementById('cert-student-name').textContent.replace(/ /g, '_')}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
    } catch (err) {
      console.error(err);
      alert('تعذر استخراج الشهادة تلقائياً. تأكد من متصفحك.');
    } finally {
      downloadCertBtn.textContent = origText;
      downloadCertBtn.disabled = false;
    }
  });
});
