/* =====================================================================
 * TALELIA · story/stage.js — 대화 장면 무대: 배경 · 캐릭터 표정 그림 (화면 전용)
 *
 *  create(root, cast, opt) → stage
 *    setBg(id)                 배경 (null · 없는 이름 = 단색 바탕)
 *    setTone('base' | 'lab')   톤 (root 의 data-tone → story.css 토큰이 바뀜)
 *    enter(id, pos, expr)      등장 (pos = left · center · right, expr = 표정 이름(한국어) · 없으면 기본)
 *    exit(id | '*')            퇴장
 *    expr(id, expr)            표정 교체 (같은 크기 바탕이라 위치 그대로)
 *    move(id, pos)             자리 옮김
 *    speak(id | null)          말하는 캐릭터 강조 · 나머지 어둡게 (null = 나레이션: 모두 어둡게 · undefined = 모두 보통)
 *    label(id)                 이름표 글 (@이름표 로 바꾼 값 우선)
 *    setLabel(id, text|null)
 *    preload(ids)              쓰일 캐릭터의 표정 그림을 미리 받기
 *    reset()                   모두 퇴장 · 배경 · 이름표 원래대로 (애니메이션 없음)
 *    instant                   true 면 등장 · 퇴장 · 이동 애니메이션 없음 (건너뛰기 · 움직임 줄이기)
 *  그림을 못 불러오면 조용히 이름 상자로 바꿔 보여 줌 (console.error 없음).
 *  그림 없는 캐릭터(cast.js portrait: null)는 등장 · 표정 · 이동 · 퇴장 모두 무대에 아무것도 하지 않음.
 * ===================================================================== */
(function(){
  'use strict';
  const POS_X = { left: 1, center: 1, right: 1 };   // 쓸 수 있는 자리 (실제 가로 위치는 story.css 의 .st-por[data-pos])

  function create(root, cast, opt){
    opt = opt || {};
    const chars = cast.characters, base = opt.base != null ? opt.base : cast.base;
    const bgEl = root.querySelector('.st-bg'), layer = root.querySelector('.st-cast');
    const on = {}, labels = {}, cache = {};
    const S = { instant: false, reduced: !!opt.reduced, speaker: undefined, bg: null };

    const src = (id, e) => { const c = chars[id]; return base + c.dir + '/' + (c.fixed || c.expressions[e]) + '.webp'; };   // fixed = 표정 없이 그림 하나
    const exprOf = (id, e) => { const c = chars[id]; return e && (c.fixed || c.expressions[e]) ? e : c.default; };
    const animOK = () => !S.instant && !S.reduced && typeof Element !== 'undefined' && Element.prototype.animate;

    function load(url){
      return cache[url] || (cache[url] = new Promise(ok => { const im = new Image(); im.onload = () => ok(true); im.onerror = () => ok(false); im.src = url; }));
    }
    const drawn = id => chars[id] && chars[id].portrait !== null && chars[id].dir;   // 그림 없는 캐릭터(portrait: null)는 무대에 그리지 않음
    function preload(ids){ return Promise.all((ids || []).filter(drawn).flatMap(id => chars[id].fixed ? [load(src(id))] : Object.keys(chars[id].expressions).map(e => load(src(id, e))))); }

    // 배경 표 값: '그림 경로' 또는 { fill: CSS 배경값 } (단색 · 그라데이션). 없으면 톤 기본 바탕
    function setBg(id){
      S.bg = id || null;
      const v = id && cast.backgrounds && cast.backgrounds[id];
      const url = typeof v === 'string' ? v : v && v.image, fill = v && typeof v === 'object' && v.fill;
      bgEl.style.background = '';
      if(url) bgEl.style.backgroundImage = 'url("' + url + '")';
      else if(fill) bgEl.style.background = fill;
      bgEl.dataset.bg = url || fill ? id : '';
    }
    function setTone(v){ root.dataset.tone = v === 'lab' ? 'lab' : 'base'; }

    function build(id){
      const c = chars[id], fig = document.createElement('figure');
      fig.className = 'st-por'; fig.dataset.id = id;
      fig.style.setProperty('--w', c.size[0]); fig.style.setProperty('--h', c.size[1]); fig.style.setProperty('--k', c.scale || 1); fig.style.setProperty('--sink', c.sink || 0);   // sink: 전신 그림을 바닥선 아래로 내려 아랫몸을 대화창 뒤로
      const img = document.createElement('img'); img.alt = ''; img.decoding = 'async'; img.draggable = false;
      img.addEventListener('error', () => fig.classList.add('is-missing'));
      img.addEventListener('load', () => fig.classList.remove('is-missing'));
      const cap = document.createElement('figcaption'); cap.textContent = label(id);
      fig.append(img, cap);
      return fig;
    }
    function place(u, pos){ u.pos = pos; u.el.dataset.pos = pos; }
    function show(u, e){ u.expr = exprOf(u.id, e); const url = src(u.id, u.expr); if(u.img.getAttribute('src') !== url) u.img.src = url; u.el.dataset.expr = u.expr; }

    function enter(id, pos, e){
      if(!drawn(id)) return;   // 그림 없는 캐릭터: 이름표만 (말하면 다른 캐릭터는 speak() 로 어두워짐)
      let u = on[id];
      if(u && u.leaving){ u.leaving.cancel && u.leaving.cancel(); u.el.remove(); u = null; delete on[id]; }
      if(!u){
        const el = build(id);
        u = on[id] = { id, el, img: el.querySelector('img'), pos: null, expr: null };
        place(u, pos || 'center'); show(u, e);
        layer.appendChild(el);
        if(animOK()) el.animate([{ opacity: 0, transform: 'translateY(4%)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: 'ease-out' });
      } else { if(pos) move(id, pos); if(e) show(u, e); }
      applySpeak();
    }
    function exit(id){
      const ids = id === '*' ? Object.keys(on) : [id];
      for(const k of ids){
        const u = on[k]; if(!u) continue; delete on[k];
        if(animOK()){ u.leaving = u.el.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateY(3%)' }], { duration: 260, easing: 'ease-in', fill: 'forwards' }); u.leaving.onfinish = () => u.el.remove(); }
        else u.el.remove();
      }
    }
    function expr(id, e){ const u = on[id]; if(u) show(u, e); }
    function move(id, pos){
      const u = on[id]; if(!u || !POS_X[pos]) return;
      u.el.classList.toggle('no-move-anim', !animOK());
      place(u, pos);
    }
    function applySpeak(){
      for(const k in on){
        const el = on[k].el, sp = S.speaker;
        el.classList.toggle('is-speaking', sp != null && sp === k);
        el.classList.toggle('is-dim', sp !== undefined && sp !== k);
      }
      // 말하는 캐릭터를 맨 앞으로
      for(const k in on) on[k].el.style.zIndex = S.speaker === k ? 3 : 1;
    }
    function speak(id){ S.speaker = id; applySpeak(); }
    function label(id){ return labels[id] || (chars[id] ? chars[id].label : id); }
    function setLabel(id, text){ if(text) labels[id] = text; else delete labels[id]; const u = on[id]; if(u) u.el.querySelector('figcaption').textContent = label(id); }
    function reset(){ for(const k in on){ on[k].el.remove(); delete on[k]; } layer.textContent = ''; for(const k in labels) delete labels[k]; S.speaker = undefined; setBg(null); setTone('base'); }

    return {
      S, on, setBg, setTone, enter, exit, expr, move, speak, label, setLabel, preload, reset, src, load,
      set instant(v){ S.instant = !!v; }, get instant(){ return S.instant; },
      set reduced(v){ S.reduced = !!v; }, get reduced(){ return S.reduced; }
    };
  }

  window.TaleliaStoryStage = { create, POS_X };
})();
