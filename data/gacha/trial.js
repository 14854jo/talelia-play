/* =====================================================================
 * TALELIA · 시험 전투 (뽑기 편성으로 battle.html?party=1) 상대 · 난이도 데이터 (모든 수치 = 임시값)
 *
 *  - 시험 전투에만 씁니다. 이야기 전투 · 기존 전투 화면(data/battle-proto.js)은 그대로입니다.
 *  - 적은 data/battle-proto.js 의 적(base)을 복사하고 적은 값만 덮어씀 (이야기 전투 encounters 와 같은 방식)
 *  - skills = 시험 전투 적에게만 붙이는 스킬 (v2 4단계 · docs/design/battle-rules-v2.md 3장) · battle-proto.js 스킬 · 적은 그대로
 *     → 1장 전투 · 기준 로그 46개에 영향 없음
 *     경비 기계 기절 강타 = 어려움 단계 경비 기계에만 · 저격 기계 조준 연사 = 모든 단계 · 감시자 = 보스(기절 면역) + 광역 약화
 *  - 난이도 = 편성에 맞춤 (js/gacha/trial.js strength):
 *     전투 세기 = Σ 버티는 체력(방어 · 전열 보정 반영) × Σ 한 턴 평균 피해(공격 × 스킬 배율 · 맞는 대상 수 · 중독 · 쿨타임 · 후열 보정 반영)
 *                × (1 − 상대 제어율: 상대의 기절 · 약화가 내 피해를 줄이는 비율)   ← v2 4-2단계
 *     적의 체력 · 공격에 같은 배율 s 를 곱해 적 세기 = 아군 세기 × mul 이 되게 (s ≈ √(mul × 아군 ÷ 적 기본) · 중독 때문에 몇 번 다시 계산 · 방어 · 속도 · 스킬은 그대로)
 *     s 는 sMin ~ sMax 로 자름 · 시험용 주소 옵션 ?trialk=1.2 = mul 에 한 번 더 곱함
 *     (처음에 쓴 뽑기 화면 전투력 식은 높은 성급의 스킬 배율 · 필살기를 못 봐서 편성마다 승률이 크게 달랐음 → 세기 식으로 바꿈)
 *  - mul 은 기준 편성 5개(초반 4명 · 중반 6명 · 후반 6명 · 스토리 3명 · 24호 혼자) × 시드 200 자동 전투로 맞춤
 *     (v2 4-2단계 · 세기 식에 적 n명 · 상태이상 어림값을 넣고 다시 맞춤)
 *     쉬움 1.0   = 모두 100%                                 (4단계 전 1.0  = 모두 100%)
 *     보통 1.29  = 91 · 76 · 75 · 70 · 52% · 평균 73%       (4단계 전 1.32 = 87 · 63 · 83 · 69 · 58% · 평균 72% / 4단계 1.32 = 77 · 100 · 100 · 34 · 49%)
 *     어려움 1.6 = 49 · 15 · 27 · 21 · 28% · 평균 28%       (4단계 전 1.55 = 39 · 24 · 49 · 10 · 1% · 평균 25% / 4단계 1.9 = 0 · 59 · 72 · 0 · 0%)
 *    → tests/battle-party.test.html P7 이 승률을 참고 행으로 다시 보여 줌
 *  - row · slot = 전투 6자리 (slot 0 = 위 · 1 = 가운데 · 2 = 아래)
 * ===================================================================== */
window.TALELIA_GACHA_TRIAL = {
  version: 1,
  defaultTier: 'normal',
  sMin: 0.15, sMax: 12,
  // 세기 식 어림값 가중치 (v2 4-2단계 · js/gacha/trial.js strength) · 제어율 = 기절 · 약화가 상대 피해를 줄이는 비율 (상한 ctrlMax)
  est: { stunW: 1, weakenW: 1, poisonW: 1, ctrlMax: 0.6 },
  skills: {
    trial_stun_bash:    { name: '기절 강타', kind: 'attack', target: 'enemy_single', mult: 1.0, cooldown: 4,
                          status: { type: 'stun', chance: 0.2, turns: 1 } },
    trial_aimed_burst:  { name: '조준 연사', kind: 'attack', target: 'enemy_single', mult: 1.2, hits: 3, cooldown: 3 },   // 일반 쿨타임 스킬 (AI 3.6단계에서 씀 · 필살기 아님)
    trial_warden_alarm: { name: '감시 경보', kind: 'attack', target: 'enemy_all', mult: 0.5, cooldown: 4,
                          status: { type: 'weaken', chance: 0.7, turns: 2, value: 0.15 } }
  },
  tiers: {
    easy:   { name: '쉬움', mul: 1.0,
      enemies: [ { base: 'guard_a', id: 'trial_guard_1', name: '경비 기계 A', row: 'front', slot: 0 },
                 { base: 'guard_b', id: 'trial_guard_2', name: '경비 기계 B', row: 'front', slot: 2 },
                 { base: 'sniper',  id: 'trial_sniper_1', name: '저격 기계', row: 'back', slot: 1, skills: ['atk_basic', 'aoe_snipe', 'trial_aimed_burst'] } ] },
    normal: { name: '보통', mul: 1.4,   // V3: 패시브 · 단일기 강화로 아군이 세져 1.29 → 1.4 (기준 편성 5종 평균 승률 72%)
     
      enemies: [ { base: 'guard_a', id: 'trial_guard_1', name: '경비 기계 A', row: 'front', slot: 0 },
                 { base: 'guard_b', id: 'trial_guard_2', name: '경비 기계 B', row: 'front', slot: 1, spd: 90 },
                 { base: 'guard_a', id: 'trial_guard_3', name: '경비 기계 C', row: 'front', slot: 2, spd: 80 },
                 { base: 'sniper',  id: 'trial_sniper_1', name: '저격 기계 A', row: 'back', slot: 0, skills: ['atk_basic', 'aoe_snipe', 'trial_aimed_burst'] },
                 { base: 'sniper',  id: 'trial_sniper_2', name: '저격 기계 B', row: 'back', slot: 2, spd: 100, skills: ['atk_basic', 'aoe_snipe', 'trial_aimed_burst'] } ] },
    hard:   { name: '어려움', mul: 1.8,   // V3: 1.6 → 1.8 (평균 39% · 가장 낮은 편성 1%)
     
      enemies: [ { base: 'guard_a', id: 'trial_guard_1', name: '경비 기계 A', row: 'front', slot: 0, skills: ['atk_basic', 'trial_stun_bash'] },
                 { base: 'guard_a', id: 'trial_warden', name: '감시자', row: 'front', slot: 1, img: 'images/battle/enemies/warden.webp', shape: 'square', color: '#5a6a7a',
                   hp: 1500, atk: 180, def: 60, spd: 78, immune: ['stun'], skills: ['atk_basic', 'ult_walnut', 'trial_warden_alarm'] },   // 보스: 기절 면역
                 { base: 'guard_b', id: 'trial_guard_2', name: '경비 기계 B', row: 'front', slot: 2, skills: ['atk_basic', 'trial_stun_bash'] },
                 { base: 'sniper',  id: 'trial_sniper_1', name: '저격 기계 A', row: 'back', slot: 0, skills: ['atk_basic', 'aoe_snipe', 'trial_aimed_burst'] },
                 { base: 'guard_b', id: 'trial_guard_3', name: '경비 기계 C', row: 'back', slot: 1, spd: 82, skills: ['atk_basic', 'trial_stun_bash'] },   // 가운데 후열은 경비 (저격 기계는 총이 길어 바로 옆 줄에 두 대를 두면 서로 가림)
                 { base: 'sniper',  id: 'trial_sniper_2', name: '저격 기계 B', row: 'back', slot: 2, spd: 100, skills: ['atk_basic', 'aoe_snipe', 'trial_aimed_burst'] } ] }
  }
};
