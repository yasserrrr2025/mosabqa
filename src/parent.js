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

      // Prepare UI for rendering
      renderEvaluations(evals);

      // Show Report
      searchSection.style.display = 'none';
      reportSection.style.display = 'block';
      document.getElementById('eval-results').style.display = 'block';


    } catch (err) {
      console.error(err);
      showError('حدث خطأ في الاتصال بالخادم.');
      searchBtn.disabled = false;
      searchBtn.textContent = 'استعلام وعرض التقرير';
    }
  });

  function renderEvaluations(evals) {
    const timeline = document.getElementById('timeline-list');
    const oldTitle = document.querySelector('h2');
    if(oldTitle && oldTitle.textContent.includes('أحدث التقييمات')) oldTitle.style.display = 'none';

    if (!evals || evals.length === 0) {
      timeline.innerHTML = '<li style="text-align:center; padding: 15px; color:#666; background:#f9fafb; border-radius:8px;">لا يوجد سجل تقييمات للطالب حتى الآن.</li>';
      return;
    }

    timeline.innerHTML = '';
    
    // Sort descending by date (newest top)
    evals.sort((a,b) => new Date(b.eval_date || b.created_at) - new Date(a.eval_date || a.created_at));

    evals.forEach(ev => {
      const dateStr = ev.eval_date || new Date(ev.created_at).toLocaleDateString('ar-SA');
      const memoTxt = ev.memorized_part ? `<span style="display:block; font-size:0.95rem; color:var(--color-primary-dark); margin-top:8px; font-weight:bold;">📖 المحفوظ: ${ev.memorized_part}</span>` : '';
      const noteTxt = (ev.notes && ev.notes.trim() !== '') ? `<span style="display:block; font-size:0.9rem; color:#666; margin-top:5px; border-right: 3px solid #ccc; padding-right: 8px;">📝 ملاحظة: ${ev.notes}</span>` : '';
      
      let badgeColor = '#d1d5db';
      if(ev.performance.includes('ممتاز')) badgeColor = '#fcd34d'; // goldish
      else if(ev.performance.includes('جيد جداً')) badgeColor = '#bfdbfe'; // light blue

      const li = document.createElement('li');
      li.style.cssText = "padding: 15px; border: 1px solid #eee; border-radius: 8px; margin-bottom: 10px; background: #fff;";
      li.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <strong style="color:#4b5563;">📅 ${dateStr}</strong>
          <span style="background:${badgeColor}; color:#374151; padding:3px 10px; border-radius:15px; font-size:0.85rem; font-weight:bold;">${ev.performance}</span>
        </div>
        <div style="font-size: 0.95rem; margin-top:8px; display:flex; gap:15px;">
          <span>التحضير: <strong>${ev.attendance_status}</strong></span>
          <span>التجويد: <strong>${ev.tajweed || 'غير مقيم'}</strong></span>
        </div>
        ${memoTxt}
        ${noteTxt}
      `;
      timeline.appendChild(li);
    });

    const latest = evals[0];
    if(latest.performance && latest.performance.includes('ممتاز') && latest.memorized_part && latest.memorized_part.trim().length > 0) {
       document.getElementById('memo-cert-container').style.display = 'block';
       document.getElementById('memo-cert-part').textContent = latest.memorized_part;
    }
  }

  function showError(msg) {
    errorMsg.textContent = msg;
    errorMsg.style.display = 'block';
  }

  // Handle actual Certificate Download (Participation)
  if(downloadCertBtn) {
    downloadCertBtn.addEventListener('click', () => {
      const studentName = document.getElementById('r-name').textContent;
      window.open(`/certificate.html?type=part&name=${encodeURIComponent(studentName)}`, '_blank');
    });
  }

  // Handle actual Certificate Download (Memorization)
  const downloadMemoCertBtn = document.getElementById('download-memo-cert-btn');
  if(downloadMemoCertBtn) {
     downloadMemoCertBtn.addEventListener('click', () => {
        const studentName = document.getElementById('r-name').textContent;
        const memoPart = document.getElementById('memo-cert-part').textContent;
        window.open(`/certificate.html?type=memo&name=${encodeURIComponent(studentName)}&part=${encodeURIComponent(memoPart)}`, '_blank');
     });
  }
});
