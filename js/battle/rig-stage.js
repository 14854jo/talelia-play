/* =====================================================================
 * TALELIA · battle/rig-stage.js — 파츠 리그(js/battle/rig.js)를 전투 화면 칸에 연결 (화면 전용)
 *
 *  - 규칙 · 자동 행동 코드는 부르지 않습니다. view.js 가 "언제 어떤 동작"인지 알려 주면 재생 · 그리기만 합니다.
 *  - 그림을 못 불러오면 조용히 정지 그림(<img>)을 그대로 보여 줍니다 (console.error 없음).
 *
 *  mount(id, rigName, box, opt)   칸의 .bt-fig--rig 상자에 캔버스 연결 · 그림 불러오기 (한 번 불러온 리그는 다시 시작해도 재사용)
 *  ready(id)                      리그가 그려지고 있는지
 *  play(id, clip, { speed, onEvent, onEnd, blend })
 *  attack(id, speed)              → { hit: Promise(타격 신호), end: Promise(동작 끝) }
 *  hit(id, speed)                 피격 동작 → 끝나면 대기
 *  freeze(id, on)                 쓰러짐: 그 자세로 멈춤
 *  setReduced(on)                 움직임 줄이기: 갱신하지 않고 기본 자세로 고정
 *  resetAll()                     다시 시작: 모두 대기 · 멈춤 해제
 *  log                            시험용 기록 [{ id, clip | ev, t }]
 * ===================================================================== */
(function(){
  'use strict';
  const RIG = window.TaleliaRig, DEFS = window.TALELIA_RIGS || {};
  const units = {}, cache = {};
  const S = { reduced: false, raf: 0, last: 0, log: [], frames: 0 };
  const now = () => performance.now();

  function mount(id, rigName, box, opt){
    opt = opt || {};
    const def = DEFS[rigName], canvas = box && box.querySelector('canvas');
    const u = units[id] = Object.assign(units[id] || {}, { id, rigName, def, box, canvas, h: opt.height || 96, actor: box && box.closest('.bt-unit') && box.closest('.bt-unit').querySelector('.bt-actor'),
      frozen: false });
    if(!def || !RIG || !canvas){ fail(u); return u; }
    if(u.rig){ ok(u); idle(u, 0); return u; }
    // 불러오는 순서: 축소 사본(def.variants.small) → 원본 → 정지 그림
    //  opt.src = 'full' 이면 원본만 · opt.base(시험용) 를 주면 그 경로의 원본만 · opt.smallBase(시험용) = 사본 경로 바꾸기
    const base = opt.base != null ? opt.base : def.base, tries = [];
    const sm = def.variants && def.variants.small;
    if(sm && opt.src !== 'full' && opt.base == null) tries.push({ src: 'small', variant: opt.smallBase != null ? 'small_test' : 'small' });
    if(opt.smallBase != null && sm) def.variants.small_test = Object.assign({}, sm, { base: opt.smallBase });
    tries.push({ src: 'full', variant: null });
    const load = t => { const key = id + '|' + base + '|' + (t.variant || 'full'); return cache[key] || (cache[key] = RIG.load(def, base, t.variant)); };
    const next = i => i >= tries.length ? fail(u) : load(tries[i]).then(rig => { u.rig = rig; u.src = tries[i].src; ok(u); idle(u, 0); }, () => next(i + 1));
    next(0);
    return u;
  }
  function ok(u){ u.ready = true; u.failed = false; if(u.box){ u.box.classList.add('is-rig-ready'); u.box.classList.remove('is-rig-failed'); } start(); }
  function fail(u){ u.ready = false; u.failed = true; if(u.box){ u.box.classList.add('is-rig-failed'); u.box.classList.remove('is-rig-ready'); } }
  const ready = id => !!(units[id] && units[id].ready && units[id].rig);

  function play(id, clip, o){
    const u = units[id]; if(!u || !u.rig || !u.rig.has(clip)) return false;
    o = o || {};
    u.rig.play(clip, { speed: o.speed || 1, blend: o.blend, onEvent: o.onEvent || null,
      onEnd: o.onEnd || null });
    u.clip = clip; S.log.push({ id, clip, t: now() });
    return true;
  }
  function idle(u, blend){ play(u.id, 'idle', { speed: 1, blend }); }

  /** 공격 동작: 타격 신호 · 끝을 각각 기다릴 수 있게 */
  function attack(id, speed){
    let hitRes, endRes;
    const hit = new Promise(r => hitRes = r), end = new Promise(r => endRes = r);
    const okPlay = play(id, 'attack', { speed, blend: .05,
      onEvent: n => { if(n === 'hit'){ S.log.push({ id, ev: 'hit', t: now() }); hitRes(); } },
      onEnd: () => { endRes(); } });
    if(!okPlay){ hitRes(); endRes(); }
    return { hit, end };
  }
  function hit(id, speed){
    const u = units[id]; if(!u || !u.rig || u.frozen) return;
    play(id, 'hit', { speed, blend: .03, onEnd: () => { if(units[id] === u && !u.frozen) idle(u); } });
  }
  function freeze(id, on){ const u = units[id]; if(u) u.frozen = !!on; }
  function resetAll(){ for(const id in units){ const u = units[id]; u.frozen = false; if(u.rig) idle(u, 0); } }
  function setReduced(on){ S.reduced = !!on; }

  /* ---------- 갱신 · 그리기 (rAF 하나) ---------- */
  function start(){ if(!S.raf){ S.last = now(); S.raf = requestAnimationFrame(frame); } }
  function frame(t){
    S.raf = requestAnimationFrame(frame);
    const dt = Math.min(.1, Math.max(0, (t - S.last) / 1000)); S.last = t; S.frames++;
    for(const id in units){
      const u = units[id]; if(!u.ready || !u.rig || !u.canvas || !u.canvas.isConnected) continue;
      const bh = u.box && u.box.clientHeight; if(bh) u.h = bh;   // 캐릭터 키 = 그림 상자 높이 (전장 크기에 따라 바뀜)
      if(!S.reduced && !u.frozen){
        // 화면에서 앞으로 나간 거리(기준 전신 px) → 망토 · 귀가 바람을 받음
        if(u.actor){ const m = getComputedStyle(u.actor).transform, px = m && m !== 'none' ? new DOMMatrixReadOnly(m).m41 : 0; u.rig.setExternalX(px / (u.h / u.def.height)); }
        u.rig.update(dt);
      }
      draw(u);
    }
  }
  function draw(u){
    const c = u.canvas, d = window.devicePixelRatio || 1, w = c.clientWidth, h = c.clientHeight;
    if(!w || !h) return;
    const W = Math.round(w * d), H = Math.round(h * d);
    if(c.width !== W || c.height !== H){ c.width = W; c.height = H; }
    const ctx = c.getContext('2d'); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, H);
    u.rig.draw(ctx, w / 2, h - 1, u.h, 1, d);   // 발 밑 = 캔버스 아래 가운데 (= 칸의 그림 상자 아래)
  }

  window.TaleliaBattleRig = { mount, ready, play, attack, hit, freeze, resetAll, setReduced, units, log: S.log, stats: S };
})();
