/* =====================================================================
 * TALELIA · town/camera.js — 카메라 (이동 · 확대 · 화면 크기 대응)
 *
 *  - 바꾸는 것은 카메라 요소(layer)의 transform 하나뿐입니다. 땅·건물·동물 요소는 다시 그리지 않습니다.
 *  - 조작: 끌기(마우스·한 손가락) · 두 손가락 확대 · 휠/트랙패드 · 두 번 눌러 확대 · 버튼 · 키보드(화살표 · + · − · 0)
 *  - 가장 작은 배율 = "마을 전체가 보이는 배율"(fit). 위 HUD 와 아래 메뉴를 뺀 영역 기준입니다.
 *  - 끌기가 끝나면 짧은 관성. 움직임 줄이기 설정이면 관성·부드러운 확대를 끕니다.
 *  - 6px 이상 움직이지 않고 손을 떼면 onTap(clientX, clientY) 를 부릅니다. (3단계 선택에서 사용)
 * ===================================================================== */
(function(){
  const REDUCED = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /**
   * @param viewport  끌기를 받는 요소 (화면 전체)
   * @param layer     transform 을 바꿀 카메라 요소
   * @param box       세계의 화면 경계 상자 {x,y,w,h} (확대 1배 기준)
   * @param opts      { insets(): {top,right,bottom,left}, onChange(state), onTap(cx,cy), maxScale }
   */
  function create(viewport, layer, box, opts){
    const o = opts || {};
    const S = { x: 0, y: 0, s: 1, fit: 1, min: 1, max: 2, changes: 0 };
    let anim = 0, inertia = 0;

    /** 마을을 보여 줄 영역 (뷰포트 좌표) */
    function area(){
      const r = viewport.getBoundingClientRect(), i = o.insets ? o.insets() : { top: 0, right: 0, bottom: 0, left: 0 };
      return { left: i.left, top: i.top, w: Math.max(80, r.width - i.left - i.right), h: Math.max(80, r.height - i.top - i.bottom), rect: r };
    }
    function computeFit(){ const a = area(), pad = Math.min(24, a.w * .03); return Math.min((a.w - pad * 2) / box.w, (a.h - pad * 2) / box.h); }

    function apply(){
      layer.style.transform = `translate3d(${S.x.toFixed(2)}px,${S.y.toFixed(2)}px,0) scale(${S.s.toFixed(5)})`;
      S.changes++;
      if(o.onChange) o.onChange(state());
    }

    /** 세계가 화면 밖으로 너무 멀리 나가지 않게 (작으면 가운데 정렬) */
    function bound(){
      const a = area(), ww = box.w * S.s, wh = box.h * S.s;
      if(ww <= a.w + 1) S.x = a.left + a.w / 2 - (box.x + box.w / 2) * S.s;
      else { const m = Math.min(a.w * .3, 180); S.x = clamp(S.x, a.left + a.w - m - (box.x + box.w) * S.s, a.left + m - box.x * S.s); }
      if(wh <= a.h + 1) S.y = a.top + a.h / 2 - (box.y + box.h / 2) * S.s;
      else { const m = Math.min(a.h * .3, 180); S.y = clamp(S.y, a.top + a.h - m - (box.y + box.h) * S.s, a.top + m - box.y * S.s); }
    }

    function stop(){ cancelAnimationFrame(anim); cancelAnimationFrame(inertia); anim = inertia = 0; }

    /** 뷰포트 좌표 (vx, vy) 를 고정점으로 배율 변경 */
    function zoomAt(vx, vy, ns){
      ns = clamp(ns, S.min, S.max);
      const wx = (vx - S.x) / S.s, wy = (vy - S.y) / S.s;
      S.s = ns; S.x = vx - wx * ns; S.y = vy - wy * ns;
      bound(); apply();
    }
    function panBy(dx, dy){ S.x += dx; S.y += dy; bound(); apply(); }

    /** 부드러운 확대 (버튼 · 두 번 누르기) */
    function zoomTo(vx, vy, ns, ms){
      stop(); ns = clamp(ns, S.min, S.max);
      if(REDUCED() || !ms){ zoomAt(vx, vy, ns); return; }
      const s0 = S.s, t0 = performance.now();
      const step = t => { const k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3); zoomAt(vx, vy, s0 + (ns - s0) * e); if(k < 1) anim = requestAnimationFrame(step); else anim = 0; };
      anim = requestAnimationFrame(step);
    }
    function areaCenter(){ const a = area(); return [a.left + a.w / 2, a.top + a.h / 2]; }
    function zoomBy(f){ const [cx, cy] = areaCenter(); zoomTo(cx, cy, S.s * f, 200); }

    /** 마을 전체 보기 */
    function fit(){ stop(); S.fit = computeFit(); S.min = S.fit; S.max = Math.max(o.maxScale || 2, S.fit * 1.5); S.s = S.fit; bound(); apply(); }

    /** 세계 좌표 (wx, wy) 를 영역 가운데로 */
    function centerOn(wx, wy, ns){ const [cx, cy] = areaCenter(); if(ns) S.s = clamp(ns, S.min, S.max); S.x = cx - wx * S.s; S.y = cy - wy * S.s; bound(); apply(); }

    /** 화면 크기가 바뀌면: 보던 지점을 가운데에 유지, fit 다시 계산 */
    function resize(){
      const wasFit = Math.abs(S.s - S.fit) < 1e-4;
      const [cx0, cy0] = lastCenter || areaCenter();
      const wx = (cx0 - S.x) / S.s, wy = (cy0 - S.y) / S.s;
      S.fit = computeFit(); S.min = S.fit; S.max = Math.max(o.maxScale || 2, S.fit * 1.5);
      S.s = wasFit ? S.fit : clamp(S.s, S.min, S.max);
      const [cx, cy] = areaCenter(); S.x = cx - wx * S.s; S.y = cy - wy * S.s;
      bound(); apply(); lastCenter = areaCenter();
    }
    let lastCenter = null;

    /* ---------- 입력 ---------- */
    const pts = new Map();
    let drag = null, pinch = null, vel = [], lastTap = null;
    const local = e => { const r = viewport.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    const ignore = t => t && t.closest && t.closest('button, a, input, select, textarea, [data-no-pan]');

    viewport.addEventListener('pointerdown', e => {
      if(ignore(e.target) || (e.pointerType === 'mouse' && e.button !== 0)) return;
      stop();
      try{ viewport.setPointerCapture(e.pointerId); }catch(_){}
      pts.set(e.pointerId, local(e));
      if(pts.size === 1){ const [x, y] = pts.get(e.pointerId); drag = { id: e.pointerId, x, y, sx: x, sy: y, moved: false, t: e.timeStamp }; vel = []; }
      if(pts.size === 2){
        const [a, b] = [...pts.values()];
        pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, s: S.s, mx: (a[0] + b[0]) / 2, my: (a[1] + b[1]) / 2 };
        if(drag) drag.moved = true;
      }
      viewport.classList.add('is-moving');
    });

    viewport.addEventListener('pointermove', e => {
      if(!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, local(e));
      if(pts.size >= 2 && pinch){
        const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
        S.x += mx - pinch.mx; S.y += my - pinch.my; pinch.mx = mx; pinch.my = my;   // 두 손가락 가운데 이동 = 끌기
        zoomAt(mx, my, pinch.s * d / pinch.d);
        return;
      }
      if(drag && drag.id === e.pointerId){
        const [x, y] = pts.get(e.pointerId), dx = x - drag.x, dy = y - drag.y;
        if(!drag.moved && Math.hypot(x - drag.sx, y - drag.sy) > 6) drag.moved = true;
        drag.x = x; drag.y = y;
        if(drag.moved){
          panBy(dx, dy);
          vel.push({ t: e.timeStamp, dx, dy }); while(vel.length && e.timeStamp - vel[0].t > 100) vel.shift();
        }
      }
    });

    function end(e){
      if(!pts.has(e.pointerId)) return;
      pts.delete(e.pointerId);
      if(pts.size < 2) pinch = null;
      if(pts.size === 1){ const [id, p] = [...pts.entries()][0]; drag = { id, x: p[0], y: p[1], sx: p[0], sy: p[1], moved: true, t: e.timeStamp }; vel = []; return; }
      if(pts.size) return;
      viewport.classList.remove('is-moving');
      const d = drag; drag = null;
      if(!d) return;
      if(!d.moved && e.type === 'pointerup'){
        // 두 번 누르기 = 확대 (마우스는 dblclick 이벤트가 따로 처리)
        if(e.pointerType !== 'mouse' && lastTap && e.timeStamp - lastTap.t < 300 && Math.hypot(d.x - lastTap.x, d.y - lastTap.y) < 24){ lastTap = null; zoomTo(d.x, d.y, S.s * 1.6, 220); return; }
        lastTap = { t: e.timeStamp, x: d.x, y: d.y };
        if(o.onTap) o.onTap(e.clientX, e.clientY);
        return;
      }
      // 관성: 손을 떼기 직전 100ms 동안의 움직임만 씀 (멈췄다가 떼면 관성 없음)
      vel = vel.filter(v => e.timeStamp - v.t <= 100);
      if(REDUCED() || vel.length < 2) return;
      const span = Math.max(32, e.timeStamp - vel[0].t);
      let vx = vel.reduce((s, v) => s + v.dx, 0) / span * 16, vy = vel.reduce((s, v) => s + v.dy, 0) / span * 16;
      const sp = Math.hypot(vx, vy), cap = 45;   // 한 프레임 최대 45px
      if(sp < 2) return;
      if(sp > cap){ vx *= cap / sp; vy *= cap / sp; }
      const step = () => { vx *= .92; vy *= .92; panBy(vx, vy); if(Math.hypot(vx, vy) > .4) inertia = requestAnimationFrame(step); else inertia = 0; };
      inertia = requestAnimationFrame(step);
    }
    viewport.addEventListener('pointerup', end);
    viewport.addEventListener('pointercancel', end);

    viewport.addEventListener('wheel', e => {
      e.preventDefault(); stop();
      const [x, y] = local(e), unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
      if(!e.ctrlKey && Math.abs(e.deltaX) > Math.abs(e.deltaY) * 1.2){ panBy(-e.deltaX * unit, -e.deltaY * unit); return; }   // 트랙패드 가로 밀기
      zoomAt(x, y, S.s * Math.exp(-e.deltaY * unit * (e.ctrlKey ? .01 : .0015)));
    }, { passive: false });

    viewport.addEventListener('dblclick', e => { if(ignore(e.target)) return; const [x, y] = local(e); zoomTo(x, y, S.s * 1.6, 220); });

    viewport.addEventListener('keydown', e => {
      const k = e.key, step = 70;
      if(k === 'ArrowLeft') panBy(step, 0); else if(k === 'ArrowRight') panBy(-step, 0);
      else if(k === 'ArrowUp') panBy(0, step); else if(k === 'ArrowDown') panBy(0, -step);
      else if(k === '+' || k === '=') zoomBy(1.25); else if(k === '-' || k === '_') zoomBy(1 / 1.25);
      else if(k === '0') fit();
      else return;
      e.preventDefault();
    });

    if(window.ResizeObserver) new ResizeObserver(() => resize()).observe(viewport);
    else window.addEventListener('resize', resize);

    /* ---------- 좌표 변환 (테스트 · 3단계 선택용) ---------- */
    function state(){ return { x: S.x, y: S.y, s: S.s, fit: S.fit, min: S.min, max: S.max, changes: S.changes }; }
    function clientToWorld(cx, cy){ const r = viewport.getBoundingClientRect(); return [(cx - r.left - S.x) / S.s, (cy - r.top - S.y) / S.s]; }
    function worldToClient(wx, wy){ const r = viewport.getBoundingClientRect(); return [r.left + S.x + wx * S.s, r.top + S.y + wy * S.s]; }

    fit(); lastCenter = areaCenter();
    return Object.freeze({ fit, zoomAt, zoomTo, zoomBy, panBy, centerOn, resize, state, area, clientToWorld, worldToClient });
  }

  window.TaleliaTownCamera = Object.freeze({ create });
})();
