/* =====================================================================
 * TALELIA · 뽑기 · 수집 도감 데이터 (모든 수치 = 임시값 · 숫자만 바꾸면 규칙 코드가 그대로 따름)
 *
 *  - 별도 로컬 프로토타입: 원본 게임 서버의 소환 · 6등급(js/grade-map.js)과 연결하지 않음. 이름도 따로(rarity)
 *  - 규칙 코드: js/gacha/rules.js · 저장: js/gacha/store.js · 검사: tests/gacha-rules.test.html
 *  - <script> 로 읽음 (fetch 를 쓰지 않음 · 파일을 직접 열어도 동작)
 *  - card = 뽑기 카드 그림 (원본 docs/graphics/gacha/<id>/card.png → python tools/sprite_prep.py gacha · 흰 바탕 제거) · 없으면 placeholder(아이콘 · 색)로 임시 카드
 *    스토리 캐릭터는 card 대신 art(대화 장면 초상화)를 씀
 *
 *  등급(rarity) 5단계 → 시작 성급 · 뽑기 확률(%, 합 100) · 등급이 스킬 구조(대상 수 · 타격 횟수 · 상태이상)를 정함
 *  성급(star) 1~6 → 능력치(hp · atk · def) 와 스킬 배율만 올림 (속도는 성급과 무관 · 행동 순서가 성급으로 뒤집히지 않게)
 *  강화(enh) 0~5 → 1단계마다 능력치 +enhStep (3%) · 5강에서 멈춤 (자동 승급 없음)
 *  승급 → 5강 캐릭터 + 같은 성급의 5강 캐릭터 1마리(종류 상관없음) = 다음 성급 0강 · 100% · 별의 조각으로 대신할 수 없음 · 6성이 끝
 *  초월(tr) 0~6 → 같은 캐릭터 중복 1마리(등급 · 성급 · 강화 상관없음) = +1단계 · 100% · 체력 · 공격 · 방어 보너스 누적 (transcend.bonus · 속도는 그대로)
 *  중복 캐릭터는 강화 재료로 쓸지 초월 재료로 쓸지 플레이어가 고름
 *
 *  스킬 필드 (전투 규칙 rules.js 의 스킬과 같은 모양 + 아직 규칙에 없는 필드는 5단계에서 규칙을 넓힐 때 씀)
 *   kind      attack · heal · buff         target  enemy_single · enemy_n(count 명) · enemy_all · ally_single · ally_all
 *   mult      대상 1명이 받는 "합계" 배율 (hits 번으로 나눠 맞음 · 예: 3회 250% = 한 번 약 83%)
 *   hits      타격 횟수 (기본 1)            cooldown · tag('ultimate') · pctMaxHp(회복)
 *   status    { type: stun(기절) · poison(중독) · weaken(약화), chance(0~1), turns, value }
 *             stun = 그 턴 쉼 · poison = 자기 턴 시작마다 최대 HP × value 피해 · weaken = 공격력 × (1 − value) · silence = 기본 공격만 쓸 수 있음 (V3-5a)
 *   reach     'back' = 후열 우선 (enemy_single · enemy_n · 상대 후열이 남아 있으면 후열만 고를 수 있음 · V3-5a)
 *  species 필드 hidden: true = 도감 화면에 보이지 않음 (V3-5b · 아직 뽑기에 나오지 않는 신규 캐릭터 · 5c에서 gacha: true 와 함께 지움)
 * ===================================================================== */
window.TALELIA_GACHA = {
  version: 1,
  rarities: {
    common:   { name: '일반', startStar: 1, rate: 55, order: 1 },
    uncommon: { name: '고급', startStar: 2, rate: 30, order: 2 },
    hero:     { name: '영웅', startStar: 3, rate: 12, order: 3 },
    legend:   { name: '전설', startStar: 4, rate: 2,  order: 4 },
    myth:     { name: '설화', startStar: 4, rate: 1,  order: 5 }
  },
  maxStar: 6, maxEnh: 5,
  starMul:  [0, 1.00, 1.15, 1.32, 1.52, 1.75, 2.00],   // 성급 → 능력치 배율 (hp · atk · def)
  skillMul: [0, 1.00, 1.06, 1.12, 1.20, 1.28, 1.36],   // 성급 → 스킬 배율
  enhStep: 0.03,                                       // 강화 1단계마다 능력치 +3%
  // 초월: 단계마다 체력 · 공격 · 방어 보너스 (속도 제외) (1~6단계: +3% +3% +3% +4% +4% +8% · 6단계 누적 25%) · stats = 보너스를 받는 능력치
  transcend: { max: 6, bonus: [0, 0.03, 0.03, 0.03, 0.04, 0.04, 0.08], stats: ['hp', 'atk', 'def'] },
  scaleStats: ['hp', 'atk', 'def'],                    // 성급 · 강화로 오르는 능력치 (spd 는 고정)
  statuses: ['stun', 'poison', 'weaken', 'silence'],   // silence = 침묵 (V3-5a · 걸린 캐릭터는 기본 공격만 · 규칙 = js/battle/rules.js)
  // 뽑기
  currency: { name: '정령석', start: 3000 },
  cost: { single: 150, ten: 1500 },
  pity: 50,                    // 천장: 이 횟수째 뽑기는 전설 이상 확정 → 횟수 0 (자연히 나온 전설은 횟수를 되돌리지 않음) · 0 = 끔
  tenGuarantee: 'hero',        // 10회 뽑기 1번 안에 이 등급 이상이 없으면 마지막 장을 이 등급 이상으로 다시 뽑음 · null = 끔 (1회 뽑기에는 없음)
  pityPool: ['legend', 'myth'],
  // 강화 재료 아이템 (같은 성급 캐릭터 1마리 대신 · 성공률 100% · 승급 재료는 대신하지 못함) · 얻는 곳은 나중에 탑 · 일일 보상 (지금은 개발용 지급만)
  shard: { name: '별의 조각' },
  historyMax: 100, partyMax: 6,                        // 편성 = 전열 3칸 · 후열 3칸
  // 밸런스 기준: 1장 24호(battle-proto.js · HP 1000 · 공격 120 · 방어 40 · 속도 110) = 고급 2성 0강
  benchmark: { species: 's24', star: 2 },

  // 소환 종류 (화면 오른쪽 목록 · 위에서부터) — 이벤트 소환은 여기에 한 줄 더하면 목록에 나옴
  //  featured = 크게 보여 줄 캐릭터 (첫 번째가 대표 · 나머지는 작은 그림으로 바꿔 볼 수 있음)
  //  지금은 모든 소환이 같은 확률표 · 같은 천장을 씀 (픽업 확률 올림은 아직 없음 · 데이터 자리만)
  banners: [
    { id: 'pickup_moon', kind: 'pickup', name: '달빛 픽업 소환', tag: '픽업', desc: '설화 달토끼 · 전설 부엉이 현자 등장', featured: ['moon_rabbit', 'owl_sage'] },
    { id: 'standard', kind: 'standard', name: '일반 소환', tag: '상시', desc: '상시 동료 8종이 나와요', featured: ['fox_mage', 'turtle_guard'] }
  ],
  // 소환 영상 (원본 docs/graphics/gacha/video/ → python tools/video_prep.py --spec docs/graphics/gacha/video/video_prep.json · 소리 없음 · 가장자리 종이 테두리 잘라 냄)
  //  등급과 상관없이 같은 길이(약 4.5초) · 원래 속도 · 10회는 10장 중 가장 높은 등급 기준으로 한 번만
  summonVideo: {
    basic:  { src: 'images/gacha/video/summon_basic.mp4',  first: 'images/gacha/video/summon_basic_first.webp',  for: ['common', 'uncommon', 'hero'] },
    legend: { src: 'images/gacha/video/summon_legend.mp4', first: 'images/gacha/video/summon_legend_first.webp', for: ['legend'] },
    myth:   { src: 'images/gacha/video/summon_myth.mp4',   first: 'images/gacha/video/summon_myth_first.webp',   for: ['myth'] }
  },
  cutin: { hero: 1.5, legend: 3, myth: 4.5 },          // 영상 뒤 전체 화면 컷인 시간(초) · 일반 · 고급은 컷인 없이 바로 카드
  ui: { bg: 'images/gacha/ui/summon_bg.webp', cardBack: 'images/gacha/ui/card_back.webp',
        stone: 'images/gacha/ui/icon_spirit_stone.webp', shard: 'images/gacha/ui/icon_star_shard.webp' },

  skills: {
    g_basic:        { name: '기본 공격', kind: 'attack', target: 'enemy_single', mult: 1.2, hits: 1, cooldown: 0 },
    g_basic_08:     { name: '기본 공격', kind: 'attack', target: 'enemy_single', mult: 0.96, hits: 1, cooldown: 0 },
    // V3 (밸런스 v3 · V4): 단일 대상 공격은 기본 ×1.2 · 필살 ×1.45 (일반 350% → 508% · 고급 360% → 522%)
    // 일반: 적 1명 · 1회
    g_hoe_slam:     { name: '괭이 내려치기', kind: 'attack', target: 'enemy_single', mult: 5.08, hits: 1, cooldown: 3, tag: 'ultimate' },
    g_acorn_shot:   { name: '도토리 투석', kind: 'attack', target: 'enemy_single', mult: 5.08, hits: 1, cooldown: 3, tag: 'ultimate' },
    // 고급: 적 1명 · 2회 / 아군 1명 회복
    g_pick_combo:   { name: '곡괭이 연타', kind: 'attack', target: 'enemy_single', mult: 5.22, hits: 2, cooldown: 3, tag: 'ultimate' },
    g_mend:         { name: '깃털 붕대', kind: 'heal', target: 'ally_single', pctMaxHp: 0.3, cooldown: 2, tag: 'ultimate' },
    // 영웅: 적 2명 · 1회 + 약한 상태이상
    g_shell_bash:   { name: '등껍질 박치기', kind: 'attack', target: 'enemy_n', count: 2, mult: 1.8, hits: 1, cooldown: 3, tag: 'ultimate',
                      status: { type: 'weaken', chance: 0.5, turns: 2, value: 0.15 } },
    g_foxfire:      { name: '여우불', kind: 'attack', target: 'enemy_n', count: 2, mult: 2.2, hits: 1, cooldown: 3, tag: 'ultimate',
                      status: { type: 'poison', chance: 0.6, turns: 2, value: 0.04 } },   // v2 4단계: 약화 → 중독 2턴 4% (확률 0.6 그대로)
    // 전설: 적 3명 · 3회 타격(합계 250%) + 상태이상 (부엉이 현자의 수면 = 기절)
    g_sleep_spell:  { name: '잠의 주문', kind: 'attack', target: 'enemy_n', count: 3, mult: 2.5, hits: 3, cooldown: 4, tag: 'ultimate',
                      status: { type: 'stun', chance: 0.3, turns: 1 } },
    // 설화: 적 전체 · 2회 + 상태이상
    g_moon_pound:   { name: '월광 떡방아', kind: 'attack', target: 'enemy_all', mult: 3.0, hits: 2, cooldown: 4, tag: 'ultimate',
                      status: { type: 'poison', chance: 0.6, turns: 2, value: 0.06 } },
    // V3-5b 신규 1차 (docs/design/new-characters-v1.md · 수치는 설계안 그대로 · 밸런스는 캐릭터 8종쯤 갖춰진 뒤 한 번에)
    // 일반 곰: 단일 강타 (일반 V4 값 5.08 · 1타)
    g_paw_slam:     { name: '앞발 내려찍기', kind: 'attack', target: 'enemy_single', mult: 5.08, hits: 1, cooldown: 3, tag: 'ultimate' },
    // 고급 고슴도치: 가시 연사 (기본 2타 · 필살 4타 · 합계 배율은 고급 V4 값 5.22)
    g_thorn_shot:   { name: '가시 쏘기', kind: 'attack', target: 'enemy_single', mult: 1.2, hits: 2, cooldown: 0 },
    g_thorn_volley: { name: '가시 소나기', kind: 'attack', target: 'enemy_single', mult: 5.22, hits: 4, cooldown: 3, tag: 'ultimate' },
    // 전설 고양이: 후열 우선 · 필살기 = 2타 + 침묵 (영상 없음 · 리그 필살기)
    g_shadow_claw:  { name: '그림자 할퀴기', kind: 'attack', target: 'enemy_single', mult: 1.2, hits: 1, cooldown: 0, reach: 'back' },
    g_silence_strike: { name: '침묵의 일격', kind: 'attack', target: 'enemy_single', mult: 5.4, hits: 2, cooldown: 4, tag: 'ultimate', reach: 'back',
                      status: { type: 'silence', chance: 0.75, turns: 2 } }
  },

  // 도감. base = 1성 0강 능력치 (spd 는 성급과 무관) · start = 시작 성급에서의 값(주석) · placeholder = 그림이 생기기 전 임시 표시
  species: {
    farmer_rabbit:    { name: '농부 토끼',        rarity: 'common',   role: '근접', row: 'front', gacha: true,
                        base: { hp: 900, atk: 100, def: 38, spd: 100 }, skills: ['g_basic', 'g_hoe_slam'],          // 1성: 900 / 100 / 38
                        art: null, card: 'images/gacha/cards/farmer_rabbit.webp', placeholder: { icon: '🐰', color: '#8a7a5a' } },
    squirrel_slinger: { name: '다람쥐 투석병',    rarity: 'common',   role: '원거리', row: 'back', gacha: true,
                        base: { hp: 720, atk: 112, def: 26, spd: 112 }, skills: ['g_basic', 'g_acorn_shot'],
                        art: null, card: 'images/gacha/cards/squirrel_slinger.webp', placeholder: { icon: '🐿️', color: '#9a6a3a' } },
    mole_miner:       { name: '두더지 광부',      rarity: 'uncommon', role: '근접', row: 'front', gacha: true,
                        base: { hp: 913, atk: 103, def: 42, spd: 92 }, skills: ['g_basic', 'g_pick_combo'],         // 2성: 1050 / 118 / 48
                        art: null, card: 'images/gacha/cards/mole_miner.webp', placeholder: { icon: '⛏️', color: '#6a5a4a' } },
    duck_healer:      { name: '오리 견습 치유사', rarity: 'uncommon', role: '회복', row: 'back', gacha: true,
                        base: { hp: 748, atk: 70, def: 30, spd: 104 }, skills: ['g_basic_08', 'g_mend'],            // 2성: 860 / 80 / 34
                        art: null, card: 'images/gacha/cards/duck_healer.webp', placeholder: { icon: '🦆', color: '#c8a23a' } },
    turtle_guard:     { name: '거북 방패병',      rarity: 'hero',     role: '방어', row: 'front', gacha: true,
                        base: { hp: 1212, atk: 89, def: 61, spd: 84 }, skills: ['g_basic', 'g_shell_bash'],         // 3성: 1600 / 118 / 80
                        art: null, card: 'images/gacha/cards/turtle_guard.webp', placeholder: { icon: '🐢', color: '#4a7a5a' } },
    fox_mage:         { name: '여우 마술사',      rarity: 'hero',     role: '마법', row: 'back', gacha: true,
                        base: { hp: 758, atk: 133, def: 27, spd: 118 }, skills: ['g_basic', 'g_foxfire'],           // 3성: 1000 / 175 / 36
                        art: null, card: 'images/gacha/cards/fox_mage.webp', placeholder: { icon: '🦊', color: '#c86a3a' } },
    owl_sage:         { name: '부엉이 현자',      rarity: 'legend',   role: '마법', row: 'back', gacha: true,
                        base: { hp: 855, atk: 141, def: 34, spd: 116 }, skills: ['g_basic', 'g_sleep_spell'],       // 4성: 1300 / 215 / 52
                        art: null, card: 'images/gacha/cards/owl_sage.webp', placeholder: { icon: '🦉', color: '#6a5a8a' } },
    moon_rabbit:      { name: '달토끼',           rarity: 'myth',     role: '근접', row: 'front', gacha: true,
                        base: { hp: 1118, atk: 135, def: 46, spd: 124 }, skills: ['g_basic', 'g_moon_pound'],       // 4성: 1700 / 205 / 70
                        art: null, card: 'images/gacha/cards/moon_rabbit.webp', placeholder: { icon: '🌕', color: '#7a6ac8' } },
    // V3-5b 신규 1차 3종 (임시 이름 · id 는 확정 · 아직 뽑기에 나오지 않음 gacha: false + 도감에 안 보임 hidden · 그림이 없어 card: null → 임시 카드)
    berserk_bear:     { name: '광폭화 곰',        rarity: 'common',   role: '근접', row: 'front', gacha: false, hidden: true,
                        base: { hp: 1000, atk: 106, def: 32, spd: 94 }, skills: ['g_basic', 'g_paw_slam'],           // 1성: 1000 / 106 / 32
                        art: null, card: null, placeholder: { icon: '🐻', color: '#7a4a2a' } },
    hedgehog_archer:  { name: '고슴도치 궁수',    rarity: 'uncommon', role: '원거리', row: 'back', gacha: false, hidden: true,
                        base: { hp: 760, atk: 100, def: 30, spd: 106 }, skills: ['g_thorn_shot', 'g_thorn_volley'],  // 2성: 874 / 115 / 35
                        art: null, card: null, placeholder: { icon: '🦔', color: '#8a6a4a' } },
    black_cat:        { name: '검은 고양이 암살자', rarity: 'legend',  role: '암살', row: 'back', gacha: false, hidden: true,
                        base: { hp: 800, atk: 150, def: 30, spd: 130 }, skills: ['g_shadow_claw', 'g_silence_strike'], // 4성: 1216 / 228 / 46
                        art: null, card: null, placeholder: { icon: '🐈‍⬛', color: '#2a2a3a' } },
    // 스토리 캐릭터: 뽑기에 나오지 않음 · 강화 재료 · 강화 대상이 아님 · 진화석으로 성장(세부 미정 · 자리만)
    //  능력치 · 스킬은 전투 데이터(battle-proto.js) 그대로 → base = 전투 값 ÷ 2성 배율 (2성 0강으로 보면 전투 값과 같음)
    s24:              { name: '실험체 24호', rarity: null, story: true, gacha: false, startStar: 2, battleId: 'subject_24', role: '근접', row: 'front',
                        base: { hp: 1000 / 1.15, atk: 120 / 1.15, def: 40 / 1.15, spd: 110 }, skills: ['atk_basic', 'ult_carrot'], skillSource: 'battle',
                        evolve: { stone: null }, art: 'images/story/portraits/s24/smile.webp', placeholder: { icon: '🐰', color: '#9C3F2C' } },
    hamster_hammer:   { name: '망치 햄스터', rarity: null, story: true, gacha: false, startStar: 2, battleId: 'hamster_hammer', role: '근접', row: 'front',
                        base: { hp: 1100 / 1.15, atk: 130 / 1.15, def: 50 / 1.15, spd: 90 }, skills: ['atk_basic', 'ult_walnut'], skillSource: 'battle',
                        evolve: { stone: null }, art: 'images/story/portraits/hammer/confident.webp', placeholder: { icon: '🐹', color: '#A84B2A' } },
    hamster_explorer: { name: '탐험가 햄스터', rarity: null, story: true, gacha: false, startStar: 2, battleId: 'hamster_explorer', role: '지원', row: 'back',
                        base: { hp: 800 / 1.15, atk: 70 / 1.15, def: 30 / 1.15, spd: 100 }, skills: ['atk_basic_08', 'heal_potion', 'buff_atk', 'buff_def'], skillSource: 'battle',
                        evolve: { stone: null }, art: 'images/story/portraits/explorer/smile.webp', placeholder: { icon: '🐹', color: '#7A5E1E' } }
  }
};

/* V3-2 패시브 (docs/design/battle-balance-v3.md 3장 · 규칙 = js/battle/rules.js V3-1 · 단계 · 보조 효과 = js/gacha/passive.js)
 *  list = 1단계 수치 · from = 열리는 성급 (스토리 캐릭터는 초월석으로 3성이 되면 열림) · aux = 초월 6단계에 더하는 값 */
(function(){
  const P = {
    farmer_rabbit:    { list: [{ type: 'dmgIf', name: '밭갈이 근성', single: true, hpOver: 0.5, pct: 0.15 }], aux: [{ idx: 0, field: 'pct', add: 0.05 }] },
    squirrel_slinger: { list: [{ type: 'extraHit', name: '연속 투석', chance: 0.25, mult: 0.5 }], aux: [{ idx: 0, field: 'chance', add: 0.10 }] },
    mole_miner:       { list: [{ type: 'pierce', name: '굴착', pct: 0.2, minDef: 50 }], aux: [{ idx: 0, field: 'pct', add: 0.05 }] },
    duck_healer:      { list: [{ type: 'turnHeal', name: '포근한 깃털', pct: 0.04 }], aux: [{ idx: 0, field: 'pct', add: 0.01 }] },
    turtle_guard:     { list: [{ type: 'takenIf', name: '단단한 등껍질', front: true, pct: 0.12 }, { type: 'defIfLowHp', name: '단단한 등껍질', hpBelow: 0.5, pct: 0.2 }], aux: [{ idx: 0, field: 'pct', add: 0.03 }] },
    fox_mage:         { list: [{ type: 'dmgIf', name: '잔불', poisoned: true, pct: 0.15 }], aux: [{ idx: 0, field: 'pct', add: 0.05 }] },
    owl_sage:         { list: [{ type: 'startBuff', name: '지혜의 눈', stat: 'atk', pct: 0.08, duration: 3 }, { type: 'dmgIf', name: '지혜의 눈', stunned: true, pct: 0.2 }], aux: [{ idx: 1, field: 'pct', add: 0.05 }] },
    moon_rabbit:      { list: [{ type: 'roundAtk', name: '보름달', pct: 0.04, max: 5 }, { type: 'afterUlt', name: '보름달', effect: 'healAll', pct: 0.05 }], aux: [{ idx: 1, field: 'pct', add: 0.02 }] },
    // V3-5b 신규 1차: 곰 = 필살기 뒤 공격 +12% (2턴) · 고슴도치 = 단일 공격 +10% + 가시 소진(A안 · 초월 6단계 보조 = 가시 회복 +1) · 고양이 = 후열 +15% · 침묵한 적 +10%
    berserk_bear:     { list: [{ type: 'afterUlt', name: '광폭화', effect: 'selfBuff', stat: 'atk', pct: 0.12, duration: 2 }], aux: [{ idx: 0, field: 'pct', add: 0.04 }] },
    hedgehog_archer:  { list: [{ type: 'dmgIf', name: '가시 갑옷', single: true, pct: 0.10 }, { type: 'thornWear', name: '가시 소진', max: 8, regen: 3, low: 4, defLoss: 0.3 }], aux: [{ idx: 1, field: 'regen', add: 1 }] },
    black_cat:        { list: [{ type: 'dmgIf', name: '그림자 걸음', back: true, pct: 0.15 }, { type: 'dmgIf', name: '그림자 걸음', silenced: true, pct: 0.10 }], aux: [{ idx: 0, field: 'pct', add: 0.05 }] },
    s24:              { from: 3, list: [{ type: 'dmgIf', name: '실험체의 집중', single: true, pct: 0.10 }], aux: [{ idx: 0, field: 'pct', add: 0.04 }] },
    hamster_hammer:   { from: 3, list: [{ type: 'afterUlt', name: '호두 껍질 갑옷', effect: 'selfBuff', stat: 'def', pct: 0.2, duration: 2 }], aux: [{ idx: 0, field: 'pct', add: 0.05 }] },
    hamster_explorer: { from: 3, list: [{ type: 'startBuff', name: '모험 준비', stat: 'atk', pct: 0.05, duration: 2 }], aux: [{ idx: 0, field: 'pct', add: 0.02 }] }
  };
  for(const k of Object.keys(P)) window.TALELIA_GACHA.species[k].passive = P[k];
})();
