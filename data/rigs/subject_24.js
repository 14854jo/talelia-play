/* 실험체 24호 측면 전투 리그 (좌표 = 기준 전신 01_base.png 픽셀, 오른쪽을 봄)
 * 조각 그림: images/battle/s24/  (원본 · 검수 기록: docs/graphics/s24_battle/, 규격서 06_S24_BATTLE_PARTS_SPEC.md)
 * 재생기: js/battle/rig.js
 */
(function () {
  'use strict';
  var R = window.TALELIA_RIGS = window.TALELIA_RIGS || {};

  /* 조각 (기준 전신에서 직접 자른 b_* 가 눈에 보이는 부분, 생성 조각은 그 아래에 깔아 가려진 곳만 메움)
   * id, 그림, 부모, 관절(pivot), 그림 중심(at), 그림 회전(rot), 겹침(z: 작을수록 뒤), shade(먼 쪽 어둡게), def(평소 값)
   */
  var parts = [
    { id: 'cape_hang',   img: 'b_cape_low.png',   parent: 'torso',       pivot: [662, 1062], at: [662, 1084.5], rot: 0,   z: 0.5 },
    { id: 'cape_fly',    img: 'cape_fly.png',     parent: 'cape_top',    pivot: [700, 700],  at: [430, 880],    rot: 0,   z: 1, def: { a: 0 } },
    // 먼 팔: 기준 전신의 가슴 앞 주먹(당근 안 든 손). 어깨(망토 밑)를 중심으로 흔들림
    { id: 'arm_l',       img: 'b_fist.png',       parent: 'torso',       pivot: [585, 775],  at: [647.5, 804.5], rot: 0,  z: 8.5 },
    // 가방(생성): 먼 쪽 엉덩이 - 몸통 · 망토 뒤로 가려짐
    { id: 'pouch',       img: 'pouch.png',        parent: 'torso',       pivot: [540, 860],  at: [530, 880],    rot: 0,   z: 2.5, shade: 0.85, def: { a: 0 } },
    { id: 'leg_far',     img: 'b_leg_far.png',    parent: null,          pivot: [530, 1015], at: [483.5, 1111.5], rot: 0, z: 3 },
    { id: 'leg_near',    img: 'b_leg_near.png',   parent: null,          pivot: [790, 1015], at: [829.5, 1107.5], rot: 0, z: 7 },
    // 몸통 메움(생성): 지운 먼 팔 주먹 · 가까운 팔 · 가방 자리를 아래에서 채움
    { id: 'torso_fill',  img: 'torso.png',        parent: 'torso',       pivot: [690, 1040], at: [695, 865],    rot: 0,   z: 7.9 },
    { id: 'torso',       img: 'b_torso.png',      parent: null,          pivot: [690, 1040], at: [665.5, 906],  rot: 0,   z: 8 },
    { id: 'cape_front_fill', img: 'cape_front.png', parent: 'cape_front', pivot: [850, 700], at: [858, 860],    rot: -5,  z: 8.8,
      clip: [[835, 698], [908, 698], [918, 1075], [850, 1075], [838, 960]] }, // 기준 전신 앞자락 모양 안에서만 보이게
    { id: 'cape_front',  img: 'b_cape_front.png', parent: 'cape_top',    pivot: [860, 700],  at: [876.5, 876.5], rot: 0,  z: 9 },
    { id: 'arm_r_upper', img: 'b_arm_u.png',      parent: 'torso',       pivot: [855, 772],  at: [870.5, 809],  rot: 0,   z: 10 },
    { id: 'cape_top',    img: 'b_cape.png',       parent: 'torso',       pivot: [770, 665],  at: [497, 805.5],  rot: 0,   z: 11 },
    { id: 'tail',        img: 'b_tail.png',       parent: 'torso',       pivot: [470, 930],  at: [435.5, 928],  rot: 0,   z: 11.2 },
    { id: 'ear_near',    img: 'b_ears.png',       parent: 'head',        pivot: [700, 335],  at: [699.5, 197.5], rot: 0,  z: 11.5 },
    { id: 'head',        img: 'b_head.png',       parent: 'torso',       pivot: [760, 650],  at: [750.5, 491.5], rot: 0,  z: 12 },
    // 눈: 평소 = 기준 전신의 점 눈. 감은 눈 · 결의 눈(눈썹) · 아픔 눈은 생성 조각
    { id: 'eye',         imgs: { normal: 'b_eye.png', closed: 'eye_closed.png', angry: 'eye_angry.png', hurt: 'eye_hurt.png' },
                                                  parent: 'head',        pivot: [863, 521],  at: [863.5, 521],  rot: 0,   z: 13 },
    // 가까운 팔 아랫부분 + 쥔 손 + 당근 (기준 전신에서 한 조각으로)
    { id: 'arm_r_fore',  img: 'b_fore.png',       parent: 'arm_r_upper', pivot: [878, 830],  at: [968.5, 927],  rot: 0,   z: 15 }
  ];
  /* 동작. 값은 기본 자세에서 바뀌는 양: r 도(시계 방향 +), x·y 기준 전신 px, sx·sy 배율
   * 팔·다리 방향 참고: 아래를 향한 조각에 r 음수 = 앞(오른쪽)으로, r 양수 = 뒤로
   * ease: 'smooth'(키를 멈추지 않고 지나감) · 'in'(점점 빠르게, 휘두르기) · 'out'(빠르게 시작해 멈춤) · 'inout' · 'outback'(살짝 넘었다 돌아옴)
   */
  function clips() {
    function K(t, p, ease) { return { t: t, p: p, ease: ease }; }

    // 대기: 1.8초 숨쉬기. 몸이 위로 늘었다 줄고, 머리 · 팔 · 당근 · 귀 · 꼬리가 반 박자 늦게 따라감
    var idleA = {
      root: {}, torso: {}, head: { r: 0 }, arm_r_upper: { r: 0 }, arm_r_fore: { r: 0 }, arm_l: { r: 0 },
      ear_near: { r: 0 }, ear_far: { r: 0 }, tail: { r: 0 }, cape_top: { r: 0 }, cape_hang: { r: 0 }
    };
    var idleB = {
      root: {}, torso: { sy: 1.022, sx: 0.992 }, head: { r: -1.6, y: -2 }, arm_r_upper: { r: 3 }, arm_r_fore: { r: -7 },
      arm_l: { r: -4 }, ear_near: { r: -3 }, ear_far: { r: -4.5 }, tail: { r: 5 }, cape_top: { r: 1.5 }, cape_hang: { r: 3 }
    };
    var idle = { dur: 1.8, loop: true, ease: 'smooth', blend: 0.25,
      keys: [K(0, idleA), K(0.9, idleB), K(1.8, idleA)],
      eyes: [{ t: 0, eye: 'normal' }, { t: 1.45, eye: 'closed' }, { t: 1.56, eye: 'normal' }] };

    // 돌진: 0.44초에 두 걸음. 몸을 앞으로 기울이고, 당근은 뒤로 빼 들고, 망토 자락을 펼침. 다리가 짧아 보폭은 작게
    function run(legN, legF, armL, y, sq) {
      return {
        root: { r: 11, y: y }, torso: { r: 2, sy: sq, sx: 2 - sq }, head: { r: -7 },
        leg_near: { r: legN }, leg_far: { r: legF },
        arm_l: { r: armL }, arm_r_upper: { r: 62 - armL * 0.15 }, arm_r_fore: { r: 44 },
        ear_near: { r: -16 }, ear_far: { r: -18 }, tail: { r: -8 },
        cape_top: { r: 8 }, cape_fly: { a: 1, r: 4 }, cape_hang: { r: 22 }, cape_front: { r: 10 }
      };
    }
    var dash = { dur: 0.44, loop: true, ease: 'smooth', blend: 0.1,
      keys: [
        K(0,    run(-28, 20, 38, 0, 0.97)),
        K(0.11, run(-4, -3, 0, -26, 1.03)),
        K(0.22, run(22, -28, -38, 0, 0.97)),
        K(0.33, run(-3, -4, 0, -26, 1.03)),
        K(0.44, run(-28, 20, 38, 0, 0.97))
      ],
      eyes: [{ t: 0, eye: 'normal' }] };

    // 기본 공격(횡베기): 뒤로 크게 감아올렸다가(0.15) 가로로 한 번에 베고(0.24 = 맞는 순간) 앞으로 휘두른 채 멈췄다 돌아옴
    var ready = { root: { r: 6 }, torso: { r: 2 }, arm_r_upper: { r: 30 }, arm_r_fore: { r: -5 }, cape_fly: { a: 1, r: 2 } };
    var windup = {
      root: { x: -14, r: -5 }, torso: { r: -6, sx: 0.98, sy: 1.02 }, head: { r: 4 },
      arm_r_upper: { r: 125 }, arm_r_fore: { r: 32 },
      arm_l: { r: -38 }, leg_near: { r: -10 }, leg_far: { r: 10 },
      cape_top: { r: -3 }, cape_fly: { a: 1, r: -2 }, ear_near: { r: 6 }, ear_far: { r: 6 }
    };
    var strike = {
      root: { x: 40, r: 12 }, torso: { r: 8, sx: 1.03, sy: 0.97 }, head: { r: -5 },
      arm_r_upper: { r: -58 }, arm_r_fore: { r: 14 },
      arm_l: { r: 58 }, leg_near: { r: -18 }, leg_far: { r: 16 },
      cape_top: { r: 9 }, cape_fly: { a: 1, r: 8 }, cape_hang: { r: 16 }, ear_near: { r: -14 }, ear_far: { r: -16 }
    };
    // 휘두르는 도중: 손은 가슴 앞까지 왔고 당근은 아직 뒤로 끌려옴(가로로 도는 느낌)
    var sweep = {
      root: { x: 18, r: 6 }, torso: { r: 3 }, head: { r: -2 },
      arm_r_upper: { r: 38 }, arm_r_fore: { r: 70 },
      arm_l: { r: 20 }, leg_near: { r: -14 }, leg_far: { r: 12 },
      cape_top: { r: 4 }, cape_fly: { a: 1, r: 3 }, ear_near: { r: -4 }, ear_far: { r: -4 }
    };
    var follow = {
      root: { x: 46, r: 10 }, torso: { r: 9 }, head: { r: -4 },
      arm_r_upper: { r: -92 }, arm_r_fore: { r: -10 },
      arm_l: { r: 62 }, leg_near: { r: -18 }, leg_far: { r: 16 },
      cape_top: { r: 10 }, cape_fly: { a: 1, r: 9 }, cape_hang: { r: 20 }, ear_near: { r: -10 }, ear_far: { r: -12 }
    };
    var settle = {
      root: { x: 20, r: 5 }, torso: { r: 3 }, arm_r_upper: { r: -20 }, arm_r_fore: { r: -6 },
      arm_l: { r: 12 }, leg_near: { r: -12 }, leg_far: { r: 10 }, cape_fly: { a: 0 }
    };
    var attack = { dur: 0.7, loop: false, blend: 0.06,
      keys: [
        K(0,    ready),
        K(0.15, windup, 'out'),
        K(0.19, windup, 'inout'),
        K(0.215, sweep, 'in'),
        K(0.24, strike, 'out'),
        K(0.38, follow, 'out'),
        K(0.52, follow, 'inout'),
        K(0.7,  settle, 'inout')
      ],
      eyes: [{ t: 0, eye: 'normal' }, { t: 0.17, eye: 'angry' }, { t: 0.46, eye: 'normal' }], // 결의 눈은 베는 순간에만
      events: [{ t: 0.24, name: 'hit' }] };

    // 피격: 맞는 순간 뒤로 젖혀지며 번쩍(0.06), 버티다가(0.22) 제자리로
    var hitPose = {
      root: { x: -44, r: -11, fl: 1 }, torso: { r: -7, sx: 1.03, sy: 0.96 }, head: { r: -12 },
      arm_r_upper: { r: 34 }, arm_r_fore: { r: 28 }, arm_l: { r: 30 },
      leg_near: { r: 10 }, leg_far: { r: -6 }, ear_near: { r: 14 }, ear_far: { r: 16 }, cape_top: { r: -6 }, cape_hang: { r: -10 }
    };
    var hitHold = {
      root: { x: -50, r: -7, fl: 0.15 }, torso: { r: -4 }, head: { r: -6 },
      arm_r_upper: { r: 18 }, arm_r_fore: { r: 13 }, arm_l: { r: 16 },
      leg_near: { r: 6 }, leg_far: { r: -4 }, ear_near: { r: 6 }, ear_far: { r: 8 }
    };
    var hit = { dur: 0.55, loop: false, blend: 0.03,
      keys: [K(0, {}), K(0.06, hitPose, 'out'), K(0.22, hitHold, 'inout'), K(0.55, {}, 'inout')],
      eyes: [{ t: 0, eye: 'hurt' }, { t: 0.42, eye: 'normal' }] };

    // 복귀(미리보기 연속 동작용): 뒤로 뛰어 착지
    var hop = { dur: 0.42, loop: false, blend: 0.08,
      keys: [
        K(0,    { root: { r: 4 }, arm_r_upper: { r: -10 } }),
        K(0.08, { root: { r: -4 }, torso: { sx: 1.04, sy: 0.95 }, leg_near: { r: -8 }, leg_far: { r: 8 } }, 'out'),
        K(0.22, { root: { y: -70, r: -8 }, torso: { r: -3 }, leg_near: { r: -16 }, leg_far: { r: 14 }, arm_l: { r: 30 }, arm_r_upper: { r: 20 }, ear_near: { r: 10 }, ear_far: { r: 12 }, cape_hang: { r: -12 } }, 'out'),
        K(0.34, { root: { y: 0, r: 0 }, torso: { sx: 1.04, sy: 0.95 } }, 'in'),
        K(0.42, {}, 'out')
      ],
      eyes: [{ t: 0, eye: 'normal' }] };

    return {
      bind: { dur: 1, loop: true, keys: [K(0, {}), K(1, {})] },
      idle: idle, dash: dash, attack: attack, hit: hit, hop: hop
    };
  }

  R.subject_24 = {
    base: 'images/battle/s24/',
    height: 1190,            // 귀 끝 ~ 발바닥 (기준 전신 px)
    anchor: [670, 1215],     // 발 밑 가운데 (화면에 놓는 기준점)
    rootPivot: [690, 1000],  // 몸 전체 회전 중심 (엉덩이)
    eyeDefault: 'normal',
    parts: parts,
    // 관성: 몸이 가로로 움직이는 속도(px/s)에 늦게 따라오는 회전. gx = 속도 1px/s 당 각도(도)
    springs: [
      { part: 'cape_top',   k: 70,  d: 9,  gx: 0.006,  max: 16 },
      { part: 'cape_hang',  k: 55,  d: 7,  gx: 0.012,  max: 32 },
      { part: 'cape_front', k: 90,  d: 10, gx: 0.008,  max: 18 },
      { part: 'cape_fly',   k: 60,  d: 7,  gx: 0.006,  max: 14 },
      { part: 'ear_near',   k: 110, d: 9,  gx: -0.007, max: 22 },
      { part: 'tail',       k: 160, d: 10, gx: 0.003,  max: 10 }
    ],
    clips: clips()
  };
})();
