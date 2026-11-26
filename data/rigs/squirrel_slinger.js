/* 다람쥐 투석병 간이 리그 (좌표 = 기준 전신 battle_base.png 픽셀, 오른쪽을 봄)
 * 조각 그림: images/battle/squirrel_slinger/  ← python tools/rig_parts.py docs/graphics/gacha/squirrel_slinger/rig_parts.json
 * 간이 리그: 기준 전신 1장만 씀 · 대기 · 돌진 · 피격 · 복귀 = data/rigs/_kit.js simpleClips · 재생기 = js/battle/rig.js
 *
 * 공격 연출 (뽑기 5단계): 투석끈이 "손을 중심으로 실제로 원을 그리며" 돎
 *  - 평소(대기 · 돌진 등): 그림 그대로 (weapon = 손 + 끈 + 돌 주머니 한 장 · 위로 휘어 걸려 있음)
 *  - 돌리는 동작(attack · skill): weapon 을 숨기고(a=0) 손만 남김(weapon_hand = 같은 그림의 주먹 부분만 오려 그림)
 *    끈과 돌 주머니는 코드로 그림 (rig.js 의 paint 층 · 주머니 = weapon.png 의 주머니 부분을 잘라 그림 · 새 그림 파일 없음)
 *  - 동작 키의 sling 값 묶음(그림 없음)을 paint 가 읽음: x = 1 끈 + 주머니 · 0.5 끈만(던진 직후) · 0 없음 / r = 돌아가는 각도(도 · 쌓임) / sx = 궤적 세기 / sy = 반지름 배율
 *  - 궤도 = 손을 중심으로 한 납작한 타원 (옆모습이라 앞쪽 반 = 머리 앞 · 뒤쪽 반 = 몸 뒤) · 지나간 길에 빛 띠 잔상
 *  - 던지는 순간(shoot) 주머니 자리에서 돌이 날아감 (js/battle/fx-kit.js · def.fx.muzzleAt 이 그 자리를 알려 줌)
 */
(function () {
  'use strict';
  var R = window.TALELIA_RIGS = window.TALELIA_RIGS || {}, KIT = window.TALELIA_RIG_KIT, K = KIT.K, mix = KIT.mix, FXK = function () { return window.TaleliaFx; };
  var D2R = Math.PI / 180;

  /* 조각: 몸 한 덩어리 + 팔(몸에 붙음) + 무기(손 + 투석끈 · 손을 중심으로 돔) + 큰 꼬리(따로 출렁임) + 눈 4종
   * weapon_hand = weapon 과 같은 그림에서 주먹 부분만 (돌리는 동안 weapon 대신 보임) · sling = 그림 없는 값 묶음
   */
  var parts = [
    { id: 'tail',   img: 'tail.png',   parent: 'body', pivot: [480, 880], at: [309, 600.5],   rot: 0, z: 1 },
    { id: 'body',   img: 'body.png',   parent: null,   pivot: [690, 1000], at: [692.5, 683.5], rot: 0, z: 5 },
    { id: 'arm',    img: 'arm.png',    parent: 'body', pivot: [600, 650], at: [510, 575],     rot: 0, z: 6 },
    { id: 'eye',    imgs: { normal: 'eye_normal.png', closed: 'eye_closed.png', angry: 'eye_angry.png', hurt: 'eye_hurt.png' },
                                        parent: 'body', pivot: [860, 498], at: [860, 498],     rot: 0, z: 9 },
    { id: 'weapon', img: 'weapon.png', parent: 'arm',  pivot: [442, 450], at: [681, 270.5],   rot: 0, z: 10 },
    { id: 'weapon_hand', img: 'weapon.png', parent: 'weapon', pivot: [442, 450], at: [681, 270.5], rot: 0, z: 10.1, clip: [377, 372, 125, 140] },
    { id: 'sling',  parent: 'arm',  pivot: [442, 450], at: [442, 450], rot: 0, z: 10.2 }
  ];
  var W_UP = -20, W_DOWN = 25;   // 끈을 뒤로 감아올림 / 앞으로 휘둘러 던짐 (손을 중심으로 · 도)

  /* ---------- 코드로 그리는 끈 · 주머니 ---------- */
  var GRIP = [420, 388];        // 주먹 위 끈이 나오는 자리 (weapon 조각 기준 좌표)
  var RAD = 430, KY = 0.42;     // 궤도 반지름(기준 전신 px) · 납작한 정도 (옆에서 비스듬히 내려다본 원)
  var POUCH = { sx: 470, sy: 0, sw: 258, sh: 105, ax: 22, ay: 42 };   // weapon.png 에서 주머니를 자르는 영역 · 끈이 매이는 자리
  function orbitOf(api) {
    var s = api.pose.sling, H = api.pt('weapon', GRIP[0], GRIP[1]), phi = s.r * D2R, rad = RAD * s.sy, cx = H[0], cy = H[1] - 24;
    return { s: s, H: H, cx: cx, cy: cy, rad: rad, phi: phi, P: [cx + Math.cos(phi) * rad, cy + Math.sin(phi) * rad * KY], front: Math.sin(phi) >= 0 };
  }
  function slingPaint(half) {
    return function (ctx, api) {
      var s = api.pose.sling; if (!s || s.x < 0.25) return;
      var o = orbitOf(api), F = FXK(), full = s.x > 0.75, k = Math.max(0, s.sx), im = api.rig.imgs['weapon:_'];
      // 지나온 길: 빛 띠 (뒤쪽 반은 몸 뒤 · 앞쪽 반은 몸 앞)
      if (F && full && k > 0.05) {
        F.orbit(ctx, { cx: o.cx, cy: o.cy, rx: o.rad, ry: o.rad * KY, a: s.r, span: 120 + 100 * k, width: 64 + 30 * k, col: [255, 196, 110], col2: [255, 248, 226], half: half, alpha: Math.min(1, .6 + .4 * k) });
        if (k > 0.7 && half === 'front') {   // 빨라지면 바깥에 바람 줄무늬 · 불티
          ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
          for (var i = 0; i < 7; i++) { var an = s.r * D2R - i * 0.42 - 0.2, r0 = o.rad * (1.04 + (i % 3) * .06), r1 = r0 + 46 + 18 * k;
            ctx.strokeStyle = 'rgba(255,240,210,' + (0.55 - i * 0.07).toFixed(2) + ')'; ctx.lineWidth = 5 + k * 2;
            ctx.beginPath(); ctx.moveTo(o.cx + Math.cos(an) * r0, o.cy + Math.sin(an) * r0 * KY); ctx.lineTo(o.cx + Math.cos(an - .22) * r1, o.cy + Math.sin(an - .22) * r1 * KY); ctx.stroke(); }
          ctx.restore(); }
      }
      if ((half === 'front') !== o.front) return;   // 끈 · 주머니는 지금 있는 쪽 층에서만
      // 끈: 손 → 주머니 (살짝 뒤로 처진 곡선 · 두 가닥 느낌의 굵은 선 + 밝은 선)
      var lag = o.phi - 0.5, C = [o.cx + Math.cos(lag) * o.rad * 0.55, o.cy + Math.sin(lag) * o.rad * KY * 0.55], P = o.P;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      [['#4a2a16', 30], ['#8a4b2a', 20], ['#d39a66', 7]].forEach(function (st) {
        ctx.strokeStyle = st[0]; ctx.lineWidth = st[1]; ctx.beginPath(); ctx.moveTo(o.H[0], o.H[1]); ctx.quadraticCurveTo(C[0], C[1], P[0], P[1]); ctx.stroke(); });
      if (!full || !im) return;
      var ang = Math.atan2(P[1] - C[1], P[0] - C[0]), kk = im.width / (im._w || im.width);   // 사본이면 원본 크기 기준 좌표를 맞춤
      ctx.save(); ctx.translate(P[0], P[1]); ctx.rotate(ang); ctx.scale(1.7, 1.7); ctx.translate(-POUCH.ax, -POUCH.ay);
      ctx.drawImage(im, POUCH.sx * kk, POUCH.sy * kk, POUCH.sw * kk, POUCH.sh * kk, 0, 0, POUCH.sw, POUCH.sh); ctx.restore();
    };
  }
  /** 돌 주머니가 지금 있는 자리 (기준 전신 좌표) → 던질 때 돌이 나가는 곳 */
  function muzzleAt(rig) { var s = rig.pose.sling, o = orbitOf({ pose: rig.pose, pt: function (id, x, y) { return rig.pt(id, x, y); } }); return o.P; }

  /* ---------- 돌리는 동작 ----------
   * phases = [[끝 시각, 끝 각도(도, 누적), 가속 지수] …] 처음 각도 0 · 시각마다 30분의 1초 키 · 끝 각도가 360 의 배수일 때 주머니가 앞(오른쪽)에서 놓임 */
  function spinKeys(phases, trail, radius, lean) {
    var keys = [], t = 0, phi = 0, idx = 0, T = phases[phases.length - 1][0], step = 1 / 30;
    function angle(tt) { var a0 = 0, t0 = 0; for (var i = 0; i < phases.length; i++) { var p = phases[i]; if (tt <= p[0] + 1e-9) { var u = (tt - t0) / (p[0] - t0); return a0 + (p[1] - a0) * Math.pow(u, p[2]); } a0 = p[1]; t0 = p[0]; } return a0; }
    var times = []; for (var n = 0; n * step < T - 1e-9; n++) times.push(Math.round(n * step * 1000) / 1000); times.push(T);   // 끝 시각 T 에도 키 (각도가 정확히 끝값)
    for (var ni = 0; ni < times.length; ni++) {
      t = times[ni]; phi = angle(t); var r = phi * D2R, u = t / T;
      keys.push(K(t, {
        root: { r: lean(u), x: -10 * Math.min(1, u * 3) },
        body: { sx: 1 + 0.012 * Math.sin(2 * r), sy: 1 - 0.012 * Math.sin(2 * r) },
        arm: { r: 6 * Math.sin(r), y: -5 * Math.cos(r) },
        tail: { r: 9 * Math.sin(r + 1) - 4 },
        weapon: { a: 0 },
        sling: { x: 1, r: phi, sx: trail(u), sy: radius(u) }
      }));
    }
    return { keys: keys, T: T, phi: angle(T) };
  }
  function clips() {
    var base = KIT.simpleClips({ wUp: W_UP, wDown: W_DOWN, height: 1088, attack: 'throw', skill: 'whirl', extra: { tail: 6 } });
    var rest = { root: { r: 2 }, weapon: { r: W_UP * 0.2 } };
    function tail(sp, phiEnd, t0, flickR, recoverT, dur, followSling) {
      // 놓은 뒤: 끈만 남아 앞으로 휘둘리다 늘어짐 → 원래 자세 (weapon 이 다시 보이면서 sling 은 꺼짐)
      var fl = { root: { x: 12, r: 9 }, body: { sx: 1.03, sy: 0.97 }, arm: { r: flickR }, tail: { r: -8 }, weapon: { a: 0 }, sling: { x: 0.5, r: phiEnd, sx: 0, sy: followSling } };
      return [K(t0 + 0.03, fl, 'out'), K(t0 + 0.14, mix(fl, { sling: { x: 0.5, r: phiEnd + 25, sx: 0, sy: followSling * 0.7 } }), 'out'),
        K(recoverT, { root: { x: 8, r: 5 }, arm: { r: flickR * 0.4 }, weapon: { r: W_DOWN * 0.3 }, sling: { x: 0, r: phiEnd, sx: 0, sy: 1 } }, 'inout'), K(dur, { root: { r: 2 }, weapon: { r: W_DOWN * 0.2 } }, 'inout')];
    }
    // 기본 공격 (1.0초): 2바퀴 돌리다(0.55 · 점점 빨라짐) 앞에서 놓음 → 돌이 날아감 (0.55 = shoot · 투사체가 닿는 순간은 화면이 정함)
    var a = spinKeys([[0.55, 720, 1.5]], function (u) { return 0.5 + 0.6 * u; }, function () { return 1; }, function (u) { return -3 + 7 * u; });
    var attack = { dur: 1.0, loop: false, ease: 'linear', blend: 0.06, keys: [K(0, rest)].concat(a.keys.slice(1), tail(a, a.phi, 0.55, 26, 0.8, 1.0, 0.85)),
      eyes: [{ t: 0, eye: 'normal' }, { t: 0.08, eye: 'angry' }, { t: 0.85, eye: 'normal' }],
      events: [{ t: 0.55, name: 'shoot' }, { t: 0.83, name: 'hit' }] };
    // 필살기 · 도토리 투석 (2.1초): 3바퀴(0.5 → 0.35 → 0.25초 · 점점 빨라짐) + 한 바퀴 더 빠르게(몸을 뒤로 젖힘) → 크게 던짐 (1.3 = shoot)
    var b = spinKeys([[0.5, 360, 1], [0.85, 720, 1], [1.1, 1080, 1], [1.3, 1440, 1]], function (u) { return 0.5 + 1.8 * u; }, function (u) { return 1 + 0.32 * Math.max(0, (u - 0.84) / 0.16); },
      function (u) { return u < 0.84 ? -3 + 5 * u : -3 + 5 * 0.84 - 28 * (u - 0.84) / 0.16; });
    var skill = { dur: 2.1, loop: false, ease: 'linear', blend: 0.06, keys: [K(0, rest)].concat(b.keys.slice(1), tail(b, b.phi, 1.3, 38, 1.7, 2.1, 1.1)),
      eyes: [{ t: 0, eye: 'normal' }, { t: 0.1, eye: 'angry' }, { t: 1.8, eye: 'normal' }],
      events: [{ t: 1.3, name: 'shoot' }, { t: 1.75, name: 'hit' }, { t: 1.75, name: 'shake' }] };   // 큰 돌은 0.45초 날아감
    base.attack = attack; base.skill = skill; return base;
  }

  R.squirrel_slinger = {
    base: 'images/battle/squirrel_slinger/',
    height: 1088,            // 귀 끝 ~ 발바닥 (투석끈 제외 · 기준 전신 px)
    anchor: [691, 1225],     // 발 밑 가운데
    rootPivot: [690, 1000],
    eyeDefault: 'normal',
    armMax: 38,
    // kind = 화면이 쓰는 투사체 (js/battle/fx-kit.js) · muzzleAt = 던지는 순간 돌 주머니 자리 · 돌 색
    fx: { weapon: 'weapon', tip: [945, 75], ranged: true, projectile: '#8d8a86', kind: 'stone', ultKind: 'stone_big', muzzleAt: muzzleAt, flight: { shoot: 0.28, big: 0.45 } },
    parts: parts,
    paint: [{ z: 4, fn: slingPaint('back') }, { z: 11, fn: slingPaint('front') }],
    springs: KIT.springsFor(['tail']),
    clips: clips()
  };
})();
