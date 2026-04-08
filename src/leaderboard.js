import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://oypfhzkbibrpobrvzwtn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95cGZoemtiaWJycG9icnZ6d3RuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxMDY3ODAsImV4cCI6MjA5MDY4Mjc4MH0.pgHCJdvOxOD-btGMmpSIiRblk8o82VxQ2Z36rd7HyGg';
const supabase = createClient(supabaseUrl, supabaseKey);

document.addEventListener('DOMContentLoaded', async () => {
  const boardEl = document.getElementById('board-container');
  const loadingEl = document.getElementById('loading');

  async function fetchLeaderboard() {
    try {
      // 1. Get current batch
      const { data: sData } = await supabase.from('settings').select('current_batch').single();
      const currentBatch = sData ? sData.current_batch : 1;
      
      // 2. Fetch active students for CURRENT batch only
      const { data: students, error: stdErr } = await supabase
        .from('registrations')
        .select('id, full_name, grade, class_number')
        .eq('status', 'active')
        .eq('batch_number', currentBatch);

      if (stdErr) throw stdErr;
      
      // 3. Fetch all evaluations to calculate real scores
      const { data: evals, error: evalErr } = await supabase.from('evaluations').select('*');
      if (evalErr) throw evalErr;

      // 4. Calculate Scores (Performance Points + Pages Count)
      const scores = {};
      evals.forEach(ev => {
        if (!scores[ev.student_id]) scores[ev.student_id] = 0;
        let pPoints = 0;
        if (ev.performance === 'ممتاز') pPoints = 3;
        else if (ev.performance === 'جيد جداً') pPoints = 2;
        else if (ev.performance === 'جيد') pPoints = 1;
        
        scores[ev.student_id] += (pPoints + (ev.pages_count || 0));
      });

      // 5. Build ranking array
      let rankedStudents = students.map(s => ({
          ...s,
          score: scores[s.id] || 0
      }));

      // Sort descending by score, and only keep students who actually have points > 0
      rankedStudents = rankedStudents
          .filter(s => s.score > 0)
          .sort((a, b) => b.score - a.score);

      // Top 10 max
      const topStudents = rankedStudents.slice(0, 10);

      renderBoard(topStudents);

    } catch (err) {
      console.error(err);
      loadingEl.textContent = 'حدث خطأ في جلب بيانات اللوحة.';
    }
  }

  function renderBoard(students) {
    boardEl.innerHTML = '';
    loadingEl.style.display = 'none';

    if (students.length === 0) {
      boardEl.innerHTML = '<h2 style="grid-column: 1/-1; text-align:center; color: #a0aec0;">لا يوجد أبطال مقيَّمين حتى الآن. بادر بحصد درجاتك الأولى!</h2>';
      return;
    }

    students.forEach((student, index) => {
      const realRank = index + 1;
      const card = document.createElement('div');
      
      // Assign specific classes for top 3
      let rankClass = '';
      if (realRank === 1) rankClass = 'rank-1';
      else if (realRank === 2) rankClass = 'rank-2';
      else if (realRank === 3) rankClass = 'rank-3';

      card.className = `student-card ${rankClass}`;
      
      // Use emoji for top 3
      let rankDisplay = realRank;
      if(realRank === 1) rankDisplay = '👑';
      else if(realRank === 2) rankDisplay = '🥈';
      else if(realRank === 3) rankDisplay = '🥉';

      card.innerHTML = `
        <div class="rank-badge">${rankDisplay}</div>
        <div class="student-info">
          <h3 class="student-name">${student.full_name}</h3>
          <div class="student-meta">الصف ${student.grade} - فصل ${student.class_number}</div>
        </div>
        <div class="points-badge">${student.score}<span>🚀</span></div>
      `;
      
      boardEl.appendChild(card);

      // Cascade animation
      setTimeout(() => {
        card.classList.add('visible');
      }, 200 * index);
    });
  }

  // Auto-refresh every 60 seconds (Great for TV mode)
  fetchLeaderboard();
  setInterval(fetchLeaderboard, 60000);
});
