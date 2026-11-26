/* =====================================================================
 * TALELIA · 전투 프로토타입 데이터 (모든 수치 = 임시값)
 *
 *  - 숫자만 바꾸고 battle.html 을 새로고침하면 바로 다시 시험할 수 있습니다.
 *  - JSON 과 같은 모양입니다. 맨 앞 한 줄(window.TALELIA_BATTLE_PROTO =)만 붙어 있습니다.
 *    (이 프로젝트는 파일을 직접 열어도 동작하도록 fetch 를 쓰지 않습니다)
 *  - 기준: 「TALELIA 핵심 게임 루프 기획서」 2장 전투 시스템 · 확정되지 않은 값은 모두 임시값
 * ===================================================================== */
window.TALELIA_BATTLE_PROTO = {
  version: 1,
  rules: {
    frontTakenMul: 0.85,        // 전열: 받는 피해 ×0.85 (임시값)
    backDealtMul: 1.15,         // 후열: 주는 피해 ×1.15 (임시값)
    defK: 100,                  // 피해 = … × defK / (defK + 방어력) (임시값)
    minDamage: 1,
    tieBreak: ['allyFirst', 'frontFirst', 'slot'],   // 속도가 같을 때 (임시값) · 순서를 바꾸면 우선순위가 바뀜
    cooldownStartReady: true,   // 전투 시작 시 필살기 바로 사용 가능 (임시값)
    autoHealBelowPct: 0.6,      // 자동 회복 조건: HP 60% 미만 아군이 있을 때 (임시값)
    maxRounds: 50               // 넘으면 무승부 (무한 전투 방지)
  },
  allies: [
    { id: 'subject_24', name: '실험체 24호', row: 'front', slot: 0, img: 'images/talelia/actors/subject_24.webp',
      hp: 1000, atk: 120, def: 40, spd: 110, skills: ['atk_basic', 'ult_carrot'] },
    { id: 'hamster_hammer', name: '망치 햄스터', row: 'front', slot: 1, img: 'images/talelia/actors/hamster_hammer.webp',
      hp: 1100, atk: 130, def: 50, spd: 90, skills: ['atk_basic', 'ult_walnut'] },
    { id: 'hamster_explorer', name: '탐험가 햄스터', row: 'back', slot: 0, img: 'images/talelia/actors/hamster_explorer.webp',
      hp: 800, atk: 70, def: 30, spd: 100, skills: ['atk_basic_08', 'heal_potion', 'buff_atk', 'buff_def'] }
  ],
  // 적 그림: 경비 · 저격 기계 정지 그림 (docs/graphics/enemies · tools/sprite_prep.py) · 못 불러오면 shape · color 임시 도형
  enemies: [
    { id: 'guard_a', name: '임시 경비 A', row: 'front', slot: 0, shape: 'square', color: '#8a6f5a', img: 'images/battle/enemies/guard.webp',
      hp: 900, atk: 200, def: 40, spd: 95, skills: ['atk_basic'] },
    { id: 'guard_b', name: '임시 경비 B', row: 'front', slot: 1, shape: 'square', color: '#6f7d8a', img: 'images/battle/enemies/guard.webp',
      hp: 900, atk: 200, def: 40, spd: 85, skills: ['atk_basic'] },
    { id: 'sniper', name: '임시 저격수', row: 'back', slot: 0, shape: 'circle', color: '#9a5f7a', img: 'images/battle/enemies/sniper.webp',
      hp: 600, atk: 210, def: 20, spd: 105, skills: ['atk_basic', 'aoe_snipe'] }
  ],
  skills: {
    atk_basic:    { name: '기본 공격', kind: 'attack', target: 'enemy_single', mult: 1.0, cooldown: 0 },
    atk_basic_08: { name: '기본 공격', kind: 'attack', target: 'enemy_single', mult: 0.8, cooldown: 0 },
    ult_carrot:   { name: '당근 강타 (임시)', kind: 'attack', target: 'enemy_single', mult: 2.6, cooldown: 3, tag: 'ultimate' },
    ult_walnut:   { name: '호두 분쇄 (임시)', kind: 'attack', target: 'enemy_all', mult: 1.1, cooldown: 4, tag: 'ultimate' },
    heal_potion:  { name: '회복 포션', kind: 'heal', target: 'ally_single', pctMaxHp: 0.25, cooldown: 2 },
    buff_atk:     { name: '공격력 강화 양피지', kind: 'buff', target: 'ally_all', stat: 'atk', pct: 0.2, duration: 2, cooldown: 4 },
    buff_def:     { name: '방어력 강화 양피지', kind: 'buff', target: 'ally_all', stat: 'def', pct: 0.3, duration: 2, cooldown: 4 },
    aoe_snipe:    { name: '난사 (임시)', kind: 'attack', target: 'enemy_all', mult: 0.6, cooldown: 0, every: 3 }   // 자기 턴 3 · 6 · 9 … 번째에만
  },
  // 전투 구성 (이야기에서 부르는 전투) : battle.html?encounter=이름 — 화면(js/battle/view.js)이 이 구성으로 아군 · 적을 꾸려 규칙에 넘김
  //  allies  = 위 allies 의 id 목록 (능력치 · 스킬 그대로)
  //  enemies = 위 enemies 의 하나(base)를 복사하고 적은 값(id · name · hp · atk …)만 덮어씀 · id 는 구성 안에서 겹치지 않게
  //  encounter 없이 열면 위 allies · enemies 그대로 (기존 프로토타입 화면)
  //  난이도 (임시값 · 시드 300개 모의 전투 · 24호 혼자 HP 1000)
  //   lab_guard_tutorial : 무엇을 눌러도 이김 (자동 4라운드 · 남은 HP 892 / 기본 공격만 6라운드 · 남은 HP 820)
  //   lab_guard_sniper   : 자동 전승 (7~10라운드 · 남은 HP 평균 538) / 필살기 없이 최악으로 골라도 승리 (13라운드 · 남은 HP 145)
  encounters: {
    lab_guard_tutorial: { title: '경비 기계', allies: ['subject_24'],
      enemies: [ { base: 'guard_a', id: 'guard_t', name: '경비 기계', hp: 420, atk: 60 } ] },
    lab_guard_sniper: { title: '출구 앞 기계들', allies: ['subject_24'],
      enemies: [ { base: 'guard_a', id: 'guard_1', name: '경비 기계 A', hp: 320, atk: 45 },
                 { base: 'guard_b', id: 'guard_2', name: '경비 기계 B', hp: 320, atk: 45 },
                 { base: 'sniper',  id: 'sniper_1', name: '저격 기계', hp: 220, atk: 55 } ] }
  }
};
