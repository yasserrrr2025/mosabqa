document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const type = urlParams.get('type') || 'part';
    const studentName = urlParams.get('name') || 'اسم الطالب';
    const memoPart = urlParams.get('part') || '';
  
    // Determine which template to populate and capture
    let targetTemplateId = 'cert-part-template';
    
    if (type === 'memo') {
      targetTemplateId = 'cert-memo-template';
      document.getElementById('memo-name').textContent = studentName;
      document.getElementById('memo-part-val').textContent = memoPart;
      document.getElementById(targetTemplateId).style.display = 'block';
    } else {
      document.getElementById('part-name').textContent = studentName;
      document.getElementById(targetTemplateId).style.display = 'block';
    }
    
    // Give external webfonts a moment to load before capturing
    await new Promise(r => setTimeout(r, 600));
    
    try {
      const container = document.getElementById(targetTemplateId);
      const canvas = await html2canvas(container, {
        scale: 2, // Retain high resolution matching 200/300 DPI
        useCORS: true,
        backgroundColor: '#fffcf5'
      });
      
      const imgData = canvas.toDataURL('image/png');
      
      // Output to screen
      document.getElementById('loading').style.display = 'none';
      const resultImg = document.getElementById('result-img');
      resultImg.src = imgData;
      resultImg.style.display = 'block';
      document.getElementById('instructions').style.display = 'block';
      
      // Delete render tank to save memory
      const tank = document.getElementById('render-tank');
      if(tank) tank.parentNode.removeChild(tank);
      
    } catch (err) {
      console.error(err);
      document.getElementById('loading').textContent = '❌ تعذر استخراج الشهادة يرجى تحديث الصفحة';
    }
});
