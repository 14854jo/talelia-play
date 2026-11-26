/* =====================================================================
 * TALELIA · battle/fx-kit.js — 뽑기 캐릭터 공격 이펙트 (전부 코드로 그림 · 그림 파일 없음 · 화면 전용)
 *
 *  전투 규칙 · 피해 계산과 상관없음. "보이는 것"만: 투사체 · 폭발 · 빛 입자 · 회전 궤적.
 *  전투 화면(view.js)과 리그 미리보기(gacha-rig-preview.html)가 같이 씀.
 *
 *  const fx = TaleliaFx.create()          이펙트 묶음 하나 (좌표 = 그릴 캔버스의 CSS px)
 *   fx.shoot(kind, from, to, o)  → Promise  투사체가 닿는 순간 풀림 (닿은 뒤 꼬리는 남아 사라짐)
 *        kind = 'foxfire' 여우불 · 'moonorb' 달빛 구체 · 'stone' 돌
 *        o = { h(캐릭터 키 px) · dur(초) · arc(포물선 높이 px) · size(배율) · big · ts(시간 배율: 느리게 > 1) · onArrive }
 *   fx.burst(kind, p, o)         명중 이펙트: 'foxfire' · 'foxfire_big' · 'moon' · 'stone' · 'stone_big' · 'slash'(달토끼 초승달 강타)
 *   fx.gather(p, o) → { end() }  빛 입자가 모여드는 기 모으기 (o.dur 초 동안 · 중심에 불덩이가 커짐)
 *   fx.spark(p, o)               작은 불씨 / 별빛 (마법봉 끝 · kind: 'fire' | 'moon')
 *   fx.ring(p, o)                퍼지는 고리
 *   fx.update(dt) · fx.draw(ctx) · fx.busy() · fx.clear()
 *   모든 크기는 o.h(캐릭터 키)에 비례 + 최소 px 가 있음 → 큰 화면 · 작은 화면 모두 알아볼 수 있게
 *   시간은 "기준 초" 로 적고 o.ts 로 늘림 (전투 배속 · 시험용 fxscale 을 따라감)
 *
 *  TaleliaFx.orbit(ctx, o)        타원 궤적 띠 (리그의 코드로 그리는 층에서 씀 · 기준 전신 좌표)
 *  TaleliaFx.attach(fieldEl)      전장 위에 이펙트 캔버스를 깔고 그리는 반복 · { fx, resize, destroy }
 * ===================================================================== */
(function (root) {
  'use strict';
  var TAU = Math.PI * 2, rnd = function (a, b) { return a + Math.random() * (b - a); };
  var ease = { in: function (u) { return u * u; }, out: function (u) { return 1 - (1 - u) * (1 - u); }, inout: function (u) { return u < .5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2; } };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var MAXP = 900;

  /* ---------- 그리기 부품 ---------- */
  /** 불꽃 한 송이: 머리 중심 (0,0) · 꼬리는 뒤(-x) · 물방울 모양 · wob = 일렁임 */
  function flamePath(ctx, len, r, wob, t) {
    var w1 = Math.sin(t * 38) * r * .35 * wob, w2 = Math.sin(t * 27 + 1.3) * r * .55 * wob, w3 = Math.sin(t * 31 + .4) * r * .5 * wob;
    ctx.beginPath(); ctx.moveTo(0, -r);
    ctx.bezierCurveTo(-r * 1.1, -r + w1, -len * .6, -r * .55 + w2, -len, w3);
    ctx.bezierCurveTo(-len * .6, r * .55 + w1, -r * 1.1, r - w2, 0, r);
    ctx.arc(0, 0, r, Math.PI / 2, -Math.PI / 2, true); ctx.closePath();
  }
  function glow(ctx, x, y, R, c0, c1) { var g = ctx.createRadialGradient(x, y, 0, x, y, R); g.addColorStop(0, c0); g.addColorStop(1, c1 || 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.fill(); }
  /** 여우불: 주황 겉불꽃 + 푸른 속불 + 빛 번짐 */
  function drawFoxfire(ctx, x, y, ang, r, t, a) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.globalAlpha = a == null ? 1 : a; ctx.globalCompositeOperation = 'lighter';
    glow(ctx, 0, 0, r * 3.1, 'rgba(255,150,60,.55)', 'rgba(255,90,20,0)');
    var len = r * 3.4, g = ctx.createLinearGradient(r, 0, -len, 0);
    g.addColorStop(0, 'rgba(255,226,140,1)'); g.addColorStop(.3, 'rgba(255,140,46,.95)'); g.addColorStop(1, 'rgba(255,60,20,0)');
    flamePath(ctx, len, r, 1, t); ctx.fillStyle = g; ctx.fill();
    var g2 = ctx.createLinearGradient(r * .6, 0, -len * .6, 0);
    g2.addColorStop(0, 'rgba(255,255,255,1)'); g2.addColorStop(.4, 'rgba(120,208,255,.95)'); g2.addColorStop(1, 'rgba(60,110,255,0)');
    ctx.translate(r * .12, 0); flamePath(ctx, len * .62, r * .56, .8, t + .7); ctx.fillStyle = g2; ctx.fill();
    ctx.restore();
  }
  /** 달빛 구체: 빛나는 중심 · 금빛 테두리 · 도는 룬 고리 */
  function drawMoonOrb(ctx, x, y, r, t, a) {
    ctx.save(); ctx.translate(x, y); ctx.globalAlpha = a == null ? 1 : a; ctx.globalCompositeOperation = 'lighter';
    glow(ctx, 0, 0, r * 3.2, 'rgba(150,190,255,.5)', 'rgba(120,150,255,0)');
    glow(ctx, 0, 0, r * 1.5, 'rgba(255,248,210,.95)', 'rgba(255,230,150,0)');
    ctx.globalCompositeOperation = 'source-over';
    var g = ctx.createRadialGradient(-r * .25, -r * .25, 0, 0, 0, r); g.addColorStop(0, '#ffffff'); g.addColorStop(.6, '#fff6c8'); g.addColorStop(1, '#ffe08a');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    ctx.lineWidth = Math.max(1, r * .16); ctx.strokeStyle = 'rgba(214,164,52,.95)'; ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';   // 룬 고리: 짧은 획 6개 (갈고리 달린 획) 가 천천히 돎
    ctx.rotate(t * 2.2); ctx.lineWidth = Math.max(1, r * .15); ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(255,238,170,.95)';
    var R = r * 1.9;
    for (var i = 0; i < 6; i++) {
      ctx.save(); ctx.rotate(i * TAU / 6); ctx.beginPath(); ctx.moveTo(R, -r * .38); ctx.lineTo(R, r * .38);
      if (i % 3 === 0) { ctx.moveTo(R, 0); ctx.lineTo(R + r * .32, r * .26); } else if (i % 3 === 1) { ctx.moveTo(R - r * .22, -r * .2); ctx.lineTo(R + r * .22, r * .2); } else { ctx.moveTo(R, r * .1); ctx.lineTo(R - r * .3, r * .34); }
      ctx.stroke(); ctx.restore();
    }
    ctx.lineWidth = Math.max(.6, r * .07); ctx.globalAlpha *= .5; ctx.beginPath(); ctx.arc(0, 0, R + r * .5, 0, TAU); ctx.stroke();
    ctx.restore();
  }
  /** 돌: 울퉁불퉁한 회색 덩어리 · big 은 가장자리가 달아오른 듯 빛남 */
  function drawStone(ctx, x, y, r, rot, big, a) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.globalAlpha = a == null ? 1 : a;
    if (big) { ctx.globalCompositeOperation = 'lighter'; glow(ctx, 0, 0, r * 2.4, 'rgba(255,170,70,.55)', 'rgba(255,100,20,0)'); ctx.globalCompositeOperation = 'source-over'; }
    ctx.beginPath(); for (var i = 0; i < 9; i++) { var an = i * TAU / 9, rr = r * (.82 + .18 * Math.sin(i * 2.7 + 1)); i ? ctx.lineTo(Math.cos(an) * rr, Math.sin(an) * rr) : ctx.moveTo(Math.cos(an) * rr, Math.sin(an) * rr); }
    ctx.closePath();
    var g = ctx.createRadialGradient(-r * .35, -r * .35, r * .1, 0, 0, r * 1.1); g.addColorStop(0, '#d6d2cb'); g.addColorStop(.55, '#9a968f'); g.addColorStop(1, '#5b5855');
    ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = Math.max(1, r * .12); ctx.strokeStyle = big ? 'rgba(255,196,110,.95)' : '#4a4642'; ctx.stroke();
    if (!big) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= .55; glow(ctx, 0, 0, r * 1.9, 'rgba(255,240,210,.55)', 'rgba(255,240,210,0)'); }   // 작은 화면에서도 보이게 옅은 빛 테두리
    ctx.restore();
  }
  function star4(ctx, x, y, s, rot) {   // 네 갈래 별 반짝이
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0); ctx.beginPath();
    for (var i = 0; i < 8; i++) { var rr = i % 2 ? s * .28 : s; ctx.lineTo(Math.cos(i * Math.PI / 4) * rr, Math.sin(i * Math.PI / 4) * rr); }
    ctx.closePath(); ctx.fill(); ctx.restore();
  }

  /* ---------- 이펙트 묶음 ---------- */
  function create() {
    var E = [], P = [], seq = 0;
    var api = { E: E, P: P };
    var minR = function (v, m) { return Math.max(m, v); };

    function part(o) { if (P.length >= MAXP) return null; o.age = 0; o.ts = o.ts || 1; o.rot = o.rot || 0; o.vr = o.vr || 0; o.ax = o.ax || 0; o.ay = o.ay || 0; o.drag = o.drag == null ? 0 : o.drag; P.push(o); return o; }
    function effect(o) { o.t = 0; o.ts = o.ts || 1; o.id = ++seq; E.push(o); return o; }
    var TS = function (o) { return (o && o.ts) || 1; };

    /* --- 투사체 --- */
    api.shoot = function (kind, from, to, o) {
      o = o || {}; var h = o.h || 80, ts = TS(o), dur = o.dur || .3, big = !!o.big, size = o.size || 1;
      var r = kind === 'foxfire' ? minR(h * (big ? .5 : .16) * size, big ? 14 : 6)
            : kind === 'moonorb' ? minR(h * .15 * size, 6)
            : minR(h * (big ? .2 : .1) * size, big ? 10 : 5);
      var arc = o.arc != null ? o.arc : (kind === 'stone' ? h * (big ? .55 : .25) : h * .06), trail = [];
      return new Promise(function (resolve) {
        effect({ ts: ts, dur: dur, done: false, r: r, kind: kind, big: big,   // r = 투사체 반지름(px · 시험이 크기를 확인)
          update: function (e, dt) {
            var u = clamp(e.t / dur, 0, 1), k = kind === 'stone' ? u : Math.pow(u, 1.25);
            var x = from.x + (to.x - from.x) * k, y = from.y + (to.y - from.y) * k - arc * 4 * u * (1 - u);
            if (e.px != null) { e.ang = Math.atan2(y - e.py, x - e.px); var d = Math.hypot(x - e.px, y - e.py); e.dist = (e.dist || 0) + d;
              var n = Math.min(6, Math.max(1, Math.round(d / (r * .6))));
              for (var i = 0; i < n; i++) {
                var f = (i + 1) / n, sx = e.px + (x - e.px) * f, sy = e.py + (y - e.py) * f;
                if (kind === 'foxfire') part({ x: sx + rnd(-r, r) * .5, y: sy + rnd(-r, r) * .5, vx: rnd(-.2, .2) * r * 3, vy: -rnd(.3, 1.2) * r * 2, life: rnd(.25, .5), size: r * rnd(.12, .3), kind: 'ember', col: Math.random() < .25 ? 'blue' : 'fire', ts: ts });
                else if (kind === 'moonorb') part({ x: sx + rnd(-r, r) * .6, y: sy + rnd(-r, r) * .6, vx: rnd(-.5, .5) * r, vy: rnd(-.5, .8) * r, life: rnd(.35, .7), size: r * rnd(.3, .6), kind: 'star', col: Math.random() < .5 ? 'gold' : 'white', rot: rnd(0, 3), vr: rnd(-4, 4), ts: ts });
                else if (Math.random() < (big ? .9 : .45)) part({ x: sx, y: sy, vx: rnd(-.3, .3) * r, vy: rnd(-.3, .3) * r, life: rnd(.25, .45), size: r * rnd(.35, .8), kind: 'dust', ts: ts, grow: 1.6 });
              } }
            e.px = x; e.py = y; e.x = x; e.y = y; e.rot = (e.rot || 0) + dt * (kind === 'stone' ? 14 : 0);
            if (!e.done && e.t >= dur) { e.done = true; e.life = 0; resolve(); if (o.onArrive) o.onArrive(); }
            return e.t < dur + .01;
          },
          draw: function (ctx, e) {
            if (e.x == null) return; var tt = e.t * 1;
            if (kind === 'foxfire') drawFoxfire(ctx, e.x, e.y, e.ang || 0, r, tt);
            else if (kind === 'moonorb') drawMoonOrb(ctx, e.x, e.y, r, tt);
            else drawStone(ctx, e.x, e.y, r, e.rot || 0, big);
          } });
      });
    };

    /* --- 명중 --- */
    api.ring = function (p, o) { o = o || {}; var h = o.h || 80, r1 = o.r1 || h * .8, r0 = o.r0 || r1 * .15, dur = o.dur || .4, col = o.col || '255,220,150', w = o.w || Math.max(2, h * .05);
      effect({ ts: TS(o), dur: dur, update: function (e) { return e.t < dur; },
        draw: function (ctx, e) { var u = e.t / dur, r = r0 + (r1 - r0) * ease.out(u); ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = (1 - u) * (o.a || .9);
          ctx.strokeStyle = 'rgba(' + col + ',1)'; ctx.lineWidth = w * (1 - u * .6); ctx.beginPath(); ctx.ellipse(p.x, p.y, r, r * (o.flat || 1), 0, 0, TAU); ctx.stroke(); ctx.restore(); } }); };
    function flash(p, R, dur, col, ts) { effect({ ts: ts, dur: dur, update: function (e) { return e.t < dur; }, draw: function (ctx, e) { var u = e.t / dur; ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1 - u; glow(ctx, p.x, p.y, R * (.5 + u * .7), 'rgba(' + col + ',.95)', 'rgba(' + col + ',0)'); ctx.restore(); } }); }
    api.burst = function (kind, p, o) {
      o = o || {}; var h = o.h || 80, ts = TS(o), i;
      if (kind === 'foxfire' || kind === 'foxfire_big') {
        var big = kind === 'foxfire_big', R = h * (big ? 1.6 : .55), n = big ? 18 : 9, dur = big ? .75 : .45;
        flash(p, R * .9, big ? .35 : .22, '255,235,190', ts);
        for (i = 0; i < n; i++) { var an = i * TAU / n + rnd(-.15, .15), L = R * rnd(.7, 1); effect({ ts: ts, dur: dur, an: an, L: L, update: function (e) { return e.t < dur; },
          draw: function (ctx, e) { var u = e.t / dur, d = e.L * ease.out(u), w = R * .22 * (1 - u * .7); ctx.save(); ctx.translate(p.x + Math.cos(e.an) * d, p.y + Math.sin(e.an) * d); ctx.rotate(e.an); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1 - u * u;
            var g = ctx.createLinearGradient(w, 0, -w * 3, 0); g.addColorStop(0, 'rgba(255,230,150,1)'); g.addColorStop(.35, 'rgba(255,130,40,.9)'); g.addColorStop(1, 'rgba(255,50,10,0)'); flamePath(ctx, w * 3, w, 1, e.t + e.an); ctx.fillStyle = g; ctx.fill();
            ctx.translate(w * .1, 0); var g2 = ctx.createLinearGradient(w * .6, 0, -w * 1.8, 0); g2.addColorStop(0, 'rgba(255,255,255,1)'); g2.addColorStop(.5, 'rgba(110,200,255,.9)'); g2.addColorStop(1, 'rgba(60,110,255,0)'); flamePath(ctx, w * 1.8, w * .55, .8, e.t); ctx.fillStyle = g2; ctx.fill(); ctx.restore(); } }); }
        for (i = 0; i < (big ? 46 : 22); i++) { var a2 = rnd(0, TAU), sp = rnd(.4, 1.6) * R * (big ? 1.3 : 1); part({ x: p.x, y: p.y, vx: Math.cos(a2) * sp, vy: Math.sin(a2) * sp - R * .3, ay: R * -.6, drag: 1.4, life: rnd(.45, 1), size: h * rnd(.015, .04), kind: 'ember', col: Math.random() < .25 ? 'blue' : 'fire', ts: ts }); }
        api.ring(p, { h: h, r1: R * (big ? 1.3 : .8), dur: big ? .6 : .35, col: '255,170,70', ts: ts, flat: .55 });
        if (big) { api.ring(p, { h: h, r1: R * .8, dur: .45, col: '120,200,255', ts: ts, flat: .55, w: h * .04 });
          effect({ ts: ts, dur: .8, update: function (e) { return e.t < .8; },   // 솟는 불기둥
            draw: function (ctx, e) { var u = e.t / .8, up = h * 1.7 * ease.out(Math.min(1, u * 1.6)), w = h * .34 * (1 - u * .6); ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(-Math.PI / 2); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(1, (1 - u) * 1.6);
              var g = ctx.createLinearGradient(w, 0, -up, 0); g.addColorStop(0, 'rgba(255,230,160,1)'); g.addColorStop(.3, 'rgba(255,120,35,.9)'); g.addColorStop(1, 'rgba(255,50,10,0)'); flamePath(ctx, up, w, 1.4, e.t); ctx.fillStyle = g; ctx.fill();
              var g2 = ctx.createLinearGradient(w * .6, 0, -up * .6, 0); g2.addColorStop(0, 'rgba(255,255,255,1)'); g2.addColorStop(.45, 'rgba(110,200,255,.9)'); g2.addColorStop(1, 'rgba(60,110,255,0)'); ctx.scale(1, .8); flamePath(ctx, up * .62, w * .56, 1, e.t + 1); ctx.fillStyle = g2; ctx.fill(); ctx.restore(); } }); }
      } else if (kind === 'moon') {
        var Rm = h * .9; flash(p, Rm * .8, .3, '230,240,255', ts);
        effect({ ts: ts, dur: .5, update: function (e) { return e.t < .5; },   // 초승달 섬광
          draw: function (ctx, e) { var u = e.t / .5, r = Rm * (.35 + .65 * ease.out(u)); ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(-.5 + u * .6); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = (1 - u) * .95;
            ctx.fillStyle = 'rgba(255,244,200,1)'; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.arc(r * .32, -r * .08, r * .92, 0, TAU, true); ctx.fill('evenodd');
            ctx.restore(); } });
        for (i = 0; i < 8; i++) { var ar = i * TAU / 8; effect({ ts: ts, dur: .45, ar: ar, update: function (e) { return e.t < .45; },   // 방사선
          draw: function (ctx, e) { var u = e.t / .45, r0 = Rm * .25 + Rm * .6 * ease.out(u), r1 = r0 + Rm * .35 * (1 - u); ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1 - u; ctx.strokeStyle = 'rgba(190,215,255,1)'; ctx.lineWidth = Math.max(1.5, h * .035 * (1 - u));
            ctx.beginPath(); ctx.moveTo(p.x + Math.cos(e.ar) * r0, p.y + Math.sin(e.ar) * r0); ctx.lineTo(p.x + Math.cos(e.ar) * r1, p.y + Math.sin(e.ar) * r1); ctx.stroke(); ctx.restore(); } }); }
        for (i = 0; i < 16; i++) { var am = rnd(0, TAU), sm = rnd(.3, 1.2) * Rm; part({ x: p.x, y: p.y, vx: Math.cos(am) * sm, vy: Math.sin(am) * sm, drag: 1.8, life: rnd(.5, 1), size: h * rnd(.03, .08), kind: 'star', col: Math.random() < .5 ? 'gold' : 'white', rot: rnd(0, 3), vr: rnd(-3, 3), ts: ts }); }
        api.ring(p, { h: h, r1: Rm * 1.1, dur: .5, col: '200,220,255', ts: ts, flat: .6 });
      } else if (kind === 'stone' || kind === 'stone_big') {
        var bs = kind === 'stone_big', Rs = h * (bs ? 1.2 : .5);
        flash(p, Rs * .8, bs ? .3 : .18, '255,246,222', ts);
        api.ring(p, { h: h, r1: Rs, dur: bs ? .5 : .3, col: '255,235,200', ts: ts, flat: .55 });
        if (bs) api.ring(p, { h: h, r1: Rs * .62, dur: .4, col: '255,190,100', ts: ts, flat: .55, w: h * .05 });
        for (i = 0; i < (bs ? 14 : 6); i++) { var as = rnd(Math.PI, TAU) , ss = rnd(.5, 1.5) * Rs; part({ x: p.x, y: p.y, vx: Math.cos(as) * ss, vy: Math.sin(as) * ss, ay: Rs * 3.2, life: rnd(.5, .9), size: h * rnd(.02, bs ? .06 : .04), kind: 'shard', rot: rnd(0, 6), vr: rnd(-12, 12), ts: ts }); }
        for (i = 0; i < (bs ? 9 : 4); i++) part({ x: p.x + rnd(-1, 1) * Rs * .3, y: p.y + rnd(-.1, .1) * h * .1, vx: rnd(-1, 1) * Rs * .6, vy: rnd(-.5, -.1) * Rs * .4, drag: 2, life: rnd(.5, .9), size: h * rnd(.05, .1), kind: 'dust', ts: ts, grow: 2.2 });
      } else if (kind === 'slash') {   // 달토끼 회전 강타: 큰 초승달 베기 + 충격 고리 + 흙먼지
        var Rl = h * 1.2, dirx = o.dir || 1; flash(p, Rl * .6, .25, '255,244,214', ts);
        effect({ ts: ts, dur: .45, update: function (e) { return e.t < .45; },
          draw: function (ctx, e) { var u = e.t / .45, sw = ease.out(Math.min(1, u * 2)), r = Rl * (.5 + .5 * ease.out(u)); ctx.save(); ctx.translate(p.x, p.y); ctx.scale(dirx, 1); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = (1 - u * u) * .95;
            var g = ctx.createRadialGradient(0, 0, r * .6, 0, 0, r); g.addColorStop(0, 'rgba(190,170,255,0)'); g.addColorStop(.7, 'rgba(255,230,150,1)'); g.addColorStop(1, 'rgba(255,255,255,1)');
            ctx.strokeStyle = g; ctx.lineWidth = r * .22 * (1 - u * .5); ctx.lineCap = 'round'; ctx.beginPath(); ctx.ellipse(0, 0, r, r * .62, -.2, Math.PI * (1.15 - sw * 1.3), Math.PI * 1.15); ctx.stroke(); ctx.restore(); } });
        api.ring(p, { h: h, r1: Rl, dur: .45, col: '255,230,170', ts: ts, flat: .55 }); api.ring(p, { h: h, r1: Rl * .6, dur: .35, col: '190,170,255', ts: ts, flat: .55, w: h * .05 });
        for (i = 0; i < 10; i++) part({ x: p.x + rnd(-1, 1) * Rl * .3, y: p.y, vx: rnd(-1, 1) * Rl * .8, vy: rnd(-.8, -.1) * Rl * .6, drag: 2, life: rnd(.5, .9), size: h * rnd(.05, .1), kind: 'dust', ts: ts, grow: 2.2 });
        for (i = 0; i < 12; i++) part({ x: p.x, y: p.y, vx: rnd(-1, 1) * Rl, vy: rnd(-1, .2) * Rl, drag: 1.6, life: rnd(.4, .8), size: h * rnd(.03, .07), kind: 'star', col: Math.random() < .5 ? 'gold' : 'white', rot: rnd(0, 3), vr: rnd(-4, 4), ts: ts });
      }
    };
    /* --- 기 모으기: 빛 입자가 중심으로 빨려 들어가고 불덩이가 커짐 --- */
    api.gather = function (p, o) {
      o = o || {}; var h = o.h || 80, ts = TS(o), dur = o.dur || .9, handle = { ended: false, end: function () { handle.ended = true; } };
      var N = o.n || 30, ps = [];
      for (var i = 0; i < N; i++) ps.push({ an: rnd(0, TAU), r0: h * rnd(.7, 1.6), t0: rnd(0, dur * .55), sp: rnd(.35, .6), size: h * rnd(.02, .045), col: Math.random() < .3 ? 'blue' : 'fire', spin: rnd(.6, 1.6) * (Math.random() < .5 ? -1 : 1) });
      effect({ ts: ts, dur: dur, update: function (e) { return e.t < dur && !handle.ended; },
        draw: function (ctx, e) {
          var u = clamp(e.t / dur, 0, 1); ctx.save(); ctx.globalCompositeOperation = 'lighter';
          ps.forEach(function (q) { var k = clamp((e.t - q.t0) / (dur * q.sp), 0, 1); if (k <= 0 || k >= 1) return; var rr = q.r0 * (1 - ease.in(k)), an = q.an + q.spin * k * 2.2;
            var x = p.x + Math.cos(an) * rr, y = p.y + Math.sin(an) * rr * .8; ctx.globalAlpha = Math.min(1, k * 3) * (1 - k * .3);
            glow(ctx, x, y, q.size * 2.6, q.col === 'blue' ? 'rgba(150,220,255,.95)' : 'rgba(255,220,140,.95)', 'rgba(255,150,60,0)'); });
          var R = h * (.08 + .34 * ease.out(u)) + Math.sin(e.t * 40) * h * .012;   // 중심 불덩이
          ctx.globalAlpha = .5 + .5 * u; glow(ctx, p.x, p.y, R * 2.3, 'rgba(255,170,70,.55)', 'rgba(255,90,20,0)'); glow(ctx, p.x, p.y, R, 'rgba(255,238,200,1)', 'rgba(255,150,50,.2)');
          glow(ctx, p.x, p.y, R * .55, 'rgba(255,255,255,1)', 'rgba(130,210,255,.3)');
          var rr2 = h * (1.1 - .75 * ease.in(u)); ctx.globalAlpha = .4 * Math.min(1, u * 3); ctx.strokeStyle = 'rgba(255,200,120,1)'; ctx.lineWidth = Math.max(1.5, h * .03);   // 좁아지는 고리
          ctx.beginPath(); ctx.ellipse(p.x, p.y, rr2, rr2 * .8, 0, 0, TAU); ctx.stroke(); ctx.restore(); } });
      return handle;
    };
    api.spark = function (p, o) { o = o || {}; var h = o.h || 80, ts = TS(o), dur = o.dur || .35, moon = o.kind === 'moon';
      effect({ ts: ts, dur: dur, update: function (e) { return e.t < dur; }, draw: function (ctx, e) { var u = e.t / dur; ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.sin(u * Math.PI);
        glow(ctx, p.x, p.y, Math.max(4, h * .09) * (.6 + u), moon ? 'rgba(220,235,255,.95)' : 'rgba(255,200,110,.95)', 'rgba(255,120,40,0)'); ctx.restore(); } }); };

    /* --- 갱신 · 그리기 --- */
    api.update = function (dt) {
      for (var i = E.length - 1; i >= 0; i--) { var e = E[i]; e.t += dt / e.ts; if (!e.update(e, dt / e.ts)) E.splice(i, 1); }
      for (var j = P.length - 1; j >= 0; j--) { var q = P[j], d = dt / q.ts; q.age += d;
        if (q.age >= q.life) { P.splice(j, 1); continue; }
        var dg = Math.max(0, 1 - q.drag * d); q.vx = (q.vx + q.ax * d) * dg; q.vy = (q.vy + q.ay * d) * dg; q.x += q.vx * d; q.y += q.vy * d; q.rot += q.vr * d; }
    };
    api.draw = function (ctx) {
      ctx.save();
      P.forEach(function (q) {   // 흙먼지 · 파편 (불투명 계열)
        var u = q.age / q.life;
        if (q.kind === 'dust') { ctx.globalAlpha = (1 - u) * .55; ctx.fillStyle = '#b79c78'; ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (1 + (q.grow || 0) * u), 0, TAU); ctx.fill(); }
        else if (q.kind === 'shard') { ctx.globalAlpha = 1 - u * u; ctx.fillStyle = '#7d7a75'; ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot); ctx.fillRect(-q.size, -q.size * .6, q.size * 2, q.size * 1.2); ctx.restore(); } });
      E.forEach(function (e) { ctx.save(); e.draw(ctx, e); ctx.restore(); });
      ctx.globalCompositeOperation = 'lighter';
      P.forEach(function (q) {   // 불티 · 별가루 (빛)
        var u = q.age / q.life;
        if (q.kind === 'ember') { ctx.globalAlpha = 1 - u; glow(ctx, q.x, q.y, q.size * 2.2, q.col === 'blue' ? 'rgba(150,220,255,1)' : 'rgba(255,190,90,1)', 'rgba(255,100,30,0)'); }
        else if (q.kind === 'star') { ctx.globalAlpha = Math.sin(u * Math.PI); ctx.fillStyle = q.col === 'gold' ? 'rgba(255,226,130,1)' : 'rgba(255,255,255,1)'; star4(ctx, q.x, q.y, q.size, q.rot); } });
      ctx.restore();
    };
    api.busy = function () { return E.length > 0 || P.length > 0; };
    api.clear = function () { E.length = 0; P.length = 0; };
    return api;
  }

  /* ---------- 리그의 코드로 그리는 층에서 쓰는 타원 궤적 띠 (기준 전신 좌표) ----------
   * o = { cx, cy, rx, ry, a(현재 각도 · 도), span(꼬리 길이 · 도), width, col: [r, g, b], col2, half: 'front'|'back'|'all', alpha }
   * 각도 0 = 오른쪽 · 90 = 몸 앞(아래쪽 = 가까움) · 앞쪽 반(sin ≥ 0)이 캐릭터 앞 · 뒤쪽 반이 캐릭터 뒤 */
  function orbit(ctx, o) {
    var span = o.span || 160, step = 6, n = Math.ceil(span / step), half = o.half || 'all', al = o.alpha == null ? 1 : o.alpha;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    for (var i = 0; i < n; i++) {
      var f0 = i / n, f1 = (i + 1) / n, a0 = (o.a - span + span * f0) * Math.PI / 180, a1 = (o.a - span + span * f1) * Math.PI / 180, am = (a0 + a1) / 2;
      var front = Math.sin(am) >= 0; if ((half === 'front' && !front) || (half === 'back' && front)) continue;
      var c = o.col2 && f1 < .55 ? o.col2 : o.col, k = Math.pow(f1, 1.6);
      ctx.strokeStyle = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (k * al * (front ? 1 : .6)).toFixed(3) + ')'; ctx.lineWidth = o.width * (.25 + .75 * k);
      ctx.beginPath(); ctx.moveTo(o.cx + Math.cos(a0) * o.rx, o.cy + Math.sin(a0) * o.ry); ctx.lineTo(o.cx + Math.cos(a1) * o.rx, o.cy + Math.sin(a1) * o.ry); ctx.stroke();
    }
    ctx.restore();
  }

  /* ---------- 전장 위에 이펙트 캔버스를 깔고 그리는 반복 ---------- */
  function attach(host, opt) {
    opt = opt || {}; var cv = document.createElement('canvas'); cv.className = 'bt-fxcanvas'; cv.setAttribute('aria-hidden', 'true'); host.appendChild(cv);
    var fx = create(), ctx = cv.getContext('2d'), raf = 0, last = 0, dead = false;
    function resize() { var d = window.devicePixelRatio || 1, w = host.clientWidth, h = host.clientHeight; if (cv.width !== Math.round(w * d) || cv.height !== Math.round(h * d)) { cv.width = Math.round(w * d); cv.height = Math.round(h * d); } return d; }
    function frame(ts) {
      raf = 0; if (dead) return; var dt = last ? Math.min(.05, (ts - last) / 1000) : 0; last = ts;
      var d = resize(); fx.update(dt); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.setTransform(d, 0, 0, d, 0, 0); fx.draw(ctx);
      if (fx.busy()) raf = requestAnimationFrame(frame); else last = 0;
    }
    var wake = function () { if (!raf && !dead) raf = requestAnimationFrame(frame); };
    var api = { fx: fx, canvas: cv, wake: wake, destroy: function () { dead = true; cancelAnimationFrame(raf); cv.remove(); } };
    ['shoot', 'burst', 'ring', 'gather', 'spark'].forEach(function (k) { var f = fx[k]; fx[k] = function () { var r = f.apply(fx, arguments); wake(); return r; }; });
    return api;
  }

  root.TaleliaFx = { create: create, attach: attach, orbit: orbit, drawFoxfire: drawFoxfire, drawMoonOrb: drawMoonOrb, drawStone: drawStone };
})(window);
