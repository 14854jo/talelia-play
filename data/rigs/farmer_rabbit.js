/* 농부 토끼 측면 전투 리그 (좌표 = 기준 전신 battle_base.png 픽셀, 오른쪽을 봄)
 * 조각 그림: images/battle/farmer_rabbit/  ← python tools/rig_parts.py docs/graphics/gacha/farmer_rabbit/rig_parts.json
 * 규격서 · 검수 기록: docs/graphics/gacha/farmer_rabbit/BATTLE_PARTS_SPEC.md · 재생기: js/battle/rig.js (24호와 같음)
 * 아직 전투 화면에는 연결하지 않음 (미리보기 gacha-rig-preview.html 에서만 씀)
 */
(function () {
  'use strict';
  var R = window.TALELIA_RIGS = window.TALELIA_RIGS || {};

  /* 조각: 기준 전신에서 자른 조각이 보이는 부분, 부품 그림(채움)은 그 아래에 깔려 움직일 때 비는 곳만 메움
   * 양팔 + 괭이는 한 조각(두 손이 자루 하나를 쥠) · 두 어깨 가운데를 중심으로 ±15° 안에서만 돌림
   * 소매 끝(sleeve_*)은 팔 묶음 위에 덮음 (뒤 소매 = 몸통에 붙어 어깨 이음매를 가림 · 앞 소매 = 팔과 같이 움직임) · 씨앗 주머니는 묶음 아래 층(자루 끝을 채워 그림)
   */
  var parts = [
    { id: 'ear_fold',    img: 'ear_fold.png',     parent: 'head',     pivot: [685, 305],  at: [730.5, 261],   rot: 0, z: 1 },
    { id: 'tail_fill',   img: 'tail_fill.png',    parent: 'tail',     pivot: [362, 850],  at: [329, 845],     rot: 0, z: 1.9 },
    { id: 'tail',        img: 'tail.png',         parent: 'torso',    pivot: [362, 850],  at: [327.5, 848],   rot: 0, z: 2 },
    { id: 'leg_back',    img: 'leg_back.png',     parent: null,       pivot: [440, 928],  at: [362.5, 1032.5], rot: 0, z: 3 },
    { id: 'leg_front',   img: 'leg_front.png',    parent: null,       pivot: [618, 915],  at: [656, 1016],    rot: 0, z: 4 },
    { id: 'torso_fill',  img: 'torso_fill.png',   parent: 'torso',    pivot: [560, 930],  at: [513.5, 776.5], rot: 0, z: 5 },
    { id: 'torso',       img: 'torso.png',        parent: null,       pivot: [560, 930],  at: [538, 784.5],   rot: 0, z: 6 },
    { id: 'pouch',       img: 'pouch.png',        parent: 'torso',    pivot: [432, 796],  at: [412, 858.5],   rot: 0, z: 7 },
    { id: 'head',        img: 'head.png',         parent: 'torso',    pivot: [610, 622],  at: [582.5, 456.5], rot: 0, z: 8 },
    { id: 'ear_up',      img: 'ear_up.png',       parent: 'head',     pivot: [553, 332],  at: [537.5, 188],   rot: 0, z: 8.6 },
    // 눈: 평소 = 기준 전신의 눈 그대로. 감은 · 결의 · 아픈 눈은 부품 그림의 얼굴에서 눈 둘레만 오려 털색을 기준 얼굴에 맞춤
    { id: 'eye',         imgs: { normal: 'eye_normal.png', closed: 'eye_closed.png', angry: 'eye_angry.png', hurt: 'eye_hurt.png' },
                                                  parent: 'head',     pivot: [697, 516],  at: [697, 516],     rot: 0, z: 9 },
    { id: 'arms_hoe',    img: 'arms_hoe.png',     parent: 'torso',    pivot: [570, 722],  at: [778.5, 704],   rot: 0, z: 10 },
    { id: 'sleeve_back', img: 'sleeve_back.png',  parent: 'torso',    pivot: [441, 687],  at: [441, 687.5],   rot: 0, z: 11 },
    // 앞 소매는 팔과 같이 움직임 (몸 앞으로 나온 팔이라 어깨에 남기면 허공에 뜸) · 뒤 소매는 어깨(몸통)에 남아 팔 이음매를 가림
    { id: 'sleeve_front', img: 'sleeve_front.png', parent: 'arms_hoe', pivot: [702, 737], at: [702, 737],     rot: 0, z: 11 }
  ];

  /* 동작. 값은 기본 자세에서 바뀌는 양: r 도(시계 방향 +), x·y 기준 전신 px, sx·sy 배율
   * 괭이 묶음 r: − = 날이 들림(준비), + = 날이 내려감(내려찍기) · 어떤 동작에서도 −15 ~ +15
   * 몸통 · root r: + = 앞(오른쪽)으로 기울임 · 다리 r: − = 발이 앞으로
   */
  var ARM_MAX = 15;
  function clips() {
    function K(t, p, ease) { return { t: t, p: p, ease: ease }; }

    // 대기: 1.6초 숨쉬기. 몸이 위로 늘었다 줄고, 괭이 · 귀 · 꼬리 · 주머니가 반 박자 늦게
    var idleA = { root: {}, torso: {}, head: { r: 0 }, arms_hoe: { r: 0 }, ear_up: { r: 0 }, ear_fold: { r: 0 }, tail: { r: 0 }, pouch: { r: 0 } };
    var idleB = { root: {}, torso: { sy: 1.02, sx: 0.992 }, head: { r: -1.5, y: -2 }, arms_hoe: { r: -2.5, y: -3 },
      ear_up: { r: -3 }, ear_fold: { r: 5 }, tail: { r: 5 }, pouch: { r: 3 } };
    var idle = { dur: 1.6, loop: true, ease: 'smooth', blend: 0.25,
      keys: [K(0, idleA), K(0.8, idleB), K(1.6, idleA)],
      eyes: [{ t: 0, eye: 'normal' }, { t: 1.25, eye: 'closed' }, { t: 1.36, eye: 'normal' }] };

    // 돌진: 0.45초에 두 걸음. 몸을 앞으로 기울이고 괭이는 살짝 끌어당겨 날을 듦
    function run(legF, legB, y, sq) {
      return { root: { r: 8, y: y }, torso: { r: 2, sy: sq, sx: 2 - sq }, head: { r: -6 },
        leg_front: { r: legF }, leg_back: { r: legB }, arms_hoe: { r: -6, x: -10, y: -4 },
        ear_up: { r: -10 }, ear_fold: { r: -8 }, tail: { r: -6 }, pouch: { r: -8 } };
    }
    var dash = { dur: 0.45, loop: true, ease: 'smooth', blend: 0.1,
      keys: [K(0, run(-24, 18, 0, 0.97)), K(0.1125, run(-4, -2, -24, 1.03)), K(0.225, run(18, -24, 0, 0.97)),
        K(0.3375, run(-2, -4, -24, 1.03)), K(0.45, run(-24, 18, 0, 0.97))],
      eyes: [{ t: 0, eye: 'normal' }] };

    // 기본 공격 (0.7초): 몸을 뒤로 젖히며 날을 들었다가(−15) → 앞으로 내디디며 내려찍기(+15 · 0.28 = 맞는 순간) → 잠깐 멈춤 → 돌아옴
    var ready = { root: { r: 2 }, arms_hoe: { r: -3 } };
    var windup = { root: { x: -12, r: -6 }, torso: { r: -4, sx: 0.98, sy: 1.02 }, head: { r: 4 },
      arms_hoe: { r: -ARM_MAX, x: -12, y: -10 }, leg_front: { r: -6 }, leg_back: { r: 6 },
      ear_up: { r: 8 }, ear_fold: { r: 8 }, pouch: { r: 6 } };
    var swing = { root: { x: 18, r: 4 }, torso: { r: 0 }, head: { r: -1 }, arms_hoe: { r: 0, x: 2 },
      leg_front: { r: -10 }, leg_back: { r: 8 }, ear_up: { r: -2 }, ear_fold: { r: -2 } };
    var strike = { root: { x: 42, r: 12 }, torso: { r: 2, sx: 1.03, sy: 0.97 }, head: { r: -4 },
      arms_hoe: { r: ARM_MAX, x: 14, y: 8 }, leg_front: { r: -16 }, leg_back: { r: 12 },
      ear_up: { r: -14 }, ear_fold: { r: -16 }, pouch: { r: -10 }, tail: { r: -6 } };
    var follow = { root: { x: 46, r: 10 }, torso: { r: 2 }, head: { r: -3 }, arms_hoe: { r: 13, x: 12, y: 6 },
      leg_front: { r: -16 }, leg_back: { r: 12 }, ear_up: { r: -8 }, ear_fold: { r: -10 } };
    var settle = { root: { x: 20, r: 4 }, torso: { r: 1 }, arms_hoe: { r: 4 }, leg_front: { r: -10 }, leg_back: { r: 8 } };
    var attack = { dur: 0.7, loop: false, blend: 0.06,
      keys: [K(0, ready), K(0.16, windup, 'out'), K(0.2, windup, 'inout'), K(0.25, swing, 'in'), K(0.28, strike, 'out'),
        K(0.4, follow, 'out'), K(0.52, follow, 'inout'), K(0.7, settle, 'inout')],
      eyes: [{ t: 0, eye: 'normal' }, { t: 0.14, eye: 'angry' }, { t: 0.5, eye: 'normal' }],
      events: [{ t: 0.28, name: 'hit' }] };

    // 필살기 · 괭이 내려치기 (1.1초): 웅크렸다가 작게 뛰어올라(날 −15 유지) → 내려오며 몸을 크게 숙여 내려찍기(+15)
    //  더 큰 호는 괭이가 아니라 몸(뛰어오름 · 기울기)으로 만듦 · 0.62 = 맞는 순간(흙 튐 · 화면 흔들림)
    var crouch = { root: { r: -3, y: 6 }, torso: { r: -2, sx: 1.05, sy: 0.94 }, head: { r: 3 },
      arms_hoe: { r: -ARM_MAX, x: -8, y: 4 }, leg_front: { r: -8 }, leg_back: { r: 8 }, ear_up: { r: 6 }, ear_fold: { r: 6 } };
    var jump = { root: { x: 40, y: -110, r: -7 }, torso: { r: -5, sx: 0.97, sy: 1.04 }, head: { r: 4 },
      arms_hoe: { r: -ARM_MAX, x: -14, y: -14 }, leg_front: { r: -22 }, leg_back: { r: 18 },
      ear_up: { r: 16 }, ear_fold: { r: 18 }, pouch: { r: 12 }, tail: { r: 8 } };
    var fall = { root: { x: 66, y: -30, r: 6 }, torso: { r: 2 }, head: { r: -2 }, arms_hoe: { r: 2, x: 4 },
      leg_front: { r: -18 }, leg_back: { r: 14 }, ear_up: { r: 4 }, ear_fold: { r: 6 } };
    var slam = { root: { x: 80, y: 0, r: 15 }, torso: { r: 4, sx: 1.06, sy: 0.94 }, head: { r: -5 },
      arms_hoe: { r: ARM_MAX, x: 16, y: 12 }, leg_front: { r: -18 }, leg_back: { r: 14 },
      ear_up: { r: -18 }, ear_fold: { r: -20 }, pouch: { r: -12 }, tail: { r: -8 } };
    var slamHold = { root: { x: 80, r: 13 }, torso: { r: 3 }, head: { r: -4 }, arms_hoe: { r: 14, x: 14, y: 10 },
      leg_front: { r: -18 }, leg_back: { r: 14 }, ear_up: { r: -6 }, ear_fold: { r: -8 } };
    var skillEnd = { root: { x: 30, r: 4 }, torso: { r: 1 }, arms_hoe: { r: 4 }, leg_front: { r: -10 }, leg_back: { r: 8 } };
    var skill = { dur: 1.1, loop: false, blend: 0.08,
      keys: [K(0, ready), K(0.2, crouch, 'out'), K(0.42, jump, 'out'), K(0.54, fall, 'in'), K(0.62, slam, 'in'),
        K(0.66, slam, 'out'), K(0.86, slamHold, 'inout'), K(1.1, skillEnd, 'inout')],
      eyes: [{ t: 0, eye: 'normal' }, { t: 0.16, eye: 'angry' }, { t: 0.95, eye: 'normal' }],
      events: [{ t: 0.62, name: 'hit' }, { t: 0.62, name: 'shake' }] };

    // 피격 (0.55초): 맞는 순간 뒤로 젖혀지며 번쩍 → 버팀 → 제자리
    var hitPose = { root: { x: -44, r: -11, fl: 1 }, torso: { r: -7, sx: 1.03, sy: 0.96 }, head: { r: -12 },
      arms_hoe: { r: -8, x: -8, y: -4 }, leg_front: { r: 10 }, leg_back: { r: -6 },
      ear_up: { r: 16 }, ear_fold: { r: 18 }, pouch: { r: 10 }, tail: { r: 8 } };
    var hitHold = { root: { x: -50, r: -7, fl: 0.15 }, torso: { r: -4 }, head: { r: -6 }, arms_hoe: { r: -5, x: -4 },
      leg_front: { r: 6 }, leg_back: { r: -4 }, ear_up: { r: 6 }, ear_fold: { r: 8 } };
    var hit = { dur: 0.55, loop: false, blend: 0.03,
      keys: [K(0, {}), K(0.06, hitPose, 'out'), K(0.22, hitHold, 'inout'), K(0.55, {}, 'inout')],
      eyes: [{ t: 0, eye: 'hurt' }, { t: 0.42, eye: 'normal' }] };

    // 복귀(미리보기 연속 동작용): 뒤로 뛰어 착지
    var hop = { dur: 0.42, loop: false, blend: 0.08,
      keys: [K(0, { root: { r: 4 }, arms_hoe: { r: 3 } }),
        K(0.08, { root: { r: -4 }, torso: { sx: 1.04, sy: 0.95 }, leg_front: { r: -8 }, leg_back: { r: 8 } }, 'out'),
        K(0.22, { root: { y: -70, r: -8 }, torso: { r: -3 }, leg_front: { r: -16 }, leg_back: { r: 14 }, arms_hoe: { r: -8 },
          ear_up: { r: 10 }, ear_fold: { r: 12 }, pouch: { r: 8 } }, 'out'),
        K(0.34, { root: { y: 0, r: 0 }, torso: { sx: 1.04, sy: 0.95 } }, 'in'),
        K(0.42, {}, 'out')],
      eyes: [{ t: 0, eye: 'normal' }] };

    return { bind: { dur: 1, loop: true, keys: [K(0, {}), K(1, {})] },
      idle: idle, dash: dash, attack: attack, skill: skill, hit: hit, hop: hop };
  }

  R.farmer_rabbit = {
    base: 'images/battle/farmer_rabbit/',
    height: 1129,            // 귀 끝 ~ 발바닥 (기준 전신 px)
    anchor: [505, 1163],     // 발 밑 가운데 (화면에 놓는 기준점)
    rootPivot: [560, 930],   // 몸 전체 회전 중심 (엉덩이)
    eyeDefault: 'normal',
    armMax: ARM_MAX,         // 괭이 묶음 회전 한계 (시험에서 확인)
    fx: { blade: [1150, 715] }, // 괭이 날 끝 (흙 튐 위치 · 미리보기)
    parts: parts,
    springs: [
      { part: 'ear_up',   k: 110, d: 9,  gx: -0.007, max: 22 },
      { part: 'ear_fold', k: 80,  d: 7,  gx: -0.010, max: 26 },
      { part: 'tail',     k: 160, d: 10, gx: 0.003,  max: 10 },
      { part: 'pouch',    k: 120, d: 8,  gx: 0.004,  max: 10 }
    ],
    clips: clips()
  };
})();
