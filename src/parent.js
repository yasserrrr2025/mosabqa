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

  // Check for auto-search from URL
  const urlParams = new URLSearchParams(window.location.search);
  const autoId = urlParams.get('id');
  if (autoId) {
    nationalIdInput.value = autoId;
    setTimeout(() => searchBtn.click(), 300);
  }

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
    const memoContainer = document.getElementById('memo-cert-container');
    if(memoContainer) memoContainer.style.display = 'none'; // Reset state between searches
    
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
      const track = ev.track || 'حفظ أجزاء';
      const pages = ev.pages_count || 0;
      
      const memoTxt = ev.memorized_part ? `<div style="font-size:0.95rem; color:var(--color-primary-dark); margin-top:10px; font-weight:bold; background:#f0f9ff; padding:8px 12px; border-radius:8px; border-right:4px solid #0ea5e9;">📖 المنجز: ${ev.memorized_part}</div>` : '';
      const noteTxt = (ev.notes && ev.notes.trim() !== '') ? `<div style="font-size:0.9rem; color:#6b7280; margin-top:8px; padding-right:10px; font-style:italic;">💬 ملاحظة المعلم: ${ev.notes}</div>` : '';
      
      let badgeStyle = "background:#f1f5f9; color:#475569;";
      if(ev.performance.includes('ممتاز')) badgeStyle = "background:#fef3c7; color:#92400e; border: 1px solid #fde68a;";
      else if(ev.performance.includes('جيد جداً')) badgeStyle = "background:#ecfdf5; color:#065f46; border: 1px solid #bbfcce;";

      const li = document.createElement('li');
      li.style.cssText = "padding: 20px; border: 1px solid #e2e8f0; border-radius: 14px; margin-bottom: 15px; background: #fff; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);";
      li.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:1px dashed #e2e8f0; padding-bottom:10px;">
          <strong style="color:#1f2937; font-size:1.05rem;">🗓️ ${dateStr}</strong>
          <span style="${badgeStyle} padding:4px 12px; border-radius:20px; font-size:0.8rem; font-weight:800;">${ev.performance}</span>
        </div>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; font-size:0.9rem; color:#4b5563;">
          <div style="background:#f8fafc; padding:8px; border-radius:8px;">🎯 المسار: <strong>${track}</strong></div>
          <div style="background:#f8fafc; padding:8px; border-radius:8px;">📄 المنجز: <strong>${pages} صفحات</strong></div>
          <div style="background:#f8fafc; padding:8px; border-radius:8px;">⏰ الحضور: <strong>${ev.attendance_status}</strong></div>
          <div style="background:#f8fafc; padding:8px; border-radius:8px;">✨ التجويد: <strong>${ev.tajweed || 'غير مقيم'}</strong></div>
        </div>
        ${memoTxt}
        ${noteTxt}
      `;
      timeline.appendChild(li);
    });

    const latest = evals[0];
    if(latest.performance && latest.performance.includes('ممتاز') && latest.memorized_part && latest.memorized_part.trim().length > 0) {
       if(memoContainer) memoContainer.style.display = 'block';
       const btnObj = document.getElementById('download-memo-cert-btn');
       if(btnObj) btnObj.setAttribute('data-part', latest.memorized_part);
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
        const memoPart = downloadMemoCertBtn.getAttribute('data-part') || 'المقرر';
        window.open(`/certificate.html?type=memo&name=${encodeURIComponent(studentName)}&part=${encodeURIComponent(memoPart)}`, '_blank');
     });
  }
});
