/* 거북 방패병 전체 리그 (좌표 = 기준 전신 battle_base.png 픽셀, 오른쪽을 봄)
 * 조각 그림: images/battle/turtle_guard/  ← python tools/rig_parts.py docs/graphics/gacha/turtle_guard/rig_parts.json
 * 기준 전신에서 자른 조각 + 채움 시트(parts_fill.png · 몸통 채움 · 웅크린 등껍질 · 눈 3종) · 재생기 = js/battle/rig.js
 * 아직 전투 화면에는 연결하지 않음 (미리보기 gacha-rig-preview.html 에서만 씀)
 */
(function () {
  'use strict';
  var R = window.TALELIA_RIGS = window.TALELIA_RIGS || {}, KIT = window.TALELIA_RIG_KIT, K = KIT.K, mix = KIT.mix;

  /* 조각: 가까운 팔 + 창은 한 묶음(어깨를 중심으로) · 어깨 보호대는 그 위에 덮여 이음매를 가림 · 방패는 먼 팔이 들어 몸 앞에
   * 등껍질은 몸 뒤에 고정 · 필살기(등껍질 박치기)는 몸 전체를 웅크린 등껍질(shell_tuck)로 바꿔 끼워 굴러감
   */
  var parts = [
    { id: 'shell',      img: 'shell.png',      parent: 'torso', pivot: [330, 700],  at: [310, 696],      rot: 0, z: 1 },
    { id: 'leg_back',   img: 'leg_back.png',   parent: null,    pivot: [390, 960],  at: [390.5, 1052.5], rot: 0, z: 2 },
    { id: 'leg_front',  img: 'leg_front.png',  parent: null,    pivot: [760, 990],  at: [802.5, 1080],   rot: 0, z: 3 },
    { id: 'torso_fill', img: 'torso_fill.png', parent: 'torso', pivot: [560, 950],  at: [566.5, 753.5],  rot: 0, z: 4 },
    { id: 'torso',      img: 'torso.png',      parent: null,    pivot: [560, 950],  at: [511, 753.5],    rot: 0, z: 5 },
    { id: 'shield',     img: 'shield.png',     parent: 'torso', pivot: [740, 620],  at: [821, 759],      rot: 0, z: 6 },
    { id: 'spear_arm',  img: 'spear_arm.png',  parent: 'torso', pivot: [450, 610],  at: [753.5, 608],    rot: 0, z: 7 },
    { id: 'pauldron',   img: 'pauldron.png',   parent: 'torso', pivot: [442, 556],  at: [442, 556],      rot: 0, z: 8 },
    { id: 'head',       img: 'head.png',       parent: 'torso', pivot: [590, 520],  at: [593.5, 293],    rot: 0, z: 9 },
    { id: 'eye',        imgs: { normal: 'eye_normal.png', closed: 'eye_closed.png', angry: 'eye_angry.png', hurt: 'eye_hurt.png' },
                                               parent: 'head',  pivot: [680, 383],  at: [680, 383],      rot: 0, z: 10 },
    { id: 'shell_tuck', img: 'shell_tuck.png', parent: null,    pivot: [556, 885],  at: [556.5, 885.5],  rot: 0, z: 12, def: { a: 0 } }
  ];
  var ARM_MAX = 15, BODY = ['shell', 'leg_back', 'leg_front', 'torso_fill', 'torso', 'shield', 'spear_arm', 'pauldron', 'head', 'eye'];
  function tuck(r, extra) { var o = { shell_tuck: { a: 1, r: r } }; BODY.forEach(function (id) { o[id] = { a: 0 }; }); return mix(o, extra || {}); }

  function clips() {
    // 대기: 숨쉬기 · 창은 살짝 들썩 · 방패는 반 박자 늦게
    var idleA = { root: {}, torso: {}, head: { r: 0 }, spear_arm: { r: 0 }, shield: { r: 0 } };
    var idleB = { root: {}, torso: { sy: 1.018, sx: 0.993 }, head: { r: -1.5, y: -2 }, spear_arm: { r: -2.5, y: -3 }, shield: { r: 1.2 } };
    var idle = { dur: 1.7, loop: true, ease: 'smooth', blend: 0.25, keys: [K(0, idleA), K(0.85, idleB), K(1.7, idleA)],
      eyes: [{ t: 0, eye: 'normal' }, { t: 1.3, eye: 'closed' }, { t: 1.41, eye: 'normal' }] };

    // 돌진: 다리가 짧아 보폭은 작게 · 몸을 앞으로 · 방패를 앞세움
    function run(f, b, y) { return { root: { r: 6, y: y }, torso: { r: 2 }, head: { r: -4 }, leg_front: { r: f }, leg_back: { r: b }, spear_arm: { r: -5 }, shield: { r: -3, x: 8 } }; }
    var dash = { dur: 0.45, loop: true, ease: 'smooth', blend: 0.1,
      keys: [K(0, run(-15, 12, 0)), K(0.1125, run(-2, -2, -18)), K(0.225, run(12, -15, 0)), K(0.3375, run(-2, -2, -18)), K(0.45, run(-15, 12, 0))],
      eyes: [{ t: 0, eye: 'normal' }] };

    // 기본 공격 (창 찌르기 · 0.28 = 맞는 순간): 창을 뒤로 당겼다가 몸을 내밀며 창끝 방향(오른쪽 위)으로 찌름
    var ready = { root: { r: 2 }, spear_arm: { r: -2 } };
    var wind = { root: { x: -12, r: -5 }, torso: { r: -3 }, head: { r: 3 }, spear_arm: { r: -ARM_MAX, x: -30, y: 18 }, shield: { r: 3 }, leg_front: { r: -5 }, leg_back: { r: 5 } };
    var thrust = { root: { x: 48, r: 9 }, torso: { r: 3, sx: 1.03, sy: 0.97 }, head: { r: -4 }, spear_arm: { r: 6, x: 46, y: -30 }, shield: { r: -3, x: 6 }, leg_front: { r: -14 }, leg_back: { r: 10 } };
    var hold = { root: { x: 50, r: 8 }, torso: { r: 2 }, spear_arm: { r: 5, x: 40, y: -26 }, leg_front: { r: -14 }, leg_back: { r: 10 } };
    var attack = { dur: 0.7, loop: false, blend: 0.06,
      keys: [K(0, ready), K(0.16, wind, 'out'), K(0.2, wind, 'inout'), K(0.28, thrust, 'in'), K(0.42, hold, 'out'), K(0.52, hold, 'inout'),
        K(0.7, { root: { x: 20, r: 3 }, spear_arm: { r: 1 }, leg_front: { r: -8 }, leg_back: { r: 6 } }, 'inout')],
      eyes: [{ t: 0, eye: 'normal' }, { t: 0.14, eye: 'angry' }, { t: 0.5, eye: 'normal' }],
      events: [{ t: 0.28, name: 'hit' }] };

    // 필살기 · 등껍질 박치기 (1.2초): 웅크림 → 몸 전체를 웅크린 등껍질로 바꿔 두 바퀴 굴러 박음(0.62 = 맞음 · 흔들림) → 튕겨 나와 원래대로
    var crouch = { root: { r: -4, y: 8 }, torso: { sx: 1.06, sy: 0.92 }, head: { r: 6, y: 20 }, spear_arm: { r: -8 }, shield: { r: 4 } };
    var skill = { dur: 1.2, loop: false, blend: 0.06,
      keys: [K(0, ready), K(0.18, crouch, 'out'), K(0.24, tuck(0, { root: { y: 10 } }), 'out'),
        K(0.45, tuck(400, { root: { x: 70, y: -40 } }), 'inout'), K(0.62, tuck(720, { root: { x: 130, y: 0 } }), 'in'),
        K(0.72, tuck(760, { root: { x: 110, y: -30 } }), 'out'), K(0.86, tuck(800, { root: { x: 80, y: 0 } }), 'in'),
        K(0.9, { root: { x: 80, r: -6 }, torso: { sx: 1.05, sy: 0.94 }, spear_arm: { r: -6 } }, 'out'), K(1.2, { root: { x: 30, r: 2 } }, 'inout')],
      eyes: [{ t: 0, eye: 'normal' }, { t: 0.12, eye: 'angry' }, { t: 1.05, eye: 'normal' }],
      events: [{ t: 0.62, name: 'hit' }, { t: 0.62, name: 'shake' }] };

    // 피격: 방패를 들어 버팀 · 뒤로 밀림 · 번쩍임
    var hitP = { root: { x: -40, r: -9, fl: 1 }, torso: { r: -5, sx: 1.03, sy: 0.96 }, head: { r: -10 }, spear_arm: { r: -6, x: -6 }, shield: { r: -6, x: 10 }, leg_front: { r: 8 }, leg_back: { r: -5 } };
    var hit = { dur: 0.55, loop: false, blend: 0.03,
      keys: [K(0, {}), K(0.06, hitP, 'out'), K(0.22, { root: { x: -46, r: -6, fl: 0.15 }, head: { r: -5 }, shield: { r: -3, x: 6 } }, 'inout'), K(0.55, {}, 'inout')],
      eyes: [{ t: 0, eye: 'hurt' }, { t: 0.42, eye: 'normal' }] };

    var hop = { dur: 0.42, loop: false, blend: 0.08,
      keys: [K(0, { root: { r: 4 } }), K(0.08, { root: { r: -4 }, torso: { sx: 1.04, sy: 0.95 }, leg_front: { r: -6 }, leg_back: { r: 6 } }, 'out'),
        K(0.22, { root: { y: -60, r: -7 }, leg_front: { r: -12 }, leg_back: { r: 10 }, spear_arm: { r: -8 } }, 'out'),
        K(0.34, { root: { y: 0, r: 0 }, torso: { sx: 1.04, sy: 0.95 } }, 'in'), K(0.42, {}, 'out')],
      eyes: [{ t: 0, eye: 'normal' }] };

    return { bind: { dur: 1, loop: true, keys: [K(0, {}), K(1, {})] }, idle: idle, dash: dash, attack: attack, skill: skill, hit: hit, hop: hop };
  }

  R.turtle_guard = {
    base: 'images/battle/turtle_guard/',
    height: 1144,            // 투구 꼭대기 ~ 발바닥 (기준 전신 px)
    anchor: [594, 1200],     // 발 밑 가운데
    rootPivot: [560, 950],
    eyeDefault: 'normal',
    armMax: ARM_MAX,
    fx: { weapon: 'spear_arm', tip: [1137, 312] },   // 창끝
    parts: parts,
    springs: [],
    clips: clips()
  };
})();
