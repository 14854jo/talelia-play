/* 부엉이 현자 전체 리그 (좌표 = 기준 전신 battle_base.png 픽셀, 오른쪽을 봄)
 * 조각 그림: images/battle/owl_sage/  ← python tools/rig_parts.py docs/graphics/gacha/owl_sage/rig_parts.json
 * 기준 전신에서 자른 조각 + 채움 시트(parts_fill.png · 로브 몸 · 먼 날개 · 안경 없는 눈 3종) · 재생기 = js/battle/rig.js
 * 아직 전투 화면에는 연결하지 않음 (미리보기 gacha-rig-preview.html 에서만 씀)
 */
(function () {
  'use strict';
  var R = window.TALELIA_RIGS = window.TALELIA_RIGS || {}, K = window.TALELIA_RIG_KIT.K;

  /* 조각: 가까운 날개 + 지팡이는 한 묶음(어깨를 중심으로) · 머리는 로브 깃 아래 층(깃이 턱을 덮어 고개를 돌려도 목이 안 보임)
   * 눈은 안경알 안쪽만 바꿔 끼움(안경 테는 머리 그림 그대로) · 떠 있는 책은 몸과 따로 둥실 · 먼 날개는 로브 뒤에서 살짝 퍼덕
   */
  var parts = [
    { id: 'far_wing_fill', img: 'far_wing_fill.png', parent: 'far_wing', pivot: [800, 700], at: [842.5, 811],  rot: 0, z: 1.9 },
    { id: 'far_wing',   img: 'far_wing.png',   parent: 'torso', pivot: [800, 700],  at: [846, 820],     rot: 0, z: 2 },
    { id: 'foot_back',  img: 'foot_back.png',  parent: null,    pivot: [574, 1130], at: [574, 1161],    rot: 0, z: 3 },
    { id: 'foot_front', img: 'foot_front.png', parent: null,    pivot: [757, 1130], at: [757.5, 1159],  rot: 0, z: 3 },
    { id: 'torso_fill', img: 'torso_fill.png', parent: 'torso', pivot: [650, 1000], at: [602, 793],     rot: 0, z: 3.9 },
    { id: 'head',       img: 'head.png',       parent: 'torso', pivot: [640, 560],  at: [618, 366.5],   rot: 0, z: 4 },
    { id: 'eye',        imgs: { normal: 'eye_normal.png', closed: 'eye_closed.png', angry: 'eye_angry.png', hurt: 'eye_hurt.png' },
                                               parent: 'head',  pivot: [705, 424],  at: [705, 424],     rot: 0, z: 4.5 },
    { id: 'torso',      img: 'torso.png',      parent: null,    pivot: [650, 1000], at: [605, 722.5],   rot: 0, z: 5 },
    { id: 'staff_wing', img: 'staff_wing.png', parent: 'torso', pivot: [470, 590],  at: [396, 621],     rot: 0, z: 7 },
    { id: 'book',       img: 'book.png',       parent: null,    pivot: [944, 555],  at: [944.5, 555.5], rot: 0, z: 12 }
  ];
  var ARM_UP = -12, ARM_DOWN = 10;   // 지팡이를 들어 올림 / 앞으로 내밂 (어깨를 중심으로 · 도)

  function clips() {
    // 대기: 숨쉬기 · 책은 둥실 · 고개를 살짝 갸웃
    var idleA = { root: {}, torso: {}, head: { r: 0 }, staff_wing: { r: 0 }, far_wing: { r: 0 }, book: { y: 0, r: 0 } };
    var idleB = { root: {}, torso: { sy: 1.018, sx: 0.993 }, head: { r: 4, y: -2 }, staff_wing: { r: -2.5 }, far_wing: { r: 3 }, book: { y: -16, r: 3 } };
    var idle = { dur: 1.9, loop: true, ease: 'smooth', blend: 0.25, keys: [K(0, idleA), K(0.95, idleB), K(1.9, idleA)],
      eyes: [{ t: 0, eye: 'normal' }, { t: 1.45, eye: 'closed' }, { t: 1.56, eye: 'normal' }] };

    // 돌진(통통 걸음): 로브라 다리 대신 발을 번갈아 조금씩 · 몸이 통통 튐
    function step(f, b, y) { return { root: { r: 5, y: y }, head: { r: -4 }, foot_front: { r: f, y: f < 0 ? -10 : 0 }, foot_back: { r: b, y: b < 0 ? -10 : 0 }, staff_wing: { r: -5 }, far_wing: { r: -6 }, book: { y: -10, x: -10 } }; }
    var dash = { dur: 0.5, loop: true, ease: 'smooth', blend: 0.1,
      keys: [K(0, step(-10, 8, 0)), K(0.125, step(0, 0, -20)), K(0.25, step(8, -10, 0)), K(0.375, step(0, 0, -20)), K(0.5, step(-10, 8, 0))],
      eyes: [{ t: 0, eye: 'normal' }] };

    // 기본 공격 (제자리 · 0.3 = 달빛을 쏨 · 0.55 = 맞음): 지팡이를 들었다가 앞으로 내밂 · 책이 따라 기울어짐
    var lift = { root: { x: -6, r: -4 }, head: { r: 6 }, staff_wing: { r: ARM_UP, y: -8 }, far_wing: { r: 6 }, book: { y: -24, r: -6 } };
    var push = { root: { x: 10, r: 5 }, torso: { sx: 1.02, sy: 0.98 }, head: { r: -4 }, staff_wing: { r: ARM_DOWN, x: 10 }, far_wing: { r: -4 }, book: { y: -8, r: 8, x: 10 } };
    var attack = { dur: 0.7, loop: false, blend: 0.06,
      keys: [K(0, { root: { r: 1 } }), K(0.2, lift, 'out'), K(0.26, lift, 'inout'), K(0.3, push, 'in'), K(0.45, push, 'out'), K(0.7, { book: { y: -6 } }, 'inout')],
      eyes: [{ t: 0, eye: 'normal' }, { t: 0.14, eye: 'angry' }, { t: 0.55, eye: 'normal' }],
      events: [{ t: 0.3, name: 'shoot' }, { t: 0.55, name: 'hit' }] };

    // 필살기 · 잠의 주문 (1.3초 · 세 번): 책이 높이 떠올라 펼쳐지고 지팡이를 높이 든 채 세 번 내밂
    var rise = { root: { y: -10, r: -3 }, torso: { sx: 0.97, sy: 1.04 }, head: { r: -8 }, staff_wing: { r: ARM_UP, y: -10 }, far_wing: { r: 10 }, book: { y: -90, r: -10, sx: 1.1, sy: 1.1 } };
    function pulse(k) { return { root: { r: 4 }, head: { r: -6 }, staff_wing: { r: ARM_DOWN * k }, far_wing: { r: -6 }, book: { y: -80, r: 6, sx: 1.1, sy: 1.1 } }; }
    var skill = { dur: 1.3, loop: false, blend: 0.06,
      keys: [K(0, { root: { r: 1 } }), K(0.3, rise, 'out'), K(0.42, rise, 'inout'), K(0.5, pulse(1), 'in'), K(0.58, rise, 'inout'), K(0.65, pulse(1), 'in'),
        K(0.73, rise, 'inout'), K(0.8, pulse(1), 'in'), K(1.0, pulse(0.6), 'out'), K(1.3, {}, 'inout')],
      eyes: [{ t: 0, eye: 'normal' }, { t: 0.2, eye: 'closed' }, { t: 0.45, eye: 'angry' }, { t: 1.1, eye: 'normal' }],
      events: [{ t: 0.5, name: 'shoot' }, { t: 0.65, name: 'shoot' }, { t: 0.75, name: 'hit' }, { t: 0.8, name: 'shoot' }, { t: 0.9, name: 'hit' }, { t: 1.05, name: 'hit' }, { t: 1.05, name: 'shake' }] };   // 시간순 (재생기는 앞에서부터 차례로 처리)

    var hitP = { root: { x: -38, r: -9, fl: 1 }, torso: { sx: 1.03, sy: 0.96 }, head: { r: -14 }, staff_wing: { r: 6 }, far_wing: { r: 12 }, book: { y: 20, r: 14 } };
    var hit = { dur: 0.55, loop: false, blend: 0.03,
      keys: [K(0, {}), K(0.06, hitP, 'out'), K(0.22, { root: { x: -44, r: -6, fl: 0.15 }, head: { r: -6 }, book: { y: 10, r: 6 } }, 'inout'), K(0.55, {}, 'inout')],
      eyes: [{ t: 0, eye: 'hurt' }, { t: 0.42, eye: 'normal' }] };

    var hop = { dur: 0.42, loop: false, blend: 0.08,
      keys: [K(0, { root: { r: 3 } }), K(0.08, { root: { r: -3 }, torso: { sx: 1.04, sy: 0.95 } }, 'out'),
        K(0.22, { root: { y: -55, r: -6 }, far_wing: { r: 14 }, staff_wing: { r: -6 }, book: { y: -30 } }, 'out'),
        K(0.34, { root: { y: 0, r: 0 }, torso: { sx: 1.04, sy: 0.95 } }, 'in'), K(0.42, {}, 'out')],
      eyes: [{ t: 0, eye: 'normal' }] };

    return { bind: { dur: 1, loop: true, keys: [K(0, {}), K(1, {})] }, idle: idle, dash: dash, attack: attack, skill: skill, hit: hit, hop: hop };
  }

  R.owl_sage = {
    base: 'images/battle/owl_sage/',
    height: 1050,            // 귀깃 끝 ~ 발바닥 (지팡이 제외 · 기준 전신 px)
    anchor: [662, 1206],     // 발 밑 가운데
    rootPivot: [650, 1000],
    eyeDefault: 'normal',
    armMax: Math.max(-ARM_UP, ARM_DOWN),
    fx: { weapon: 'staff_wing', tip: [345, 120], ranged: true, projectile: '#fff3b0', kind: 'moonorb', ultKind: 'moonorb', flight: { shoot: 0.25 } },   // 초승달 지팡이 끝 · 달빛 구체 (js/battle/fx-kit.js 가 그림 · 필살기 영상 자리 = view.js FX.ultVideo)
    parts: parts,
    springs: [{ part: 'far_wing', k: 90, d: 7, gx: 0.006, max: 12 }],
    clips: clips()
  };
})();
