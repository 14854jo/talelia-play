/* 달토끼 전체 리그 (좌표 = 기준 전신 battle_base.png 픽셀, 오른쪽을 봄)
 * 조각 그림: images/battle/moon_rabbit/  ← python tools/rig_parts.py docs/graphics/gacha/moon_rabbit/rig_parts.json
 * 기준 전신에서 자른 조각 + 채움 시트(parts_fill.png · 몸통 · 눈 3종) · 재생기 = js/battle/rig.js
 * 기본 공격 (뽑기 5단계): 떡메를 가로로 눕혀 들고 "몸째 빙글빙글" 돌며 다가감(spin) → 그 회전력으로 크게 강타(attack)
 *  옆모습 그림만으로 회전을 보이는 법 (새 그림 없음):
 *   ① 좌우 뒤집기: 몸 전체를 좌우로 cos(회전각) 만큼 줄였다 뒤집음 (root.sx · 너무 얇아지지 않게 ±0.16 이하로는 안 줄임 · 뒤집히면 떡메도 반대쪽)
 *   ② 원형 잔상: 떡메 머리가 그리는 타원 궤적을 금빛 · 보랏빛 띠로 (rig.js paint 층 · 얇아지는 순간을 가림)
 *   ③ 몸 잔상: 지난 자세 3장을 옅게 겹침 (rig.js clip.ghost)
 *   ④ 기울기 · 관성: 몸을 앞으로 숙이고 귀 · 노리개 · 꼬리가 바깥으로 날림
 *  spin 조각 = 그림 없는 값 묶음: r = 돌아가는 각도(도 · 누적) · x = 궤적 켜짐 · sx = 궤적 세기
 */
(function () {
  'use strict';
  var R = window.TALELIA_RIGS = window.TALELIA_RIGS || {}, K = window.TALELIA_RIG_KIT.K;

  /* 조각: 양손 + 떡메는 한 묶음(두 손 가운데를 중심으로 ±15° · 농부 토끼와 같은 방식) · 소매 끝은 그 위에 덮여 손목 이음매를 가림
   * 긴 귀 2개 · 꼬리 · 노리개는 관성으로 출렁임 · 더 큰 호는 몸 기울기 · 점프로 만듦
   */
  var parts = [
    { id: 'tail',        img: 'tail.png',        parent: 'torso', pivot: [350, 820],  at: [296.5, 815],    rot: 0, z: 1 },
    { id: 'ear_back',    img: 'ear_back.png',    parent: 'head',  pivot: [520, 370],  at: [496, 217],      rot: 0, z: 2 },
    { id: 'ear_front',   img: 'ear_front.png',   parent: 'head',  pivot: [640, 360],  at: [669.5, 211],    rot: 0, z: 2.1 },
    { id: 'leg_back',    img: 'leg_back.png',    parent: null,    pivot: [400, 900],  at: [401, 1041.5],   rot: 0, z: 3 },
    { id: 'leg_front',   img: 'leg_front.png',   parent: null,    pivot: [700, 900],  at: [700, 1041],     rot: 0, z: 3.1 },
    { id: 'torso_fill',  img: 'torso_fill.png',  parent: 'torso', pivot: [560, 1000], at: [617, 801.5],    rot: 0, z: 4.5 },
    { id: 'torso',       img: 'torso.png',       parent: null,    pivot: [560, 1000], at: [553.5, 807.5],  rot: 0, z: 5 },
    { id: 'head',        img: 'head.png',        parent: 'torso', pivot: [590, 610],  at: [588.5, 480],    rot: 0, z: 6 },
    { id: 'eye',         imgs: { normal: 'eye_normal.png', closed: 'eye_closed.png', angry: 'eye_angry.png', hurt: 'eye_hurt.png' },
                                                 parent: 'head',  pivot: [691, 504],  at: [691, 504],      rot: 0, z: 6.5 },
    { id: 'norigae',     img: 'norigae.png',     parent: 'torso', pivot: [590, 790],  at: [593.5, 896.5],  rot: 0, z: 7 },
    { id: 'arms_mallet', img: 'arms_mallet.png', parent: 'torso', pivot: [680, 780],  at: [767.5, 876],    rot: 0, z: 8 },
    { id: 'sleeve_l',    img: 'sleeve_l.png',    parent: 'torso', pivot: [438, 715],  at: [438.5, 715],    rot: 0, z: 9 },
    { id: 'sleeve_r',    img: 'sleeve_r.png',    parent: 'torso', pivot: [701, 786],  at: [701, 786],      rot: 0, z: 9 }
  ];
  parts.push({ id: 'spin', parent: 'torso', pivot: [560, 1000], at: [560, 1000], rot: 0, z: 12 });   // 그림 없음 (값 묶음)
  var D2R = Math.PI / 180, MALLET_H = -66;   // MALLET_H = 떡메를 앞으로 눕혀 가로로 든 각도 (− = 들어 올림)
  var ARM_MAX = 15;   // 떡메 묶음: − = 떡메를 들어 올림 · + = 내려찧음

  function clips() {
    var idleA = { root: {}, torso: {}, head: { r: 0 }, arms_mallet: { r: 0 }, ear_back: { r: 0 }, ear_front: { r: 0 }, tail: { r: 0 }, norigae: { r: 0 } };
    var idleB = { root: {}, torso: { sy: 1.02, sx: 0.992 }, head: { r: -1.5, y: -2 }, arms_mallet: { r: -2.5, y: -3 }, ear_back: { r: -4 }, ear_front: { r: -3 }, tail: { r: 5 }, norigae: { r: 4 } };
    var idle = { dur: 1.7, loop: true, ease: 'smooth', blend: 0.25, keys: [K(0, idleA), K(0.85, idleB), K(1.7, idleA)],
      eyes: [{ t: 0, eye: 'normal' }, { t: 1.3, eye: 'closed' }, { t: 1.41, eye: 'normal' }] };

    function run(f, b, y, sq) { return { root: { r: 8, y: y }, torso: { r: 2, sy: sq, sx: 2 - sq }, head: { r: -6 }, leg_front: { r: f }, leg_back: { r: b }, arms_mallet: { r: -6, x: -10 },
      ear_back: { r: -12 }, ear_front: { r: -10 }, tail: { r: -6 }, norigae: { r: -10 } }; }
    var dash = { dur: 0.45, loop: true, ease: 'smooth', blend: 0.1,
      keys: [K(0, run(-22, 18, 0, 0.97)), K(0.1125, run(-4, -2, -26, 1.03)), K(0.225, run(18, -22, 0, 0.97)), K(0.3375, run(-2, -4, -26, 1.03)), K(0.45, run(-22, 18, 0, 0.97))],
      eyes: [{ t: 0, eye: 'normal' }] };

    // 기본 공격 · 회전 접근(spin 0.6초) → 강타(attack 0.7초 · 0.28 = 맞음)
    //  spin: 떡메를 가로로 눕히고 2바퀴 반 돌며 다가감 (view.js 가 앞으로 가는 이동과 함께 재생) · 점점 빨라짐
    function spinPose(phi, u, t) {
      var r = phi * D2R, c = Math.cos(r), sx = Math.abs(c) < 0.16 ? (c < 0 ? -0.16 : 0.16) : c, jog = Math.sin(t * 42);
      return { root: { sx: sx, r: 9, y: -6 * Math.abs(Math.sin(r * 2)) }, torso: { r: 3 }, head: { r: -6 }, arms_mallet: { r: MALLET_H + 4 * Math.sin(r), x: -4, y: 4 },
        leg_front: { r: 20 * jog }, leg_back: { r: -20 * jog }, ear_back: { r: 22 }, ear_front: { r: 24 }, norigae: { r: 24 + 8 * Math.sin(r * 2) }, tail: { r: -12 },
        spin: { r: phi, x: 1, sx: 0.5 + 0.9 * u } };
    }
    var spinKeys = [], SN = 60, ST = 0.6, PHI_END = 900, prevSx = 1;
    for (var n = 0; n <= SN; n++) {   // 0.01초마다 키 · 몸이 뒤집히는 칸(배율 부호가 바뀜)은 'hold' 로 끊어서 얇은 상태를 지나가지 않고 한 번에 뒤집음
      var u = n / SN, pose = spinPose(PHI_END * Math.pow(u, 1.25), u, u * ST), flip = Math.sign(pose.root.sx) !== Math.sign(prevSx); prevSx = pose.root.sx;
      spinKeys.push(K(Math.round(u * ST * 1000) / 1000, pose, flip ? 'hold' : undefined)); }
    var spin = { dur: ST, loop: false, ease: 'linear', blend: 0.06, keys: spinKeys, eyes: [{ t: 0, eye: 'angry' }],
      ghost: { n: 3, gap: 0.04, alpha: [0.34, 0.2, 0.1], filter: 'brightness(1.12) saturate(0.75)' } };
    var ready = { root: { r: 2 }, arms_mallet: { r: -3 } };
    var swingEnd = spinPose(PHI_END, 1, ST);   // 회전 끝 자세 (뒤돌아 있음 · cos 180° = −1)
    var strike = { root: { x: 44, r: 13 }, torso: { r: 2, sx: 1.03, sy: 0.97 }, head: { r: -4 }, arms_mallet: { r: ARM_MAX, x: 14, y: 10 }, leg_front: { r: -16 }, leg_back: { r: 12 },
      ear_back: { r: -18 }, ear_front: { r: -18 }, norigae: { r: -12 }, tail: { r: -6 }, spin: { r: 1100, x: 0.7, sx: 1.5 } };
    var follow = { root: { x: 46, r: 11 }, torso: { r: 2 }, arms_mallet: { r: 13, x: 12, y: 8 }, leg_front: { r: -16 }, leg_back: { r: 12 }, ear_back: { r: -8 }, ear_front: { r: -8 } };
    var attack = { dur: 0.7, loop: false, ease: 'linear', blend: 0.06,
      keys: [K(0, swingEnd), K(0.08, spinPose(990, 1, 0.68)), K(0.16, spinPose(1060, 1, 0.76)), K(0.22, mix2(spinPose(1080, 1, 0.82), { root: { x: 24, r: 12 }, arms_mallet: { r: MALLET_H - 8 } })),
        K(0.28, strike, 'in'), K(0.4, follow, 'out'), K(0.52, follow, 'inout'),
        K(0.7, { root: { x: 20, r: 4 }, arms_mallet: { r: 4 }, leg_front: { r: -10 }, leg_back: { r: 8 } }, 'inout')],
      eyes: [{ t: 0, eye: 'angry' }, { t: 0.5, eye: 'normal' }],
      ghost: { n: 2, gap: 0.04, alpha: [0.3, 0.15], filter: 'brightness(1.12) saturate(0.75)' },
      events: [{ t: 0.28, name: 'hit' }] };
    function mix2(a, b) { var o = {}, k; for (k in a) o[k] = a[k]; for (k in b) o[k] = Object.assign({}, o[k] || {}, b[k]); return o; }

    // 필살기 · 월광 떡방아 (1.3초 · 두 번): 높이 뛰어올라 크게 내려찧고(0.62) → 한 번 더 찧음(0.92)
    var crouch = { root: { r: -3, y: 8 }, torso: { r: -2, sx: 1.05, sy: 0.94 }, head: { r: 3 }, arms_mallet: { r: -ARM_MAX, x: -8, y: 4 }, leg_front: { r: -8 }, leg_back: { r: 8 } };
    var jump = { root: { x: 40, y: -140, r: -8 }, torso: { r: -5, sx: 0.97, sy: 1.04 }, head: { r: 4 }, arms_mallet: { r: -ARM_MAX, x: -14, y: -16 }, leg_front: { r: -22 }, leg_back: { r: 18 },
      ear_back: { r: 22 }, ear_front: { r: 22 }, norigae: { r: 14 }, tail: { r: 8 } };
    var slam = { root: { x: 80, r: 16 }, torso: { r: 4, sx: 1.06, sy: 0.94 }, head: { r: -5 }, arms_mallet: { r: ARM_MAX, x: 16, y: 12 }, leg_front: { r: -18 }, leg_back: { r: 14 },
      ear_back: { r: -22 }, ear_front: { r: -22 }, norigae: { r: -14 }, tail: { r: -8 } };
    var lift2 = { root: { x: 76, r: 4 }, arms_mallet: { r: -ARM_MAX * 0.8, y: -10 }, leg_front: { r: -14 }, leg_back: { r: 10 }, ear_back: { r: 8 }, ear_front: { r: 8 } };
    var skill = { dur: 1.3, loop: false, blend: 0.08,
      keys: [K(0, ready), K(0.2, crouch, 'out'), K(0.42, jump, 'out'), K(0.62, slam, 'in'), K(0.68, slam, 'out'), K(0.82, lift2, 'inout'), K(0.92, slam, 'in'),
        K(1.05, slam, 'out'), K(1.3, { root: { x: 30, r: 3 }, arms_mallet: { r: 4 }, leg_front: { r: -10 }, leg_back: { r: 8 } }, 'inout')],
      eyes: [{ t: 0, eye: 'normal' }, { t: 0.16, eye: 'angry' }, { t: 1.15, eye: 'normal' }],
      events: [{ t: 0.62, name: 'hit' }, { t: 0.62, name: 'shake' }, { t: 0.92, name: 'hit' }, { t: 0.92, name: 'shake' }] };

    var hitP = { root: { x: -44, r: -11, fl: 1 }, torso: { r: -7, sx: 1.03, sy: 0.96 }, head: { r: -12 }, arms_mallet: { r: -8, x: -8, y: -4 }, leg_front: { r: 10 }, leg_back: { r: -6 },
      ear_back: { r: 18 }, ear_front: { r: 20 }, norigae: { r: 12 }, tail: { r: 8 } };
    var hit = { dur: 0.55, loop: false, blend: 0.03,
      keys: [K(0, {}), K(0.06, hitP, 'out'), K(0.22, { root: { x: -50, r: -7, fl: 0.15 }, torso: { r: -4 }, head: { r: -6 }, arms_mallet: { r: -5, x: -4 }, ear_back: { r: 6 }, ear_front: { r: 8 } }, 'inout'), K(0.55, {}, 'inout')],
      eyes: [{ t: 0, eye: 'hurt' }, { t: 0.42, eye: 'normal' }] };

    var hop = { dur: 0.42, loop: false, blend: 0.08,
      keys: [K(0, { root: { r: 4 }, arms_mallet: { r: 3 } }), K(0.08, { root: { r: -4 }, torso: { sx: 1.04, sy: 0.95 }, leg_front: { r: -8 }, leg_back: { r: 8 } }, 'out'),
        K(0.22, { root: { y: -70, r: -8 }, torso: { r: -3 }, leg_front: { r: -16 }, leg_back: { r: 14 }, arms_mallet: { r: -8 }, ear_back: { r: 12 }, ear_front: { r: 14 } }, 'out'),
        K(0.34, { root: { y: 0, r: 0 }, torso: { sx: 1.04, sy: 0.95 } }, 'in'), K(0.42, {}, 'out')],
      eyes: [{ t: 0, eye: 'normal' }] };

    return { bind: { dur: 1, loop: true, keys: [K(0, {}), K(1, {})] }, idle: idle, dash: dash, spin: spin, attack: attack, skill: skill, hit: hit, hop: hop };
  }

  /* 떡메 머리가 그리는 타원 궤적 띠 (몸 둘레 · 떡메 높이) · 앞쪽 반은 몸 앞 · 뒤쪽 반은 몸 뒤 */
  function orbitPaint(half) {
    return function (ctx, api) {
      var s = api.pose.spin, F = window.TaleliaFx; if (!s || s.x < 0.05 || !F) return;
      F.orbit(ctx, { cx: 560, cy: 800, rx: 560, ry: 120, a: s.r, span: 160 + 80 * s.sx, width: 72 + 30 * s.sx, col: [255, 214, 120], col2: [190, 170, 255], half: half, alpha: Math.min(1, s.x * (0.5 + 0.4 * s.sx)) });
    };
  }

  R.moon_rabbit = {
    base: 'images/battle/moon_rabbit/',
    height: 1176,            // 귀 끝 ~ 발바닥 (기준 전신 px)
    anchor: [556, 1201],     // 발 밑 가운데
    rootPivot: [560, 1000],
    eyeDefault: 'normal',
    armMax: 80,              // 떡메 묶음 각도 한계 (회전 접근에서 가로로 눕힘 −66° · 관성 포함 −74° · 강타 +15°)
    // 떡메 머리 아래 (흙 튐 위치) · melee = 맞을 때 이펙트 · dashClip · dashSec = 다가갈 때 쓰는 회전 동작과 걸리는 시간 (view.js)
    fx: { weapon: 'arms_mallet', tip: [1000, 1060], melee: 'slash', dashClip: 'spin', dashSec: 0.6 },
    paint: [{ z: 0.5, fn: orbitPaint('back') }, { z: 12.5, fn: orbitPaint('front') }],
    parts: parts,
    springs: [
      { part: 'ear_back',  k: 100, d: 8, gx: -0.008, max: 24 },
      { part: 'ear_front', k: 110, d: 8, gx: -0.007, max: 22 },
      { part: 'tail',      k: 160, d: 10, gx: 0.003, max: 10 },
      { part: 'norigae',   k: 90,  d: 6, gx: -0.006, max: 16 }
    ],
    clips: clips()
  };
})();
