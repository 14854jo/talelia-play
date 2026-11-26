/* =====================================================================
 * TALELIA · 장비 데이터 (docs/design/equipment-dungeon.md · E1 · 모든 수치 = 숫자만 바꾸면 규칙 코드가 그대로 따름)
 *
 *  - 규칙 코드: js/gacha/gear.js (순수 함수 · 시드 난수) · 저장: 뽑기 저장 v3 (js/gacha/rules.js migrate)
 *  - 장비 수치 = 기준 캐릭터(benchmark · 고급 2성 0강 = 1장 24호) 능력치 × % → 착용자와 무관한 고정값
 *    소수 첫째 자리까지 들고 있다가 최종 능력치에서만 반올림 (statsWithGear)
 *  - 강화 1단계마다 기본 수치 +enhStep(10%) → 5강 = 1.5배 · 5강에 처음 올라갈 때 보너스 1개 (공 · 방 · 체 중 무작위 · 기준 대비 고정값)
 *  - 세트: 같은 세트 3부위(지금은 전설만 세트가 붙음) → (캐릭터 + 장비) 합계에 % 를 곱함 · add 는 더하기 (신속 = 속도 +10)
 *    효과 적중 · 효과 저항 = 자리만 (drop: false · 전투 규칙 eff · res → statusChance 와 연결 예정)
 * ===================================================================== */
window.TALELIA_EQUIP = {
  version: 1,
  benchmark: { hp: 1000, atk: 120, def: 40 },          // 기준 캐릭터 (고급 2성 0강 = 24호 · data/gacha/species.js benchmark)
  slots: {
    weapon:    { name: '무기',   stats: ['atk'] },       // 등급 pct.weapon = 공격 %
    armor:     { name: '방어구', stats: ['def', 'hp'] }, // 등급 pct.armor = [방어 %, 체력 %]
    accessory: { name: '장신구', stats: ['hp'] }         // 등급 pct.accessory = 체력 %
  },
  slotOrder: ['weapon', 'armor', 'accessory'],
  grades: {
    common:   { name: '일반', order: 1, pct: { weapon: [0.06], armor: [0.06, 0.04], accessory: [0.06] }, bonus: 0.02, costMul: 1, dismantle: 10 },
    uncommon: { name: '고급', order: 2, pct: { weapon: [0.09], armor: [0.09, 0.06], accessory: [0.09] }, bonus: 0.03, costMul: 2, dismantle: 30 },
    hero:     { name: '영웅', order: 3, pct: { weapon: [0.13], armor: [0.13, 0.09], accessory: [0.13] }, bonus: 0.05, costMul: 4, dismantle: 80 },
    legend:   { name: '전설', order: 4, pct: { weapon: [0.20], armor: [0.20, 0.13], accessory: [0.20] }, bonus: 0.08, costMul: 8, dismantle: 250, hasSet: true }
  },
  maxEnh: 5,
  enhStep: 0.10,                                        // 강화 1단계마다 기본 수치 +10%
  enhRate: [1.00, 0.90, 0.75, 0.60, 0.45],              // 0→1강 … 4→5강 성공률 · 실패해도 단계 유지
  enhCost: [100, 150, 200, 300, 400],                   // 일반 등급 단계별 골드 (× 등급 costMul)
  bonusStats: ['atk', 'def', 'hp'],                     // 5강 보너스 후보 (부위와 무관 · 같은 확률)
  sets: {
    might:  { name: '맹공', pct: { atk: 0.15 }, drop: true },
    guard:  { name: '수호', pct: { def: 0.15 }, drop: true },
    life:   { name: '생명', pct: { hp: 0.15 },  drop: true },
    swift:  { name: '신속', add: { spd: 10 },   drop: true },
    hit:    { name: '적중', add: { eff: 0 },    drop: false },   // 자리만 (효과 적중 · 값 미정)
    resist: { name: '저항', add: { res: 0 },    drop: false }    // 자리만 (효과 저항 · 값 미정)
  },
  setPieces: 3,
  // 골드 (던전 회당 골드 · 드롭표 · 입장 소모는 E3 data/dungeon/floors.js)
  gold: { daily: 1000, towerFirstPerFloor: 500, storyFirst: 1000 }
};
