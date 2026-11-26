/* =====================================================================
 * TALELIA · story/fx.js — 일러스트 컷 연출 (화면 전용 · 브라우저 내장 애니메이션(WAAPI) + CSS 만)
 *
 *  play(type, host, opts) → { done: Promise, skip(), cancel() }
 *    host  컷 카드(.st-card) — 안의 img.st-card__img 위에 연출 층(.st-fx)을 깔고, 끝나면 걷어 냄
 *    opts  { at: [가로 비율, 세로 비율] (그림 원본 기준 · 빛이 모이는 점), color, reduced }
 *    done  연출이 끝나거나 skip() 하면 풀림 → 부른 쪽이 다음 대사로 넘어감
 *  last    시험용 기록 { type, point: [x, y] (컷 카드 기준 px), phases: { 단계: 시작 ms }, total, flashMax, shakePx, reduced, skipped }
 *
 *  leak_burst (cut_leak_light · 청록빛이 새어 나오는 순간 · 총 약 2.85초)
 *    0 ~ 0.9초    모임    점에 작은 빛망울이 커지며 두 번 맥동 · 빛 알갱이가 점으로 빨려 들어감
 *    0.9 ~ 1.3초  터짐    점에서 원형 빛이 화면 전체로 퍼짐 (화면 밝게 물들이기 · 그림은 그대로 보임)
 *    0.9 ~ 1.15초 번쩍    흰빛 최대 FLASH_MAX(0.35) 까지만 (눈부시지 않게)
 *    0.9 ~ 1.35초 흔들림  최대 ±SHAKE_PX(8px) · 점점 약하게
 *    1.3 ~ 2.6초  잦아듦  빛이 서서히 옅어짐 → 0.25초 동안 컷이 사라지며 끝
 *    움직임 줄이기: 퍼짐 · 번쩍 · 흔들림 없이 1초 동안 청록빛이 부드럽게 올라왔다 내려감
 * ===================================================================== */
(function(){
  'use strict';
  const FLASH_MAX = 0.35, SHAKE_PX = 8;
  const S = { last: null };

  /** 그림(object-fit: cover)에서 원본 비율 좌표 → 컷 카드 안의 px */
  function pointOf(host, img, at){
    const hw = host.clientWidth, hh = host.clientHeight, iw = img && img.naturalWidth || hw, ih = img && img.naturalHeight || hh;
    const s = Math.max(hw / iw, hh / ih), dx = (hw - iw * s) / 2, dy = (hh - ih * s) / 2;
    return [dx + at[0] * iw * s, dy + at[1] * ih * s];
  }
  const el = (cls, parent) => { const d = document.createElement('div'); d.className = cls; parent.appendChild(d); return d; };
  const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')'; };

  function leakBurst(host, opts){
    const img = host.querySelector('.st-card__img'), color = opts.color || '#5fe8d6', at = opts.at || [0.5, 0.5];
    const [x, y] = pointOf(host, img, at), W = host.clientWidth, H = host.clientHeight, U = Math.max(W, H);
    const rec = { type: 'leak_burst', point: [x, y], phases: {}, total: 0, flashMax: FLASH_MAX, shakePx: SHAKE_PX, reduced: !!opts.reduced, skipped: false };
    const layer = el('st-fx', host); layer.style.setProperty('--fx-c', color);
    const anims = [];
    const go = (node, frames, o) => { const a = node.animate(frames, Object.assign({ fill: 'forwards' }, o)); anims.push(a); return a; };   // forwards: 늦게 시작하는 층은 시작 전까지 CSS 기본(투명) 그대로
    const tint = el('st-fx__tint', layer);
    tint.style.background = color;

    if(opts.reduced){   // 움직임 줄이기: 청록빛이 부드럽게 올라왔다 내려감 (1초)
      rec.phases = { gather: 0, end: 1000 }; rec.flashMax = 0; rec.shakePx = 0; rec.total = 1000;
      go(tint, [{ opacity: 0 }, { opacity: .42, offset: .45 }, { opacity: 0 }], { duration: 1000, easing: 'ease-in-out' });
      return { rec, layer, anims, total: 1000, fadeOut: 0 };
    }

    const orbD = Math.max(28, U * .045), burstD = Math.hypot(Math.max(x, W - x), Math.max(y, H - y)) * 2.2;
    // ① 모임: 빛망울 (두 번 맥동 후 터지며 사라짐)
    const orb = el('st-fx__orb', layer);
    Object.assign(orb.style, { left: x + 'px', top: y + 'px', width: orbD + 'px', height: orbD + 'px' });
    go(orb, [
      { opacity: 0, transform: 'translate(-50%,-50%) scale(.2)' },
      { opacity: .85, transform: 'translate(-50%,-50%) scale(.55)', offset: .18 },
      { opacity: .95, transform: 'translate(-50%,-50%) scale(.85)', offset: .4 },
      { opacity: .8, transform: 'translate(-50%,-50%) scale(.62)', offset: .55 },
      { opacity: 1, transform: 'translate(-50%,-50%) scale(1.05)', offset: .78 },
      { opacity: 1, transform: 'translate(-50%,-50%) scale(1.5)', offset: .86 },
      { opacity: 0, transform: 'translate(-50%,-50%) scale(3)' }
    ], { duration: 1050, easing: 'ease-in-out' });
    // 빛 알갱이: 점 둘레(고정 배치)에서 점으로 빨려 들어감
    const R = U * .16;
    for(let i = 0; i < 7; i++){
      const a = (i / 7) * Math.PI * 2 + .4, r = R * (.7 + (i % 3) * .2), p = el('st-fx__dot', layer);
      Object.assign(p.style, { left: x + 'px', top: y + 'px' });
      const sx = Math.cos(a) * r, sy = Math.sin(a) * r;
      go(p, [
        { opacity: 0, transform: `translate(calc(-50% + ${sx}px), calc(-50% + ${sy}px)) scale(.6)` },
        { opacity: .95, transform: `translate(calc(-50% + ${sx * .6}px), calc(-50% + ${sy * .6}px)) scale(1)`, offset: .35 },
        { opacity: 0, transform: 'translate(-50%,-50%) scale(.3)' }
      ], { duration: 700, delay: 60 + i * 30, easing: 'cubic-bezier(.5,0,.9,.5)' });
    }
    // ② 터짐: 원형 빛이 화면 전체로 퍼졌다가 ⑤ 서서히 잦아듦
    const burst = el('st-fx__burst', layer);
    Object.assign(burst.style, { left: x + 'px', top: y + 'px', width: burstD + 'px', height: burstD + 'px',
      background: `radial-gradient(circle, ${rgba('#ffffff', .9)} 0, ${rgba(color, .85)} 12%, ${rgba(color, .45)} 38%, ${rgba(color, 0)} 70%)` });
    go(burst, [
      { opacity: .95, transform: 'translate(-50%,-50%) scale(.04)' },
      { opacity: .8, transform: 'translate(-50%,-50%) scale(1)', offset: .23 },
      { opacity: 0, transform: 'translate(-50%,-50%) scale(1.06)' }
    ], { duration: 1720, delay: 880, easing: 'cubic-bezier(.2,.7,.3,1)' });
    go(tint, [{ opacity: 0 }, { opacity: .5, offset: .14 }, { opacity: .45, offset: .3 }, { opacity: 0 }], { duration: 1700, delay: 900, easing: 'ease-out' });
    // ③ 번쩍 (약하게)
    const flash = el('st-fx__flash', layer);
    go(flash, [{ opacity: 0 }, { opacity: FLASH_MAX, offset: .3 }, { opacity: 0 }], { duration: 250, delay: 900, easing: 'ease-out' });
    // ④ 흔들림: 그림과 연출 층을 함께
    const shake = [[0, 0], [8, -5], [-7, 4], [5, -3], [-3, 2], [1, -1], [0, 0]].map(([dx, dy]) => ({ transform: `translate(${dx / 8 * SHAKE_PX}px, ${dy / 8 * SHAKE_PX}px)` }));
    for(const n of [img, layer]) if(n) go(n, shake, { duration: 450, delay: 900, easing: 'linear', fill: 'none' });
    rec.phases = { gather: 0, burst: 880, flash: 900, shake: 900, settle: 1300, fadeOut: 2600, end: 2850 };
    rec.total = 2850;
    return { rec, layer, anims, total: 2600, fadeOut: 250 };
  }

  const TYPES = { leak_burst: leakBurst };

  function play(type, host, opts){
    opts = opts || {};
    const make = TYPES[type];
    if(!make){ const r = { done: Promise.resolve('unknown'), skip(){}, cancel(){} }; return r; }
    const t0 = performance.now(), fx = make(host, opts);
    S.last = Object.assign(fx.rec, { t0, t1: 0 });
    let finish, over = false, timer = 0, fade = null;
    const done = new Promise(res => { finish = res; });
    const clean = () => { clearTimeout(timer); for(const a of fx.anims) try{ a.cancel(); }catch(e){} if(fade) try{ fade.cancel(); }catch(e){} fx.layer.remove(); };
    const end = how => { if(over) return; over = true; fx.rec.t1 = performance.now() - t0; fx.rec.skipped = how === 'skip'; clean(); finish(how); };
    timer = setTimeout(() => {
      if(over) return;
      if(!fx.fadeOut) return end('done');
      fade = host.animate([{ opacity: 1 }, { opacity: 0 }], { duration: fx.fadeOut, easing: 'ease-in', fill: 'forwards' });
      fade.onfinish = () => end('done');
    }, fx.total);
    return { done, skip: () => end('skip'), cancel: () => end('cancel'), get running(){ return !over; } };
  }

  window.TaleliaStoryFx = { play, pointOf, TYPES, FLASH_MAX, SHAKE_PX, get last(){ return S.last; } };
})();
