document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const type = urlParams.get('type') || 'part';
  const studentName = urlParams.get('name') || 'اسم الطالب';
  const memoPart = urlParams.get('part') || '';

  const bodyEl = document.body;
  const titleEl = document.getElementById('title');
  const introEl = document.getElementById('intro');
  const nameEl = document.getElementById('name');
  const descEl = document.getElementById('desc');
  const memoBlock = document.getElementById('memo-block');
  const partEl = document.getElementById('part');

  nameEl.textContent = studentName;

  if (type === 'memo') {
    // Memorization Theme
    bodyEl.className = 'theme-memo';
    titleEl.textContent = 'شَهَادَةُ إِتْمَامِ حِفْظٍ وَتَفَوُّق';
    introEl.textContent = 'بكل فخر واعتزاز، نُشهد بأن الطالب المتميز:';
    
    memoBlock.style.display = 'block';
    partEl.textContent = memoPart;
    
    descEl.innerHTML = 'بدرجة (ممتاز ومتقن للأحكام).<br>نسأل الله أن يجعله من أهل القرآن الذين هم أهل الله وخاصته.';
  } else {
    // Participation Theme (Default)
    bodyEl.className = 'theme-part';
    titleEl.textContent = 'شَهَادَةُ شُكْرٍ وَمُشَارَكَة';
    introEl.textContent = 'يسر إدارة المدرسة ومعلم الحلقة تقديم خالص الشكر والتقدير للطالب الفاعل:';
    
    memoBlock.style.display = 'none';
    
    descEl.innerHTML = 'نظير تفاعله المستمر ومشاركته المثمرة في حلقة تحفيظ وتجويد القرآن الكريم.<br>سائلين المولى عز وجل له دوام التوفيق والسداد، وأن يجعله من أهل القرآن الميمونين.';
  }
});
