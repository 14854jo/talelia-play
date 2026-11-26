/* 두더지 광부 간이 리그 (좌표 = 기준 전신 battle_base.png 픽셀, 오른쪽을 봄)
 * 조각 그림: images/battle/mole_miner/  ← python tools/rig_parts.py docs/graphics/gacha/mole_miner/rig_parts.json
 * 간이 리그: 기준 전신 1장만 씀 · 동작 = data/rigs/_kit.js simpleClips (휘두르기 · 곡괭이 연타) · 재생기 = js/battle/rig.js
 * 아직 전투 화면에는 연결하지 않음 (미리보기 gacha-rig-preview.html 에서만 씀)
 */
(function () {
  'use strict';
  var R = window.TALELIA_RIGS = window.TALELIA_RIGS || {}, KIT = window.TALELIA_RIG_KIT;

  /* 조각: 몸 한 덩어리 + 무기(들어 올린 팔 + 손 + 곡괭이 · 어깨를 중심으로 내려찍음) + 눈 4종
   * 팔이 빠진 어깨 자리는 이웃 털로 메우고 둥근 외곽선을 그음 (팔이 움직일 때만 보임)
   */
  var parts = [
    { id: 'body',   img: 'body.png',   parent: null,   pivot: [630, 1000], at: [574, 645], rot: 0, z: 5 },
    { id: 'eye',    imgs: { normal: 'eye_normal.png', closed: 'eye_closed.png', angry: 'eye_angry.png', hurt: 'eye_hurt.png' },
                                        parent: 'body', pivot: [762, 401],  at: [762, 401], rot: 0, z: 9 },
    { id: 'weapon', img: 'weapon.png', parent: 'body', pivot: [500, 600],  at: [350, 383], rot: 0, z: 10 }
  ];
  var W_UP = -12, W_DOWN = 60;   // 곡괭이를 더 들어 올림 / 앞으로 내려찍음 (어깨를 중심으로 · 도)

  R.mole_miner = {
    base: 'images/battle/mole_miner/',
    height: 1011,            // 헬멧 꼭대기 ~ 발바닥 (곡괭이 제외 · 기준 전신 px)
    anchor: [630, 1198],     // 발 밑 가운데
    rootPivot: [630, 1000],
    eyeDefault: 'normal',
    armMax: Math.max(-W_UP, W_DOWN),
    fx: { weapon: 'weapon', tip: [575, 105] },   // 곡괭이 앞쪽 날 끝 (흙 튐 위치)
    parts: parts,
    springs: [],
    clips: KIT.simpleClips({ wUp: W_UP, wDown: W_DOWN, height: 1011, attack: 'swing', skill: 'combo' })
  };
})();
