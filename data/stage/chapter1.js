/* =====================================================================
 * TALELIA · 1장 스테이지 데이터 (docs/design/stage-system.md · S1 · 모든 수치 = 제안 · 임시값)
 *
 *  - 규칙 코드: js/stage/rules.js (순수 함수) · 진행 저장: 뽑기 저장 v4 의 stage { cleared, open, runs, seq, guide, intro }
 *  - 1장 = 전투 6개 (1-1 ~ 1-6) · 전투 안에서 이야기 진행 · 대사는 전투 전후에만 (대본은 data/story/scenes/chapter1.js · S3)
 *  - 보상은 첫 클리어 때만 (정령석 · 골드) · 다시 보기(기록 보관소)는 이번 범위 아님
 *  - 1장 적에는 상태이상이 없고, 스토리 전투에는 장비를 적용하지 않음 (equipment-dungeon.md 5장)
 *  - battle-proto.js 의 allies · enemies · encounters 는 바꾸지 않음 (기준 로그 46개) → 적 종류는 여기에서 따로 정의
 *
 *  enemyTypes  : 적 종류 (능력치 = 기본값 · 스테이지 배율 s 와 변이 배율 mutant 를 곱해 전투 데이터를 만듦)
 *    img        = 적 그림 (S2 에서 docs/graphics/enemies 원본 → renewal/images/battle/enemies 로 연결 · 없으면 shape · color 임시 도형)
 *    placeholder= true 면 그림이 아직 없는 자리 (이름표에 "디자인 준비 중")
 *  V3 다시 맞춤(120명 × 25판 · 평균 / 하위 10%): 1-1 100 / 100 (s 1.2 고정) · 1-2 97.8 / 96 · 1-3 95.3 / 92 · 1-4 91.7 / 76 · 1-5 90.3 / 80 · 1-6 85.3 / 60
 *  V3 (밸런스 v3 · V4): 적 기본 체력 × 0.8 · 공격 × 1.15 (체력 대비 공격 비율을 높임 · 승률이 그대로가 되게 s 를 다시 맞춤 · 아래 표)
 *  stages[].s  : 스테이지 세기 배율 (S2 제안값 · 승인 후 확정) = 시작 상태 6명(10회 뽑기 1번 + 스토리 3종 · 장비 없음) 120명 × 25판 자동 전투로 맞춤
 *    측정(평균 / 하위 10%): 1-1 100 / 100 · 1-2 98 / 92 · 1-3 94.4 / 80 · 1-4 92.7 / 72 · 1-5 89.8 / 68 · 1-6 86.3 / 44  (1-1 은 튜토리얼이라 s 1.2 고정)
 *    목표 승률(제안): 1-1 100% · 1-2 98% · 1-3 95% · 1-4 92% · 1-5 90% · 1-6 85%
 *  stages[].wave = [ [종류, 줄(row), 칸(slot 0 위 · 1 가운데 · 2 아래), { 덮어쓸 값 }] … ]  (전투 6자리 = 전열 3 · 후열 3)
 *  mutant      : 변이 배율 (제안) · 변이 해충은 같은 그림 + 이름 앞 "변이" (색 필터는 S2)
 * ===================================================================== */
(function(){
  'use strict';
  window.TALELIA_STAGE = {
    version: 1,
    chapter: { id: 1, title: '1장 (가제)' },
    rewardRev: 3,                                   // 보상 분배 판 (3 = 초월석 추가 · 2 = 정령석 300 × 5 + 1,500 = 3,000 · 1 = 옛 분배 2,550) · 기존 저장의 차액 보충 = js/stage/reward-fix.js
    legacyStones: { '1-1': 150, '1-2': 150, '1-3': 300, '1-4': 150, '1-5': 300, '1-6': 1500 },   // 판 1 의 첫 클리어 정령석 (차액 계산용 · 바꾸지 말 것)
    last: '1-6',                                    // 이 스테이지를 처음 클리어하면 던전 개방
    mutant: { hp: 1.3, atk: 1.3 },                  // 변이 배율 (제안)
    enemyTypes: {
      cabbage_worm: { name: '배추벌레', img: 'images/battle/enemies/enemy_cabbage_worm.webp', shape: 'circle', color: '#7a9a4a', hp: 800, atk: 138, def: 20, spd: 80, skills: ['atk_basic'] },
      snail:        { name: '달팽이',   img: 'images/battle/enemies/enemy_snail.webp',        shape: 'circle', color: '#9a7a5a', hp: 1120, atk: 161, def: 60, spd: 60, skills: ['atk_basic'] },
      grasshopper:  { name: '메뚜기',   img: 'images/battle/enemies/enemy_grasshopper.webp',  shape: 'circle', color: '#6a9a3a', hp: 720, atk: 253, def: 20, spd: 120, skills: ['atk_basic'] },
      moth:         { name: '나방',     img: 'images/battle/enemies/enemy_moth.webp',         shape: 'circle', color: '#a09080', hp: 672, atk: 207, def: 20, spd: 100, skills: ['atk_basic', 'aoe_snipe'] },
      scarab_chief: { name: '풍뎅이 우두머리', img: 'images/battle/enemies/boss_beetle_chief.webp', shape: 'square', color: '#5a4a3a', hp: 1280, atk: 207, def: 60, spd: 85, skills: ['atk_basic'] },   // 1-4 중간 보스 (N4 · 능력치는 예전 기계 자리 그대로 · 그림은 기존 딱정벌레 대장 그림을 임시로)
      retriever:    { name: '회수 기계', img: 'images/battle/enemies/enemy_retriever_boss.webp', shape: 'square', color: '#6b5a6e', hp: 4800, atk: 322, def: 60, spd: 75, skills: ['atk_basic', 'ult_walnut'], boss: true },   // 1장 보스 (N4 · 능력치는 예전 딱정벌레 대장 그대로 · 등에 텅 빈 철창 · 외형 설계 추후 · 지금은 임시 도형)
      machine:      { name: '연구소 기계', img: 'images/battle/enemies/enemy_guard.webp', shape: 'square', color: '#6f7d8a', hp: 1280, atk: 207, def: 60, spd: 85, skills: ['atk_basic'] },                       // 경비 기계 그림 (enemy_guard)
      robot:        { name: '로봇',     img: 'images/battle/enemies/enemy_scout.webp', shape: 'square', color: '#8a6f5a', hp: 1120, atk: 184, def: 50, spd: 90, skills: ['atk_basic'] }                        // 1-2 마더를 습격하는 로봇 · 임시 도형 (그림이 생기면 img 만 교체)
    },
    stages: [
      { id: '1-1', n: 1, title: '해충 퇴치', place: 'farm_field', s: 1.2, reward: { stones: 300, gold: 1000, tstones: 2 },
        wave: [['cabbage_worm', 'front', 0], ['cabbage_worm', 'front', 1], ['cabbage_worm', 'front', 2]] },
      { id: '1-2', n: 2, title: '밭의 불청객', place: 'farm_field', s: 2.121, reward: { stones: 300, gold: 1000, tstones: 2 },
        wave: [['cabbage_worm', 'front', 0], ['robot', 'front', 1], ['cabbage_worm', 'front', 2], ['grasshopper', 'back', 1]] },
      { id: '1-3', n: 3, title: '들판의 해충들', place: 'meadow', s: 1.821, reward: { stones: 300, gold: 1000, tstones: 2 },
        wave: [['snail', 'front', 0], ['snail', 'front', 2], ['grasshopper', 'back', 0], ['grasshopper', 'back', 2]] },
      { id: '1-4', n: 4, title: '상류의 통', place: 'stream_upper', s: 1.854, reward: { stones: 300, gold: 1000, tstones: 2 },
        wave: [['cabbage_worm', 'front', 0, { mutant: true }], ['scarab_chief', 'front', 1], ['cabbage_worm', 'front', 2, { mutant: true }], ['moth', 'back', 1]] },
      { id: '1-5', n: 5, title: '마을 습격', place: 'village_dusk', s: 1.191, reward: { stones: 300, gold: 1000, tstones: 2 },
        wave: [['machine', 'front', 0], ['snail', 'front', 1, { mutant: true }], ['machine', 'front', 2], ['grasshopper', 'back', 0, { mutant: true }], ['grasshopper', 'back', 2, { mutant: true }]] },
      { id: '1-6', n: 6, title: '회수 기계', place: 'village_fire', s: 0.893, reward: { stones: 1500, gold: 1000, tstones: 5 },
        wave: [['machine', 'front', 0], ['retriever', 'front', 1], ['machine', 'front', 2], ['moth', 'back', 1, { mutant: true }]] }
    ]
  };
})();
