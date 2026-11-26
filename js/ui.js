/* =====================================================================
 * TALELIA · ui.js — 공통 화면 도우미 (토스트 · 맥락 팝업 · 등급 표시)
 *  건강관리 앱의 공통 함수(head 등)는 가져오지 않았습니다.
 *  esc 는 원본 1409행 esc 와 같은 목적(HTML 특수문자 변환)의 새 함수입니다.
 * ===================================================================== */
(function(){
  const ESC = { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' };
  function esc(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, c => ESC[c]); }
  function num(v){ return Math.floor(Number(v) || 0).toLocaleString('ko-KR'); }

  // 등급 이름·색: 원본 VG_GRADE(1868행) + 2590행(6 돌연변이 · 7 보스 · 8 태초) 그대로
  const GRADE = {
    1:{ name:'일반', color:'#8a97ad' }, 2:{ name:'희귀', color:'#3b8cff' }, 3:{ name:'영웅', color:'#9b5cff' },
    4:{ name:'전설', color:'#ff9a1f' }, 5:{ name:'신화', color:'#ff4f8b' }, 6:{ name:'돌연변이', color:'#0fb59a' },
    7:{ name:'보스', color:'#6a3df0' }, 8:{ name:'태초', color:'#a46bff' }
  };
  function grade(g){ return GRADE[Number(g)] || { name:'?', color:'#999' }; }

  const ELEM = { fire:'🔥 불', water:'💧 물', grass:'🌿 풀', earth:'🪨 땅', thunder:'⚡ 번개', light:'✨ 빛', dark:'🌑 어둠' };

  function toast(msg, isErr){
    document.querySelectorAll('.tl-toast').forEach(t => t.remove());
    const t = document.createElement('div');
    t.className = 'tl-toast' + (isErr ? ' is-error' : '');
    t.setAttribute('role', 'status');
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2600);
  }

  /** 맥락 팝업(하단 시트). html 은 이미 esc 처리된 문자열이어야 합니다. */
  function sheet(title, html, actions){
    closeSheet();
    const wrap = document.createElement('div');
    wrap.className = 'tl-sheet-backdrop';
    wrap.innerHTML = `<section class="tl-sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <header class="tl-sheet__head"><h2>${esc(title)}</h2><button class="tl-icon-btn" data-close aria-label="닫기">✕</button></header>
        <div class="tl-sheet__body">${html}</div>
        <footer class="tl-sheet__foot"></footer></section>`;
    const foot = wrap.querySelector('.tl-sheet__foot');
    (actions || []).forEach(a => {
      const b = document.createElement('button');
      b.className = 'tl-btn ' + (a.kind || '');
      b.textContent = a.label;
      b.addEventListener('click', async () => { b.disabled = true; try{ await a.run(); } finally { b.disabled = false; } });
      foot.appendChild(b);
    });
    if(!foot.children.length) foot.remove();
    wrap.addEventListener('click', e => { if(e.target === wrap || e.target.closest('[data-close]')) closeSheet(); });
    document.body.appendChild(wrap);
    requestAnimationFrame(() => wrap.classList.add('is-open'));
  }
  function closeSheet(){ document.querySelectorAll('.tl-sheet-backdrop').forEach(e => e.remove()); }
  document.addEventListener('keydown', e => { if(e.key === 'Escape') closeSheet(); });

  // 없는 그림 기억 (원본 VG_LBMISS 와 같은 목적): 한 번 404 난 그림은 다시 요청하지 않음
  const MISSING = new Set();
  function imgOk(url){ return !!url && !MISSING.has(url); }
  function imgMiss(url){ if(url) MISSING.add(url); }

  window.TaleliaUI = Object.freeze({ esc, num, grade, GRADE, ELEM, toast, sheet, closeSheet, imgOk, imgMiss });
})();
