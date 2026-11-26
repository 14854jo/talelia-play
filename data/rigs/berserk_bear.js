/* 광폭화 곰 전체 리그 (좌표 = 기준 전신 bear_base_v1_full.png 1199×1312 픽셀, 오른쪽을 봄)
 * 조각 그림: images/battle/berserk_bear/  ← python tools/rig_parts.py docs/graphics/gacha/bear/rig_parts.json
 * 낱개 부위 그림을 기준 전신에 맞춰 배치한 조각 (기준 전신에서 오려 내지 않음) · 판단 기록 = docs/graphics/gacha/bear/RIG_NOTES.md
 * 재생기 = js/battle/rig.js · 아직 전투 화면에는 연결하지 않음 (미리보기 gacha-rig-preview.html 에서만 씀)
 */
(function () {
  'use strict';
  var R = window.TALELIA_RIGS = window.TALELIA_RIGS || {};
  function K(t, p, ease) { return { t: t, p: p, ease: ease }; }   // _kit.js 없이도 읽힘 (tools/rig_shrink.py 는 리그 파일만 불러옴)

  /* 조각 (부위 그림 v2): 먼 팔(몸 뒤 · 오른쪽 앞발 = 치는 팔)과 가까운 팔(가슴 앞 주먹)은 윗팔 → 주먹 2마디 · 둥근 털 덩어리라 단면 없음
   * 팔꿈치는 ±15° 안 · 큰 호는 어깨 회전 + 몸 기울기 · 점프로 만듦
   * 어깨 기준점은 몸통 안쪽 어깨 · 가까운 팔 = 몸통 앞 층 · 먼 팔 = 몸통 뒤 층 · 꼬리는 엉덩이 쪽 기준점으로 몸통 · 뒷다리 뒤에 반쯤 가려짐
   * 머리 아래 목털이 몸통 윗부분을 덮어 목 이음매가 가려짐 (덮개 조각 없음)
   * 포효 입(bear_roar)은 평소 숨김(def a:0) · 필살기에서만 켬 → PDEF 를 함께 쓰므로 접두어 id
   */
  var parts = [
    { id: 'ear_far',        img: 'ear_far.png',        parent: 'head',           pivot: [835, 262],  at: [833, 212],     rot: 0, z: 1 },
    { id: 'tail',           img: 'tail.png',           parent: 'torso',          pivot: [400, 900],  at: [322, 897.5],   rot: 0, z: 2 },
    { id: 'arm_far_upper',  img: 'arm_far_upper.png',  parent: 'torso',          pivot: [820, 650],  at: [870, 700.5],   rot: 0, z: 3 },
    { id: 'arm_far_fore',   img: 'arm_far_fore.png',   parent: 'arm_far_upper',  pivot: [900, 740],  at: [978, 723],   rot: 0, z: 4 },
    { id: 'leg_back',       img: 'leg_back.png',       parent: null,             pivot: [430, 930],  at: [380, 1060],    rot: 0, z: 5 },
    { id: 'leg_front',      img: 'leg_front.png',      parent: null,             pivot: [810, 960],  at: [875, 1080],    rot: 0, z: 6 },
    { id: 'torso',          img: 'torso.png',          parent: null,             pivot: [660, 960],  at: [679.5, 770],   rot: 0, z: 7 },
    { id: 'head',           img: 'head.png',           parent: 'torso',          pivot: [690, 630],  at: [637.5, 442.5], rot: 0, z: 8 },
    { id: 'ear_near',       img: 'ear_near.png',       parent: 'head',           pivot: [620, 250],  at: [604.5, 186],   rot: 0, z: 9 },
    // 눈 2개 (가까운 눈 · 먼 눈) · 평소 = calm · 감음 = closed · 화남 = angry · 아픔 = hit
    { id: 'eye',            imgs: { normal: 'eye_normal.png', closed: 'eye_closed.png', angry: 'eye_angry.png', hurt: 'eye_hurt.png' },
                                                       parent: 'head',           pivot: [790.5, 397.5], at: [790.5, 397.5], rot: 0, z: 10 },
    { id: 'eye_far',        imgs: { normal: 'eye_far_normal.png', closed: 'eye_far_closed.png', angry: 'eye_far_angry.png', hurt: 'eye_far_hurt.png' },
                                                       parent: 'head',           pivot: [877.5, 407.5], at: [877.5, 407.5], rot: 0, z: 9.5 },
    // 입: 눈 상태를 따라 바뀜 (감음 = 평소 입 · 평소 입은 그림이 없어 선으로 그린 임시본)
    { id: 'mouth',          imgs: { normal: 'mouth_normal.png', closed: 'mouth_normal.png', angry: 'mouth_angry.png', hurt: 'mouth_hurt.png' },
                                                       parent: 'head',           pivot: [878, 523],  at: [878, 523],     rot: 0, z: 11 },
    { id: 'bear_roar',      img: 'mouth_roar.png',     parent: 'head',           pivot: [871.5, 530.5], at: [871.5, 530.5], rot: 0, z: 11.1, def: { a: 0 } },
    { id: 'arm_near_upper', img: 'arm_near_upper.png', parent: 'torso',          pivot: [465, 650],  at: [349.5, 719.5],   rot: 0, z: 12 },
    { id: 'arm_near_fore',  img: 'arm_near_fore.png',  parent: 'arm_near_upper', pivot: [370, 730],  at: [449.5, 706.5],     rot: 0, z: 13 }
  ];

  /* 동작. 값은 기본 자세에서 바뀌는 양: r 도(시계 방향 +), x·y 기준 전신 px, sx·sy 배율
   * 어깨 r: − = 팔이 들림 (먼 팔 · 가까운 팔 모두) · 팔꿈치(arm_*_fore) r: ±ELBOW 안
   * 몸통 · root r: + = 앞(오른쪽)으로 기울임 · 다리 r: − = 발이 앞으로
   */
  var ELBOW = 15;
  function clips() {
    // 대기 (1.8초): 무겁게 숨쉬기 · 어깨가 들썩 · 귀 · 꼬리는 반 박자 늦게(관성)
    var idleA = { root: {}, torso: {}, head: { r: 0 }, arm_far_upper: { r: 0 }, arm_near_upper: { r: 0 }, arm_far_fore: { r: 0 }, arm_near_fore: { r: 0 } };
    var idleB = { root: {}, torso: { sy: 1.022, sx: 0.99 }, head: { r: -1.5, y: -4 }, arm_far_upper: { r: -3, y: -3 }, arm_far_fore: { r: -2 },
      arm_near_upper: { r: -2, y: -4 }, arm_near_fore: { r: -2 }, ear_near: { r: -2 }, ear_far: { r: 2 } };
    var idle = { dur: 1.8, loop: true, ease: 'smooth', blend: 0.25, keys: [K(0, idleA), K(0.9, idleB), K(1.8, idleA)],
      eyes: [{ t: 0, eye: 'normal' }, { t: 1.4, eye: 'closed' }, { t: 1.51, eye: 'normal' }] };

    // 돌진 (0.5초에 두 걸음): 몸을 앞으로 숙이고 쿵쿵 · 팔은 반대로 흔듦
    function run(f, b, y, sq, arm) {
      return { root: { r: 10, y: y }, torso: { r: 2, sy: sq, sx: 2 - sq }, head: { r: -6 }, leg_front: { r: f }, leg_back: { r: b },
        arm_far_upper: { r: -6 + arm }, arm_far_fore: { r: -4 }, arm_near_upper: { r: -4 - arm }, arm_near_fore: { r: -4 }, tail: { r: -6 } };
    }
    var dash = { dur: 0.5, loop: true, ease: 'smooth', blend: 0.1,
      keys: [K(0, run(-20, 16, 0, 0.96, 8)), K(0.125, run(-2, -2, -26, 1.03, 0)), K(0.25, run(16, -20, 0, 0.96, -8)),
        K(0.375, run(-2, -2, -26, 1.03, 0)), K(0.5, run(-20, 16, 0, 0.96, 8))],
      eyes: [{ t: 0, eye: 'angry' }] };

    // 기본 공격 · 앞발 내려치기 (0.75초 · 0.3 = 맞는 순간): 먼 앞발을 높이 들며 몸을 뒤로 → 내디디며 내려침
    var ready = { root: { r: 2 }, arm_far_upper: { r: -4 } };
    var windup = { root: { x: -14, r: -7 }, torso: { r: -4, sx: 0.98, sy: 1.03 }, head: { r: 4 },
      arm_far_upper: { r: -32, y: -6 }, arm_far_fore: { r: -ELBOW }, arm_near_upper: { r: -10 }, arm_near_fore: { r: -6 },
      leg_front: { r: -6 }, leg_back: { r: 6 } };
    var swing = { root: { x: 14, r: 4 }, torso: { r: 1 }, head: { r: -1 }, arm_far_upper: { r: -10 }, arm_far_fore: { r: 0 },
      arm_near_upper: { r: -4 }, leg_front: { r: -10 }, leg_back: { r: 8 } };
    var strike = { root: { x: 46, r: 13 }, torso: { r: 3, sx: 1.04, sy: 0.96 }, head: { r: -5 },
      arm_far_upper: { r: 26, y: 6 }, arm_far_fore: { r: ELBOW }, arm_near_upper: { r: 6 }, arm_near_fore: { r: 6 },
      leg_front: { r: -16 }, leg_back: { r: 12 }, tail: { r: -6 } };
    var follow = { root: { x: 48, r: 11 }, torso: { r: 3 }, head: { r: -3 }, arm_far_upper: { r: 22, y: 4 }, arm_far_fore: { r: 12 },
      arm_near_upper: { r: 4 }, leg_front: { r: -16 }, leg_back: { r: 12 } };
    var settle = { root: { x: 20, r: 4 }, torso: { r: 1 }, arm_far_upper: { r: 6 }, arm_far_fore: { r: 4 }, leg_front: { r: -10 }, leg_back: { r: 8 } };
    var attack = { dur: 0.75, loop: false, blend: 0.06,
      keys: [K(0, ready), K(0.18, windup, 'out'), K(0.22, windup, 'inout'), K(0.27, swing, 'in'), K(0.3, strike, 'out'),
        K(0.42, follow, 'out'), K(0.55, follow, 'inout'), K(0.75, settle, 'inout')],
      eyes: [{ t: 0, eye: 'normal' }, { t: 0.12, eye: 'angry' }, { t: 0.6, eye: 'normal' }],
      events: [{ t: 0.3, name: 'hit' }] };

    // 필살기 · 두 앞발 내려찍기 (1.25초 · 0.74 = 맞는 순간 · 흔들림)
    //  몸을 일으켜(뒤로 젖힘 · 키가 커짐) 포효하며 두 앞발을 높이 듦 → 작게 뛰어 앞으로 → 두 앞발로 내려찍음
    //  포효 입: 키에 bear_roar a:1 · mouth a:0 을 적은 구간만 (a 는 구간 가운데에서 한 번에 바뀜)
    //  먼 팔은 몸 뒤 층이라 너무 높이 들면 머리에 가려짐 → 어깨 −34° (앞발이 얼굴 앞 위로) + 몸을 젖혀 높이를 더함
    var rise = { root: { x: -10, y: -14, r: -10 }, torso: { r: -6, sx: 0.97, sy: 1.06 }, head: { r: 6, y: -6 },
      arm_far_upper: { r: -34, y: -14 }, arm_far_fore: { r: -ELBOW }, arm_near_upper: { r: -50, y: -14 }, arm_near_fore: { r: -ELBOW },
      leg_front: { r: -4 }, leg_back: { r: 4 }, tail: { r: 6 }, bear_roar: { a: 1 }, mouth: { a: 0 } };
    var crouch = { root: { r: -2, y: 8 }, torso: { r: -2, sx: 1.05, sy: 0.94 }, head: { r: 3 }, arm_far_upper: { r: -14 }, arm_near_upper: { r: -12 },
      leg_front: { r: -8 }, leg_back: { r: 8 } };
    var jump = { root: { x: 46, y: -70, r: -6 }, torso: { r: -4, sy: 1.04 }, head: { r: 4 },
      arm_far_upper: { r: -32, y: -10 }, arm_far_fore: { r: -12 }, arm_near_upper: { r: -48, y: -10 }, arm_near_fore: { r: -12 },
      leg_front: { r: -18 }, leg_back: { r: 16 }, bear_roar: { a: 1 }, mouth: { a: 0 } };
    var slam = { root: { x: 84, y: 0, r: 16 }, torso: { r: 5, sx: 1.07, sy: 0.93 }, head: { r: -6 },
      arm_far_upper: { r: 32, y: 8 }, arm_far_fore: { r: ELBOW }, arm_near_upper: { r: 26, y: 8 }, arm_near_fore: { r: ELBOW },
      leg_front: { r: -18 }, leg_back: { r: 14 }, tail: { r: -8 }, bear_roar: { a: 1 }, mouth: { a: 0 } };
    var slamHold = { root: { x: 84, r: 14 }, torso: { r: 4 }, head: { r: -4 }, arm_far_upper: { r: 28, y: 6 }, arm_far_fore: { r: 13 },
      arm_near_upper: { r: 22, y: 6 }, arm_near_fore: { r: 12 }, leg_front: { r: -18 }, leg_back: { r: 14 } };
    var skillEnd = { root: { x: 30, r: 4 }, torso: { r: 1 }, arm_far_upper: { r: 6 }, arm_near_upper: { r: 4 }, leg_front: { r: -10 }, leg_back: { r: 8 } };
    var skill = { dur: 1.25, loop: false, blend: 0.08,
      keys: [K(0, ready), K(0.12, crouch, 'out'), K(0.36, rise, 'out'), K(0.5, rise, 'inout'), K(0.62, jump, 'out'),
        K(0.74, slam, 'in'), K(0.78, slam, 'out'), K(0.98, slamHold, 'inout'), K(1.25, skillEnd, 'inout')],
      eyes: [{ t: 0, eye: 'normal' }, { t: 0.1, eye: 'angry' }, { t: 1.1, eye: 'normal' }],
      events: [{ t: 0.74, name: 'hit' }, { t: 0.74, name: 'shake' }] };

    // 피격 (0.55초): 뒤로 젖혀지며 번쩍 → 버팀 → 제자리
    var hitPose = { root: { x: -42, r: -10, fl: 1 }, torso: { r: -6, sx: 1.03, sy: 0.96 }, head: { r: -12 },
      arm_far_upper: { r: -16 }, arm_far_fore: { r: -8 }, arm_near_upper: { r: -12 }, arm_near_fore: { r: -8 },
      leg_front: { r: 10 }, leg_back: { r: -6 }, tail: { r: 8 } };
    var hitHold = { root: { x: -48, r: -6, fl: 0.15 }, torso: { r: -3 }, head: { r: -6 }, arm_far_upper: { r: -8 }, arm_near_upper: { r: -6 },
      leg_front: { r: 6 }, leg_back: { r: -4 } };
    var hit = { dur: 0.55, loop: false, blend: 0.03,
      keys: [K(0, {}), K(0.06, hitPose, 'out'), K(0.22, hitHold, 'inout'), K(0.55, {}, 'inout')],
      eyes: [{ t: 0, eye: 'hurt' }, { t: 0.42, eye: 'normal' }] };

    // 복귀: 뒤로 무겁게 뛰어 착지
    var hop = { dur: 0.45, loop: false, blend: 0.08,
      keys: [K(0, { root: { r: 4 } }), K(0.08, { root: { r: -4 }, torso: { sx: 1.05, sy: 0.94 }, leg_front: { r: -8 }, leg_back: { r: 8 } }, 'out'),
        K(0.24, { root: { y: -55, r: -7 }, torso: { r: -3 }, leg_front: { r: -14 }, leg_back: { r: 12 }, arm_far_upper: { r: -10 }, arm_near_upper: { r: -8 } }, 'out'),
        K(0.36, { root: { y: 0, r: 0 }, torso: { sx: 1.06, sy: 0.93 } }, 'in'), K(0.45, {}, 'out')],
      eyes: [{ t: 0, eye: 'normal' }] };

    return { bind: { dur: 1, loop: true, keys: [K(0, {}), K(1, {})] }, idle: idle, dash: dash, attack: attack, skill: skill, hit: hit, hop: hop };
  }

  R.berserk_bear = {
    base: 'images/battle/berserk_bear/',
    height: 1129,            // 가까운 귀 끝(107) ~ 발바닥 (기준 전신 px)
    anchor: [625, 1236],     // 발 밑 가운데
    rootPivot: [660, 960],   // 엉덩이
    eyeDefault: 'normal',
    armMax: ELBOW,           // 치는 팔(먼 앞발) 팔꿈치 회전 한계
    fx: { weapon: 'arm_far_fore', tip: [1100, 700] },   // 먼 앞발 끝 (흙 튐 위치)
    parts: parts,
    springs: [
      { part: 'ear_near', k: 120, d: 9,  gx: -0.006, max: 14 },
      { part: 'ear_far',  k: 120, d: 9,  gx: -0.006, max: 14 },
      { part: 'tail',     k: 140, d: 9,  gx: 0.004,  max: 12 }
    ],
    clips: clips()
  };
})();
