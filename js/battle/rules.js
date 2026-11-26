/* =====================================================================
 * TALELIA · battle/rules.js — 전투 규칙 (화면 코드 없음 · 브라우저 / 테스트 공용)
 *
 *  B = TaleliaBattleRules.create(data, { mode: 'pve' | 'pvp', seed })
 *    B.current()                  지금 행동할 캐릭터 (라운드 · 자기 턴 시작 처리 포함) · 끝났으면 null
 *    B.skillsOf(unit)             스킬 목록 + 사용 가능 여부 · 남은 쿨타임 · 자동 사용 ON/OFF
 *    B.legalTargets(skillId)      지금 차례 캐릭터가 그 스킬로 고를 수 있는 대상 (enemy_n 은 주대상 후보)
 *    B.targetsOf(skillId, id)     그 대상을 골랐을 때 실제로 맞는 캐릭터 (enemy_n = 주대상 + 이웃 · 단일 = 그 1명 · 전체 = 전부)
 *    B.act(skillId, targetId)     행동 실행 → 결과 이벤트 배열 (피해 · 회복 · 강화 · 쓰러짐)
 *    B.pass()                     기절 상태인 지금 차례를 넘김 (기절이 아니면 오류) · B.isStunned(unit)
 *    B.statusChance(src, tgt, st) · B.statusTurns(src, tgt, st)   상태이상 확률 · 지속 (장비 효과 적중 eff · 저항 res 연결 자리)
 *    B.result()                   null | 'win' | 'lose' | 'draw'
 *    B.queueView()                이번 라운드에 남은 행동 순서 (지금 차례 포함)
 *    B.setAuto(unitId, skillId, on)  스킬별 자동 사용 ON/OFF
 *    B.rand()                     시드 고정 난수 (대상 고르기에만 사용)
 *
 *  규칙 (임시값 · 임시 해석은 data/battle-proto.js 와 보고서 참고)
 *   - 순서: PVE = 아군 전원 속도순 → 적 전원 속도순 · PVP = 전체 속도순. 라운드 시작 때 정렬, 쓰러지면 빠짐
 *   - 같은 속도: rules.tieBreak 순서 (기본: 아군 우선 → 전열 우선 → 배치 번호)
 *   - 피해 = round(공격력(강화) × 배율 × 후열 보정 × 대상 전열 보정 × defK / (defK + 방어력(강화))), 최소 minDamage
 *   - 단일 공격 대상: 상대 전열이 남아 있으면 전열만
 *   - 쿨타임: 사용하면 N, 그 캐릭터의 다음 자기 턴 시작마다 1 감소, 0 이면 사용 가능
 *   - 강화: 받은 캐릭터의 자기 턴이 끝날 때마다 1 감소 (받은 그 턴에는 감소하지 않음) · 같은 강화는 쌓이지 않고 시간만 갱신
 *   - every: n → 그 캐릭터의 n · 2n · … 번째 자기 턴에만 사용 가능
 *  V3-1 패시브 (docs/design/battle-balance-v3.md 3장) — 유닛 데이터 passives: [{ type, name, … }] · 없으면(빈 배열) 아무것도 하지 않음 (기준 로그 46개와 한 글자까지 같음)
 *   stat       { stat: hp|atk|def|spd, pct }            전투 시작 때 한 번 능력치 × (1 + pct)
 *   dmgIf      { pct, single?, hpOver?, poisoned?, stunned? }   주는 피해 × (1 + pct) (조건이 모두 맞을 때 · single = 단일 대상 공격)
 *   pierce     { pct, minDef }                          방어 minDef 이상인 대상의 방어를 pct 만큼 무시
 *   takenIf    { pct, front? }                          받는 피해 × (1 − pct) (front = 전열일 때)
 *   defIfLowHp { pct, hpBelow }                         HP 가 최대의 hpBelow 이하면 방어 + pct
 *   roundAtk   { pct, max }                             자기 턴이 지날 때마다 공격 + pct (최대 max 번 쌓임)
 *   turnHeal   { pct }                                  자기 턴 시작: HP 비율이 가장 낮은 아군 최대 HP × pct 회복
 *   startBuff  { stat, pct, duration }                  1라운드 시작: 아군 전체 강화
 *   afterUlt   { effect: selfBuff|healAll, stat, pct, duration }   필살기(tag ultimate)를 쓴 뒤
 *   extraHit   { chance, mult }                         기본 공격 뒤 chance 확률로 추가타 (상태이상과 같은 두 번째 난수 줄기)
 *  v2 (docs/design/battle-rules-v2.md · 1단계)
 *   - 여러 번 타격 hits: 합계 피해(위 식 · mult = 대상 1명이 받는 합계 배율)를 정수로 hits 등분 · 나머지는 마지막 타격 · 타격마다 최소 minDamage
 *                       도중에 쓰러지면 남은 타격 중단 · hits 1 은 v1 과 로그 · 이벤트가 완전히 같음
 *   - 적 n명 enemy_n(count): 주대상(단일 공격과 같은 규칙 · 전열 우선) + 가까운 이웃 count 명까지 (같은 줄 칸 거리 → 다른 줄 같은 칸에 가까운 순)
 *                       대상 수에 따른 피해 감소 없음 · 살아 있는 상대가 적으면 있는 만큼만
 *  v2 2단계 — 상태이상 (공격 스킬의 status: { type: stun · poison · weaken, chance, turns, value })
 *   - 대상마다 1번 굴림 (모든 타격이 끝나고 살아 있을 때) · 확률 = statusChance = chance × (1 + 시전자 eff − 대상 res), 0 ~ rules.statusChanceMax(기본 0.95)
 *     굴림은 시드에서 따로 만든 두 번째 난수 줄기 (B.rand = 대상 고르기 순서는 그대로) · 지속 = statusTurns (지금은 turns 그대로 · 장비 세트 연결 자리)
 *   - 같은 종류는 1개: 다시 걸리면 남은 턴 · 수치(· 중독 상한)는 둘 중 큰 쪽 · 대상 immune: ['stun'] 이면 그 종류는 안 걸림(굴림 없음)
 *   - 남은 턴은 받은 캐릭터의 자기 턴 기준
 *     기절: 자기 턴은 옴(턴 수 · 쿨타임 · every 진행) · 스킬을 못 씀 → B.pass() 로 넘김(남은 턴 1 감소)
 *           풀린 직후 기절 내성 = 다음 자기 턴이 끝날 때까지 기절이 안 걸림
 *     중독: 자기 턴 시작 때 max(1, min(round(최대 HP × value), 상한)) 피해 → 남은 턴 1 감소 · 상한 = 걸 때 시전자 공격력 × rules.poisonCapAtkMul(기본 1.0)
 *           방어 · 전열/후열 보정 무시 · 중독으로 쓰러지면 그 턴은 행동 없음 · 피해는 시전자 준 피해에 합산
 *     약화: 공격력 −value · 강화와 합산 · 합계 하한 −rules.weakenMaxPct(기본 0.5) · 자기 턴 끝마다 1 감소 (강화와 같음)
 *   - 해제: 지금은 시간 경과만 (정화 cleanse 는 3단계 이후 자리만)
 *  V3-5a (docs/design/new-characters-v1.md 2 · 3장) — 모두 새 데이터(reach · silence · thornWear · dmgIf back/silenced)가 있을 때만 작동 (없으면 기준 로그 46개와 한 글자까지 같음)
 *   - 후열 우선 공격 reach: 'back' (enemy_single · enemy_n 스킬 필드): 고를 수 있는 대상 = 살아 있는 상대 후열 → 후열이 없으면 지금 규칙(전열 → 전체)
 *   - 침묵 silence (status.type): 걸린 캐릭터는 기본 공격(공격 · 쿨 0 · tag 없음 · every 없음)만 쓸 수 있음 · 쿨타임 · 턴 수는 그대로 진행
 *     남은 턴은 자기 턴이 끝날 때 1 감소 (약화와 같은 방식) · 확률 = statusChance (효과 적중 eff · 저항 res) · 기절 내성 없음 · 기절과 겹치면 기절이 우선
 *     쓸 수 있는 스킬이 하나도 없는 침묵 캐릭터는 B.pass() 로 넘김 (지금 데이터에는 없음 · 안전장치)
 *   - 가시 thornWear { max, regen, low, defLoss } (A안): 유닛 thorn = 남은 가시 (전투 시작 max) · 공격으로 실제 맞힌 타수만큼 줄어듦 (0 아래로는 안 내려가고 피해 · 배율은 그대로)
 *     자기 턴 시작마다 + regen (최대 max) · 남은 가시가 low 이하면 방어 − defLoss (방어 강화와 합쳐 하한 −weakenMaxPct)
 *   - dmgIf 조건 추가: back (대상이 후열) · silenced (대상이 침묵)
 * ===================================================================== */
(function(root){
  'use strict';

  /** 시드 고정 난수 (mulberry32) */
  function rng(seed){
    let a = (seed >>> 0) || 1;
    return function(){ a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const SIDE_NAME = { ally: '아군', enemy: '적' }, ROW_NAME = { front: '전열', back: '후열' }, STAT_NAME = { atk: '공격력', def: '방어력' };
  const STATUS_NAME = { stun: '기절', poison: '중독', weaken: '약화', silence: '침묵' };
  const END_NAME = { win: '승리', lose: '패배', draw: '무승부' };
  const pct = v => Math.round(v * 100) + '%', mul = v => '×' + (Math.round(v * 100) / 100).toFixed(2);

  function create(data, opts){
    opts = opts || {};
    const R = data.rules, mode = opts.mode === 'pvp' ? 'pvp' : 'pve', seed = opts.seed == null ? 1 : opts.seed, rand = rng(seed);
    const roll = rng(((seed >>> 0) ^ 0x9E3779B9) >>> 0);   // 상태이상 굴림 전용 (rand 와 따로)
    const opt = (k, v) => R[k] != null ? R[k] : v;
    const CHANCE_MAX = opt('statusChanceMax', 0.95), POISON_CAP = opt('poisonCapAtkMul', 1.0), WEAKEN_MAX = opt('weakenMaxPct', 0.5);
    const units = [];
    function mk(d, side){
      return { id: d.id, side, name: d.name, row: d.row, slot: d.slot || 0, img: d.img || null, shape: d.shape || null, color: d.color || null,
        maxHp: d.hp, hp: d.hp, atk: d.atk, def: d.def, spd: d.spd, alive: true, turns: 0, buffs: [],
        passives: Array.isArray(d.passives) ? d.passives.map(p => Object.assign({}, p)) : [],   // V3-1 패시브 (없으면 빈 배열 = 아무것도 하지 않음)
        eff: d.eff || 0, res: d.res || 0, immune: Array.isArray(d.immune) ? d.immune.slice() : [], statuses: [], guard: null,
        skills: d.skills.map(k => { const s = data.skills[k]; if(!s) throw new Error('스킬 없음: ' + k);
          return { id: k, def: s, cd: (s.cooldown && !R.cooldownStartReady) ? s.cooldown : 0, auto: true }; }),
        stats: { dealt: 0, healed: 0, taken: 0, actions: 0 } };
    }
    data.allies.forEach(d => units.push(mk(d, 'ally')));
    data.enemies.forEach(d => units.push(mk(d, 'enemy')));
    for(const u of units) for(const p of u.passives) if(p.type === 'stat' && p.pct){   // 능력치형 패시브: 전투 시작 때 한 번
      const k = p.stat === 'hp' ? 'maxHp' : p.stat; u[k] = Math.round(u[k] * (1 + p.pct)); if(p.stat === 'hp') u.hp = u.maxHp; }
    for(const u of units) for(const p of u.passives) if(p.type === 'thornWear' && u.thorn == null) u.thorn = p.max;   // V3-5a 가시 (thornWear 가 있는 유닛에만 칸이 생김)
    const byId = id => units.find(u => u.id === id);

    const S = { mode, seed, round: 0, queue: [], qi: 0, started: null, over: null, log: [], turnNo: 0 };

    /* ---------- 순서 ---------- */
    function cmp(a, b){
      if(b.spd !== a.spd) return b.spd - a.spd;
      for(const k of R.tieBreak || []){
        if(k === 'allyFirst' && a.side !== b.side) return a.side === 'ally' ? -1 : 1;
        if(k === 'enemyFirst' && a.side !== b.side) return a.side === 'enemy' ? -1 : 1;
        if(k === 'frontFirst' && a.row !== b.row) return a.row === 'front' ? -1 : 1;
        if(k === 'backFirst' && a.row !== b.row) return a.row === 'back' ? -1 : 1;
        if(k === 'slot' && a.slot !== b.slot) return a.slot - b.slot;
      }
      return units.indexOf(a) - units.indexOf(b);
    }
    function buildQueue(){
      const alive = units.filter(u => u.alive);
      if(mode === 'pvp') return alive.slice().sort(cmp);
      return alive.filter(u => u.side === 'ally').sort(cmp).concat(alive.filter(u => u.side === 'enemy').sort(cmp));
    }

    /* ---------- 상태 계산 ---------- */
    const buffPct = (u, stat) => u.buffs.filter(b => b.stat === stat).reduce((s, b) => s + b.pct, 0);
    const statusOf = (u, type) => u.statuses.find(s => s.type === type) || null, isStunned = u => !!statusOf(u, 'stun');
    const weakenOf = u => { const w = statusOf(u, 'weaken'); return w ? w.value : 0; };
    /** 공격력 변화율 = 강화 합 − 약화 (약화가 있을 때만 하한 적용 · 없으면 v1 과 같은 값) */
    const atkPct = u => { const b = buffPct(u, 'atk'), w = weakenOf(u); return w ? Math.max(-WEAKEN_MAX, b - w) : b; };
    /** 패시브 공격 · 방어 변화율 (패시브가 없으면 0 → 아래 식이 v1 과 같은 값) */
    const pAtk = u => { let v = 0; for(const p of u.passives) if(p.type === 'roundAtk') v += p.pct * Math.min(p.max || 5, Math.max(0, u.turns - 1)); return v; };
    /** V3-5a 가시 (thornWear 가 없으면 null) → { left, max, low, regen, defLoss, worn } */
    const thornOf = u => { const p = u.thorn != null && u.passives.find(x => x.type === 'thornWear'); return p ? { left: u.thorn, max: p.max, low: p.low, regen: p.regen, defLoss: p.defLoss, worn: u.thorn <= p.low } : null; };
    const pDef = u => { let v = 0; for(const p of u.passives) if(p.type === 'defIfLowHp' && u.hp <= u.maxHp * (p.hpBelow || 0.5)) v += p.pct;
      if(u.thorn != null){ const t = thornOf(u); if(t && t.worn) v -= t.defLoss; }
      return v; };
    const effAtk = u => u.atk * (1 + atkPct(u) + (u.passives.length ? pAtk(u) : 0));
    const effDef = u => u.thorn == null ? u.def * (1 + buffPct(u, 'def') + (u.passives.length ? pDef(u) : 0))   // 가시가 없으면 v1 과 같은 식
      : u.def * (1 + Math.max(-WEAKEN_MAX, buffPct(u, 'def') + pDef(u)));
    const alliesOf = u => units.filter(x => x.alive && x.side === u.side), foesOf = u => units.filter(x => x.alive && x.side !== u.side);

    function result(){
      if(S.over) return S.over;
      if(!units.some(u => u.alive && u.side === 'enemy')) S.over = 'win';
      else if(!units.some(u => u.alive && u.side === 'ally')) S.over = 'lose';
      return S.over;
    }

    /** 지금 차례 (필요하면 새 라운드 · 자기 턴 시작 처리) */
    function current(){
      for(;;){
        if(result()) return null;
        for(;;){
          while(S.qi < S.queue.length && !S.queue[S.qi].alive) S.qi++;
          if(S.qi < S.queue.length) break;
          if(S.round >= R.maxRounds){ S.over = 'draw'; S.log.push({ round: S.round, text: '최대 ' + R.maxRounds + '라운드 도달 → 무승부' }); return null; }
          S.round++; S.queue = buildQueue(); S.qi = 0; S.started = null;
          S.log.push({ round: S.round, text: '── 라운드 ' + S.round + ' 시작 · 순서: ' + S.queue.map(u => u.name + '(' + u.spd + ')').join(' → ') });
          if(S.round === 1 && units.some(x => x.passives.length)) startPassives();
        }
        const u = S.queue[S.qi];
        if(S.started !== u){   // 자기 턴 시작: 쿨타임 감소 · 턴 수 증가 · 중독 피해
          S.started = u; u.turns++; S.turnNo++;
          u.skills.forEach(s => { if(s.cd > 0) s.cd--; });
          if(statusOf(u, 'poison') && poisonTick(u)){   // 중독으로 쓰러짐 → 이 턴은 행동 없음
            S.qi++; S.started = null;
            if(result()) S.log.push({ round: S.round, text: '전투 종료: ' + END_NAME[S.over] });
            continue;
          }
          if(u.passives.length) turnStartPassives(u);
        }
        return u;
      }
    }
    /** 중독: 자기 턴 시작 때 피해 → 남은 턴 1 감소 · 쓰러지면 true */
    function poisonTick(u){
      const p = statusOf(u, 'poison'), raw = Math.round(u.maxHp * p.value), amount = Math.max(1, Math.min(raw, p.cap)), before = u.hp, src = byId(p.src);
      u.hp = Math.max(0, u.hp - amount); u.stats.taken += before - u.hp; if(src) src.stats.dealt += before - u.hp;
      const ev = [{ type: 'poison', src: p.src, tgt: u.id, amount, hp: u.hp }];
      let text = 'R' + S.round + ' · ' + u.name + ' 중독 피해 ' + amount + ' (최대 HP ' + pct(p.value) + ' = ' + raw + ' · 상한 ' + p.cap + ') HP ' + before + '→' + u.hp;
      p.left--;
      if(p.left <= 0){ u.statuses = u.statuses.filter(s => s !== p); ev.push({ type: 'statusEnd', tgt: u.id, status: 'poison' }); text += ' · 중독 끝'; }
      else text += ' · 남은 ' + p.left + '턴';
      if(u.hp <= 0){ u.alive = false; ev.push({ type: 'down', tgt: u.id }); text += ' / ' + u.name + ' 쓰러짐'; }
      S.log.push({ round: S.round, text, events: ev });
      return !u.alive;
    }

    const isBasicDef = d => d.kind === 'attack' && !d.cooldown && !d.tag && !d.every;   // 기본 공격 (침묵 중에도 쓸 수 있음)
    const isSilenced = u => !!statusOf(u, 'silence');
    function usable(u, s){
      if(isStunned(u)) return false;
      if(s.cd > 0) return false;
      if(s.def.every && u.turns % s.def.every !== 0) return false;
      if(u.statuses.length && isSilenced(u) && !isBasicDef(s.def)) return false;   // V3-5a 침묵: 기본 공격만
      return true;
    }
    function skillsOf(u){ return u.skills.map(s => ({ id: s.id, name: s.def.name, kind: s.def.kind, target: s.def.target, tag: s.def.tag || null, cooldown: s.def.cooldown || 0, every: s.def.every || 0,
      hits: hitsOf(s.def), count: s.def.target === 'enemy_n' ? countOf(s.def) : 0, reach: s.def.reach || null,
      cd: s.cd, auto: s.auto, usable: usable(u, s), basic: isBasicDef(s.def) })); }
    const hitsOf = d => Math.max(1, Math.floor(d.hits || 1)), countOf = d => Math.max(1, Math.floor(d.count || 1));
    /** 주대상을 직접 고르는 스킬 (단일 · 적 n명) */
    const picksOne = target => /_single$/.test(target) || target === 'enemy_n';

    function legalFor(u, s){
      switch(s.def.target){
        case 'enemy_single': case 'enemy_n': { const f = foesOf(u);
          if(s.def.reach === 'back'){ const back = f.filter(x => x.row === 'back'); if(back.length) return back; }   // V3-5a 후열 우선 (후열이 없으면 아래 지금 규칙)
          const front = f.filter(x => x.row === 'front'); return front.length ? front : f; }
        case 'enemy_all': return foesOf(u);
        case 'ally_single': return alliesOf(u);
        case 'ally_all': return alliesOf(u);
      }
      return [];
    }
    function legalTargets(skillId){
      const u = current(); if(!u) return [];
      const s = u.skills.find(x => x.id === skillId); if(!s) return [];
      return legalFor(u, s);
    }
    /** 적 n명: 주대상 + 가까운 이웃 (같은 줄 칸 거리 → 다른 줄 같은 칸에 가까운 순 · 같으면 칸 번호 → 배치 순) · 이웃은 전열 제한 없음 */
    function nearest(u, main, n){
      const rest = foesOf(u).filter(x => x !== main).sort((a, b) => ((a.row !== main.row) - (b.row !== main.row)) || (Math.abs(a.slot - main.slot) - Math.abs(b.slot - main.slot)) || (a.slot - b.slot) || (units.indexOf(a) - units.indexOf(b)));
      return [main].concat(rest.slice(0, Math.max(0, n - 1)));
    }
    function hitList(u, s, targetId){
      const legal = legalFor(u, s);
      if(!picksOne(s.def.target)) return legal;
      const t = legal.find(x => x.id === targetId); if(!t) return null;
      return s.def.target === 'enemy_n' ? nearest(u, t, countOf(s.def)) : [t];
    }
    function targetsOf(skillId, targetId){
      const u = current(); if(!u) return [];
      const s = u.skills.find(x => x.id === skillId); if(!s) return [];
      return hitList(u, s, targetId) || [];
    }
    /** 합계 피해를 hits 번으로 나눔 (정수 등분 · 나머지는 마지막 · 타격마다 최소 minDamage) */
    function splitHits(total, hits){
      const base = Math.floor(total / hits), parts = [];
      for(let i = 0; i < hits; i++) parts.push(Math.max(R.minDamage, i === hits - 1 ? total - base * (hits - 1) : base));
      return parts;
    }

    function damageOf(src, tgt, mult, ctx){
      const back = src.row === 'back' ? R.backDealtMul : 1, front = tgt.row === 'front' ? R.frontTakenMul : 1;
      const atk = effAtk(src);
      let def = effDef(tgt), pm = 1; const pn = [];
      if(src.passives.length || tgt.passives.length){   // V3-1 패시브 보정 (패시브가 없으면 이 분기에 들어오지 않음)
        for(const p of src.passives){
          if(p.type === 'pierce' && tgt.def >= (p.minDef || 0)){ def *= 1 - p.pct; pn.push(p.name + ' 방어 -' + pct(p.pct)); }
          else if(p.type === 'dmgIf' && (!p.single || (ctx && ctx.single)) && (p.hpOver == null || tgt.hp > tgt.maxHp * p.hpOver) && (!p.poisoned || statusOf(tgt, 'poison')) && (!p.stunned || isStunned(tgt)) && (!p.back || tgt.row === 'back') && (!p.silenced || statusOf(tgt, 'silence'))){ pm *= 1 + p.pct; pn.push(p.name + ' +' + pct(p.pct)); }
        }
        for(const p of tgt.passives){
          if(p.type === 'takenIf' && (!p.front || tgt.row === 'front')){ pm *= 1 - p.pct; pn.push(p.name + ' 받는 피해 -' + pct(p.pct)); }
          else if(p.type === 'thornWear' && thornOf(tgt) && thornOf(tgt).worn) pn.push(p.name + ' 방어 -' + pct(p.defLoss) + ' (가시 ' + tgt.thorn + ')');
        }
      }
      const raw = atk * mult * back * front * R.defK / (R.defK + def) * pm;
      return { amount: Math.max(R.minDamage, Math.round(raw)), raw, back, front, atk, def, atkPct: atkPct(src), defPct: buffPct(tgt, 'def'), weak: weakenOf(src), buffAtk: buffPct(src, 'atk'), passive: pn };
    }

    /* ---------- 상태이상 (장비 세트 연결 자리: 확률 · 지속은 이 두 함수에서만 계산) ---------- */
    function statusChance(src, tgt, st){ return Math.min(CHANCE_MAX, Math.max(0, (st.chance || 0) * (1 + (src.eff || 0) - (tgt.res || 0)))); }
    function statusTurns(src, tgt, st){ return Math.max(1, Math.floor(st.turns || 1)); }
    /** 대상 1명에게 상태이상 굴림 → 이벤트 · 로그 줄 추가 */
    function applyStatus(src, tgt, st, ev, lines){
      const name = STATUS_NAME[st.type] || st.type, base = { src: src.id, tgt: tgt.id, status: st.type };
      if(tgt.immune.includes(st.type)){ ev.push(Object.assign({ type: 'resist', reason: 'immune' }, base)); lines.push(tgt.name + ' ' + name + ' 면역'); return; }
      if(st.type === 'stun' && tgt.guard){ ev.push(Object.assign({ type: 'resist', reason: 'guard' }, base)); lines.push(tgt.name + ' 기절 내성 (안 걸림)'); return; }
      const p = statusChance(src, tgt, st), r = roll();
      if(!(r < p)){ ev.push(Object.assign({ type: 'resist', reason: 'chance', chance: p }, base)); lines.push(tgt.name + ' ' + name + ' 안 걸림 (확률 ' + pct(p) + ')'); return; }
      const turns = statusTurns(src, tgt, st), value = st.value || 0, cap = st.type === 'poison' ? Math.max(1, Math.round(effAtk(src) * POISON_CAP)) : null;
      const old = statusOf(tgt, st.type);
      let s = old;
      if(old){ old.left = Math.max(old.left, turns); old.value = Math.max(old.value, value); if(cap != null) old.cap = Math.max(old.cap, cap); old.src = src.id; }
      else { s = { type: st.type, name, left: turns, value, cap, src: src.id, fresh: tgt === src }; tgt.statuses.push(s); }
      ev.push(Object.assign({ type: 'status', chance: p, left: s.left, value: s.value, refreshed: !!old }, base));
      lines.push(tgt.name + ' ' + name + ' 걸림 (확률 ' + pct(p) + ' · ' + s.left + '턴' + (s.value ? ' · ' + pct(s.value) : '') + (cap != null ? ' · 상한 ' + s.cap : '') + (old ? ' · 갱신' : '') + ')');
    }

    /** V3-1 패시브 (행동 뒤): 기본 공격 뒤 확률 추가타 · 필살기 뒤 자기 강화 · 아군 전체 회복 */
    function afterAction(u, s, targets, ev, lines){
      const basic = s.def.kind === 'attack' && s.def.target === 'enemy_single' && !s.def.cooldown && !s.def.tag && !s.def.every;
      for(const p of u.passives){
        if(p.type === 'extraHit' && basic){
          const t = targets[0]; if(!t || !t.alive) continue;
          const r = roll();
          if(!(r < p.chance)){ lines.push('패시브 ' + p.name + ': 추가타 안 나옴 (확률 ' + pct(p.chance) + ')'); continue; }
          const d = damageOf(u, t, p.mult, { single: true }), before = t.hp;
          t.hp = Math.max(0, t.hp - d.amount); u.stats.dealt += before - t.hp; t.stats.taken += before - t.hp;
          ev.push({ type: 'damage', src: u.id, tgt: t.id, amount: d.amount, hp: t.hp, d, passive: p.name });
          lines.push('패시브 ' + p.name + ': 추가타 ' + t.name + ' 피해 ' + d.amount + ' (배율 ' + mul(p.mult) + ') HP ' + before + '→' + t.hp);
          if(t.hp <= 0){ t.alive = false; ev.push({ type: 'down', tgt: t.id }); lines.push(t.name + ' 쓰러짐'); }
        } else if(p.type === 'afterUlt' && s.def.tag === 'ultimate'){
          if(p.effect === 'selfBuff'){
            const key = 'pas:' + u.id + ':' + p.name, old = u.buffs.find(b => b.skill === key);
            if(old){ old.left = p.duration; old.fresh = true; } else u.buffs.push({ skill: key, name: p.name, stat: p.stat, pct: p.pct, left: p.duration, fresh: true });
            ev.push({ type: 'buff', src: u.id, tgt: u.id, stat: p.stat, pct: p.pct, left: p.duration, passive: p.name });
            lines.push('패시브 ' + p.name + ': 자기 ' + STAT_NAME[p.stat] + ' +' + pct(p.pct) + ' (' + p.duration + '턴)');
          } else if(p.effect === 'healAll'){
            const got = [];
            for(const a of alliesOf(u)){ const amt = Math.round(a.maxHp * p.pct), b0 = a.hp; a.hp = Math.min(a.maxHp, a.hp + amt); u.stats.healed += a.hp - b0; ev.push({ type: 'heal', src: u.id, tgt: a.id, amount: a.hp - b0, hp: a.hp, passive: p.name }); got.push(a.name + ' +' + (a.hp - b0)); }
            lines.push('패시브 ' + p.name + ': 아군 전체 최대 HP ' + pct(p.pct) + ' 회복 (' + got.join(', ') + ')');
          }
        }
      }
    }
    /** V3-1 패시브 (자기 턴 시작): HP 비율이 가장 낮은 아군 회복 */
    function turnStartPassives(u){
      for(const p of u.passives){
        if(p.type === 'thornWear'){ thornRegen(u, p); continue; }
        if(p.type !== 'turnHeal') continue;
        const cand = alliesOf(u).filter(a => a.hp < a.maxHp).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0]; if(!cand) continue;
        const amt = Math.round(cand.maxHp * p.pct), b0 = cand.hp; cand.hp = Math.min(cand.maxHp, cand.hp + amt); u.stats.healed += cand.hp - b0;
        S.log.push({ round: S.round, text: 'R' + S.round + ' · ' + u.name + ' 패시브 ' + p.name + ': ' + cand.name + ' 최대 HP ' + pct(p.pct) + ' 회복 +' + (cand.hp - b0) + ' HP ' + b0 + '→' + cand.hp, events: [{ type: 'heal', src: u.id, tgt: cand.id, amount: cand.hp - b0, hp: cand.hp, passive: p.name }] });
      }
    }
    /** V3-5a 가시 (행동 뒤): 맞힌 타수만큼 줄어듦 (0 아래로는 안 내려감) → 소진에 들어가면 로그에 표시 */
    function thornSpend(u, shots, ev, lines){
      const t0 = thornOf(u); if(!t0) return;
      const before = u.thorn; u.thorn = Math.max(0, u.thorn - shots); const t1 = thornOf(u);
      ev.push({ type: 'thorn', tgt: u.id, left: u.thorn, max: t1.max, worn: t1.worn });
      lines.push('패시브 ' + u.passives.find(x => x.type === 'thornWear').name + ': 가시 ' + before + '→' + u.thorn + ' (쏜 타수 ' + shots + ')' + (t1.worn && !t0.worn ? ' · 소진! 방어 -' + pct(t1.defLoss) : t1.worn ? ' · 소진 중' : ''));
    }
    /** V3-5a 가시 (자기 턴 시작): + regen (최대 max) → 값이 바뀌면 로그 한 줄 · 소진이 풀리면 표시 */
    function thornRegen(u, p){
      const t0 = thornOf(u); if(!t0 || u.thorn >= p.max) return;
      const before = u.thorn; u.thorn = Math.min(p.max, u.thorn + (p.regen || 0)); const t1 = thornOf(u);
      S.log.push({ round: S.round, text: 'R' + S.round + ' · ' + u.name + ' 패시브 ' + p.name + ': 가시 ' + before + '→' + u.thorn + ' (+' + (u.thorn - before) + ' 다시 자람)' + (t0.worn && !t1.worn ? ' · 소진 풀림' : ''),
        events: [{ type: 'thorn', tgt: u.id, left: u.thorn, max: p.max, worn: t1.worn }] });
    }
    /** V3-1 패시브 (1라운드 시작): 아군 전체 강화 */
    function startPassives(){
      for(const u of units){
        if(!u.alive) continue;
        for(const p of u.passives){
          if(p.type !== 'startBuff') continue;
          const ts = alliesOf(u);
          for(const t of ts){ const key = 'pas:' + u.id + ':' + p.name, old = t.buffs.find(b => b.skill === key); if(old){ old.left = p.duration; old.fresh = false; } else t.buffs.push({ skill: key, name: p.name, stat: p.stat, pct: p.pct, left: p.duration, fresh: false }); }
          S.log.push({ round: S.round, text: u.name + ' 패시브 ' + p.name + ': 아군 ' + ts.length + '명 ' + STAT_NAME[p.stat] + ' +' + pct(p.pct) + ' (' + p.duration + '턴)', events: ts.map(t => ({ type: 'buff', src: u.id, tgt: t.id, stat: p.stat, pct: p.pct, left: p.duration, passive: p.name })) });
        }
      }
    }

    /** 행동 실행 → 이벤트 */
    function act(skillId, targetId){
      const u = current(); if(!u) throw new Error('전투가 끝났습니다');
      const s = u.skills.find(x => x.id === skillId); if(!s) throw new Error(u.name + ' 에게 없는 스킬: ' + skillId);
      if(isStunned(u)) throw new Error(u.name + ' 은(는) 기절 상태라 행동할 수 없음 (B.pass 로 넘김)');
      if(!usable(u, s)) throw new Error(s.def.name + ' 은(는) 지금 쓸 수 없음 (쿨타임 ' + s.cd + ')');
      const targets = hitList(u, s, targetId);
      if(!targets) throw new Error('고를 수 없는 대상: ' + targetId);
      const ev = [], head = 'R' + S.round + ' · ' + u.name + '(' + ROW_NAME[u.row] + ') · ' + s.def.name;
      const lines = [];
      if(s.def.kind === 'attack'){
        const hits = hitsOf(s.def); let shots = 0;   // shots = 실제로 맞힌 타수 (V3-5a 가시 세기용)
        for(const t of targets){
          const d = damageOf(u, t, s.def.mult, { single: s.def.target === 'enemy_single' }), before = t.hp;
          // 적용된 보정은 항상 표시 (해당 없으면 ×1.00)
          const atkNote = d.weak ? ' (강화 +' + pct(d.buffAtk) + ' · 약화 -' + pct(d.weak) + ' → ' + (d.atkPct >= 0 ? '+' : '') + pct(d.atkPct) + ')'
            : d.atkPct ? ' (강화 +' + pct(d.atkPct) + ')' : ' (강화 없음)';   // 약화가 없으면 v1 그대로
          const detail = ' [공격 ' + Math.round(d.atk * 10) / 10 + atkNote +
            ' · 배율 ' + mul(s.def.mult) + ' · 후열 보정 ' + mul(d.back) + ' · 전열 보정 ' + mul(d.front) +
            ' · 방어 ' + Math.round(d.def * 10) / 10 + (d.defPct ? ' (강화 +' + pct(d.defPct) + ')' : ' (강화 없음)') + (d.passive && d.passive.length ? ' · 패시브 ' + d.passive.join(', ') : '') + ']';
          if(hits === 1){   // v1 그대로 (기준 로그와 한 글자까지 같아야 함)
            t.hp = Math.max(0, t.hp - d.amount); u.stats.dealt += before - t.hp; t.stats.taken += before - t.hp; shots++;
            ev.push({ type: 'damage', src: u.id, tgt: t.id, amount: d.amount, hp: t.hp, d });
            lines.push(t.name + '(' + ROW_NAME[t.row] + ') 피해 ' + d.amount + detail + ' HP ' + before + '→' + t.hp);
          } else {
            const parts = splitHits(d.amount, hits), done = [];
            for(let i = 0; i < parts.length && t.hp > 0; i++){
              const b0 = t.hp; t.hp = Math.max(0, t.hp - parts[i]); u.stats.dealt += b0 - t.hp; t.stats.taken += b0 - t.hp; done.push(parts[i]);
              ev.push({ type: 'damage', src: u.id, tgt: t.id, amount: parts[i], hp: t.hp, d, hit: i + 1, hits });
            }
            shots += done.length;
            const sum = done.reduce((a, b) => a + b, 0);
            lines.push(t.name + '(' + ROW_NAME[t.row] + ') 피해 합계 ' + sum + ' (' + hits + '회 중 ' + done.length + '회: ' + done.join(' + ') + ')' + detail + ' HP ' + before + '→' + t.hp);
          }
          if(t.hp <= 0 && t.alive){ t.alive = false; ev.push({ type: 'down', tgt: t.id }); lines.push(t.name + ' 쓰러짐'); }
          else if(s.def.status && t.alive) applyStatus(u, t, s.def.status, ev, lines);   // 대상마다 1번 · 모든 타격 뒤
        }
        if(u.thorn != null) thornSpend(u, shots, ev, lines);   // V3-5a 가시: 맞힌 타수만큼 줄어듦
      } else if(s.def.kind === 'heal'){
        for(const t of targets){
          const amt = Math.round(t.maxHp * s.def.pctMaxHp), before = t.hp; t.hp = Math.min(t.maxHp, t.hp + amt); u.stats.healed += t.hp - before;
          ev.push({ type: 'heal', src: u.id, tgt: t.id, amount: t.hp - before, hp: t.hp });
          lines.push(t.name + ' 회복 ' + (t.hp - before) + ' (최대 HP ' + pct(s.def.pctMaxHp) + ' = ' + amt + (t.hp - before < amt ? ', 최대 HP 초과분 버림' : '') + ') HP ' + before + '→' + t.hp);
        }
      } else if(s.def.kind === 'buff'){
        for(const t of targets){
          const old = t.buffs.find(b => b.skill === s.id);
          if(old){ old.left = s.def.duration; old.fresh = t === u; }
          else t.buffs.push({ skill: s.id, name: s.def.name, stat: s.def.stat, pct: s.def.pct, left: s.def.duration, fresh: t === u });
          ev.push({ type: 'buff', src: u.id, tgt: t.id, stat: s.def.stat, pct: s.def.pct, left: s.def.duration });
        }
        lines.push('아군 ' + targets.length + '명 ' + STAT_NAME[s.def.stat] + ' +' + pct(s.def.pct) + ' (' + s.def.duration + '턴 · 받은 캐릭터 자기 턴 기준 · 쌓이지 않음)');
      }
      if(u.passives.length) afterAction(u, s, targets, ev, lines);   // V3-1 패시브: 추가타 · 필살기 뒤 효과
      if(s.def.cooldown) s.cd = s.def.cooldown;
      u.stats.actions++;
      S.log.push({ round: S.round, actor: u.id, side: u.side, skill: s.id, text: head + ' → ' + lines.join(' / '), events: ev });
      endTurn(u);
      return ev;
    }

    /** 기절 상태의 차례를 넘김 (기절 남은 턴 1 감소 · 풀리면 다음 자기 턴이 끝날 때까지 기절 내성) */
    function pass(){
      const u = current(); if(!u) throw new Error('전투가 끝났습니다');
      const st = statusOf(u, 'stun');
      if(!st && !(isSilenced(u) && !u.skills.some(s => usable(u, s)))) throw new Error(u.name + ' 은(는) 기절 상태가 아니라 넘길 수 없음');
      let ev, text = 'R' + S.round + ' · ' + u.name + '(' + ROW_NAME[u.row] + ') · ';
      if(st){
        st.left--;
        ev = [{ type: 'stunSkip', tgt: u.id, left: st.left }];
        text += '기절로 쉼';
        if(st.left <= 0){ u.statuses = u.statuses.filter(s => s !== st); u.guard = { fresh: true }; ev.push({ type: 'statusEnd', tgt: u.id, status: 'stun' }); text += ' (기절 끝 · 다음 자기 턴이 끝날 때까지 기절 내성)'; }
        else text += ' (남은 ' + st.left + '턴)';
      } else { ev = [{ type: 'stunSkip', tgt: u.id, left: 0, silence: true }]; text += '침묵으로 쓸 스킬이 없어 쉼'; }   // 안전장치: 침묵인데 기본 공격도 없음
      S.log.push({ round: S.round, actor: u.id, side: u.side, skill: null, pass: true, text, events: ev });
      endTurn(u);
      return ev;
    }

    function endTurn(u){
      // 강화 시간 감소 (받은 그 턴은 감소하지 않음)
      u.buffs.forEach(b => { if(b.fresh) b.fresh = false; else b.left--; });
      const gone = u.buffs.filter(b => b.left <= 0);
      if(gone.length){ u.buffs = u.buffs.filter(b => b.left > 0); S.log.push({ round: S.round, text: u.name + ' 강화 종료: ' + gone.map(b => b.name).join(', ') }); }
      // 약화: 강화와 같은 방식으로 감소 (기절은 pass, 중독은 턴 시작에 감소)
      if(u.statuses.length){
        u.statuses.forEach(s => { if(s.type !== 'weaken' && s.type !== 'silence') return; if(s.fresh) s.fresh = false; else s.left--; });   // 약화 · 침묵 (V3-5a)
        const off = u.statuses.filter(s => s.left <= 0);
        if(off.length){ u.statuses = u.statuses.filter(s => s.left > 0); S.log.push({ round: S.round, text: u.name + ' 상태이상 종료: ' + off.map(s => s.name).join(', '), events: off.map(s => ({ type: 'statusEnd', tgt: u.id, status: s.type })) }); }
      }
      if(u.guard){ if(u.guard.fresh) u.guard.fresh = false; else u.guard = null; }   // 기절 내성: 풀린 그 턴 + 다음 자기 턴 끝까지
      S.qi++; S.started = null;
      if(result()) S.log.push({ round: S.round, text: '전투 종료: ' + END_NAME[S.over] });
    }

    function queueView(){ current(); return S.queue.slice(S.qi).filter(u => u.alive); }
    function setAuto(unitId, skillId, on){ const u = byId(unitId), s = u && u.skills.find(x => x.id === skillId); if(s) s.auto = !!on; }

    return { data, rules: R, mode, seed, units, byId, state: S, log: S.log, current, skillsOf, legalTargets, targetsOf, act, pass, isStunned, isSilenced, thornOf, statusOf, statusChance, statusTurns, result, queueView, setAuto, rand, damageOf, effAtk, effDef,
      get round(){ return S.round; } };
  }

  const api = Object.freeze({ create, rng });
  if(typeof module !== 'undefined' && module.exports) module.exports = api; else root.TaleliaBattleRules = api;
})(typeof window !== 'undefined' ? window : globalThis);
