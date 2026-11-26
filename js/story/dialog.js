/* =====================================================================
 * TALELIA · story/dialog.js — 대화창 · 이름표 · 한 글자씩 출력 · 지난 대사 로그 · 자리표시 카드 (화면 전용)
 *
 *  create(root) → dialog
 *    type(entry, { cps, instant }) → Promise   entry = { name, color, segs } · 다 나오면 끝남 (finish() 로 바로 끝)
 *    finish()          지금 줄을 바로 다 보여 줌
 *    typing            지금 출력 중인지
 *    ready(on)         다음 표시(▼) 켜고 끄기
 *    clear()           비우기
 *    logAdd(item) · logOpen() · logClose() · logIsOpen()      item = { name, color, text, narr }
 *    card({ kind, title, body, buttons: [{ label, value }], image, fx }) → Promise(value)   전투 · 컷 · 끝 자리표시
 *      fx = { type, at, color } 이면 그림 위에서 연출(js/story/fx.js)을 재생하고 끝나면 저절로 닫힘 → 'fx-done' · 건너뛰면 'fx-skip'
 *      (버튼 없음 · 카드 클릭 또는 cardSkip() 으로 건너뜀)
 *    cardOpen() · cardSkip()   cardSkip = 연출 중인 컷만 건너뜀 (다른 카드는 아무 일 없음)
 *  글자는 처음부터 모두 깔아 두고(보이지 않게) 차례로 드러냄 → 대화창 크기 · 줄 바꿈이 출력 중에 흔들리지 않음.
 * ===================================================================== */
(function(){
  'use strict';
  const chars = s => window.TaleliaStoryParser.chars(s);

  function create(root){
    const box = root.querySelector('.st-box'), plate = box.querySelector('.st-plate'), txt = box.querySelector('.st-text'), next = box.querySelector('.st-next');
    const live = root.querySelector('.st-live'), logEl = root.querySelector('.st-log'), logList = logEl.querySelector('ol'), cardEl = root.querySelector('.st-card');
    const T = { typing: false, spans: [], times: [], t0: 0, raf: 0, done: null, card: null };
    const now = () => performance.now();

    function clear(){ stop(); txt.textContent = ''; plate.hidden = true; box.classList.remove('is-narr'); ready(false); }
    function stop(){ if(T.raf) cancelAnimationFrame(T.raf); T.raf = 0; T.typing = false; }

    function type(entry, o){
      o = o || {};
      if(T.done){ const d = T.done; T.done = null; d(); }   // 앞 줄을 기다리던 쪽은 끝난 것으로 (다시 시작 등)
      stop(); ready(false);
      const narr = !entry.name;
      box.classList.toggle('is-narr', narr);
      plate.hidden = narr; plate.textContent = entry.name || '';
      plate.style.setProperty('--np', entry.color || '#5B5146');
      // 글자 깔기 · 드러날 시각 계산 (초당 cps 글자, {쉼} 은 그만큼 늦춤)
      txt.textContent = ''; T.spans = []; T.times = [];
      const frag = document.createDocumentFragment(); let t = 0, plain = '';
      for(const s of entry.segs){
        if(s.pause != null){ t += s.pause * 1000; continue; }
        if(s.br){ frag.appendChild(document.createElement('br')); plain += '\n'; continue; }
        for(const ch of chars(s.text)){
          const sp = document.createElement('span'); sp.textContent = ch; frag.appendChild(sp);
          T.spans.push(sp); T.times.push(t); t += 1000 / (o.cps || 30); plain += ch;
        }
      }
      txt.appendChild(frag);
      live.textContent = (entry.name ? entry.name + ': ' : '') + plain;   // 화면 낭독기: 한 줄을 한 번에
      return new Promise(res => {
        T.done = res;
        if(o.instant || !T.spans.length){ finish(); return; }
        T.typing = true; T.t0 = now();
        const step = () => {
          const el = now() - T.t0; let i = T.shown || 0;
          while(i < T.spans.length && T.times[i] <= el) T.spans[i++].className = 'on';
          T.shown = i;
          if(i >= T.spans.length) finish(); else T.raf = requestAnimationFrame(step);
        };
        T.shown = 0; T.raf = requestAnimationFrame(step);
      });
    }
    function finish(){
      stop();
      for(const sp of T.spans) sp.className = 'on';
      T.shown = T.spans.length;
      const d = T.done; T.done = null; if(d) d();
    }
    function ready(on){ next.hidden = !on; }

    // ---------- 지난 대사 로그 ----------
    function logAdd(it){
      const li = document.createElement('li');
      if(it.narr) li.className = 'is-narr';
      if(it.name){ const b = document.createElement('b'); b.textContent = it.name; b.style.setProperty('--np', it.color || '#5B5146'); li.appendChild(b); }
      const p = document.createElement('p'); p.textContent = it.text; li.appendChild(p);
      logList.appendChild(li);
      while(logList.children.length > 300) logList.firstChild.remove();
    }
    function logOpen(){ logEl.hidden = false; logEl.scrollTop = logEl.scrollHeight; const b = logEl.querySelector('button'); if(b) b.focus({ preventScroll: true }); }
    function logClose(){ logEl.hidden = true; }
    function logReset(){ logList.textContent = ''; }
    const logIsOpen = () => !logEl.hidden;

    // ---------- 자리표시 카드 (전투 · 컷 · 장면 끝) ----------
    function card(c){
      cardEl.textContent = ''; cardEl.dataset.kind = c.kind || '';
      if(c.image){ const im = document.createElement('img'); im.src = c.image; im.alt = c.title || ''; im.className = 'st-card__img'; cardEl.appendChild(im); }
      const inner = document.createElement('div'); inner.className = 'st-card__box';
      if(c.title){ const h = document.createElement('h2'); h.textContent = c.title; inner.appendChild(h); }
      if(c.body){ const p = document.createElement('p'); p.textContent = c.body; inner.appendChild(p); }
      const row = document.createElement('div'); row.className = 'st-card__btns';
      inner.appendChild(row);
      if(c.title || c.body || (c.buttons && c.buttons.length)) cardEl.appendChild(inner);   // 글 · 버튼이 없는 카드(연출 컷)는 빈 상자를 그리지 않음
      cardEl.hidden = false;
      return new Promise(res => {
        T.card = v => { if(T.fx){ const f = T.fx; T.fx = null; f.cancel(); } cardEl.hidden = true; cardEl.textContent = ''; T.card = null; res(v); };
        if(c.fx && window.TaleliaStoryFx) startFx(c);
        for(const b of c.buttons || []){
          const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'st-btn' + (b.primary ? ' st-btn--primary' : ''); btn.textContent = b.label; btn.dataset.value = b.value;
          btn.addEventListener('click', ev => { ev.stopPropagation(); if(T.card) T.card(b.value); });
          row.appendChild(btn);
        }
        const first = row.querySelector('button'); if(first) first.focus({ preventScroll: true });
      });
    }
    /** 연출 컷: 그림을 받은 뒤(최대 3초 · 못 받아도 진행) 연출 → 끝나면 카드를 닫음 · 카드 클릭 = 건너뛰기 */
    async function startFx(c){
      const im = cardEl.querySelector('.st-card__img'), mine = T.card;
      if(im && !(im.complete && im.naturalWidth)) await Promise.race([new Promise(r => { im.addEventListener('load', r, { once: true }); im.addEventListener('error', r, { once: true }); }), new Promise(r => setTimeout(r, 3000))]);
      if(T.card !== mine) return;   // 그사이 닫힘 (다시 시작 등)
      const reduced = root.classList.contains('is-reduced');
      const fx = T.fx = window.TaleliaStoryFx.play(c.fx.type, cardEl, Object.assign({}, c.fx, { reduced }));
      cardEl.classList.add('is-fx');
      cardEl.addEventListener('click', T.fxClick = ev => { ev.stopPropagation(); fx.skip(); });
      const how = await fx.done;
      cardEl.classList.remove('is-fx'); cardEl.removeEventListener('click', T.fxClick);
      if(T.fx === fx){ T.fx = null; if(T.card === mine) T.card(how === 'skip' ? 'fx-skip' : 'fx-done'); }
    }
    function cardSkip(){ if(T.fx) T.fx.skip(); }
    const cardOpen = () => !!T.card;
    function cardCancel(){ if(T.card){ const f = T.card; f(null); } }

    return { type, finish, ready, clear, logAdd, logReset, logOpen, logClose, logIsOpen, card, cardOpen, cardCancel, cardSkip,
             get typing(){ return T.typing; }, get shown(){ return T.shown || 0; }, get total(){ return T.spans.length; }, T };
  }

  window.TaleliaStoryDialog = { create };
})();
