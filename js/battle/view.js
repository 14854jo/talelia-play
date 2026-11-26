/* =====================================================================
 * TALELIA · battle/view.js — 전투 프로토타입 화면 (그리기 · 조작 · 연출만 · 규칙은 rules.js · 자동 행동은 ai.js)
 *
 *  주소 옵션 (시험용): ?mode=pvp · ?seed=7 · ?auto=1 (아군 자동 전투로 시작) · ?speed=0|1|2|step
 *                     ?fxscale=0.1 (연출 시간만 배율 · 테스트용) · ?motion=reduce|full (움직임 줄이기 강제)
 *  서버 호출 · 로그인 · 저장 없음. 이 폴더 안 파일만 읽습니다.
 *
 *  이야기에서 온 전투: ?encounter=이름 (data/battle-proto.js encounters) · ?return=story.html?… (끝나면 결과를 붙여 돌아감)
 *   - encounter 가 있으면 그 구성으로 아군 · 적을 꾸려 규칙에 넘김 (규칙 · 자동 행동 코드는 그대로) · PVE 고정 · 아래 도구 줄 숨김
 *   - 끝나면: 승리 = [계속] / 패배 · 무승부 = [다시 도전](시드만 바꿔 그 자리에서) · [이야기로 돌아가기]
 *     → return 주소에 &battle=이름&result=win|lose 를 붙여 교체 이동 (전투 화면은 뒤로가기 기록에 남지 않음)
 *   - return 은 같은 폴더의 story.html 만 받음 (다른 주소는 무시 → 돌아가는 버튼 없이 단독 화면)
 *   - encounter 가 없으면 예전과 똑같이 동작
 *
 *  뽑기 편성으로 시험 전투: ?party=1 (&tier=easy|normal|hard · &trialk=배율 · &savekey=시험용 저장 키 · &return=gacha.html?…)
 *   - 뽑기 저장을 읽기만 해서(js/gacha/trial.js) 편성 최대 6명 · 능력치(성급 · 강화 · 초월) · 스킬로 아군을 꾸림 → 규칙 · 자동 행동 코드는 그대로
 *   - 적 = data/gacha/trial.js (난이도는 편성 전투력에 맞춤) · PVE 고정 · 아래 도구 줄 숨김 · 6자리 배치(FX.party.layout)
 *   - 리그가 있는 캐릭터(뽑기 8종 · 24호)는 리그로 · 없으면(햄스터) 정지 그림
 *   - 끝나면: [다시 하기] · [난이도] · [편성으로 돌아가기] → return 주소에 &trial=결과&tier=…&rounds=… 를 붙여 교체 이동
 *   - return 은 같은 폴더의 gacha.html 만 받음 · 휴대폰 세로면 "가로로 돌려 주세요" + [그래도 보기]
 *   - encounter 가 있으면 encounter 가 먼저 · party 가 없으면 이 부분은 모두 꺼져 있음 (예전과 전투 로그가 같음 · tests/battle-party.test.html P1)
 *
 *  던전 전투 (E4 · docs/design/equipment-dungeon.md): ?dungeon=층 (&run=runId · &savekey=… · &return=gacha.html?tab=dungeon)
 *   - 아군 = 시험 전투와 같은 변환(편성 · 장비) · 적 = js/dungeon/rules.js waveOf → 1라운드(일반) → 보스 라운드 · 라운드마다 새 전투 = 전원 회복 (rules.js 그대로)
 *   - 라운드 시작마다 "1라운드" / "보스" 띠를 짧게 · 배경은 지금 전투 배경 그대로 · 6자리 배치 = 시험 전투와 같음
 *   - run = 뽑기 화면이 입장(TaleliaDungeon.enter · 횟수 차감)하고 넘긴 runId → 시드 · 보상 굴림이 runId 로 정해짐
 *     run 이 없으면 미리 보기: 읽은 저장 사본으로 이 화면 안에서만 입장 (저장에 쓰지 않음)
 *   - 결과: 승리 = 골드 + 장비 카드(등급 색 · 부위 · 세트) / 패배 = 보상 없음 · 남은 횟수 · [다시 도전](모자라면 막힘) · [던전으로]
 *   - battle.html 은 저장하지 않음 → return 주소에 &dungeon=층&run=runId&result=win|lose|draw (&again=1 = 다시 도전) 를 붙여 교체 이동 · 반영은 뽑기 화면이 runId 로 한 번만 (E5)
 *
 *  뽑기 캐릭터 공격 연출 (시험 전투 · js/battle/fx-kit.js): 다람쥐 투석 · 여우불 · 달빛 구체 · 달토끼 회전 강타 · 이펙트는 모두 코드로 그림
 *   - 리그 동작의 이벤트(shoot · shoot:small · gather)에 맞춰 투사체를 날리고, 닿는 순간에만 피해 숫자 · HP 를 바꿈 (규칙 · 피해 계산은 그대로)
 *   - 필살기 영상은 주인공 24호와 설화 등급(달토끼 g_moon_pound)만 사용 (FX.ultVideo) · 나머지(부엉이 포함)는 영상 없이 리그 필살기
 *     (ready:false 로 자리만 두는 항목 · 시험용 주소 옵션 ?ultvideoready=종류 · 영상 ?ultvideosrc= 기능은 남겨 둠)
 *
 *  필살기 영상 (FX.ultVideo · 24호 당근 강타): 화면을 덮고 소리 없는 영상 재생 → 닫히는 순간 피해 숫자 · HP
 *   - 직접 조작 = 매번 · 자동 전투 = 전투당 처음 한 번 · 즉시(연출 없음) = 재생 안 함 · 위쪽 [필살기 영상] 버튼으로 끔 (이 기기에 기억)
 *   - 움직임 줄이기 = 영상 대신 마지막 장면 그림(원형 베기)을 잠깐 보여 줌
 *   - 클릭 · 터치 · Space · Enter · Esc = 건너뛰기 · 못 불러오면(최대 ultVideoWait 초 기다림) 기존 필살기 연출로 대신
 *   - 시험용 주소 옵션: ?ultvideo=0|1 (켬 · 끔 강제, 저장 안 함) · ?ultvideorate=4 (재생 배속) · ?ultvideosrc=경로 · ?ultvideodelay=ms (불러오기 늦추기)
 *
 *  연출 원칙
 *   - 규칙(B.act)은 행동을 고르는 즉시 실행합니다 → 피해 · 순서 · 승패는 연출과 무관하게 같습니다.
 *   - 화면은 "보이는 HP · 쓰러짐"(app.shown)을 따로 들고 있다가 연출의 타격 순간에 반영합니다.
 *   - 연출 코드는 B.act · AI.choose · B.rand 를 호출하지 않습니다 (결과 이벤트만 읽음).
 *   - 행동 하나 = 연출 하나. 연출이 끝나야 다음 행동이 시작됩니다.
 * ===================================================================== */
(function(){
  'use strict';
  const Rules = window.TaleliaBattleRules, AI = window.TaleliaBattleAI, DATA = window.TALELIA_BATTLE_PROTO;
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const q = new URLSearchParams(location.search);
  const STAT_SHORT = { atk: '공', def: '방' };
  /** 상태이상 아이콘 표 (v2 5단계 · 한곳에 모음) : icon = 지금 쓰는 이모지 · img = 그림 파일 경로(넣으면 이모지 대신 그림) · name = 띄우는 글자 · 이름표 칩 색은 battle.css .bt-st--종류 */
  const STATUS_ICON = {
    stun:   { icon: '💫', img: null, name: '기절' },
    poison: { icon: '☠', img: null, name: '중독' },
    weaken: { icon: '⬇', img: null, name: '약화' },
    silence: { icon: '🤐', img: null, name: '침묵' }   // V3-5a (나중에 icon_silence.png 로 교체)
  };
  const statusIconHtml = type => { const c = STATUS_ICON[type] || { icon: '?', name: type };
    return c.img ? `<img src="${esc(c.img)}" alt="" draggable="false">` : esc(c.icon); };

  /* ---------- 이야기에서 온 전투 (?encounter= · ?return=) ---------- */
  const ENC_ID = q.get('encounter') || null;
  const encDef = () => (ENC_ID && DATA.encounters && DATA.encounters[ENC_ID]) || null;
  /** 전투 구성 → 규칙에 넘길 데이터 묶음 (다시 시작할 때마다 새로 만듦) · 구성이 없거나 잘못되면 null */
  function encounterData(){
    const E = encDef(); if(!E) return null;
    const pool = DATA.allies.concat(DATA.enemies), find = id => pool.find(u => u.id === id);
    const allies = (E.allies || []).map(id => find(id) && Object.assign({}, find(id)));
    const enemies = (E.enemies || []).map(e => { const b = find(e.base); if(!b) return null; const o = Object.assign({}, b, e); delete o.base; return o; });
    if(!allies.length || !enemies.length || allies.includes(undefined) || enemies.includes(null)) return null;
    return { version: DATA.version, rules: DATA.rules, skills: DATA.skills, allies, enemies };
  }
  /** 돌아갈 주소: 같은 폴더의 story.html(?…) 만 (다른 사이트 · 다른 파일 · javascript: 등은 버림) */
  function safeReturn(v){ return typeof v === 'string' && /^story\.html(\?[A-Za-z0-9_\-.~%&=+]*)?$/.test(v) ? v : null; }
  /* ---------- 뽑기 편성으로 시험 전투 (?party=1) ---------- */
  /* ---------- 던전 전투 (?dungeon=층 · E4) : 시험 전투(?party=1)의 화면 · 아군 변환을 그대로 쓰고 적 · 라운드 · 결과만 다름 ---------- */
  const DGD = window.TALELIA_DUNGEON, DR = window.TaleliaDungeon;
  const DUNGEON = !ENC_ID && /^\d{1,2}$/.test(q.get('dungeon') || '');
  const dungeon = DUNGEON ? { floor: +q.get('dungeon'), round: 1, runId: null, seed: 0, save: null, base: null, preview: !q.get('run'), reward: null, applied: null, error: null, hold: 0, switching: false } : null;
  /* ---------- 스테이지 전투 (?stage=1-3 · S2 · docs/design/stage-system.md) : 시험 전투(?party=1)의 화면 · 아군 변환을 쓰되 장비는 적용하지 않고(1장 스토리 전투) 적 · 결과만 다름 · 한 판(1라운드) ---------- */
  const STD = window.TALELIA_STAGE, SR = window.TaleliaStage;
  const STAGE = !ENC_ID && !DUNGEON && /^\d{1,2}-\d{1,2}$/.test(q.get('stage') || '');
  const stage = STAGE ? { id: q.get('stage'), runId: null, seed: 0, retry: 0, save: null, base: null, preview: !q.get('run'), error: null } : null;
  const PARTY = !ENC_ID && (q.get('party') === '1' || DUNGEON || STAGE);
  const TRIAL = window.TALELIA_GACHA_TRIAL, TR = window.TaleliaGachaTrial;
  const party = { tier: (TRIAL && TRIAL.tiers[q.get('tier')]) ? q.get('tier') : (TRIAL ? TRIAL.defaultTier : 'normal'), k: +q.get('trialk') > 0 ? +q.get('trialk') : 1,
    key: q.get('savekey') || undefined, built: null, rotateOk: false };
  /** 뽑기 저장(읽기만) → 시험 전투 데이터 · 실패하면 null (party.built.reason 에 이유) */
  function partyData(){
    if(!TR || !TRIAL || !window.TaleliaGacha || !window.TALELIA_GACHA){ party.built = { ok: false, reason: '시험 전투 파일을 불러오지 못했어요' }; return null; }
    const G = window.TaleliaGacha, D = window.TALELIA_GACHA;
    if(DUNGEON) return dungeonData(G, D);
    if(STAGE) return stageData(G, D);
    const r = TR.readSave(D, G, { key: party.key });
    party.built = r.ok ? TR.build(D, G, r.save, DATA, TRIAL, { tier: party.tier, k: party.k }) : r;
    if(!party.built.ok) return null;
    // 리그 연결: 화면의 리그 표(FX.rigs)에 이번 아군만 더함 (리그 데이터가 있는 캐릭터만)
    const R = window.TALELIA_RIGS || {};
    for(const id in party.built.rigKeys){ const k = party.built.rigKeys[id]; if(R[k]) FX.rigs[id] = k; }
    return party.built.data;
  }
  /** 던전: 저장(읽기만 · 처음 한 번) → 아군 변환(시험 전투와 같음 · 적은 버림) → 이번 라운드 적(waveOf) · 시드 = runId 에서
   *  실패하면 null (party.built.reason 에 이유) */
  function dungeonData(G, D){
    const failD = reason => { party.built = { ok: false, reason }; return null; };
    if(!DGD || !DR || !window.TALELIA_EQUIP) return failD('던전 파일을 불러오지 못했어요');
    const fl = DR.floorOf(DGD, dungeon.floor); if(!fl) return failD('없는 층이에요: ' + dungeon.floor + '층');
    if(!dungeon.save){
      const r = TR.readSave(D, G, { key: party.key }); if(!r.ok) return failD(r.reason);
      if(!DR.isOpen(DGD, r.save, dungeon.floor)) return failD((dungeon.floor - 1) + '층을 먼저 클리어해야 해요');
      dungeon.save = r.save;
      if(dungeon.preview){ if(!newRun()) return failD(dungeon.error); }
      else { const id = q.get('run'); if(!/^\d{4}-\d{2}-\d{2}#\d{3}$/.test(id)) return failD('전투 번호(run)가 잘못됐어요'); dungeon.runId = id; dungeon.seed = DR.seedOf(id); }
    }
    if(!dungeon.base){ const b = TR.build(D, G, dungeon.save, DATA, TRIAL, {}); if(!b.ok){ party.built = b; return null; } dungeon.base = b.data; dungeon.rigKeys = b.rigKeys; dungeon.power = b.power; }
    party.built = { ok: true, rigKeys: dungeon.rigKeys, power: dungeon.power };
    const R = window.TALELIA_RIGS || {};
    for(const id in dungeon.rigKeys){ const k = dungeon.rigKeys[id]; if(R[k]) FX.rigs[id] = k; }
    app.seed = DR.roundSeed(dungeon.seed, dungeon.round);
    return DR.roundData(DGD, DATA, dungeon.floor, dungeon.round, dungeon.base);
  }
  /** 미리 보기(run 없음) · 미리 보기에서 다시 도전: 저장 사본으로 입장 (횟수 차감 · runId) — 저장소에는 쓰지 않음 */
  function newRun(){
    const e = DR.enter(DGD, dungeon.save, dungeon.floor, Date.now());
    if(!e.ok){ dungeon.error = e.reason; return false; }
    dungeon.save = e.save; dungeon.runId = e.runId; dungeon.seed = e.seed; return true;
  }
  /** 이번 전투의 보상 (승리일 때만 · 화면 표시용 · 뽑기 화면이 같은 runId 로 같은 결과를 반영) + 저장 사본에만 반영 (남은 횟수 · 불운 보정 표시용) */
  function dungeonSettle(result){
    if(dungeon.applied && dungeon.applied.runId === dungeon.runId) return dungeon.applied;
    const E = window.TALELIA_EQUIP, a = DR.applyResult(DGD, E, dungeon.save, { runId: dungeon.runId, floor: dungeon.floor, result, seed: dungeon.seed });
    if(a.ok) dungeon.save = a.save;
    dungeon.applied = { runId: dungeon.runId, result, reward: a.ok ? a.reward : null, dup: !!a.duplicate };   // dup = 이미 반영한 runId (이어 보기 · 결과 화면에 "이미 받은 보상")
    return dungeon.applied;
  }
  const dungeonLeft = () => DR.daily(DGD, dungeon.save, Date.now());
  /** 스테이지: 저장(읽기만 · 처음 한 번) → 아군 변환(시험 전투와 같음 · 장비는 적용하지 않음 · 편성이 비면 스토리 3종) → 이번 스테이지 적(waveOf) · 시드 = runId 에서
   *  실패하면 null (party.built.reason 에 이유) */
  const STORY_PARTY = [['s24', 'front', 0], ['hamster_hammer', 'front', 1], ['hamster_explorer', 'back', 0]];   // 결정 6: 편성이 비었을 때 자동 편성 = 24호 · 망치 · 탐험가 (battle-proto 배치와 같음)
  function stageData(G, D){
    const failS = reason => { party.built = { ok: false, reason }; return null; };
    if(!STD || !SR) return failS('스테이지 파일을 불러오지 못했어요');
    const st = SR.stageOf(STD, stage.id); if(!st) return failS('없는 스테이지예요: ' + stage.id);
    if(!stage.save){
      const r = TR.readSave(D, G, { key: party.key }); if(!r.ok) return failS(r.reason);
      if(!SR.isOpen(STD, r.save, stage.id)) return failS('앞 스테이지를 먼저 클리어해야 해요');
      stage.save = r.save;
      if(stage.preview){ const e = SR.enter(STD, stage.save, stage.id, Date.now()); if(!e.ok){ stage.error = e.reason; return failS(e.reason); } stage.save = e.save; stage.runId = e.runId; stage.seed = e.seed; }
      else { const id = q.get('run'); if(!/^\d{4}-\d{2}-\d{2}#st\d{3}$/.test(id || '')) return failS('전투 번호(run)가 잘못됐어요'); stage.runId = id; stage.seed = SR.seedOf(id); }
    }
    if(!stage.base){
      const sv = Object.assign({}, stage.save, { items: undefined });   // 1장 스토리 전투: 장비 적용 안 함 (items 가 배열이 아니면 trial.build 가 G.statsOf 를 씀)
      if(!sv.party || !sv.party.length) sv.party = STORY_PARTY.map(([sp, row, slot]) => { const u = stage.save.units.find(x => x.species === sp); return u && { uid: u.uid, row, slot }; }).filter(Boolean);
      const b = TR.build(D, G, sv, DATA, TRIAL, {}); if(!b.ok){ party.built = b; return null; }
      stage.base = b.data; stage.rigKeys = b.rigKeys; stage.power = b.power;
    }
    party.built = { ok: true, rigKeys: stage.rigKeys, power: stage.power };
    const R = window.TALELIA_RIGS || {};
    for(const id in stage.rigKeys){ const k = stage.rigKeys[id]; if(R[k]) FX.rigs[id] = k; }
    app.seed = stage.seed + stage.retry;
    return { version: stage.base.version, rules: stage.base.rules, skills: stage.base.skills, allies: JSON.parse(JSON.stringify(stage.base.allies)), enemies: SR.waveOf(STD, stage.id) };
  }
  const stageBattleId = () => 'st' + stage.id.replace('-', '_');   // 이야기 대본의 @전투 이름 (data/story/cast.js battles)
  /** 돌아갈 주소: 시험 전투는 같은 폴더의 gacha.html(?…) 만 */
  function safeStageReturn(v){ return typeof v === 'string' && /^(story|stage)\.html(\?[A-Za-z0-9_\-.~%&=+]*)?$/.test(v) ? v : null; }
  function safeGachaReturn(v){ return typeof v === 'string' && /^gacha\.html(\?[A-Za-z0-9_\-.~%&=+]*)?$/.test(v) ? v : null; }
  const RETURN = ENC_ID ? safeReturn(q.get('return')) : STAGE ? safeStageReturn(q.get('return')) : PARTY ? safeGachaReturn(q.get('return')) : null;   // 스테이지 전투 = 이야기(story.html) 또는 스테이지 화면(stage.html · 대사 건너뛰기)으로 돌아감

  /* ---------- 연출 수치 (모두 임시값 · 시간 단위 = 초 · ×1 기준) ---------- */
  const FX = {
    gap: 0.30,                          // 행동과 행동 사이 쉬는 시간
    speedScale: { 1: 1, 2: 0.5, step: 1 },   // ×2 = 모든 연출 절반 · 즉시(0) = 연출 없음
    melee:  { windup: 0.12, dash: 0.22, strike: 0.10, hit: 0.25, back: 0.25, backOverlap: 0.10,   // 맞음 시작 후 backOverlap 초 뒤 복귀 출발
              windupPx: 10, windupDeg: 6, strikeDeg: 14, strikeScale: 1.08, stopGapPx: 18 },
    // 근접 기본 공격의 타격 = 횡베기 (정지 그림 + 이펙트) · 타격 순간 궤적 + 발밑 먼지 → hold 초 자세 유지 → 복귀
    // 궤적 = 낮고 넓게 가로로 지나가는 빛줄기 (뒤 → 앞으로 그어지며 나타났다가 앞쪽으로 흘러 사라짐)
    slash:  { dur: 0.15, hold: 0.15, reveal: 0.45,              // reveal = dur 중 그어지는 비율
              widthPx: 230, heightPx: 80, yRatio: 0.66,         // 띠 크기 · 높이(그림 위 → 아래 비율 · 당근 높이 근처)
              backRatio: 0.38, driftPx: 14,                      // 띠 시작이 공격자 중심보다 뒤로 가는 비율 · 사라지며 앞으로 흐르는 거리
              ally:  { core: '#fffbe6', mid: '#ffc24a', edge: '#ff7a1a', glow: 'rgba(255,128,32,.85)' },   // 아군: 주황 빛줄기
              enemy: { core: '#ffffff', mid: '#d2d2d2', edge: '#8a8a8a', glow: 'rgba(80,80,80,.45)' },     // 적: 회색
              onUltimate: false },                               // true = 당근 강타 같은 단일 필살기도 횡베기
    dust:   { count: 4, sizePx: 16, spreadPx: 26, risePx: 8, dur: 0.35, color: 'rgba(140,108,68,.7)' },
    ranged: { windup: 0.12, fly: 0.28, hit: 0.25, dotPx: 10 },
    slam:   { windup: 0.12, dash: 0.26, drop: 0.30, hit: 0.25, back: 0.25, backOverlap: 0.10, walnutPx: 56, dropFromPx: 160 },
    volley: { windup: 0.12, stagger: 0.04, fly: 0.30, hit: 0.25 },
    heal:   { windup: 0.12, fly: 0.40, arcPx: 60, glow: 0.30, dotPx: 14 },
    buff:   { hop: 0.25, hopPx: 14, glow: 0.35 },
    hit:    { knockPx: 8, flash: 2.2 },     // 맞음: 밀림 거리 · 번쩍 밝기
    shake:  { px: 6, dur: 0.25 },           // 화면 흔들림 (광역 내리찍기)
    down:   { sinkPx: 8, dur: 0.35 },       // 쓰러짐
    ult:    { dim: 0.25, dur: 0.30 },       // 필살기 강조: 어둡게 · 시간
    idle:   { breathePx: 1.5, period: 2.4 },// 대기 숨쉬기
    turnScale: 1.06,                        // 지금 차례 캐릭터 확대
    // 전장 배치 (임시값 · 이야기 전투 · 기본 화면) : 발 위치 = 전장 가로 % · 세로 % · 아래쪽(세로 % 큰 쪽)이 앞 · 바닥(내려다보는 배경) 가운데쯤
    layout: { ally:  { front0: { x: 33, y: 64 }, front1: { x: 24, y: 74 }, back: { x: 14, y: 56 } },
              enemy: { front0: { x: 66, y: 60 }, front1: { x: 75, y: 72 }, back: { x: 87, y: 52, shadow: 1.1 } } },
    // 화면 키 (전장 폭 1280 기준 px · 임시값) : 그림 파일 이름 또는 진영 기본 · 실제 키 = 이 값 × 원근 배율(persp)
    figH: { ally: 120, guard: 150, sniper: 118, warden: 165 },
    shadowRatio: .95,                       // 발밑 그림자 폭 = 화면 키 × 비율
    // 원근 (임시값) : 발 높이(세로 %)가 yBack 이하면 sBack 배, yFront 이상이면 sFront 배, 그 사이는 고르게 → 뒤(위)는 작게 · 앞(아래)은 크게 (키 · 그림자 함께)
    persp: { yBack: 50, yFront: 74, sBack: .86, sFront: 1.06 },
    // 배경 · 대비 (임시값) : 그림을 못 불러오면 단색 · dim = 전체 어둡게 · dimBottom = 아래쪽 더 어둡게 · 전투 화면은 모두 이 배경 하나 (대화 장면 배경은 data/story/cast.js)
    bg: { src: 'images/battle/bg/lab_floor_battle.webp', dim: .25, dimBottom: .35, shadow: true, outline: false },
    // 스킬별 연출 종류 (없으면: 단일 공격 = 전열 근접 · 후열 원거리 / 광역 = 전열 내리찍기 · 후열 난사 / 회복 = lob / 강화 = cheer)
    skillStyle: { ult_walnut: 'slam', aoe_snipe: 'volley', heal_potion: 'lob', buff_atk: 'cheer', buff_def: 'cheer' },
    // 파츠 리그 (4단계 · js/battle/rig-stage.js) : 리그로 그릴 캐릭터 = 리그 이름 · 캐릭터 키(px) · 리그 동작을 기다리는 최대 시간(안전장치)
    rigs: { subject_24: 'subject_24' }, rigHeight: 96, rigTimeout: 3,
    rigWait: 1.5,         // 전투 시작 후 첫 행동 전에 리그 준비를 기다리는 최대 시간(초 · 실제 시간) · 넘으면 정지 그림으로 진행
    // 필살기 영상 (스킬 id → 쓰는 캐릭터 · 영상 · 첫 장면 · 마지막 장면) · 원본 docs/graphics/s24_battle/ultimate_ref.mp4 → python tools/video_prep.py
    // ※ 필살기 영상은 주인공 24호와 설화 등급(달토끼)만 사용 · 나머지 캐릭터는 영상 없이 리그 필살기로 진행
    ultVideo: { ult_carrot: { unit: 'subject_24', src: 'images/battle/video/s24_ultimate.mp4', first: 'images/battle/video/s24_ultimate_first.webp',
                              last: 'images/battle/video/s24_ultimate_last.webp', dur: 4.27 },
                // 설화 등급 (뽑기 캐릭터 · 시험 전투): 스킬 id 는 뽑기 스킬(uid 접두 없이) · species = 리그 이름 · 원본 docs/graphics/battle/moon_ultimate_src.mp4 (1920×1080)
                g_moon_pound: { species: 'moon_rabbit', ready: true, src: 'images/battle/video/moon_ultimate.mp4', first: 'images/battle/video/moon_ultimate_first.webp',
                                last: 'images/battle/video/moon_ultimate_last.webp', dur: 7.83 } },   // 1280×720 · 7.83초 · 흰 폭발로 끝남 → 피해 숫자
    ultVideoWait: 1.5,    // 필살기를 눌렀는데 아직 못 받았으면 첫 장면을 보여 주며 이만큼(초)만 기다림 → 그래도 안 되면 기존 연출
    ultVideoGuard: 2,     // 영상 길이 + 이만큼(초) 지나도 안 끝나면 강제로 닫음 (멈춤 방지)
    ultVideoOpen: 0.12, ultVideoClose: 0.15,   // 덮개가 열리고 닫히는 시간 (배속과 무관)
    ultStill: 0.6,        // 움직임 줄이기: 마지막 장면 그림을 보여 주는 시간
    // 상태이상 연출 (v2 5단계 · 임시값) : 여러 번 타격 = 숫자를 stagger 초 간격 · 좌우 dxPx · 위로 dyPx 씩 엇갈림
    multiHit: { stagger: 0.12, dxPx: 14, dyPx: 7 },
    statusText: 0.05,     // 걸림 · 저항 글자: 마지막 타격 숫자 뒤 이만큼(초) 늦게
    poisonHold: 0.45,     // 중독 숫자를 띄운 뒤 그 캐릭터 행동까지 더 쉬는 시간
    stun: { hold: 0.6, wobbleDeg: 4 },   // 기절 차례: "기절!" 을 띄우고 이만큼 보여 준 뒤 넘김 · 제자리 흔들림 각도
    // 시험 전투(?party=1) 6자리 배치 (임시값 · ① 2줄) : 깊이 줄 slot 0 = 위 · 1 = 가운데 · 2 = 아래 · 줄 안에서 사선으로 엇갈려 이름표가 아래 줄 캐릭터에 덜 가리게 · 적은 좌우 반전
    party: { layout: { ally:  { back0: { x: 26, y: 49 }, back1: { x: 16, y: 63 }, back2: { x: 6, y: 74 },  front0: { x: 42, y: 49 }, front1: { x: 34, y: 63 }, front2: { x: 26, y: 74 } },
                       enemy: { back0: { x: 74, y: 49 }, back1: { x: 84, y: 63 }, back2: { x: 94, y: 74 }, front0: { x: 58, y: 49 }, front1: { x: 66, y: 63 }, front2: { x: 74, y: 75 } } },
             // 스테이지 적 5장 (S2): 그림은 줄이지 않고 여기서 크기를 맞춤 · figH = 그림 전체 높이(1280 기준 px) = 목표 몸통 높이 ÷ 몸통 비율(더듬이 · 뿔 · 날개 폭 제외)
             //  기준: 아군 몸통 = 아군 정지 그림 키 110 × 0.71 (24호 · 귀 제외) = 78.1 → 목표 몸통 = 배추벌레 85% 66.4 · 달팽이 90% 70.3 · 메뚜기 100% 78.1 · 나방 100% 78.1 · 보스 150% 117.2
             //  몸통 비율(그림 높이 중 머리 윗선 아래): 배추벌레 .665 · 달팽이 .785 · 메뚜기 .72 · 나방 .71 · 딱정벌레 대장 .73 (뿔 제외)
             figH: { ally: 110, guard: 122, sniper: 90, warden: 130, enemy_cabbage_worm: 100, enemy_snail: 89.5, enemy_grasshopper: 108.5, enemy_moth: 110, boss_beetle_chief: 160.5, enemy_scout: 92, enemy_guard: 90, enemy_sniper: 85, enemy_watcher: 120, enemy_retriever_boss: 145 } },   // 저격 기계는 총이 길어(가로 1.8배) 조금 작게 · 감시자는 덩치가 커서 거의 그대로
    // 던전 (?dungeon= · E4) : 라운드 띠를 보여 주는 시간 · 1라운드 승리 후 보스 라운드까지 쉬는 시간 (초 · ×1 기준 · 즉시 모드 = 0)
    dungeon: { banner: 1.1, roundGap: 0.7 }
  };
  const Stage = window.TaleliaBattleRig;   // 없으면 리그 없이 정지 그림으로 동작

  const fxq = +q.get('fxscale');
  const app = { B: null, encounter: ENC_ID, returnUrl: RETURN, encError: false,
    mode: !ENC_ID && !PARTY && q.get('mode') === 'pvp' ? 'pvp' : 'pve', seed: +(q.get('seed') || 1) || 1, autoAlly: q.get('auto') === '1',
    speed: q.has('speed') ? (q.get('speed') === 'step' ? 'step' : +q.get('speed')) : 1, pending: null, timer: 0, logShown: 0, busy: false, autoFlags: {},
    fxscale: fxq > 0 ? fxq : 1,
    reduced: q.get('motion') === 'reduce' ? true : q.get('motion') === 'full' ? false : !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches),
    shown: {}, gen: 0, acting: null, trace: [],
    rig: q.get('rig') !== '0' && !!Stage, rigBase: q.get('rigbase'),   // ?rig=0 = 리그 끄기(비교용) · ?rigbase= = 시험용 원본 그림 경로
    rigSrc: q.get('rigsrc'), rigSmall: q.get('rigsmall'),
    // 필살기 영상: on = 켬/끔 (주소 옵션 > 이 기기 기억 > 켬) · state = none · loading · ready · failed · seen = 이번 전투에 영상을 보여 준 스킬 · log = 시험용 기록
    video: { on: q.get('ultvideo') === '0' ? false : q.get('ultvideo') === '1' ? true : (() => { try { return localStorage.getItem('talelia.battle.ultvideo') !== '0'; } catch(e){ return true; } })(),
             state: 'none', el: null, src: null, seen: {}, log: [], rate: +q.get('ultvideorate') > 0 ? +q.get('ultvideorate') : 1, close: null } };             // ?rigsrc=full = 축소 사본 대신 원본(비교용) · ?rigsmall= = 시험용 사본 경로

  const root = $('#battle');
  root.style.setProperty('--bt-breathe-px', FX.idle.breathePx + 'px');
  root.style.setProperty('--bt-breathe-period', FX.idle.period + 's');
  root.style.setProperty('--bt-turn-scale', FX.turnScale);
  root.classList.toggle('is-reduced', app.reduced);
  root.classList.toggle('is-story', !!ENC_ID);            // 이야기에서 온 전투: 아래 도구 줄(PVE/PVP · 시드 · 속도) 숨김 (battle.css)
  root.classList.toggle('is-party', PARTY);               // 시험 전투: 도구 줄 숨김 · 작은 전장에서 이름표 간단히 · 휴대폰 세로 안내 (battle.css)
  if(PARTY || ENC_ID){   // 스테이지 · 던전 · 시험 · 이야기(프롤로그) 전투 · 휴대폰 세로: 가로로 돌려 달라는 안내 (CSS 가 세로 · 좁은 화면에서만 보여 줌) · [그래도 보기] = 이번에는 숨김
    const r = document.createElement('div'); r.className = 'bt-rotate'; r.id = 'btRotate'; r.setAttribute('role', 'dialog'); r.setAttribute('aria-label', '화면 방향 안내');
    r.innerHTML = '<div class="bt-rotate__box"><div class="bt-rotate__icon" aria-hidden="true">📱↻</div><b>휴대폰을 가로로 돌려 주세요</b><span>가로 화면에서는 캐릭터와 버튼이 더 크게 보여요.</span><button type="button" id="btRotateOk">그래도 보기</button></div>';
    root.appendChild(r);
    r.querySelector('#btRotateOk').addEventListener('click', () => { party.rotateOk = true; root.classList.add('rotate-ok'); });
  }
  if(Stage) Stage.setReduced(app.reduced);                 // 움직임 줄이기: 리그는 기본 자세로 고정

  /* ---------- 배경 · 대비 (주소 옵션: ?bg=none · ?bgdim=0~1 · ?shadow=0 · ?outline=1) ---------- */
  const BG = Object.assign({}, FX.bg);
  if(DUNGEON && dungeon){ const f = dungeon.floor; BG.src = 'images/battle/bg/dungeon_' + (f <= 3 ? 1 : f <= 6 ? 2 : 3) + '.webp'; }   // 던전 전투 배경 (E5d · 결정 5 A): 1~3 · 4~6 · 7~10층 (?bg= 로 바꿀 수 있음)
  if(q.get('bg') === 'none') BG.src = null; else if(q.get('bg')) BG.src = q.get('bg');
  if(q.has('bgdim')){ const v = Math.max(0, Math.min(1, +q.get('bgdim') || 0)); BG.dim = v; BG.dimBottom = v ? Math.min(1, v + .1) : 0; }
  if(q.get('shadow') === '0') BG.shadow = false;
  if(q.get('outline') === '1') BG.outline = true;
  const fieldEl = $('.bt-field');
  app.fx = PARTY && window.TaleliaFx ? window.TaleliaFx.attach(fieldEl) : null;   // 시험 전투 전용 이펙트 캔버스 (js/battle/fx-kit.js)
  fieldEl.style.setProperty('--bt-dim', BG.dim); fieldEl.style.setProperty('--bt-dim-bottom', BG.dimBottom);
  root.classList.toggle('no-shadow', !BG.shadow); root.classList.toggle('has-outline', !!BG.outline);
  app.bg = { src: BG.src, state: BG.src ? 'loading' : 'none' };
  if(BG.src){ const im = new Image();                       // 불러온 뒤에만 배경으로 깔기 (실패하면 단색 그대로)
    im.onload = () => { fieldEl.style.setProperty('--bt-bg', `url("${new URL(BG.src, location.href).href}")`);   // 전체 주소 (CSS 변수 안 상대 경로는 CSS 파일 기준으로 풀림)
      fieldEl.classList.add('has-bg'); app.bg.state = 'ok'; };
    im.onerror = () => { app.bg.state = 'failed'; };
    im.src = BG.src; }
  // 로그 서랍 (기본 닫힘 · 닫혀 있어도 기록은 계속 쌓임)
  $('#btLogToggle').addEventListener('click', () => { const open = $('#btLogBox').classList.toggle('is-open'); $('#btLogToggle').setAttribute('aria-expanded', String(open)); $('#btLogToggle').textContent = open ? '로그 ◂' : '로그 ▸'; });
  const rigOf = u => app.rig && FX.rigs[u.id] || null;
  const rigOn = id => app.rig && FX.rigs[id] && Stage && Stage.ready(id);

  /* ---------- 시작 · 다시 시작 ---------- */
  function restart(){
    clearTimeout(app.timer); app.pending = null; app.logShown = 0; app.tickSeen = 0; app.busy = false; app.acting = null; app.gen++; app.trace = []; app.rigWaitT0 = null;
    cancelFx();
    if(Stage) Stage.resetAll();
    const encData = ENC_ID ? encounterData() : PARTY ? partyData() : null;
    app.encError = (!!ENC_ID || PARTY) && !encData;         // 없는 전투 구성 · 빈 편성: 기본 전장을 깔아 두되 진행하지 않고 안내만 (아래 loop)
    app.B = Rules.create(encData || DATA, { mode: app.mode, seed: app.seed });
    app.video.seen = {};                                    // 자동 전투 "전투당 처음 한 번" 은 다시 시작하면 새로
    preloadUltVideo();
    // 스킬별 자동 사용 설정은 다시 시작해도 유지
    for(const k in app.autoFlags){ const [u, s] = k.split('|'); app.B.setAuto(u, s, app.autoFlags[k]); }
    syncShown();
    $('#btLog').innerHTML = ''; $('#btResult').hidden = true;
    buildField(); buildAutos(); syncControls();
    if(DUNGEON && !app.encError) roundBanner();
    loop();
  }
  /** 던전: 라운드 시작 띠 ("1라운드" / "보스") · 보이는 동안 자동 행동은 기다림 (즉시 모드 = 띠 없이 바로) */
  function roundBanner(){
    for(const d of document.querySelectorAll('.bt-roundbanner')) d.remove();
    const boss = dungeon.round === 2, el = document.createElement('div');
    el.className = 'bt-roundbanner' + (boss ? ' is-boss' : ''); el.dataset.round = String(dungeon.round); el.setAttribute('role', 'status');
    el.innerHTML = `<small>던전 ${dungeon.floor}층</small><b>${boss ? '보스' : '1라운드'}</b>`;
    dungeon.banners = (dungeon.banners || []).concat(boss ? 'boss' : 'round1');
    if(app.speed === 0){ dungeon.hold = 0; return; }
    const dur = ms(FX.dungeon.banner); el.style.setProperty('--bt-banner-dur', dur + 'ms');
    fieldEl.appendChild(el); dungeon.hold = performance.now() + dur;
    setTimeout(() => el.remove(), dur + 50);
  }
  /** 던전: 1라운드 승리 → 잠깐 쉬고 보스 라운드 (새 전투 = 전원 회복 · 결과창 없음) */
  function nextRound(){
    if(dungeon.switching) return; dungeon.switching = true;
    dungeon.round1 = { log: app.B.log.length, rounds: app.B.round, hp: app.B.units.filter(u => u.side === 'ally').map(u => u.hp + '/' + u.maxHp) };
    const gen = app.gen, go = () => { if(gen !== app.gen) return; dungeon.switching = false; dungeon.round = 2; restart(); };
    if(app.speed === 0) return go();
    app.timer = setTimeout(go, ms(FX.dungeon.roundGap));
  }
  function syncShown(){ app.shown = {}; for(const u of app.B.units) app.shown[u.id] = { hp: u.hp, alive: u.alive }; }

  /* ---------- 진영 ---------- */
  /** 배치: 진영 · 열 · 배치 번호 → 발 위치(전장 가로 % · 세로 %) */
  function spotOf(u){
    if(PARTY && !app.encError){ const L = FX.party.layout[u.side]; return L[u.row + u.slot] || L[u.row + '0']; }   // 시험 전투: 6자리
    const L = FX.layout[u.side], key = u.row === 'back' ? 'back' : 'front' + u.slot; return L[key] || L.back; }
  /** 화면 키(전장 폭 1280 기준 px → cqw) : 그림 파일 이름(guard · sniper …) 또는 기본 */
  function figHOf(u){ const k = u.img ? u.img.split('/').pop().replace(/\.[a-z0-9]+$/i, '') : '', H = PARTY && !app.encError ? FX.party.figH : FX.figH;
    return (H[k] || (u.side === 'ally' ? H.ally : null) || FX.figH[k] || FX.figH[u.side] || 96) / 12.8; }
  /** 원근 배율: 발 높이(세로 %) → 뒤(위)는 작게 · 앞(아래)은 크게 (FX.persp) */
  function perspOf(y){ const P = FX.persp; if(!P) return 1; const t = Math.max(0, Math.min(1, (y - P.yBack) / (P.yFront - P.yBack))); return P.sBack + (P.sFront - P.sBack) * t; }
  const shapeHtml = u => `<div class="bt-fig bt-fig--shape bt-fig--${esc(u.shape || 'square')}" style="--c:${esc(u.color || '#888')}"><span>${esc(u.name.replace('임시 ', ''))}</span></div>`;
  function buildField(){
    for(const old of document.querySelectorAll('.bt-unit')) old.remove();
    const box = $('.bt-units');
    app.B.units.forEach((u, i) => {
      const el = document.createElement('div'); el.className = 'bt-unit bt-unit--' + u.side + ' bt-unit--' + u.row; el.dataset.id = u.id;
      if(STAGE && u.side === 'enemy' && /^변이 /.test(u.name)) el.classList.add('is-mutant');   // 변이 해충: 같은 그림 + 보라빛 색 필터 (스테이지 · 결정 13)
      const rig = rigOf(u), sp = spotOf(u), ps = perspOf(sp.y), fh = figHOf(u) * ps;
      el.style.left = sp.x + '%'; el.style.top = sp.y + '%'; el.dataset.z = el.style.zIndex = String(Math.round(sp.y * 10));   // 아래쪽(앞)이 위에 그려짐
      el.dataset.persp = ps.toFixed(3);                                                                                       // 원근 배율 (시험용으로 읽음)
      el.style.setProperty('--fh', fh.toFixed(3) + 'cqw'); el.style.setProperty('--sw', (fh * (sp.shadow || FX.shadowRatio)).toFixed(3) + 'cqw');
      // 리그 캐릭터: 같은 상자 안에 정지 그림(대체 · 크기 기준)과 캔버스를 겹침 → 리그가 준비되면 캔버스만 보임
      const fig = rig && u.img ? `<div class="bt-fig bt-fig--rig" data-rig="${esc(rig)}"><img class="bt-fig--img" src="${esc(u.img)}" alt="" draggable="false"><canvas class="bt-rig-canvas"></canvas></div>`
                : u.img ? `<img class="bt-fig bt-fig--img" src="${esc(u.img)}" alt="" draggable="false">`
                        : shapeHtml(u);
      // .bt-unit = 발 위치 한 점 · .bt-actor = 돌진 · 밀림 (스크립트) / .bt-pose = 숨쉬기 · 차례 확대 (CSS) · .bt-plate = 발밑 표시판
      el.innerHTML = `<div class="bt-shadow"></div><div class="bt-actor"><div class="bt-pose" data-pose="idle" style="--d:${-((i * 0.37) % FX.idle.period).toFixed(2)}s">${fig}</div></div>
        <div class="bt-stunfx" aria-hidden="true"><div class="bt-stunfx__ring"><i>★</i><i>★</i><i>★</i></div></div>
        <div class="bt-floats"></div>
        <div class="bt-plate" title="${u.row === 'front' ? '전열' : '후열'} · 속도 ${u.spd}"><div class="bt-name">${esc(u.name)}</div><div class="bt-hp"><i></i><b></b></div><div class="bt-tags"><div class="bt-effrow" hidden><span class="bt-buffs"></span><span class="bt-status"></span></div><span class="bt-cds"></span></div></div>`;
      el.addEventListener('click', () => pickTarget(u.id));
      el.addEventListener('pointerenter', () => previewSplash(u.id)); el.addEventListener('pointerleave', () => previewSplash(null));   // 적 n명: 함께 맞을 이웃 미리 보기
      box.appendChild(el);
      // 적 그림을 못 불러오면 임시 도형으로
      const im = !rig && u.img && el.querySelector('img.bt-fig');
      if(im) im.addEventListener('error', () => { im.outerHTML = shapeHtml(u); }, { once: true });
      if(rig && u.img){ el.querySelector('.bt-pose').classList.add('has-rig');   // CSS 숨쉬기 끔 (리그가 대기 동작을 그림)
        Stage.mount(u.id, rig, el.querySelector('.bt-fig--rig'), { height: FX.rigHeight, base: app.rigBase, src: app.rigSrc, smallBase: app.rigSmall }); }
    });
  }
  const unitEl = id => document.querySelector(`.bt-unit[data-id="${id}"]`);
  function renderHp(el, hp, max){
    const r = hp / max; el.querySelector('.bt-hp i').style.width = (r * 100) + '%'; el.querySelector('.bt-hp').dataset.level = r > .5 ? 'hi' : r > .25 ? 'mid' : 'lo';
    el.querySelector('.bt-hp b').textContent = hp + ' / ' + max;
  }
  function renderUnits(){
    const cur = app.B.current(), lt = app.pending ? app.B.legalTargets(app.pending) : [], legal = lt.map(t => t.id), side = lt.length ? lt[0].side : null;
    for(const u of app.B.units){
      const el = unitEl(u.id); if(!el) continue;
      const sh = app.shown[u.id] || u, alive = sh.alive;
      el.classList.toggle('is-down', !alive); el.classList.toggle('is-turn', app.acting ? app.acting === u.id : cur === u);
      if(Stage && FX.rigs[u.id]) Stage.freeze(u.id, !alive);                 // 쓰러진 리그는 그 자세로 멈춤
      el.classList.toggle('is-target', legal.includes(u.id)); el.classList.toggle('is-blocked', !!app.pending && !legal.includes(u.id) && u.alive && u.side === side);   // 고를 수 없는 같은 진영 대상만 흐리게
      renderHp(el, sh.hp, u.maxHp);
      el.querySelector('.bt-buffs').innerHTML = u.buffs.map(b => `<span title="${esc(b.name)}">${STAT_SHORT[b.stat]}+${Math.round(b.pct * 100)}% (${b.left})</span>`).join('');
      // 상태이상: 강화 옆 아이콘 + 남은 턴 (나쁜 효과 = 붉은 · 보라 계열) · 기절 = 머리 위 별 · 흐리게 (움직임 줄이기 = 아이콘만)
      const sts = alive ? u.statuses : [];
      el.querySelector('.bt-status').innerHTML = sts.map(s => { const c = STATUS_ICON[s.type] || { name: s.type };
        return `<span class="bt-st bt-st--${esc(s.type)}" data-status="${esc(s.type)}" data-left="${s.left}" title="${esc(c.name + ' · 남은 ' + s.left + '턴' + (s.value ? ' · ' + Math.round(s.value * 100) + '%' : ''))}"><i>${statusIconHtml(s.type)}</i><small>${s.left}</small></span>`; }).join('');
      const th = alive && app.B.thornOf ? app.B.thornOf(u) : null;   // V3-5a 고슴도치 가시 칩 (남은 개수 · 소진이면 붉게)
      if(th) el.querySelector('.bt-status').insertAdjacentHTML('beforeend', `<span class="bt-st bt-st--thorn${th.worn ? ' is-worn' : ''}" data-status="thorn" data-left="${th.left}" title="${esc('가시 ' + th.left + '/' + th.max + (th.worn ? ' · 소진 (방어 -' + Math.round(th.defLoss * 100) + '%)' : ''))}"><i>🦔</i><small>${th.left}</small></span>`);
      el.querySelector('.bt-effrow').hidden = !(u.buffs.length || sts.length || th);
      el.classList.toggle('is-stunned', alive && app.B.isStunned(u));
      el.querySelector('.bt-cds').innerHTML = app.B.skillsOf(u).filter(s => s.cooldown || s.every)
        .map(s => {   // 표시판 칩은 한 줄에 들어가게 짧게: 이름 앞 두 글자 + 남은 턴 (사용 가능 = 금색 · 이름만) · 전체 설명은 title
          const full = s.name.replace(' (임시)', ''), left = s.every ? (s.usable ? 0 : s.every - (u.turns % s.every)) : (s.cd || 0);
          const tip = full + ' · ' + (s.every ? (s.usable ? '이번 턴' : left + '턴 뒤') : (s.cd ? '쿨 ' + s.cd : '가능'));
          return `<span class="${s.usable ? 'ready' : ''}" title="${esc(tip)}">${esc(full.split(' ')[0].slice(0, 2))}${left ? ' ' + left : ''}</span>`; }).join('');
    }
  }

  /* ---------- 위쪽 · 아래쪽 ---------- */
  /** 데이터에 남은 "(임시)" · "임시 " 표시는 ?dev=1 에서만 보임 (화면 글만 바꿈 · 데이터 · 전투 기록은 그대로) */
  const publicText = t => window.TaleliaDev ? t : String(t).replace(/ ?\(임시\)/g, '').replace(/임시 /g, '');
  function renderTop(){
    const B = app.B, cur = B.current();
    if(DUNGEON){ $('#btRound').textContent = '던전 ' + dungeon.floor + '층 · ' + (dungeon.round === 2 ? '보스' : '1라운드') + ' · ' + Math.max(1, B.round) + '바퀴째'; }
    else if(STAGE){ const sd = STD && SR && SR.stageOf(STD, stage.id); $('#btRound').textContent = '스테이지 ' + stage.id + (sd ? ' · ' + sd.title : '') + ' · ' + Math.max(1, B.round) + '바퀴째'; }
    else $('#btRound').textContent = '라운드 ' + Math.max(1, B.round) + ' · ' + (encDef() ? encDef().title || ENC_ID : PARTY ? '시험 전투 · ' + (TRIAL ? TRIAL.tiers[party.tier].name : '') : app.mode === 'pvp' ? 'PVP (전체 속도순)' : 'PVE (아군 → 적)');
    $('#btQueue').innerHTML = B.queueView().map(u => { const stun = B.isStunned(u);   // 기절: 그 칸 회색 + 💫
      return `<li class="bt-q bt-q--${u.side}${u === cur ? ' is-now' : ''}${stun ? ' is-stunned' : ''}" data-id="${esc(u.id)}">${stun ? `<i class="bt-q__st" aria-label="기절">${statusIconHtml('stun')}</i>` : ''}${esc(u.name.replace('임시 ', ''))}<small>${u.spd}</small></li>`; }).join('');
  }
  function renderPanel(){
    const B = app.B, u = B.current(), box = $('#btSkills'), manual = u && u.side === 'ally' && !app.autoAlly;
    $('#btTurn').innerHTML = !u ? '전투 종료' : `지금 차례: <b>${esc(u.name)}</b> ${u.side === 'enemy' ? '(적 · 자동)' : app.autoAlly ? '(자동 전투)' : '— 스킬을 고르세요'}`;
    box.innerHTML = '';
    if(manual){
      for(const s of B.skillsOf(u)){
        const b = document.createElement('button'); b.type = 'button'; b.className = 'bt-skill' + (app.pending === s.id ? ' is-on' : '');
        b.disabled = !s.usable; b.dataset.skill = s.id;
        b.innerHTML = esc(publicText(s.name)) + `<small>${s.target === 'enemy_n' ? '적 ' + s.count + '명' : { enemy_single: '적 하나', enemy_all: '적 전체', ally_single: '아군 하나', ally_all: '아군 전체' }[s.target]}${s.cd ? ' · 쿨 ' + s.cd : s.cooldown ? ' · 쿨타임 ' + s.cooldown : ''}${!s.usable && !s.basic && B.isSilenced && B.isSilenced(u) ? ' · 침묵' : ''}${s.reach === 'back' ? ' · 후열 우선' : ''}</small>`;
        b.addEventListener('click', () => chooseSkill(s));
        box.appendChild(b);
      }
      if(app.pending){ const ps = B.skillsOf(u).find(x => x.id === app.pending);
        box.insertAdjacentHTML('beforeend', '<span class="bt-hint">대상을 누르세요 (흐린 대상은 고를 수 없음 · 스킬을 다시 누르면 취소' + (ps && ps.target === 'enemy_n' ? ' · 적 ' + ps.count + '명: 가리키면 함께 맞는 대상이 점선으로 보여요' : '') + ')</span>'); }
    }
    $('#btStep').hidden = !(app.speed === 'step' && u && (u.side === 'enemy' || app.autoAlly || (B.isStunned && B.isStunned(u))));
  }
  function buildAutos(){
    const box = $('#btAutos'); box.innerHTML = '<span class="bt-label">자동 사용</span>';
    for(const u of app.B.units.filter(x => x.side === 'ally')) for(const s of app.B.skillsOf(u).filter(s => !s.basic)){
      const id = 'auto_' + u.id + '_' + s.id, l = document.createElement('label'); l.className = 'bt-check';
      l.innerHTML = `<input type="checkbox" id="${id}" ${s.auto ? 'checked' : ''}> ${esc(u.name.replace(' 햄스터', ''))} · ${esc(s.name)}`;
      l.querySelector('input').addEventListener('change', e => { app.B.setAuto(u.id, s.id, e.target.checked); app.autoFlags[u.id + '|' + s.id] = e.target.checked; });
      box.appendChild(l);
    }
  }
  function renderLog(){
    const L = app.B.log, ol = $('#btLog');
    for(; app.logShown < L.length; app.logShown++){ const e = L[app.logShown], li = document.createElement('li');
      li.className = e.actor ? 'bt-log--' + e.side : 'bt-log--sys'; li.textContent = publicText(e.text); ol.appendChild(li); }
    ol.scrollTop = ol.scrollHeight;
  }
  function syncControls(){
    for(const b of document.querySelectorAll('[data-mode]')) b.classList.toggle('is-on', b.dataset.mode === app.mode);
    for(const b of document.querySelectorAll('[data-speed]')) b.classList.toggle('is-on', String(b.dataset.speed) === String(app.speed));
    $('#btAuto').classList.toggle('is-on', app.autoAlly); $('#btAuto').textContent = '자동 전투 ' + (app.autoAlly ? 'ON' : 'OFF');
    $('#btSeed').value = app.seed;
    const vb = $('#btVideoToggle'); if(vb){ vb.textContent = '필살기 영상 ' + (app.video.on ? 'ON' : 'OFF'); vb.setAttribute('aria-pressed', String(app.video.on)); }
  }

  /* ---------- 진행 ---------- */
  function render(){ renderTop(); renderUnits(); renderPanel(); renderLog(); }
  function loop(){
    clearTimeout(app.timer);
    if(app.busy) return;                          // 연출 중: 끝나면 다시 불림
    if(app.encError){ showEncError(); return; }   // 없는 전투 구성: 시작하지 않음
    app.B.current();                              // 자기 턴 시작 처리(중독 피해)를 먼저 → 아래에서 숫자로 보여 줌
    const ticked = showTicks();
    render();
    const B = app.B, res = B.result(), u = B.current();
    if(DUNGEON && res === 'win' && dungeon.round === 1){ nextRound(); return; }   // 던전: 1라운드 승리 → 보스 라운드
    if(res || !u){ showResult(B.result()); return; }
    if(u.side === 'enemy' || app.autoAlly || B.isStunned(u)){   // 기절한 아군은 수동이어도 "기절!" 을 보여 주고 넘김
      if(app.speed === 'step') return;            // "다음" 버튼을 기다림
      if(!rigsSettled()){ app.timer = setTimeout(loop, 40); return; }   // 첫 행동 전: 리그 준비를 기다림 (대기 연출은 그대로 보임)
      if(DUNGEON && dungeon.hold > performance.now()){ app.timer = setTimeout(loop, 40); return; }   // 던전: 라운드 띠가 보이는 동안 기다림
      app.timer = setTimeout(autoStep, app.speed === 0 ? 0 : ms(FX.gap + (ticked ? FX.poisonHold : 0)));
    }
  }
  /** 자기 턴 시작 때 생긴 중독 피해(행동이 아닌 로그 줄)를 화면에 반영: 보라색 "☠ -42" · 보이는 HP · 중독으로 쓰러짐 */
  function showTicks(){
    const L = app.B.log; let any = false;
    for(; app.tickSeen < L.length; app.tickSeen++){
      const e = L[app.tickSeen]; if(e.actor || !e.events) continue;
      for(const x of e.events){
        const el = unitEl(x.tgt), sh = app.shown[x.tgt]; if(!el || !sh) continue;
        if(x.type === 'poison'){ any = true; sh.hp = x.hp; renderHp(el, x.hp, app.B.byId(x.tgt).maxHp); if(app.speed !== 0) floatText(el, 'poison', '☠ -' + x.amount); }
        else if(x.type === 'down'){ if(app.speed === 0 || app.reduced){ sh.alive = false; el.classList.add('is-down'); if(Stage && FX.rigs[x.tgt]) Stage.freeze(x.tgt, true); } else downs([x], { moves: 0 }).catch(() => {}); }
      }
    }
    return any;
  }
  /** 이름표 위로 글자 띄우기 (피해 · 회복 · 중독 · 걸림 · 저항 · 기절!) · dx · dy = 엇갈림(px) */
  function floatText(el, kind, text, dx, dy){
    const f = document.createElement('span'); f.className = 'bt-float bt-float--' + kind; f.textContent = text; f.dataset.kind = kind;
    if(dx) f.style.left = dx + 'px'; if(dy) f.style.top = -dy + 'px';
    el.querySelector('.bt-floats').appendChild(f); setTimeout(() => f.remove(), 1100); return f;
  }
  /** 적 n명 스킬로 대상을 고르는 중: 가리킨 주대상과 함께 맞을 이웃을 점선으로 미리 표시 (규칙 B.targetsOf 그대로) */
  function previewSplash(id){
    for(const el of document.querySelectorAll('.bt-unit.is-splash')) el.classList.remove('is-splash');
    const B = app.B, s = app.pending && B.current() && B.skillsOf(B.current()).find(x => x.id === app.pending);
    if(!id || !s || s.target !== 'enemy_n' || !B.legalTargets(s.id).some(t => t.id === id)) return;
    for(const t of B.targetsOf(s.id, id)) if(t.id !== id){ const el = unitEl(t.id); if(el) el.classList.add('is-splash'); }
  }
  /** 기절한 차례: "기절!" 을 띄우고 잠깐 보여 준 뒤 B.pass() (행동 하나 = 연출 하나 · 즉시 모드는 바로 넘김) */
  function performPass(){
    if(app.busy) return;
    const B = app.B, u = B.current(); app.pending = null;
    if(app.speed === 0){ B.pass(); syncShown(); return loop(); }
    const gen = app.gen, el = unitEl(u.id), rec = { n: app.trace.length, actor: u.id, skill: null, pass: true, style: 'stun', t0: performance.now(), t1: 0, impacts: [], moves: 0, floats: 0, pre: {} };
    app.trace.push(rec); app.busy = true; app.acting = u.id; root.classList.add('is-busy');
    render();
    if(el){ floatText(el, 'stun', STATUS_ICON.stun.name + '!'); rec.floats++; }
    const d = FX.stun.wobbleDeg;
    Promise.all([wait(FX.stun.hold), move(actorOf(u.id), [{ transform: T() }, { transform: T(0, 0, -d) }, { transform: T(0, 0, d) }, { transform: T() }], FX.stun.hold * .6, { easing: 'ease-in-out' }, rec)])
      .catch(err => { if(gen === app.gen && err !== ABORT) throw err; })
      .finally(() => { if(gen !== app.gen) return; rec.t1 = performance.now(); finishFx(); B.pass(); app.busy = false; app.acting = null; root.classList.remove('is-busy'); syncShown(); loop(); });
  }
  /** 전투 시작(다시 시작 포함) 후 첫 행동 전에, 리그를 쓰는 모든 캐릭터가 준비됨 또는 실패가 될 때까지 기다림 (최대 FX.rigWait 초 · 실제 시간 · 넘으면 정지 그림으로 진행)
   *  → 처음 접속해 그림을 받는 중이거나 느린 기기에서도 첫 공격이 리그 동작(돌진 · 공격 · 뒤로 뛰기)으로 나감 · 결과(B.act)는 그대로 */
  function rigsSettled(){
    if(app.trace.length || app.speed === 0 || app.reduced || !Stage || !app.rig || !app.B) return true;   // 첫 행동 이후 · 즉시 · 움직임 줄이기 · 리그 없음은 기다리지 않음
    if(app.rigWaitT0 == null) app.rigWaitT0 = performance.now();
    if(performance.now() - app.rigWaitT0 >= FX.rigWait * 1000) return true;                                // 시간 초과: 지금처럼 진행
    for(const u of app.B.units){ const id = rigOf(u) && u.id, su = id && Stage.units[id]; if(su && !su.ready && !su.failed) return false; }
    return true;
  }
  function autoStep(){ if(app.busy) return; const u = app.B.current(); if(!u) return loop(); const c = AI.choose(app.B, u);
    if(c.pass) return performPass();   // 기절: "기절!" 연출 후 행동 없이 넘김
    perform(c.skill, c.target); }
  function perform(skill, target){
    if(app.busy) return;
    const B = app.B, u = B.current(), sdef = B.data.skills[skill];
    const pre = {}; for(const k in app.shown) pre[k] = app.shown[k].hp;
    const ev = B.act(skill, target); app.pending = null;            // ← 규칙 실행 (결과 확정) · 연출은 이 결과를 보여 주기만 함
    if(app.speed === 0){ syncShown(); return loop(); }              // 즉시: 연출 없이 결과만
    const gen = app.gen, rec = { n: app.trace.length, actor: u.id, skill, style: styleOf(u, skill, sdef), t0: performance.now(), t1: 0, impacts: [], moves: 0, floats: 0, pre };
    app.trace.push(rec); app.busy = true; app.acting = u.id; root.classList.add('is-busy');
    for(const el of document.querySelectorAll('.bt-unit')) el.classList.remove('is-target', 'is-blocked');
    play(u, skill, sdef, ev, rec, gen).catch(err => { if(gen === app.gen && !(err && err.name === 'AbortError') && err !== ABORT) throw err; })
      .finally(() => { if(gen !== app.gen) return; rec.t1 = performance.now(); finishFx(); app.busy = false; app.acting = null; root.classList.remove('is-busy'); syncShown(); loop(); });
  }
  function chooseSkill(s){
    if(app.busy || !s.usable) return;
    if(app.pending === s.id){ app.pending = null; return render(); }
    if(/_single$/.test(s.target) || s.target === 'enemy_n'){ app.pending = s.id; return render(); }   // 적 n명 = 주대상을 고름 (v2 4단계)
    perform(s.id, null);
  }
  function pickTarget(id){
    if(app.busy || !app.pending) return;
    if(!app.B.legalTargets(app.pending).some(t => t.id === id)) return;
    perform(app.pending, id);
  }
  function showResult(r){
    const box = $('#btResult'); if(!r){ box.hidden = true; return; }
    const B = app.B;
    const head = `<b>${{ win: '승리', lose: '패배', draw: '무승부' }[r]}</b>`;
    if(DUNGEON){ showDungeonResult(r, head); return; }
    if(STAGE){ showStageResult(r, head); return; }
    if(PARTY){   // 시험 전투: 다시 하기 · 난이도 · 편성으로 돌아가기 (보상 없음 · 뽑기 저장은 바뀌지 않음)
      const T = TRIAL.tiers, b = party.built || {};
      box.innerHTML = head + `<span>시험 전투 · ${esc(T[party.tier].name)} · ${B.round}라운드 · 편성 전투력 ${(b.power || 0).toLocaleString('ko-KR')}</span>`
        + '<div class="bt-result__tiers" role="group" aria-label="난이도">' + Object.keys(T).map(k => `<button type="button" data-tier="${k}" aria-pressed="${k === party.tier}" class="bt-result__sub">${esc(T[k].name)}</button>`).join('') + '</div>'
        + '<button type="button" id="btRetry">다시 하기</button>' + (RETURN ? '<button type="button" id="btGoGacha" class="bt-result__sub">편성으로 돌아가기</button>' : '');
      box.hidden = false; box.dataset.result = r;
      for(const t of box.querySelectorAll('[data-tier]')) t.addEventListener('click', () => { party.tier = t.dataset.tier; app.seed += 1; restart(); });
      $('#btRetry').addEventListener('click', () => { app.seed += 1; restart(); });
      if(RETURN) $('#btGoGacha').addEventListener('click', () => goGacha(r));
      $('#btRetry').focus({ preventScroll: true });
      return;
    }
    if(ENC_ID && RETURN){   // 이야기에서 온 전투: 승리 = 계속 / 패배 · 무승부 = 다시 도전 · 이야기로 돌아가기
      box.innerHTML = head + `<span>${esc(encDef().title || ENC_ID)} · ${B.round}라운드</span>` + (r === 'win'
        ? '<button type="button" id="btGoStory" data-result="win">계속</button>'
        : '<button type="button" id="btRetry">다시 도전</button><button type="button" id="btGoStory" data-result="lose" class="bt-result__sub">이야기로 돌아가기</button>');
      box.hidden = false; box.dataset.result = r;
      $('#btGoStory').addEventListener('click', e => goStory(e.currentTarget.dataset.result));
      if($('#btRetry')) $('#btRetry').addEventListener('click', () => { app.seed += 1; restart(); });   // 같은 전투를 시드만 바꿔 다시
      $(r === 'win' ? '#btGoStory' : '#btRetry').focus({ preventScroll: true });
      return;
    }
    box.innerHTML = head + `<span>${ENC_ID ? esc(encDef().title || ENC_ID) + ' · ' : ''}${B.round}라운드 ${window.TaleliaDev ? ` · ${app.mode.toUpperCase()} · 시드 ${app.seed}` : ''}</span><button type="button" id="btAgain">다시 시작</button>`;
    box.hidden = false; box.dataset.result = r;
    $('#btAgain').addEventListener('click', restart);
  }
  /** 던전 결과: 승리 = 골드 + 장비 카드 / 패배 · 무승부 = 보상 없음 · 남은 횟수 · [다시 도전](모자라면 막힘) · [던전으로] */
  function showDungeonResult(r, head){
    const box = $('#btResult'), E = window.TALELIA_EQUIP, fl = DR.floorOf(DGD, dungeon.floor), st = dungeonSettle(r), rw = st.reward;
    const where = r === 'win' ? '보스까지 클리어' : (dungeon.round === 2 ? '보스' : '1라운드') + '에서 ' + (r === 'draw' ? '무승부' : '패배');
    let body = `<span>던전 ${dungeon.floor}층 · ${where}</span>`;
    if(r === 'win' && rw){
      const it = rw.item, g = E.grades[it.grade];
      body += `<div class="bt-reward" aria-label="보상"><div class="bt-reward__gold"><i aria-hidden="true">●</i>+${rw.gold.toLocaleString('ko-KR')} 골드</div>`
        + `<div class="bt-gear bt-gear--${esc(it.grade)}" data-grade="${esc(it.grade)}" data-slot="${esc(it.slot)}" data-set="${esc(it.set || '')}">`
        + `<em>${esc(g.name)}</em><b>${esc(E.slots[it.slot].name)}</b><small>${it.set ? esc(E.sets[it.set].name) + ' 세트' : '세트 없음'}</small></div>`
        + (rw.pityHit ? '<small class="bt-reward__note">불운 보정으로 전설 확정</small>' : '') + '</div>'
        + '<small class="bt-reward__note">보상은 던전 화면으로 돌아가면 받아요</small>';
    } else body += st.dup ? '<div class="bt-reward is-none">이미 받은 보상이에요 <small>다시 지급되지 않아요</small></div>' : '<div class="bt-reward is-none">보상 없음 <small>입장 횟수는 이미 썼어요</small></div>';
    const t = dungeonLeft(), can = t.left >= fl.cost;
    body += `<small class="bt-left" data-left="${t.left}">오늘 남은 횟수 ${t.left} / ${t.max} · 다시 도전 ${fl.cost}회${can ? '' : ' (모자라요)'}</small>`;
    box.innerHTML = head + body + '<div class="bt-result__row"><button type="button" id="btRetry"' + (can ? '' : ' disabled aria-disabled="true"') + '>다시 도전</button>'
      + (RETURN ? '<button type="button" id="btGoDungeon" class="bt-result__sub">던전으로</button>' : '') + '</div>';
    box.hidden = false; box.dataset.result = r;
    $('#btRetry').addEventListener('click', () => {
      if(!(dungeonLeft().left >= fl.cost)) return;
      if(RETURN && !dungeon.preview) return goDungeon(r, true);                       // 뽑기 화면이 결과 반영 → 다시 입장(차감) → 새 runId 로 다시 엶 (E5)
      if(!newRun()){ showEncError(); return; }                                       // 미리 보기: 이 화면 안 사본으로 다시 입장
      dungeon.round = 1; dungeon.banners = []; restart();
    });
    if(RETURN) $('#btGoDungeon').addEventListener('click', () => goDungeon(r, false));
    (can ? $('#btRetry') : (RETURN ? $('#btGoDungeon') : box)).focus({ preventScroll: true });
  }
  /** 던전 결과를 들고 뽑기 화면으로 (교체 이동 · 저장은 뽑기 화면이 runId 로 한 번만 반영) */
  function goDungeon(result, again, town){
    if(!RETURN) return;
    location.replace(RETURN + (RETURN.includes('?') ? '&' : '?') + 'dungeon=' + dungeon.floor + '&run=' + encodeURIComponent(dungeon.runId || '') + '&result=' + encodeURIComponent(result) + (again ? '&again=1' : '') + (town ? '&go=town' : ''));
  }
  /** 스테이지 결과: 승리 = 첫 클리어 보상 안내(받는 것은 스테이지 화면) · 패배 · 무승부 = 다시 도전 · 이야기로 돌아가기 · 저장은 하지 않음 */
  function showStageResult(r, head){
    const box = $('#btResult'), B = app.B, sd = SR.stageOf(STD, stage.id), done = !!(stage.save && stage.save.stage && stage.save.stage.cleared[stage.id]);
    let body = `<span>스테이지 ${esc(stage.id)} · ${esc(sd.title)} · ${B.round}라운드 · 편성 전투력 ${((party.built && party.built.power) || 0).toLocaleString('ko-KR')}</span>`;
    if(r === 'win') body += done ? '<div class="bt-reward is-none">이미 클리어한 스테이지예요 <small>보상은 첫 클리어 때만 받아요</small></div>'
      : `<div class="bt-reward" aria-label="첫 클리어 보상"><div class="bt-reward__gold"><i aria-hidden="true">●</i>정령석 +${sd.reward.stones.toLocaleString('ko-KR')} · 골드 +${sd.reward.gold.toLocaleString('ko-KR')}${sd.reward.tstones ? ' · 초월석 +' + sd.reward.tstones : ''}</div></div><small class="bt-reward__note">보상은 스테이지 화면으로 돌아가면 받아요</small>`;
    // 패배 · 무승부: 동료 모으기 안내 + [소환하러 가기] [편성 확인] (결과는 스테이지 화면이 반영한 뒤 그 화면으로) · 1-2 첫 패배는 크게 (미리 보기에는 없음)
    let rc = null, big = false;
    if(r !== 'win' && RETURN && !stage.preview && stage.save){
      const GD = window.TALELIA_GACHA;
      rc = SR.recruit(stage.save, GD.cost.single, GD.partyMax); big = stage.retry === 0 && SR.firstDefeat(stage.save, stage.id);
      const b = { summon: '소환하러 가기', party: '편성 확인' }, order = rc.primary === 'party' ? ['party', 'summon'] : ['summon', 'party'];
      body += `<div class="bt-recruit${big ? ' is-first' : ''}"><p>${esc(rc.text)}</p><div class="bt-recruit__btns">` + order.map((k, i) => `<button type="button" data-go="${k}" data-result="${r}"${big && i === 0 ? '' : ' class="bt-result__sub"'}>${b[k]}</button>`).join('') + '</div></div>';
    }
    box.innerHTML = head + body + '<div class="bt-result__row">' + (r === 'win' && RETURN ? '<button type="button" id="btGoStage" data-result="win">계속</button>'
      : '<button type="button" id="btRetry"' + (big ? ' class="bt-result__sub"' : '') + '>다시 도전</button>' + (RETURN ? '<button type="button" id="btGoStage" data-result="lose" class="bt-result__sub">이야기로 돌아가기</button>' : '')) + '</div>';
    box.hidden = false; box.dataset.result = r;
    if($('#btGoStage')) $('#btGoStage').addEventListener('click', e => goStage(e.currentTarget.dataset.result));
    for(const b of box.querySelectorAll('.bt-recruit [data-go]')) b.addEventListener('click', () => goStage(b.dataset.result, b.dataset.go));
    if($('#btRetry')) $('#btRetry').addEventListener('click', () => { stage.retry += 1; restart(); });   // 같은 판(runId)을 시드만 바꿔 다시 · 결과는 한 번만 반영됨
    ((big && box.querySelector('.bt-recruit [data-go]')) || (r === 'win' && RETURN ? $('#btGoStage') : $('#btRetry'))).focus({ preventScroll: true });
  }
  /** 스테이지 결과를 들고 이야기로 (교체 이동 · 이야기가 전후 대사 뒤 스테이지 화면으로 runId 와 결과를 넘김)
   *  go = 'town'(true 도 같음) | 'summon' | 'party' : 다른 화면으로 가려는 길 → 이야기 속 전투여도 패배 대사 없이 바로 스테이지 화면 (결과를 반영한 뒤 go 로 보냄) */
  function goStage(result, go){
    if(!RETURN) return;
    const dest = go === true ? 'town' : go || null, key = q.get('savekey');
    let back = RETURN;
    if(dest && !/^stage\.html/.test(back)) back = 'stage.html' + (key ? '?savekey=' + encodeURIComponent(key) : '');
    const sep = back.includes('?') ? '&' : '?';
    if(/^stage\.html/.test(back)){ location.replace(back + sep + 'stage=' + encodeURIComponent(stage.id) + '&run=' + encodeURIComponent(stage.runId || '') + '&result=' + encodeURIComponent(result) + (dest ? '&go=' + dest : '')); return; }   // 스테이지 화면이 결과를 반영
    location.replace(back + sep + 'battle=' + encodeURIComponent(stageBattleId()) + '&run=' + encodeURIComponent(stage.runId || '') + '&result=' + encodeURIComponent(result));
  }
  /** 결과를 들고 이야기로 (교체 이동 → 끝난 전투 화면이 뒤로가기 기록에 남지 않음) */
  function goStory(result){
    if(!RETURN) return;
    location.replace(RETURN + (RETURN.includes('?') ? '&' : '?') + 'battle=' + encodeURIComponent(ENC_ID) + '&result=' + encodeURIComponent(result));
  }
  /** 시험 전투 결과를 들고 뽑기 편성 탭으로 (교체 이동 · 뽑기 저장은 건드리지 않음) */
  function goGacha(result){
    if(!RETURN) return;
    location.replace(RETURN + (RETURN.includes('?') ? '&' : '?') + 'trial=' + encodeURIComponent(result) + '&tier=' + encodeURIComponent(party.tier) + '&rounds=' + (app.B ? app.B.round : 0));
  }
  function showEncError(){
    const box = $('#btResult');
    if(DUNGEON){   // 저장 없음 · 빈 편성 · 잠긴 층 · 횟수 부족 · 잘못된 run
      box.innerHTML = '<b>던전에 들어갈 수 없어요</b><span></span>' + (RETURN ? '<button type="button" id="btGoDungeon">던전으로</button>' : '');
      box.querySelector('span').textContent = dungeon.error || (party.built && party.built.reason) || '편성을 읽지 못했어요';
      box.hidden = false; box.dataset.result = 'error';
      if(RETURN) $('#btGoDungeon').addEventListener('click', () => goDungeon('error', false));
      return;
    }
    if(STAGE){   // 저장 없음 · 잠긴 스테이지 · 없는 스테이지 · 잘못된 run
      box.innerHTML = '<b>스테이지에 들어갈 수 없어요</b><span></span>' + (RETURN ? '<button type="button" id="btGoStage" data-result="error">이야기로 돌아가기</button>' : '');
      box.querySelector('span').textContent = stage.error || (party.built && party.built.reason) || '편성을 읽지 못했어요';
      box.hidden = false; box.dataset.result = 'error';
      if(RETURN) $('#btGoStage').addEventListener('click', () => goStage('error'));
      return;
    }
    if(PARTY){   // 빈 편성 · 저장 없음 · 망가진 저장
      box.innerHTML = '<b>시험 전투를 시작할 수 없어요</b><span></span>' + (RETURN ? '<button type="button" id="btGoGacha">편성으로 돌아가기</button>' : '');
      box.querySelector('span').textContent = (party.built && party.built.reason) || '편성을 읽지 못했어요';
      box.hidden = false; box.dataset.result = 'error';
      if(RETURN) $('#btGoGacha').addEventListener('click', () => goGacha('error'));
      return;
    }
    box.innerHTML = '<b>전투 구성을 찾지 못했어요</b><span></span>' + (RETURN ? '<button type="button" id="btGoStory" data-result="error">이야기로 돌아가기</button>' : '');
    box.querySelector('span').textContent = ENC_ID;
    box.hidden = false; box.dataset.result = 'error';
    if(RETURN) $('#btGoStory').addEventListener('click', () => goStory('error'));
  }

  /* =====================================================================
   * 연출 (화면 전용)
   * ===================================================================== */
  const ABORT = { name: 'AbortError' };
  const ms = s => s * 1000 * (FX.speedScale[app.speed] || 1) * app.fxscale;
  const T = (x, y, deg, s) => `translate(${x || 0}px,${y || 0}px) rotate(${deg || 0}deg) scale(${s || 1})`;
  const field = () => $('.bt-field');
  const actorOf = id => { const el = unitEl(id); return el && el.querySelector('.bt-actor'); };
  const figOf = id => { const el = unitEl(id); return el && el.querySelector('.bt-fig'); };
  const dirOf = u => u.side === 'ally' ? 1 : -1;     // 아군 = 오른쪽을 향함

  function styleOf(u, sid, sdef){
    if(FX.skillStyle[sid]) return FX.skillStyle[sid];
    if(sdef.kind === 'heal') return 'lob';
    if(sdef.kind === 'buff') return 'cheer';
    if(sdef.target === 'enemy_all') return u.row === 'front' ? 'slam' : 'volley';
    return u.row === 'front' ? 'melee' : 'ranged';
  }
  function setPose(id, pose){ const el = unitEl(id), p = el && el.querySelector('.bt-pose'); if(p) p.dataset.pose = pose; }   // 나중에 동작 프레임 교체 지점

  /** 애니메이션 하나 → 끝날 때까지 기다림 (재시작되면 중단) */
  function run(el, frames, sec, opt, rec, isMove){
    const gen = app.gen;
    if(!el) return Promise.resolve();
    if(isMove && rec) rec.moves++;
    const a = el.animate(frames, Object.assign({ duration: ms(sec), fill: 'forwards', easing: 'ease-out' }, opt || {}));
    return a.finished.then(() => { if(gen !== app.gen) throw ABORT; });
  }
  /** 움직임 연출 (움직임 줄이기면 건너뜀) */
  const move = (el, frames, sec, opt, rec) => app.reduced ? Promise.resolve() : run(el, frames, sec, opt, rec, true);
  const wait = sec => { const gen = app.gen; return new Promise(r => setTimeout(r, ms(sec))).then(() => { if(gen !== app.gen) throw ABORT; }); };
  /** 리그 재생 속도 = 연출 시간 배율의 역수 (×2 = 2배 빠르게 · fxscale 0.1 = 10배 빠르게) */
  const rigSpeed = () => 1 / ((FX.speedScale[app.speed] || 1) * app.fxscale);
  /** 리그 동작 신호를 기다리되, rigTimeout 초가 지나면 그냥 진행 (연출이 멈추지 않게) */
  const rigWait = p => { const gen = app.gen; return Promise.race([p, new Promise(r => setTimeout(r, ms(FX.rigTimeout)))]).then(() => { if(gen !== app.gen) throw ABORT; }); };
  function rel(el){ const f = field().getBoundingClientRect(), r = el.getBoundingClientRect();
    return { x: r.left - f.left, y: r.top - f.top, w: r.width, h: r.height, cx: r.left - f.left + r.width / 2, cy: r.top - f.top + r.height / 2, l: r.left - f.left, r: r.right - f.left, b: r.bottom - f.top }; }
  function fxEl(cls, html){ const d = document.createElement('div'); d.className = 'bt-fx ' + cls; if(html) d.innerHTML = html; field().appendChild(d); return d; }
  function cancelFx(){
    closeUltVideo('abort'); if(app.fx) app.fx.fx.clear();
    try{ for(const a of document.getAnimations()) if(!(window.CSSAnimation && a instanceof CSSAnimation) && !(window.CSSTransition && a instanceof CSSTransition)) a.cancel(); }catch(e){}
    for(const d of document.querySelectorAll('.bt-fx')) d.remove();
    for(const el of document.querySelectorAll('.bt-unit')) el.style.zIndex = el.dataset.z || '';
  }
  function finishFx(){
    for(const el of document.querySelectorAll('.bt-actor, .bt-fig, .bt-field')) for(const a of el.getAnimations()) if(!(window.CSSAnimation && a instanceof CSSAnimation)) a.cancel();
    for(const d of document.querySelectorAll('.bt-fx')) d.remove();
    for(const el of document.querySelectorAll('.bt-unit')) el.style.zIndex = el.dataset.z || '';
    for(const p of document.querySelectorAll('.bt-pose')) p.dataset.pose = 'idle';
  }

  /** 타격 순간: 숫자 · HP · 번쩍 · 밀림 (이벤트 묶음) */
  function impact(evs, rec, dir){
    const jobs = [], MH = FX.multiHit, lastAt = {};
    for(const e of evs){
      if(!unitEl(e.tgt)) continue;
      // 여러 번 타격: 타격마다 stagger 초 늦게 · 좌우 · 위로 엇갈려 띄움 (HP 도 그 순간에) · 걸림 · 저항 글자 = 그 대상 마지막 숫자 뒤
      const at = e.type === 'damage' ? (e.hits > 1 ? (e.hit - 1) * MH.stagger : 0) : (e.type === 'status' || e.type === 'resist') ? (lastAt[e.tgt] || 0) + FX.statusText : 0;
      if(e.type === 'damage') lastAt[e.tgt] = at;
      if(at > 0) jobs.push(wait(at).then(() => Promise.all(impactOne(e, rec, dir))));
      else jobs.push(...impactOne(e, rec, dir));
    }
    return Promise.all(jobs);
  }
  function impactOne(e, rec, dir){
    const jobs = [], el = unitEl(e.tgt), MH = FX.multiHit;
    {
      const hpText = el.querySelector('.bt-hp b').textContent;
      if(e.type === 'damage' || e.type === 'heal'){
        app.shown[e.tgt].hp = e.hp; renderHp(el, e.hp, app.B.byId(e.tgt).maxHp);
        rec.impacts.push({ tgt: e.tgt, type: e.type, t: performance.now(), domBefore: hpText, preText: rec.pre[e.tgt] + ' / ' + app.B.byId(e.tgt).maxHp, after: el.querySelector('.bt-hp b').textContent, hp: e.hp, hit: e.hit || 1 });
      }
      if(e.type === 'damage' || e.type === 'heal' || e.type === 'buff'){
        const k = e.hits > 1 ? e.hit - 1 : 0, dx = k ? (k % 2 ? 1 : -1) * MH.dxPx * Math.ceil(k / 2) : 0;
        floatText(el, e.type, e.type === 'damage' ? '-' + e.amount : e.type === 'heal' ? '+' + e.amount : STAT_SHORT[e.stat] + '+' + Math.round(e.pct * 100) + '%', dx, k * MH.dyPx);
        rec.floats++;
      }
      if(e.type === 'status' || e.type === 'resist'){   // 걸림 = "약화" 등 · 막힘 = "저항"(확률 · 기절 내성) / "면역"
        floatText(el, e.type, e.type === 'status' ? (STATUS_ICON[e.status] || { name: e.status }).name : e.reason === 'immune' ? '면역' : '저항', 0, MH.dyPx * 3);
        rec.floats++;
      }
      if(e.type === 'damage'){
        setPose(e.tgt, 'hit');
        if(rigOn(e.tgt) && !app.reduced) Stage.hit(e.tgt, rigSpeed());           // 리그: 젖혀지며 붉게 번쩍 (흰 번쩍임 대신)
        else jobs.push(run(figOf(e.tgt), [{ filter: 'brightness(1)' }, { filter: `brightness(${FX.hit.flash}) saturate(.4)`, offset: .25 }, { filter: 'brightness(1)' }], FX.melee.hit, { easing: 'linear' }, rec));
        jobs.push(move(actorOf(e.tgt), [{ transform: T() }, { transform: T(dir * FX.hit.knockPx), offset: .3 }, { transform: T() }], FX.melee.hit, null, rec));
      } else if(e.type === 'heal'){
        jobs.push(run(figOf(e.tgt), [{ filter: 'brightness(1) drop-shadow(0 0 0 rgba(79,209,139,0))' }, { filter: 'brightness(1.25) drop-shadow(0 0 10px rgba(79,209,139,1))', offset: .35 }, { filter: 'brightness(1) drop-shadow(0 0 0 rgba(79,209,139,0))' }], FX.heal.glow, { easing: 'linear' }, rec));
      } else if(e.type === 'buff'){
        const g = document.createElement('div'); g.className = 'bt-fx bt-fx-glow'; (el.querySelector('.bt-actor') || el).appendChild(g);
        jobs.push(run(g, [{ opacity: 0 }, { opacity: 1, offset: .3 }, { opacity: 0 }], FX.buff.glow, { easing: 'linear' }, rec).then(() => g.remove()));
      }
    }
    return jobs;
  }
  /** 쓰러짐: 흐려지며 가라앉음 → 회색 */
  async function downs(evs, rec){
    const ids = evs.filter(e => e.type === 'down').map(e => e.tgt); if(!ids.length) return;
    await Promise.all(ids.map(id => app.reduced
      ? run(actorOf(id), [{ opacity: 1 }, { opacity: .5 }], FX.down.dur, null, rec)
      : run(actorOf(id), [{ opacity: 1, transform: T() }, { opacity: .5, transform: T(0, FX.down.sinkPx) }], FX.down.dur, null, rec, true)));
    ids.forEach(id => { app.shown[id].alive = false; const el = unitEl(id); if(el) el.classList.add('is-down'); if(Stage && FX.rigs[id]) Stage.freeze(id, true); });
  }
  /* ---------- 필살기 영상 ---------- */
  const ultCfg = sid => FX.ultVideo && (FX.ultVideo[sid] || FX.ultVideo[String(sid).split(':').pop()]) || null;   // 뽑기 스킬 id 는 "uid:스킬" 이라 접두를 떼고도 찾음
  /** 이 영상 설정이 이 캐릭터 것인지 (unit = 전투 id · species = 시험 전투 리그 이름) · ready:false 는 자리만 (?ultvideoready=종류,… 로 켤 수 있음) */
  const ultReady = c => c.ready !== false || (q.get('ultvideoready') || '').split(',').includes(c.species);
  const ultMine = (c, id) => ultReady(c) && (c.unit === id || (!!c.species && PARTY && !!party.built && !!party.built.rigKeys && party.built.rigKeys[id] === c.species));
  const ultSrc = c => q.get('ultvideosrc') || c.src;
  /** 이번 필살기에 영상을 보여 줄지: 켬 · 그 캐릭터의 스킬 · 직접 조작 = 매번 / 자동 전투 = 전투당 처음 한 번 (즉시 모드는 연출 자체가 없음) */
  function ultVideoWanted(u, sid){
    const c = ultCfg(sid);
    return !!c && ultMine(c, u.id) && app.video.on && app.speed !== 0 && !(app.autoAlly && app.video.seen[sid]);
  }
  /** 미리 불러오기: 이번 전투 아군에 영상 필살기를 쓰는 캐릭터가 있으면 숨긴 영상(움직임 줄이기 = 마지막 장면 그림)을 바로 받기 시작 */
  function preloadUltVideo(want){
    const V = app.video; if(!V.on || !app.B) return;
    const c = want || Object.values(FX.ultVideo || {}).find(c => app.B.units.some(x => x.side === 'ally' && ultMine(c, x.id))); if(!c) return;
    if(app.reduced){ if(!V.still){ V.still = new Image(); V.still.src = c.last; } return; }
    const src = ultSrc(c); if(V.src === src && V.state !== 'failed') return;
    const v = V.el = document.createElement('video');
    v.muted = true; v.defaultMuted = true; v.playsInline = true; v.preload = 'auto';
    v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.setAttribute('aria-hidden', 'true'); v.disablePictureInPicture = true;
    V.src = src; V.state = 'loading';
    const ok = () => { if(V.el === v && V.state === 'loading'){ V.state = 'ready'; V.log.push({ ev: 'ready', t: performance.now() }); } };
    v.addEventListener('canplaythrough', ok); v.addEventListener('loadeddata', () => { if(v.readyState >= 3) ok(); });
    v.addEventListener('error', () => { if(V.el === v){ V.state = 'failed'; V.log.push({ ev: 'failed', t: performance.now() }); } });
    const go = () => { v.src = src; v.load(); };
    if(+q.get('ultvideodelay') > 0) setTimeout(go, +q.get('ultvideodelay')); else go();
  }
  /** 영상 덮개를 닫음 (다시 시작 · 건너뛰기 · 끝) */
  function closeUltVideo(how){ const f = app.video.close; if(f) f(how); }
  /** 필살기 영상 재생 → 'ended' | 'skip' | 'still'(움직임 줄이기) | 'fallback'(못 불러옴 → 기존 연출) | 'abort'(다시 시작) */
  function ultVideo(u, sid, rec){
    const c = ultCfg(sid), V = app.video, t0 = performance.now(), gen = app.gen;
    if(!app.reduced && V.src !== ultSrc(c)) preloadUltVideo(c);   // 이 캐릭터의 영상이 아직 아니면 지금 불러옴 (여러 캐릭터 영상 자리)
    const info = rec.video = { sid, mode: app.reduced ? 'still' : 'video', t0, tOpen: 0, tPlay: 0, tEnd: 0, how: null, waited: 0, rate: V.rate };
    const ov = document.createElement('div'); ov.className = 'bt-video'; ov.dataset.sid = sid;
    ov.innerHTML = '<div class="bt-video__frame"></div><span class="bt-video__skip">눌러서 건너뛰기</span>';
    const frame = ov.querySelector('.bt-video__frame');
    document.body.appendChild(ov);
    ov.animate([{ opacity: 0 }, { opacity: 1 }], { duration: FX.ultVideoOpen * 1000, fill: 'forwards' });
    info.tOpen = performance.now();
    return new Promise(resolve => {
      let over = false, guard = 0;
      const v = V.el;
      const keys = e => { if(e.key === ' ' || e.key === 'Enter' || e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); finish('skip'); } };
      const click = e => { e.preventDefault(); e.stopPropagation(); finish('skip'); };
      function finish(how){
        if(over) return; over = true; clearTimeout(guard); V.close = null;
        document.removeEventListener('keydown', keys, true); ov.removeEventListener('click', click);
        info.how = how; info.tEnd = performance.now(); V.log.push({ ev: how, sid, t: info.tEnd });
        if(v){ try{ v.pause(); }catch(e){} v.onended = null; if(v.parentNode) v.remove(); }
        if(how === 'abort' || how === 'fallback'){ ov.remove(); return resolve(how); }
        const a = ov.animate([{ opacity: 1 }, { opacity: 0 }], { duration: FX.ultVideoClose * 1000, fill: 'forwards' });
        a.onfinish = () => { ov.remove(); info.tClose = performance.now(); resolve(gen === app.gen ? how : 'abort'); };
      }
      V.close = finish;
      document.addEventListener('keydown', keys, true); ov.addEventListener('click', click);
      if(app.reduced){   // 움직임 줄이기: 마지막 장면 그림만 잠깐
        const im = document.createElement('img'); im.alt = ''; im.src = c.last; frame.appendChild(im);
        info.tPlay = performance.now(); guard = setTimeout(() => finish('still'), FX.ultStill * 1000); return;
      }
      if(!v || V.state === 'failed'){ info.reason = v ? 'failed' : 'none'; return finish('fallback'); }
      const play = () => {
        if(over) return;
        frame.querySelector('img') && frame.querySelector('img').remove();
        frame.appendChild(v); v.currentTime = 0; v.playbackRate = V.rate;
        info.tPlay = performance.now(); V.log.push({ ev: 'play', sid, t: info.tPlay });
        v.onended = () => finish('ended');
        const p = v.play(); if(p && p.catch) p.catch(() => { info.reason = 'play-rejected'; finish('fallback'); });
        guard = setTimeout(() => finish('ended'), (c.dur / V.rate + FX.ultVideoGuard) * 1000);
      };
      if(V.state === 'ready' && v.readyState >= 3) return play();
      // 아직 받는 중: 첫 장면을 보여 주며 ultVideoWait 초까지만 기다림
      const im = document.createElement('img'); im.alt = ''; im.src = c.first; frame.appendChild(im);
      const w0 = performance.now();
      const poll = () => { if(over) return; info.waited = performance.now() - w0;
        if(V.state === 'ready' || v.readyState >= 3) return play();
        if(V.state === 'failed' || info.waited >= FX.ultVideoWait * 1000){ info.reason = V.state === 'failed' ? 'failed' : 'timeout'; return finish('fallback'); }
        guard = setTimeout(poll, 50); };
      poll();
    });
  }
  /** 필살기 강조: 어둡게 + 스킬 이름 */
  function ultIntro(name, rec){
    const dim = fxEl('bt-fx-dim'), ban = fxEl('bt-fx-banner', esc(name.replace(' (임시)', '')));
    const sc = app.reduced ? [1, 1, 1] : [.8, 1.1, 1.15];
    return Promise.all([
      run(dim, [{ opacity: 0 }, { opacity: FX.ult.dim, offset: .3 }, { opacity: FX.ult.dim, offset: .7 }, { opacity: 0 }], FX.ult.dur, { easing: 'linear' }, rec),
      run(ban, [{ opacity: 0, transform: `translate(-50%,-50%) scale(${sc[0]})` }, { opacity: 1, transform: `translate(-50%,-50%) scale(${sc[1]})`, offset: .4 }, { opacity: 0, transform: `translate(-50%,-50%) scale(${sc[2]})` }], FX.ult.dur, { easing: 'ease-out' }, rec)
    ]).then(() => { dim.remove(); ban.remove(); });
  }
  /** 발사체: from → to (arc > 0 이면 포물선) */
  function shoot(fromId, toId, sec, cls, sizePx, arc, delay, rec){
    const a = rel(figOf(fromId)), b = rel(figOf(toId)), d = fxEl('bt-fx-dot ' + cls);
    d.style.width = d.style.height = sizePx + 'px';
    const x0 = a.cx - sizePx / 2, y0 = a.cy - sizePx / 2, x1 = b.cx - sizePx / 2, y1 = b.cy - sizePx / 2, frames = [];
    for(let i = 0; i <= 10; i++){ const t = i / 10; frames.push({ transform: `translate(${x0 + (x1 - x0) * t}px,${y0 + (y1 - y0) * t - (arc || 0) * 4 * t * (1 - t)}px)` }); }
    if(app.reduced){ d.remove(); return Promise.resolve(); }
    return run(d, frames, sec, { easing: 'linear', delay: ms(delay || 0) }, rec, true).then(() => d.remove());
  }

  const isBasic = sdef => sdef.kind === 'attack' && !sdef.cooldown && !sdef.tag && !sdef.every;
  /** 횡베기 궤적: 낮고 넓은 가로 빛줄기가 뒤 → 앞으로 그어지고, 앞으로 흐르며 사라짐 (움직임 줄이기 = 제자리에서 나타났다 사라짐) */
  let slashSeq = 0;
  /* ---------- 뽑기 캐릭터 공격 연출 (시험 전투 · 리그 + js/battle/fx-kit.js · 규칙 · 피해 계산과 무관) ---------- */
  const rigDefOf = id => { const k = FX.rigs[id]; return (k && window.TALELIA_RIGS && window.TALELIA_RIGS[k]) || null; };
  const rigFxOf = id => { const d = rigDefOf(id); return (d && d.fx) || {}; };
  /** 리그 기준 전신 좌표 b → 전장 위 화면 좌표 (캐릭터 캔버스가 그리는 방식과 같은 변환 · 돌진 · 확대 중에도 맞음) + 캐릭터 키(px) */
  function rigScreen(id, b){
    const u = Stage && Stage.units[id]; if(!u || !u.rig || !u.canvas || !u.box) return null;
    const cv = u.canvas, r = cv.getBoundingClientRect(), f = field().getBoundingClientRect(), kx = r.width / (cv.clientWidth || 1), ky = r.height / (cv.clientHeight || 1), bh = u.box.clientHeight, s = bh / u.def.height;
    return { x: r.left - f.left + (cv.clientWidth / 2 + s * (b[0] - u.def.anchor[0])) * kx, y: r.top - f.top + (cv.clientHeight - 1 + s * (b[1] - u.def.anchor[1])) * ky, h: bh * ky };
  }
  const shakeField = rec => { move(field(), [0, 1, 2, 3, 4].map(i => ({ transform: `translate(${i === 4 ? 0 : (i % 2 ? -1 : 1) * FX.shake.px}px,0)` })), FX.shake.dur, { easing: 'linear' }, rec).catch(() => {}); };
  /** 투사체형 공격: 리그 동작 이벤트(shoot · shoot:small · gather)에 맞춰 날리고 닿는 순간에만 피해 숫자 · HP (필살기 한 발 = 적 무리 가운데로 크게 폭발) */
  async function playRigKind(u, sid, sdef, ev, rec, dir){
    const def = rigDefOf(u.id), F = def.fx, ult = sdef.tag === 'ultimate', clip = ult ? 'skill' : 'attack', cdef = def.clips[clip], fxo = app.fx.fx, k = ms(1) / 1000, gen = app.gen, FL = F.flight || {};
    const ids = [...new Set(ev.filter(e => e.type === 'damage').map(e => e.tgt))];
    const pts = ids.map(id => { const r = rel(figOf(id)); return { x: r.cx, y: r.y + r.h * .5 }; });
    const mid = { x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length };
    const nShoot = (cdef.events || []).filter(e => e.name === 'shoot').length || 1, big = ult && (F.kind === 'stone' || F.kind === 'foxfire');
    let shot = 0, arrived = 0, gatherH = null, resolveAll; const allArrived = new Promise(r => { resolveAll = r; });
    const muzzle = () => { const st = Stage.units[u.id], b = F.muzzleAt ? F.muzzleAt(st.rig) : st.rig.pt(F.weapon, F.tip[0], F.tip[1]); return rigScreen(u.id, b); };
    const burstOf = b => F.kind === 'foxfire' ? (b ? 'foxfire_big' : 'foxfire') : F.kind === 'moonorb' ? 'moon' : (b ? 'stone_big' : 'stone');
    const onEvent = name => {
      if(gen !== app.gen) return;
      const m = muzzle(); if(!m) return;
      if(name === 'gather'){ gatherH = fxo.gather(m, { h: m.h, dur: .85, ts: k }); return; }
      if(name === 'shoot:small'){ fxo.shoot(F.kind, m, mid, { h: m.h, dur: FL.small || .22, size: .65, ts: k }).then(() => fxo.burst(burstOf(false), mid, { h: m.h * .6, ts: k })); return; }   // 보이기만 (피해 없음)
      if(name !== 'shoot') return;
      if(gatherH){ gatherH.end(); gatherH = null; }
      const target = big || ids.length === 1 ? (big ? mid : pts[0]) : pts[shot % pts.length]; shot++;
      fxo.shoot(F.kind, m, target, { h: m.h, dur: big ? (FL.big || .45) : (FL.shoot || .28), big, ts: k }).then(() => {
        fxo.burst(burstOf(big), target, { h: m.h, ts: k }); if(big) shakeField(rec); if(++arrived >= nShoot) resolveAll(); });
    };
    const endP = new Promise(res => { if(!Stage.play(u.id, clip, { speed: rigSpeed(), blend: .05, onEvent, onEnd: () => { if(gen === app.gen && Stage.ready(u.id)) Stage.play(u.id, 'idle', { speed: 1 }); res(); } })) res(); });
    const guard = new Promise(r => setTimeout(r, ms(Math.max(4, cdef.dur + 2))));
    await Promise.race([allArrived, guard]); if(gen !== app.gen) throw ABORT;
    await impact(ev, rec, dir);                       // 닿는 순간: 피해 숫자 · HP (필살기는 전부 동시에)
    await Promise.race([endP, guard]); if(gen !== app.gen) throw ABORT;
  }
  function slashFx(u, dir, rec){
    const S = FX.slash, c = S[u.side] || S.ally, a = rel(figOf(u.id)), w = S.widthPx, h = S.heightPx, gid = 'btSlashG' + (++slashSeq);
    const d = fxEl('bt-fx-slash bt-fx-slash--' + u.side);
    d.style.width = w + 'px'; d.style.height = h + 'px'; d.style.filter = `drop-shadow(0 0 6px ${c.glow})`;
    // 아군(오른쪽 공격) 기준으로 그리고, 적은 좌우 반전 · 띠 시작은 공격자 중심보다 backRatio 만큼 뒤
    d.style.left = (dir > 0 ? a.cx - w * S.backRatio : a.cx - w * (1 - S.backRatio)) + 'px';
    d.style.top = (a.y + a.h * S.yRatio - h / 2) + 'px';
    // 빛줄기: 뒤쪽은 가늘고 투명 → 앞쪽으로 굵고 밝아짐 → 끝은 가늘게 위로 살짝 휨 (viewBox 200×60)
    d.innerHTML = `<svg viewBox="0 0 200 60" preserveAspectRatio="none" width="100%" height="100%"><defs>
      <linearGradient id="${gid}" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="${c.edge}" stop-opacity="0"/><stop offset=".35" stop-color="${c.edge}" stop-opacity=".85"/>
      <stop offset=".72" stop-color="${c.mid}"/><stop offset=".93" stop-color="${c.core}"/><stop offset="1" stop-color="${c.core}" stop-opacity="0"/></linearGradient></defs>
      <path d="M2,40 C60,52 130,50 198,22 C140,40 70,40 2,40 Z" fill="url(#${gid})"/>
      <path d="M60,44 C110,48 150,42 194,24 C150,38 110,42 60,44 Z" fill="${c.core}" opacity=".9"/></svg>`;
    d.style.transform = `scaleX(${dir})`;
    const done = () => d.remove(), X = px => `scaleX(${dir}) translateX(${px}px)`;
    if(app.reduced) return run(d, [{ opacity: 0 }, { opacity: 1, offset: .3 }, { opacity: 0 }], S.dur, { easing: 'linear' }, rec).then(done);
    return move(d, [{ opacity: 1, clipPath: 'inset(0 100% 0 0)', transform: X(0) }, { opacity: 1, clipPath: 'inset(0 0% 0 0)', transform: X(0), offset: S.reveal },
      { opacity: 0, clipPath: 'inset(0 0% 0 30%)', transform: X(S.driftPx) }], S.dur, { easing: 'ease-out' }, rec).then(done);
  }
  /** 발밑 먼지: 작은 흙먼지가 양옆으로 퍼지며 사라짐 (움직임 줄이기 = 생략) */
  function dustFx(u, rec){
    if(app.reduced) return Promise.resolve();
    const D = FX.dust, a = rel(figOf(u.id)), jobs = [];
    for(let i = 0; i < D.count; i++){
      const p = fxEl('bt-fx-dust'), s = D.sizePx, k = D.count > 1 ? (i / (D.count - 1)) * 2 - 1 : 0;
      p.style.width = p.style.height = s + 'px'; p.style.background = D.color;
      const x0 = a.cx - s / 2 + k * 6, y0 = a.b - s * .7;
      jobs.push(move(p, [{ transform: `translate(${x0}px,${y0}px) scale(.6)`, opacity: 1 },
        { transform: `translate(${x0 + k * D.spreadPx}px,${y0 - D.risePx * (1 - Math.abs(k) * .4)}px) scale(1.25)`, opacity: 0 }], D.dur, { easing: 'ease-out' }, rec).then(() => p.remove()));
    }
    return Promise.all(jobs);
  }

  /** 행동 하나의 연출 (V3: 패시브가 만든 이벤트 = 추가타 · 필살기 뒤 효과는 본 공격 연출이 끝난 뒤에 따로 보여 줌 → 추가타 피해가 투사체가 닿기 전에 HP 바에 반영되지 않음)
   *  규칙 이벤트 순서는 그대로: 본 공격 이벤트들 뒤에 패시브 이벤트(passive 표시)가 붙음 · 결과 · 로그는 규칙이 이미 정한 대로 */
  async function play(u, sid, sdef, ev, rec, gen){
    const pi = ev.findIndex(e => e.passive);
    if(pi < 0) return playMain(u, sid, sdef, ev, rec, gen);
    const late = ev.slice(pi), dir = dirOf(u);
    await playMain(u, sid, sdef, ev.slice(0, pi), rec, gen);
    if(gen != null && gen !== app.gen) throw ABORT;
    for(const e of late) if(e.tgt && app.shown[e.tgt]) rec.pre[e.tgt] = app.shown[e.tgt].hp;   // 이 단계 직전에 화면에 보이던 HP
    await impact(late, rec, dir);
    await downs(late, rec);
  }
  async function playMain(u, sid, sdef, ev, rec, gen){
    const dir = dirOf(u), A = actorOf(u.id), uel = unitEl(u.id);
    const dmg = ev.filter(e => e.type === 'damage'), tgtIds = [...new Set(ev.filter(e => e.tgt && e.type !== 'down').map(e => e.tgt))];
    if(uel) uel.style.zIndex = '900';                                         // 돌진 중 맨 앞에 보이도록 (끝나면 배치 순서로 되돌림)
    if(sdef.tag === 'ultimate' && ultVideoWanted(u, sid)){
      // 필살기 영상: 덮개가 닫히는 순간 = 타격 순간 (영상 마지막 원형 베기에 이어 피해 숫자 · HP) · 못 불러오면 아래 기존 연출로
      const how = await ultVideo(u, sid, rec);
      if(gen != null && gen !== app.gen) throw ABORT;
      if(how === 'ended' || how === 'skip' || how === 'still'){ app.video.seen[sid] = true; await impact(ev, rec, dir); await downs(ev, rec); return; }
    }
    if(sdef.tag === 'ultimate') await ultIntro(sdef.name, rec);
    const st = rec.style;
    if(PARTY && app.fx && !app.reduced && rigOn(u.id) && rigFxOf(u.id).kind && dmg.length){ await playRigKind(u, sid, sdef, ev, rec, dir); await downs(ev, rec); return; }
    if(PARTY && app.fx && app.reduced && rigFxOf(u.id).kind && dmg.length){   // 움직임 줄이기: 날아가는 동작 없이 닿는 순간 이펙트만 짧게
      const F = rigFxOf(u.id); for(const e of dmg){ const r = rel(figOf(e.tgt)); app.fx.fx.burst(F.kind === 'foxfire' ? 'foxfire' : F.kind === 'moonorb' ? 'moon' : 'stone', { x: r.cx, y: r.y + r.h * .5 }, { h: r.h * .95, ts: ms(1) / 1000 }); } }
    if(PARTY && rigOn(u.id) && !app.reduced && !(st === 'melee' && dmg.length)){
      // 시험 전투: 리그 캐릭터의 원거리 · 광역 · 회복 · 강화도 리그 동작으로 (기본 = attack · 필살기 = skill · 끝나면 대기) · 연출 시간은 기존 그대로
      const clip = sdef.tag === 'ultimate' ? 'skill' : 'attack';
      Stage.play(u.id, clip, { speed: rigSpeed(), blend: .05, onEnd: () => { if(Stage.ready(u.id)) Stage.play(u.id, 'idle', { speed: 1 }); } });
    }

    if(st === 'melee' && dmg.length && rigOn(u.id) && !app.reduced){
      // 리그 근접 (24호): 준비(기존 이동) → 돌진(리그 dash + 기존 이동) → 도착하자마자 리그 attack → hit 신호 = 타격 → 동작 끝 → 리그 hop + 기존 복귀 이동
      const M = FX.melee, a = rel(figOf(u.id)), t = rel(figOf(dmg[0].tgt)), sp = rigSpeed(), RF = PARTY ? rigFxOf(u.id) : {};
      const dx = dir > 0 ? (t.l - M.stopGapPx) - a.r : (t.r + M.stopGapPx) - a.l, dy = t.b - a.b;
      setPose(u.id, 'windup');
      await move(A, [{ transform: T() }, { transform: T(-dir * M.windupPx) }], M.windup, null, rec);
      setPose(u.id, 'dash'); Stage.play(u.id, RF.dashClip || 'dash', { speed: sp });   // 달토끼: 몸째 회전하며 다가감 (시험 전투 · 리그 spin 동작)
      await move(A, [{ transform: T(-dir * M.windupPx) }, { transform: T(dx, dy) }], RF.dashSec || M.dash, { easing: 'ease-in' }, rec);
      const slash = isBasic(sdef) || (FX.slash.onUltimate && sdef.tag === 'ultimate');
      setPose(u.id, slash ? 'slash' : 'strike');
      const atk = Stage.attack(u.id, sp);
      await rigWait(atk.hit);
      const hit = impact(ev, rec, dir);                                           // 리그 hit 신호 = 타격 순간
      if(RF.melee === 'slash' && app.fx){ const h = rel(figOf(u.id)).h; app.fx.fx.burst('slash', { x: t.cx, y: t.y + t.h * .55 }, { h, ts: ms(1) / 1000, dir }); shakeField(rec); }   // 달토끼: 초승달 강타 이펙트
      const extra = slash && !RF.melee ? [slashFx(u, dir, rec), dustFx(u, rec)] : [];
      hit.catch(() => {}); extra.forEach(p => p.catch(() => {}));               // 아래 리그 동작을 기다리는 사이 다시 시작되면 취소된 연출이 처리 안 된 오류로 남지 않게 (결과는 아래 Promise.all 에서 그대로 받음)
      await rigWait(atk.end);
      setPose(u.id, 'return'); Stage.play(u.id, 'hop', { speed: sp });
      const hopSec = (window.TALELIA_RIGS[FX.rigs[u.id]].clips.hop || {}).dur || M.back;
      await Promise.all([hit, ...extra, move(A, [{ transform: T(dx, dy) }, { transform: T() }], hopSec, { easing: 'ease-in-out' }, rec)]);
      Stage.play(u.id, 'idle', { speed: 1 });
    }
    else if(st === 'melee' && dmg.length){
      const M = FX.melee, a = rel(figOf(u.id)), t = rel(figOf(dmg[0].tgt));
      const dx = dir > 0 ? (t.l - M.stopGapPx) - a.r : (t.r + M.stopGapPx) - a.l, dy = t.b - a.b;
      setPose(u.id, 'windup');
      await move(A, [{ transform: T() }, { transform: T(-dir * M.windupPx, 0, -dir * M.windupDeg) }], M.windup, null, rec);
      setPose(u.id, 'dash');
      await move(A, [{ transform: T(-dir * M.windupPx, 0, -dir * M.windupDeg) }, { transform: T(dx, dy) }], M.dash, { easing: 'ease-in' }, rec);
      const slash = isBasic(sdef) || (FX.slash.onUltimate && sdef.tag === 'ultimate');
      setPose(u.id, slash ? 'slash' : 'strike');
      await move(A, [{ transform: T(dx, dy) }, { transform: T(dx + dir * 4, dy, dir * M.strikeDeg, M.strikeScale) }], M.strike, null, rec);
      const hit = impact(ev, rec, dir);                                           // ③ 끝 = 타격 순간: 숫자 · HP
      const extra = slash ? [slashFx(u, dir, rec), dustFx(u, rec)] : [];          // 횡베기 궤적 · 발밑 먼지
      hit.catch(() => {}); extra.forEach(p => p.catch(() => {}));               // 기다리는 사이 다시 시작돼도 처리 안 된 오류로 남지 않게 (결과는 아래 Promise.all)
      await wait(slash ? FX.slash.hold : M.backOverlap);                          // 횡베기: 자세 유지 후 복귀
      setPose(u.id, 'return');
      await Promise.all([hit, ...extra, move(A, [{ transform: T(dx + dir * 4, dy, dir * M.strikeDeg, M.strikeScale) }, { transform: T() }], M.back, { easing: 'ease-in-out' }, rec)]);
    }
    else if(st === 'slam' && dmg.length){
      const S = FX.slam, a = rel(figOf(u.id)), ts = dmg.map(e => rel(figOf(e.tgt)));
      const edge = dir > 0 ? Math.min(...ts.map(t => t.l)) : Math.max(...ts.map(t => t.r)), cy = ts.reduce((s, t) => s + t.cy, 0) / ts.length, cx = ts.reduce((s, t) => s + t.cx, 0) / ts.length;
      const dx = dir > 0 ? (edge - FX.melee.stopGapPx) - a.r : (edge + FX.melee.stopGapPx) - a.l, dy = (ts.reduce((s, t) => s + t.b, 0) / ts.length) - a.b;
      setPose(u.id, 'windup');
      await move(A, [{ transform: T() }, { transform: T(-dir * FX.melee.windupPx, 0, -dir * FX.melee.windupDeg) }], S.windup, null, rec);
      setPose(u.id, 'dash');
      await move(A, [{ transform: T(-dir * FX.melee.windupPx, 0, -dir * FX.melee.windupDeg) }, { transform: T(dx, dy) }], S.dash, { easing: 'ease-in' }, rec);
      setPose(u.id, 'strike');
      const nut = fxEl('bt-fx-walnut'), p = S.walnutPx; nut.style.width = nut.style.height = p + 'px';
      const strike = move(A, [{ transform: T(dx, dy) }, { transform: T(dx, dy - 10, -dir * 8, 1.04), offset: .6 }, { transform: T(dx + dir * 4, dy, dir * FX.melee.strikeDeg, FX.melee.strikeScale) }], S.drop, null, rec);
      if(app.reduced) nut.remove();
      else await Promise.all([strike, run(nut, [{ transform: `translate(${cx - p / 2}px,${cy - p / 2 - S.dropFromPx}px)` }, { transform: `translate(${cx - p / 2}px,${cy - p / 2}px)` }], S.drop, { easing: 'ease-in' }, rec, true)]);
      if(nut.isConnected) run(nut, [{ opacity: 1 }, { opacity: 0 }], S.hit, null, rec).then(() => nut.remove(), () => {});
      const hit = impact(ev, rec, dir);                                           // 내리찍는 순간: 적 전원 동시
      const shake = move(field(), [0, 1, 2, 3, 4].map(i => ({ transform: `translate(${i === 4 ? 0 : (i % 2 ? -1 : 1) * FX.shake.px}px,0)` })), FX.shake.dur, { easing: 'linear' }, rec);
      hit.catch(() => {}); shake.catch(() => {});                                  // 기다리는 사이 다시 시작돼도 처리 안 된 오류로 남지 않게 (결과는 아래 Promise.all)
      await wait(S.backOverlap);
      setPose(u.id, 'return');
      await Promise.all([hit, shake, move(A, [{ transform: T(dx + dir * 4, dy, dir * FX.melee.strikeDeg, FX.melee.strikeScale) }, { transform: T() }], S.back, { easing: 'ease-in-out' }, rec)]);
    }
    else if((st === 'ranged' || st === 'volley') && dmg.length){
      const P = st === 'ranged' ? FX.ranged : FX.volley;
      setPose(u.id, 'windup');
      await move(A, [{ transform: T() }, { transform: T(-dir * FX.melee.windupPx * .6, 0, -dir * FX.melee.windupDeg) }], P.windup, null, rec);
      setPose(u.id, 'strike');
      const back = move(A, [{ transform: T(-dir * FX.melee.windupPx * .6, 0, -dir * FX.melee.windupDeg) }, { transform: T() }], P.fly, null, rec);
      await Promise.all([back].concat(dmg.map((e, i) => shoot(u.id, e.tgt, P.fly, 'bt-fx-dot--' + u.side, FX.ranged.dotPx, 0, st === 'volley' ? i * FX.volley.stagger : 0, rec))));
      await impact(ev, rec, dir);                                                 // 발사체가 닿는 순간 (난사: 마지막이 닿을 때 전원 동시)
    }
    else if(st === 'lob'){
      const H = FX.heal, tgt = tgtIds[0];
      setPose(u.id, 'windup');
      await move(A, [{ transform: T() }, { transform: T(-dir * 6, 0, -dir * 4) }, { transform: T() }], H.windup, null, rec);
      if(tgt) await shoot(u.id, tgt, H.fly, 'bt-fx-dot--heal', H.dotPx, H.arcPx, 0, rec);
      await impact(ev, rec, dir);
    }
    else if(st === 'cheer'){
      const Bf = FX.buff;
      setPose(u.id, 'cheer');
      await move(A, [{ transform: T() }, { transform: T(0, -Bf.hopPx), offset: .45 }, { transform: T() }], Bf.hop, { easing: 'ease-in-out' }, rec);
      await impact(ev, rec, dir);
    }
    else await impact(ev, rec, dir);
    await downs(ev, rec);
  }

  /* ---------- 조작 ---------- */
  for(const b of document.querySelectorAll('[data-mode]')) b.addEventListener('click', () => { app.mode = b.dataset.mode; restart(); });
  for(const b of document.querySelectorAll('[data-speed]')) b.addEventListener('click', () => { app.speed = b.dataset.speed === 'step' ? 'step' : +b.dataset.speed; syncControls(); loop(); });
  $('#btAuto').addEventListener('click', () => { app.autoAlly = !app.autoAlly; app.pending = null; syncControls(); loop(); });
  $('#btStep').addEventListener('click', () => autoStep());
  $('#btVideoToggle').addEventListener('click', () => { app.video.on = !app.video.on; try{ localStorage.setItem('talelia.battle.ultvideo', app.video.on ? '1' : '0'); }catch(e){} preloadUltVideo(); syncControls(); });
  $('#btRestart').addEventListener('click', () => { app.seed = Math.max(1, Math.floor(+$('#btSeed').value) || 1); restart(); });

  /* ---------- 결과창 [마을로] (H4 · docs/design/town-hub-ui.md 3-1) ----------
   * 결과를 반영하는 화면(스테이지 · 던전)이 runId 로 한 번 반영한 뒤 마을로 보냄 (&go=town) · 전투 화면은 저장하지 않음.
   *   던전 · 스킵 모드 스테이지 = 그 화면을 거쳐 마을로 · 이야기 속 스테이지 전투는 승리하면 [계속](전후 대사) 만 두고, 패배 · 무승부는 스테이지 화면을 거쳐 마을로
   *   시험 전투 · 이야기 전투(스테이지 아님) 패배 · 무승부 · 오류 = 저장이 바뀌지 않으므로 바로 마을로 */
  function townUrl(){ const k = q.get('savekey'); return 'town.html' + (k ? '?savekey=' + encodeURIComponent(k) : ''); }
  function addTownButton(){
    const box = $('#btResult'); if(!box || box.hidden || !RETURN || box.querySelector('#btGoTown')) return;
    const r = box.dataset.result; if(!r) return;
    const viaStory = STAGE && !/^stage\.html/.test(RETURN);
    if(ENC_ID && !STAGE) return;   // 이야기 전투(프롤로그 등)는 이야기 화면의 [← 마을]을 씀
    if(r === 'win' && viaStory) return;
    let go;
    if(DUNGEON && r !== 'error') go = () => goDungeon(r, false, true);
    else if(STAGE && r !== 'error') go = () => goStage(r, true);
    else go = () => location.replace(townUrl());
    const b = document.createElement('button'); b.type = 'button'; b.id = 'btGoTown'; b.className = 'bt-result__sub'; b.textContent = '마을로';
    const row = box.querySelector('.bt-result__row'); (row || box).appendChild(b);
    b.addEventListener('click', go);
  }
  new MutationObserver(addTownButton).observe($('#btResult'), { attributes: true, attributeFilter: ['hidden', 'data-result'], childList: true });

  window.TaleliaBattleApp = { get B(){ return app.B; }, app, restart, FX, Stage, encounterData, safeReturn, ultVideoWanted, partyData, safeGachaReturn, party, PARTY, DUNGEON, dungeon, STAGE, stage };
  restart();
})();
