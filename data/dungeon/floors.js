/* =====================================================================
 * TALELIA · 던전 데이터 (docs/design/equipment-dungeon.md · E3 · 모든 수치 = 숫자만 바꾸면 규칙 코드가 그대로 따름)
 *
 *  - 규칙 코드: js/dungeon/rules.js (순수 함수 · 시드 난수) · 진행 저장: 뽑기 저장 v3 의 dungeon { cleared, day, used, pity, runs }
 *  - 1~10층 · 1라운드 일반 몬스터 → 2라운드 보스 1 (라운드 사이 전원 회복 · E4) · 이전 층 클리어로 개방
 *  - 하루 dailyRuns(100)회 · 자정(기기 날짜) 초기화 · 입장할 때 cost 만큼 차감 (승패 무관)
 *  - 보스 클리어(승리) 때만 보상: 골드(gold) + 장비 1개 확정(drop = 등급 가중치 %) · 부위 3종 같은 확률 · 전설 세트는 드롭 세트 4종 같은 확률
 *  - 불운 보정: pity.floors 층에서 전설 없이 pity.after 회 연속 → 다음 보스 드롭 전설 확정 (층 합산 · 전설이 나오면 0)
 *
 *  적 (기존 적만 · 새 몬스터는 이번 범위 아님)
 *   base = data/battle-proto.js 의 적 · 스킬 id = data/battle-proto.js skills + data/gacha/trial.js skills (기절 강타 · 조준 연사 · 감시 경보)
 *   능력치: 체력 · 공격 × 층 배율 s (방어 · 속도 · 스킬은 그대로) · 보스는 × boss.hp · boss.atk 더
 *   ※ s = E4 조정값 (기준 편성이 1 · 2라운드를 연속으로 이길 확률 약 85%) · 보스 배율 = 초안 그대로 (추천값)
 *   row · slot = 전투 6자리 (전열 · 후열 × 0 위 · 1 가운데 · 2 아래)
 * ===================================================================== */
(function(){
  'use strict';
  const G = (id, name, row, slot, o) => Object.assign({ base: id === 'b' ? 'guard_b' : 'guard_a', id: 'dg_' + row[0] + slot, name, row, slot }, o || {});
  const S = (name, slot, o) => Object.assign({ base: 'sniper', id: 'dg_b' + slot, name, row: 'back', slot, skills: ['atk_basic', 'aoe_snipe', 'trial_aimed_burst'] }, o || {});
  const STUN = { skills: ['atk_basic', 'trial_stun_bash'] };
  // 감시자 (보스) · 기본 능력치는 시험 전투 어려움 단계와 같음 (data/gacha/trial.js)
  const boss = (skills, extra) => Object.assign({ base: 'guard_a', id: 'dg_boss', name: '감시자', row: 'front', slot: 1, img: 'images/battle/enemies/warden.webp', shape: 'square', color: '#5a6a7a',
    hp: 1500, atk: 180, def: 60, spd: 78, skills }, extra || {});
  const B13 = () => boss(['atk_basic', 'ult_walnut']);
  const B46 = () => boss(['atk_basic', 'ult_walnut', 'trial_warden_alarm']);
  const B70 = () => boss(['atk_basic', 'ult_walnut', 'trial_warden_alarm', 'trial_stun_bash'], { immune: ['stun'] });
  // 층 배율 s (E4 조정값) : 층별 기준 편성(아래 bench)이 1 · 2라운드를 연속으로 이길 확률 약 85% (자동 전투 · 시드 2,000 · tests/battle-dungeon.test.html 이 다시 잼)
  //  초안(E3) = 1층 0.5 → 10층 2.0 (0.5 × 4^((층−1)/9)) → 1~5층 100% · 6층 19% · 7~10층 0% 이라 다시 맞춤
  //  층이 오를수록 적 수 · 스킬이 늘어 s 는 1층보다 낮아질 수 있음 (적 전체 세기는 층마다 커짐) · 1층은 승률이 s 1.27 → 1.29 에서 96% → 57% 로 급하게 떨어짐
  // 71ad91c 쿨타임 감소 후 B12c 승률 복구를 위해 조정
  const SCALE = [1.370, 1.516, 1.567, 1.364, 1.441, 1.133, 1.188, 1.207, 1.083, 1.097];
  const s = f => SCALE[f - 1];
  // 층별 기준 편성 (승률 맞추기 · E4) : 고급 2성 4명 (설계안 예시) + 층마다 장비 3부위
  const all3 = (grade, enh) => ['weapon', 'armor', 'accessory'].map(slot => ({ slot, grade, enh }));
  const bench = {
    units: [['mole_miner', 2, 'front', 0], ['s24', 2, 'front', 1], ['duck_healer', 2, 'back', 0], ['hamster_explorer', 2, 'back', 1]],
    gear: { 1: [], 2: all3('common', 0), 3: all3('common', 3), 4: all3('uncommon', 3), 5: all3('uncommon', 5), 6: all3('hero', 0),
            7: all3('hero', 3), 8: all3('hero', 4), 9: all3('hero', 5),
            10: [{ slot: 'weapon', grade: 'legend', enh: 3 }, { slot: 'armor', grade: 'hero', enh: 5 }, { slot: 'accessory', grade: 'legend', enh: 3 }] }
  };

  window.TALELIA_DUNGEON = {
    version: 1,
    dailyRuns: 100,
    pity: { floors: [7, 8, 9, 10], after: 60, grade: 'legend' },
    mix: { hp: 0.8, atk: 1.15 },               // V3 (밸런스 v3 · V4): 적 체력 × 0.8 · 공격 × 1.15 (체력 대비 공격 비율을 높임 · 층 배율 s 는 이에 맞춰 다시 맞춤)
    tstone: { first: 3, repeat: { 4: 0.1, 5: 0.1, 6: 0.1, 7: 0.2, 8: 0.2, 9: 0.2, 10: 0.2 }, dailyMax: 5 },   // V3-3 초월석: 층 첫 클리어 3개 · 보스 반복 클리어 확률 · 하루 최대
    boss: { hp: 4, atk: 1.3 },                 // 초안 (추천값) · 보스 체력 · 공격 = 기본 × s × 이 배율
    bench,
    floors: [
      { floor: 1,  s: s(1),  cost: 1, gold: 30, drop: { common: 80, uncommon: 20 },
        wave: [G('a', '경비 기계 A', 'front', 0), G('b', '경비 기계 B', 'front', 2)], boss: B13() },
      { floor: 2,  s: s(2),  cost: 1, gold: 30, drop: { common: 75, uncommon: 25 },
        wave: [G('a', '경비 기계 A', 'front', 0), G('b', '경비 기계 B', 'front', 1, { spd: 90 }), G('a', '경비 기계 C', 'front', 2, { spd: 80 })], boss: B13() },
      { floor: 3,  s: s(3),  cost: 1, gold: 30, drop: { common: 70, uncommon: 30 },
        wave: [G('a', '경비 기계 A', 'front', 0), G('b', '경비 기계 B', 'front', 2), S('저격 기계', 1)], boss: B13() },
      { floor: 4,  s: s(4),  cost: 2, gold: 50, drop: { uncommon: 75, hero: 25 },
        wave: [G('a', '경비 기계 A', 'front', 0), G('b', '경비 기계 B', 'front', 1, { spd: 90 }), G('a', '경비 기계 C', 'front', 2, { spd: 80 }), S('저격 기계', 1)], boss: B46() },
      { floor: 5,  s: s(5),  cost: 2, gold: 50, drop: { uncommon: 70, hero: 30 },
        wave: [G('a', '경비 기계 A', 'front', 0), G('b', '경비 기계 B', 'front', 1, { spd: 90 }), G('a', '경비 기계 C', 'front', 2, { spd: 80 }), S('저격 기계', 0)], boss: B46() },
      { floor: 6,  s: s(6),  cost: 2, gold: 50, drop: { uncommon: 65, hero: 35 },
        wave: [G('a', '경비 기계 A', 'front', 0), G('b', '경비 기계 B', 'front', 1, { spd: 90 }), G('a', '경비 기계 C', 'front', 2, { spd: 80 }), S('저격 기계 A', 0), S('저격 기계 B', 2, { spd: 100 })], boss: B46() },
      { floor: 7,  s: s(7),  cost: 3, gold: 80, drop: { hero: 99, legend: 1 },
        wave: [G('a', '경비 기계 A', 'front', 0, STUN), G('b', '경비 기계 B', 'front', 1, Object.assign({ spd: 90 }, STUN)), G('a', '경비 기계 C', 'front', 2, Object.assign({ spd: 80 }, STUN)), S('저격 기계 A', 0), S('저격 기계 B', 2, { spd: 100 })], boss: B70() },
      { floor: 8,  s: s(8),  cost: 3, gold: 80, drop: { hero: 98, legend: 2 },
        wave: [G('a', '경비 기계 A', 'front', 0, STUN), G('b', '경비 기계 B', 'front', 1, Object.assign({ spd: 90 }, STUN)), G('a', '경비 기계 C', 'front', 2, Object.assign({ spd: 80 }, STUN)), S('저격 기계 A', 0), S('저격 기계 B', 2, { spd: 100 })], boss: B70() },
      { floor: 9,  s: s(9),  cost: 3, gold: 80, drop: { hero: 97, legend: 3 },
        wave: [G('a', '경비 기계 A', 'front', 0, STUN), G('b', '경비 기계 B', 'front', 1, Object.assign({ spd: 90 }, STUN)), G('a', '경비 기계 C', 'front', 2, Object.assign({ spd: 80 }, STUN)), S('저격 기계 A', 0), S('저격 기계 B', 1, { spd: 100 }), S('저격 기계 C', 2, { spd: 95 })], boss: B70() },
      { floor: 10, s: s(10), cost: 3, gold: 80, drop: { hero: 96, legend: 4 },
        wave: [G('a', '경비 기계 A', 'front', 0, STUN), G('b', '경비 기계 B', 'front', 1, Object.assign({ spd: 90 }, STUN)), G('a', '경비 기계 C', 'front', 2, Object.assign({ spd: 80 }, STUN)), S('저격 기계 A', 0), S('저격 기계 B', 1, { spd: 100 }), S('저격 기계 C', 2, { spd: 95 })], boss: B70() }
    ]
  };
})();
