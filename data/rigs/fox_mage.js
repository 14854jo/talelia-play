/* 여우 마술사 전체 리그 (좌표 = 기준 전신 battle_base.png 픽셀, 오른쪽을 봄)
 * 조각 그림: images/battle/fox_mage/  ← python tools/rig_parts.py docs/graphics/gacha/fox_mage/rig_parts.json
 * 기준 전신에서 자른 조각 + 채움 시트(parts_fill.png · 몸통 · 꼬리 전체 · 눈 3종) · 재생기 = js/battle/rig.js
 * 아직 전투 화면에는 연결하지 않음 (미리보기 gacha-rig-preview.html 에서만 씀)
 */
(function () {
  'use strict';
  var R = window.TALELIA_RIGS = window.TALELIA_RIGS || {}, K = window.TALELIA_RIG_KIT.K;

  /* 조각: 마법봉 팔은 망토 어깨 밑에서 나와 어깨를 중심으로 돔(몸통 · 망토 아래 층이라 이음매가 가려짐)
   * 모자 끝 · 꼬리는 관성으로 출렁임 · 꼬리 채움(부품 그림)은 꼬리 아래에 깔려 망토에 가려진 부분을 메움
   */
  var parts = [
    { id: 'tail_fill',  img: 'tail_fill.png',  parent: 'tail',  pivot: [400, 1000], at: [351, 855.5],    rot: 0, z: 0.9 },
    { id: 'tail',       img: 'tail.png',       parent: 'torso', pivot: [400, 1000], at: [251, 874],      rot: 0, z: 1 },
    { id: 'leg_back',   img: 'leg_back.png',   parent: null,    pivot: [480, 1030], at: [481.5, 1111.5], rot: 0, z: 2 },
    { id: 'leg_front',  img: 'leg_front.png',  parent: null,    pivot: [780, 1020], at: [783, 1105],     rot: 0, z: 3 },
    { id: 'wand_arm',   img: 'wand_arm.png',   parent: 'torso', pivot: [835, 650],  at: [1007, 579.5],   rot: 0, z: 4 },
    { id: 'torso_fill', img: 'torso_fill.png', parent: 'torso', pivot: [640, 1000], at: [644.5, 799.5],  rot: 0, z: 3.5 },
    { id: 'shoulder_fill', img: 'shoulder_fill.png', parent: 'torso', pivot: [816, 653], at: [815, 653.5], rot: 0, z: 3.6 },
    { id: 'torso',      img: 'torso.png',      parent: null,    pivot: [640, 1000], at: [664.5, 786.5],  rot: 0, z: 5 },
    { id: 'head',       img: 'head.png',       parent: 'torso', pivot: [680, 600],  at: [621.5, 329.5],  rot: 0, z: 8 },
    { id: 'hat_tip',    img: 'hat_tip.png',    parent: 'head',  pivot: [440, 180],  at: [392, 153.5],    rot: 0, z: 9 },
    { id: 'eye',        imgs: { normal: 'eye_normal.png', closed: 'eye_closed.png', angry: 'eye_angry.png', hurt: 'eye_hurt.png' },
                                               parent: 'head',  pivot: [736, 493],  at: [736, 493],      rot: 0, z: 10 }
  ];
  var ARM_UP = -18, ARM_DOWN = 12;   // 마법봉을 들어 올림 / 앞으로 튕김 (어깨를 중심으로 · 도)

  function clips() {
    var idleA = { root: {}, torso: {}, head: { r: 0 }, wand_arm: { r: 0 }, tail: { r: 0 }, hat_tip: { r: 0 } };
    var idleB = { root: {}, torso: { sy: 1.02, sx: 0.992 }, head: { r: -1.5, y: -2 }, wand_arm: { r: -3, y: -3 }, tail: { r: 6 }, hat_tip: { r: 5 } };
    var idle = { dur: 1.7, loop: true, ease: 'smooth', blend: 0.25, keys: [K(0, idleA), K(0.85, idleB), K(1.7, idleA)],
      eyes: [{ t: 0, eye: 'normal' }, { t: 1.3, eye: 'closed' }, { t: 1.41, eye: 'normal' }] };

    function run(f, b, y) { return { root: { r: 7, y: y }, torso: { r: 2 }, head: { r: -5 }, leg_front: { r: f }, leg_back: { r: b }, wand_arm: { r: -6 }, tail: { r: -10 }, hat_tip: { r: -12 } }; }
    var dash = { dur: 0.45, loop: true, ease: 'smooth', blend: 0.1,
      keys: [K(0, run(-20, 16, 0)), K(0.1125, run(-3, -3, -22)), K(0.225, run(16, -20, 0)), K(0.3375, run(-3, -3, -22)), K(0.45, run(-20, 16, 0))],
      eyes: [{ t: 0, eye: 'normal' }] };

    // 기본 공격 (제자리 · 0.3 = 여우불 쏨 · 0.55 = 맞음): 마법봉을 들었다가 앞으로 튕김
    var lift = { root: { x: -8, r: -4 }, torso: { r: -2 }, head: { r: 3 }, wand_arm: { r: ARM_UP, y: -6 }, tail: { r: 6 }, hat_tip: { r: 8 } };
    var flick = { root: { x: 10, r: 6 }, torso: { r: 2, sx: 1.02, sy: 0.98 }, head: { r: -3 }, wand_arm: { r: ARM_DOWN, x: 8 }, tail: { r: -6 }, hat_tip: { r: -10 } };
    var attack = { dur: 0.7, loop: false, blend: 0.06,
      keys: [K(0, { root: { r: 2 } }), K(0.2, lift, 'out'), K(0.26, lift, 'inout'), K(0.3, flick, 'in'), K(0.45, flick, 'out'), K(0.7, { root: { r: 1 }, wand_arm: { r: 2 } }, 'inout')],
      eyes: [{ t: 0, eye: 'normal' }, { t: 0.14, eye: 'angry' }, { t: 0.55, eye: 'normal' }],
      events: [{ t: 0.3, name: 'shoot' }, { t: 0.55, name: 'hit' }] };

    // 필살기 · 여우불 (2.0초): 작은 여우불 1발(0.3) → 마법봉에 기를 모음(0.6 ~ 1.4 · 빛 입자가 모여듦) → 훨씬 큰 여우불(1.5)
    //  이벤트: shoot:small = 작은 첫 발 (보이기만 · 피해 숫자 없음) · gather = 기 모으기 시작 (1.4 까지) · shoot = 큰 여우불 (닿으면 크게 폭발 · 피해는 여기서 한 번에)
    var gather1 = { root: { y: -14, r: -5 }, torso: { sx: 0.96, sy: 1.05 }, head: { r: 4 }, wand_arm: { r: ARM_UP, y: -12 }, tail: { r: 10 }, hat_tip: { r: 14 } };
    var gather2 = { root: { y: -19, r: -6 }, torso: { sx: 0.95, sy: 1.06 }, head: { r: 5 }, wand_arm: { r: ARM_UP * 1.05, y: -15 }, tail: { r: 15 }, hat_tip: { r: 19 } };
    var crouch2 = { root: { y: 6, r: -3 }, torso: { sx: 1.04, sy: 0.96 }, head: { r: 2 }, wand_arm: { r: ARM_UP, y: -8 }, tail: { r: 4 }, hat_tip: { r: 6 } };
    var bigFlick = { root: { x: 16, r: 8 }, torso: { r: 3, sx: 1.03, sy: 0.97 }, head: { r: -4 }, wand_arm: { r: ARM_DOWN * 1.4, x: 12 }, tail: { r: -9 }, hat_tip: { r: -14 } };
    var skill = { dur: 2.0, loop: false, blend: 0.06,
      keys: [K(0, { root: { r: 2 } }), K(0.2, lift, 'out'), K(0.26, lift, 'inout'), K(0.3, flick, 'in'), K(0.42, flick, 'out'), K(0.55, lift, 'inout'), K(0.7, gather1, 'out'),
        K(0.95, gather2, 'inout'), K(1.2, gather1, 'inout'), K(1.4, gather2, 'inout'), K(1.45, crouch2, 'in'), K(1.5, bigFlick, 'in'), K(1.7, bigFlick, 'out'),
        K(2.0, { root: { r: 1 }, wand_arm: { r: 2 } }, 'inout')],
      eyes: [{ t: 0, eye: 'normal' }, { t: 0.12, eye: 'angry' }, { t: 1.8, eye: 'normal' }],
      events: [{ t: 0.3, name: 'shoot:small' }, { t: 0.6, name: 'gather' }, { t: 1.5, name: 'shoot' }, { t: 1.95, name: 'hit' }, { t: 1.95, name: 'shake' }] };

    var hitP = { root: { x: -40, r: -10, fl: 1 }, torso: { r: -5, sx: 1.03, sy: 0.96 }, head: { r: -10 }, wand_arm: { r: 8 }, tail: { r: 14 }, hat_tip: { r: 18 }, leg_front: { r: 8 }, leg_back: { r: -5 } };
    var hit = { dur: 0.55, loop: false, blend: 0.03,
      keys: [K(0, {}), K(0.06, hitP, 'out'), K(0.22, { root: { x: -46, r: -6, fl: 0.15 }, head: { r: -5 }, wand_arm: { r: 4 }, hat_tip: { r: 8 } }, 'inout'), K(0.55, {}, 'inout')],
      eyes: [{ t: 0, eye: 'hurt' }, { t: 0.42, eye: 'normal' }] };

    var hop = { dur: 0.42, loop: false, blend: 0.08,
      keys: [K(0, { root: { r: 4 } }), K(0.08, { root: { r: -4 }, torso: { sx: 1.04, sy: 0.95 } }, 'out'),
        K(0.22, { root: { y: -60, r: -7 }, leg_front: { r: -14 }, leg_back: { r: 12 }, tail: { r: 12 }, hat_tip: { r: 14 } }, 'out'),
        K(0.34, { root: { y: 0, r: 0 }, torso: { sx: 1.04, sy: 0.95 } }, 'in'), K(0.42, {}, 'out')],
      eyes: [{ t: 0, eye: 'normal' }] };

    return { bind: { dur: 1, loop: true, keys: [K(0, {}), K(1, {})] }, idle: idle, dash: dash, attack: attack, skill: skill, hit: hit, hop: hop };
  }

  R.fox_mage = {
    base: 'images/battle/fox_mage/',
    height: 1146,            // 모자 꼭대기 ~ 발바닥 (기준 전신 px)
    anchor: [631, 1201],     // 발 밑 가운데
    rootPivot: [640, 1000],
    eyeDefault: 'normal',
    armMax: Math.max(-ARM_UP * 1.05, ARM_DOWN * 1.4),   // 필살기 기 모으기 · 큰 여우불 튕김까지
    fx: { weapon: 'wand_arm', tip: [1197, 462], ranged: true, projectile: '#ff9a3c', kind: 'foxfire', ultKind: 'foxfire', flight: { shoot: 0.25, big: 0.45, small: 0.22 } },   // 마법봉 끝 · 여우불 (js/battle/fx-kit.js 가 그림)
    parts: parts,
    springs: [
      { part: 'tail',    k: 120, d: 8, gx: 0.005,  max: 14 },
      { part: 'hat_tip', k: 100, d: 7, gx: -0.008, max: 18 }
    ],
    clips: clips()
  };
})();
