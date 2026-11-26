/* 오리 견습 치유사 간이 리그 (좌표 = 기준 전신 battle_base.png 픽셀, 오른쪽을 봄)
 * 조각 그림: images/battle/duck_healer/  ← python tools/rig_parts.py docs/graphics/gacha/duck_healer/rig_parts.json
 * 간이 리그: 기준 전신 1장만 씀 · 동작 = data/rigs/_kit.js simpleClips (지팡이 톡 · 치유) · 재생기 = js/battle/rig.js
 * 아직 전투 화면에는 연결하지 않음 (미리보기 gacha-rig-preview.html 에서만 씀)
 */
(function () {
  'use strict';
  var R = window.TALELIA_RIGS = window.TALELIA_RIGS || {}, KIT = window.TALELIA_RIG_KIT;

  /* 조각: 몸 한 덩어리 + 무기(날개손 + 잎 달린 지팡이 · 손을 중심으로 돔) + 눈 4종
   * 손 · 지팡이가 빠진 소매 자리는 소매 끝처럼 둥글게 메우고 외곽선을 그음 (지팡이가 움직일 때만 보임)
   */
  var parts = [
    { id: 'body',   img: 'body.png',   parent: null,   pivot: [655, 1000], at: [599.5, 639.5], rot: 0, z: 5 },
    { id: 'eye',    imgs: { normal: 'eye_normal.png', closed: 'eye_closed.png', angry: 'eye_angry.png', hurt: 'eye_hurt.png' },
                                        parent: 'body', pivot: [731, 389],  at: [731, 389],     rot: 0, z: 9 },
    { id: 'weapon', img: 'weapon.png', parent: 'body', pivot: [325, 640],  at: [302, 640.5],   rot: 0, z: 10 }
  ];
  var W_UP = -15, W_DOWN = 22;   // 지팡이 끝을 뒤로 젖힘 / 앞으로 톡 (손을 중심으로 · 도)

  R.duck_healer = {
    base: 'images/battle/duck_healer/',
    height: 1107,            // 머리 깃털 ~ 발바닥 (기준 전신 px)
    anchor: [655, 1192],     // 발 밑 가운데
    rootPivot: [655, 1000],
    eyeDefault: 'normal',
    armMax: Math.max(-W_UP, W_DOWN),
    fx: { weapon: 'weapon', tip: [290, 150], ranged: true, projectile: '#9be08a' },   // 지팡이 잎 끝 · 뒷줄이라 제자리에서
    parts: parts,
    springs: [],
    clips: KIT.simpleClips({ wUp: W_UP, wDown: W_DOWN, height: 1107, attack: 'swing', skill: 'heal' })
  };
})();
