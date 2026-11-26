/* =====================================================================
 * TALELIA · dungeon/rules.js — 던전 규칙 (docs/design/equipment-dungeon.md · E3 · 화면 코드 없음 · 저장 없음 · 서버 없음)
 *
 *  모든 함수는 받은 저장(뽑기 저장 v3)을 바꾸지 않고 새 상태를 돌려줌 → { ok, reason?, save, … }
 *  시계 now(밀리초)와 시드는 넘겨받은 값만 씀 → 테스트에서 자정 · 보상을 똑같이 다시 만들 수 있음
 *  DG = window.TALELIA_DUNGEON · E = window.TALELIA_EQUIP · 장비 만들기는 TaleliaGear.makeItem
 *
 *  R = TaleliaDungeon
 *   R.validate(DG, battle, extraSkills)    던전 데이터 검사 (층 1~10 연속 · 적 base · 스킬 id · 6자리 · 드롭표 합 100 · 보스 1) → 문제 목록
 *   R.dayOf(now)                           기기 날짜 'YYYY-MM-DD' (자정 초기화 기준)
 *   R.daily(DG, save, now)                 오늘 { day, used, left, max } (날짜가 바뀌었으면 used 0 으로 봄 · 저장은 그대로)
 *   R.floorOf(DG, f) · R.isOpen(DG, save, f)   층 데이터 · 개방 여부 (1층 또는 이전 층 클리어)
 *   R.enter(DG, save, f, now)              입장 → { ok, save, runId, seed, left } · 개방 · 남은 횟수(입장 소모) 확인 · 입장할 때 차감 (승패 무관)
 *                                          runId = '날짜#그날 쓴 횟수' (그날 안에서 겹치지 않음) · seed = runId 에서 만든 수
 *   R.rollReward(DG, E, f, seed, pity)     보상 굴림 (순수 함수 · 전투 화면 · 뽑기 화면이 같은 결과) → { gold, item: { grade, slot, set }, pityBefore, pityAfter, pityHit }
 *                                          불운 보정 층(7~10)이면 pity(연속 무전설 수)가 after(60) 이상일 때 전설 확정 · 전설이면 0 · 아니면 +1 · 다른 층은 그대로
 *   R.applyResult(DG, E, save, { runId, floor, result, seed })   결과 반영 (runId 로 딱 한 번)
 *                                          승리 = 골드 + 장비 1개 + 최고 클리어 층 · 불운 보정 카운트 갱신 / 패배 · 무승부 = 보상 없음 (기록만)
 *                                          같은 runId 를 다시 넣으면 거절 (duplicate) · runs 는 최근 runKeep 개만 기억
 *   R.waveOf(DG, battle, f, round)         그 층 1라운드(round 1) · 보스(round 2) 적 목록 (체력 · 공격 × s · 보스 배율) — E4 전투 꾸리기용
 *  E4 (던전 전투 · 화면 · 모의 공용)
 *   R.roundSeed(seed, round)               라운드 전투 시드 (1라운드 = seed 그대로 · 보스 = seed 에서 만든 다른 수)
 *   R.roundData(DG, battle, f, round, base)   rules.js 가 받는 전투 데이터 { version, rules, skills, allies, enemies }
 *                                          base = 시험 전투 변환(js/gacha/trial.js build) 결과 data → 아군 · 스킬만 씀 (라운드마다 새 사본 = 전원 회복)
 *   R.runFloor(DG, battle, f, base, seed, Rules, AI)   자동 전투로 1라운드 → 보스 → { result: 'win'|'lose'|'draw', round: 끝난 라운드, rounds: [결과…] }
 *   R.benchSave(DG, E, f, { gear })        층별 기준 편성(DG.bench) 저장 (승률 맞추기 · 테스트용) · gear: false = 같은 캐릭터 장비 없음
 * ===================================================================== */
(function(root){
  'use strict';
  const clone = o => JSON.parse(JSON.stringify(o));
  const fail = (save, reason, extra) => Object.assign({ ok: false, reason, save }, extra || {});
  const RUN_KEEP = 200;   // 반영한 runId 기억 개수 (하루 최대 100회 → 이틀치)
  function rng(seed){
    let a = (seed >>> 0) || 1;
    return function(){ a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  /** 글자 → 32비트 시드 (FNV-1a) */
  function seedOf(text){ let h = 0x811c9dc5; for(const ch of String(text)){ h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; } return h >>> 0 || 1; }
  const pad = n => String(n).padStart(2, '0');
  function dayOf(now){ const d = new Date(now); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }

  /* ---------- 데이터 ---------- */
  function floorOf(DG, f){ return DG.floors.find(x => x.floor === f) || null; }
  function validate(DG, battle, extraSkills){
    const P = [], skills = Object.assign({}, (battle && battle.skills) || {}, extraSkills || {}), bases = new Set(((battle && battle.enemies) || []).map(e => e.id));
    if(!(Number.isInteger(DG.dailyRuns) && DG.dailyRuns > 0)) P.push('하루 횟수가 1 이상 정수가 아님');
    DG.floors.forEach((fl, i) => {
      const tag = fl.floor + '층';
      if(fl.floor !== i + 1) P.push('층 번호가 1부터 이어지지 않음: ' + fl.floor);
      if(!(fl.s > 0)) P.push(tag + ' 배율 s 가 없음');
      if(!(Number.isInteger(fl.cost) && fl.cost >= 1 && fl.cost <= DG.dailyRuns)) P.push(tag + ' 입장 소모가 틀림');
      if(!(Number.isInteger(fl.gold) && fl.gold >= 0)) P.push(tag + ' 골드가 정수가 아님');
      const sum = Object.values(fl.drop || {}).reduce((a, b) => a + b, 0); if(Math.abs(sum - 100) > 1e-9) P.push(tag + ' 드롭표 합이 100 이 아님: ' + sum);
      const all = (fl.wave || []).concat(fl.boss ? [fl.boss] : []);
      if(!fl.wave || !fl.wave.length) P.push(tag + ' 1라운드 적이 없음');
      if(!fl.boss) P.push(tag + ' 보스가 없음');
      for(const [list, name] of [[fl.wave || [], '1라운드'], [fl.boss ? [fl.boss] : [], '보스']]){
        const spots = new Set(), ids = new Set();
        for(const e of list){
          if(!bases.has(e.base)) P.push(tag + ' ' + name + ' 없는 적: ' + e.base);
          if(!['front', 'back'].includes(e.row) || ![0, 1, 2].includes(e.slot)) P.push(tag + ' ' + name + ' 자리가 틀림: ' + e.id);
          if(spots.has(e.row + e.slot)) P.push(tag + ' ' + name + ' 같은 자리에 둘: ' + e.row + e.slot); spots.add(e.row + e.slot);
          if(ids.has(e.id)) P.push(tag + ' ' + name + ' id 겹침: ' + e.id); ids.add(e.id);
          const base = ((battle && battle.enemies) || []).find(b => b.id === e.base), sk = e.skills || (base && base.skills) || [];
          for(const k of sk) if(!skills[k]) P.push(tag + ' ' + name + ' 없는 스킬: ' + k);
        }
      }
      if(all.length > 7) P.push(tag + ' 적이 너무 많음');
    });
    if(!DG.pity || !(DG.pity.after > 0)) P.push('불운 보정 값이 없음');
    return P;
  }

  /* ---------- 하루 횟수 · 개방 ---------- */
  function daily(DG, save, now){
    const day = dayOf(now), d = save.dungeon || {}, used = d.day === day ? (d.used || 0) : 0;
    return { day, used, left: Math.max(0, DG.dailyRuns - used), max: DG.dailyRuns };
  }
  function isOpen(DG, save, f){ return !!floorOf(DG, f) && (f === 1 || ((save.dungeon && save.dungeon.cleared) || 0) >= f - 1); }
  function enter(DG, save, f, now){
    const fl = floorOf(DG, f); if(!fl) return fail(save, '없는 층: ' + f);
    if(!isOpen(DG, save, f)) return fail(save, (f - 1) + '층을 먼저 클리어해야 해요');
    const t = daily(DG, save, now);
    if(t.left < fl.cost) return fail(save, '오늘 남은 횟수가 모자라요 (' + t.left + ' / 입장 ' + fl.cost + '회)', { left: t.left });
    const s = clone(save); s.dungeon.day = t.day; s.dungeon.used = t.used + fl.cost;
    const runId = t.day + '#' + String(s.dungeon.used).padStart(3, '0');
    return { ok: true, save: s, runId, seed: seedOf(runId), floor: f, cost: fl.cost, left: DG.dailyRuns - s.dungeon.used };
  }

  /* ---------- 보상 ---------- */
  function rollReward(DG, E, f, seed, pity){
    const fl = floorOf(DG, f); if(!fl) return null;
    const r = rng(seed), counts = DG.pity.floors.includes(f), before = pity || 0, forced = counts && before >= DG.pity.after;
    let grade = null;
    if(forced) grade = DG.pity.grade;
    else { const keys = Object.keys(fl.drop), total = keys.reduce((a, k) => a + fl.drop[k], 0); let x = r() * total; for(const k of keys){ x -= fl.drop[k]; if(x < 0){ grade = k; break; } } if(!grade) grade = keys[keys.length - 1]; }
    if(forced) r();   // 확정이어도 굴림 수를 맞춰 부위 · 세트 난수가 같은 자리에서 나옴
    const slot = E.slotOrder[Math.floor(r() * E.slotOrder.length)];
    let set = null;
    if(E.grades[grade] && E.grades[grade].hasSet){ const pool = Object.keys(E.sets).filter(k => E.sets[k].drop); set = pool[Math.floor(r() * pool.length)]; }
    const legend = grade === DG.pity.grade;
    return { floor: f, gold: fl.gold, item: { grade, slot, set }, pityBefore: before, pityAfter: counts ? (legend ? 0 : before + 1) : before, pityHit: forced };
  }
  function applyResult(DG, E, save, run){
    run = run || {};
    if(!run.runId) return fail(save, 'runId 가 없음');
    const runs = (save.dungeon && save.dungeon.runs) || [];
    if(runs.includes(run.runId)) return fail(save, '이미 반영한 전투', { duplicate: true });
    const fl = floorOf(DG, run.floor); if(!fl) return fail(save, '없는 층: ' + run.floor);
    let s = clone(save), reward = null;
    if(run.result === 'win'){
      reward = rollReward(DG, E, run.floor, run.seed != null ? run.seed : seedOf(run.runId), s.dungeon.pity || 0);
      const Q = root.TaleliaGear; if(!Q) return fail(save, '장비 규칙(js/gacha/gear.js)이 없음');
      const made = Q.makeItem(E, s, reward.item, 'dungeon:' + run.floor); if(!made.ok) return fail(save, made.reason);
      s = made.save; reward.iid = made.item.iid;
      s.gold += reward.gold; s.dungeon.pity = reward.pityAfter;
      const firstClear = run.floor > (s.dungeon.cleared || 0);
      s.dungeon.cleared = Math.max(s.dungeon.cleared || 0, run.floor);
      const TS = DG.tstone;   // V3-3 초월석: 층 첫 클리어 + 보스 반복 클리어 확률 (하루 상한 · 날짜 = runId 앞부분)
      if(TS){
        let n = 0;
        if(firstClear) n = TS.first || 0;
        else if(((TS.repeat || {})[run.floor] || 0) > 0){
          const day = String(run.runId).split('#')[0], used = s.dungeon.tday === day ? (s.dungeon.tgot || 0) : 0;
          if(used < (TS.dailyMax || 0) && rng(seedOf(run.runId + 't'))() < TS.repeat[run.floor]){ n = 1; s.dungeon.tday = day; s.dungeon.tgot = used + 1; }
        }
        if(n > 0){ s.tstones = (s.tstones || 0) + n; reward.tstones = n; }
      }
    }
    s.dungeon.runs = runs.concat(run.runId).slice(-RUN_KEEP);
    return { ok: true, save: s, reward, duplicate: false, result: run.result };
  }

  /* ---------- 적 (E4 전투 꾸리기용) ---------- */
  function waveOf(DG, battle, f, round){
    const fl = floorOf(DG, f); if(!fl) return null;
    const list = round === 2 ? [fl.boss] : fl.wave, isBoss = round === 2;
    return list.map(e => { const b = battle.enemies.find(x => x.id === e.base); const o = clone(Object.assign({}, b, e)); delete o.base;
      const mh = DG.mix ? DG.mix.hp : 1, ma = DG.mix ? DG.mix.atk : 1;   // V3: 체력 · 공격 비율 (없으면 1)
      o.hp = Math.max(1, Math.round(o.hp * fl.s * mh * (isBoss ? DG.boss.hp : 1))); o.atk = Math.max(1, Math.round(o.atk * fl.s * ma * (isBoss ? DG.boss.atk : 1))); return o; });
  }

  /* ---------- 라운드 전투 (E4) ---------- */
  function roundSeed(seed, round){ return round === 2 ? (Math.imul(((seed >>> 0) ^ 0x2545F491) >>> 0, 0x9E3779B1) >>> 0) || 1 : (seed >>> 0) || 1; }
  function roundData(DG, battle, f, round, base){
    const enemies = waveOf(DG, battle, f, round); if(!enemies || !base) return null;
    return { version: base.version, rules: base.rules, skills: base.skills, allies: clone(base.allies), enemies };
  }
  function runFloor(DG, battle, f, base, seed, Rules, AI){
    const rounds = [];
    for(const round of [1, 2]){
      const r = AI.runAuto(Rules.create(roundData(DG, battle, f, round, base), { mode: 'pve', seed: roundSeed(seed, round) })); rounds.push(r);
      if(r !== 'win') return { result: r, round, rounds };
    }
    return { result: 'win', round: 2, rounds };
  }
  /** 층별 기준 편성 → 뽑기 저장 모양 (units · party · items) · 5강 보너스 = 무기 공 · 방어구 방 · 장신구 체 (고정) */
  function benchSave(DG, E, f, opts){
    const B = DG.bench, spec = (opts && opts.gear === false) ? [] : (B.gear[f] || []), BONUS = { weapon: 'atk', armor: 'def', accessory: 'hp' };
    const s = { units: [], party: [], items: [], gold: 0, nextItemUid: 1, clock: 0 };
    B.units.forEach(([sp, star, row, slot], i) => {
      const sd = (root.TALELIA_GACHA && root.TALELIA_GACHA.species[sp]) || {}, uid = sd.story ? sp : 'b' + (i + 1);
      const u = { uid, species: sp, star, enh: 0, tr: 0, lock: false, gear: { weapon: null, armor: null, accessory: null } };
      for(const g of spec){ const iid = 'e' + String(s.nextItemUid++).padStart(6, '0');
        s.items.push({ iid, slot: g.slot, grade: g.grade, enh: g.enh, bonus: g.enh >= E.maxEnh ? { stat: BONUS[g.slot] } : null,
          set: E.grades[g.grade].hasSet ? (g.set || Object.keys(E.sets).find(k => E.sets[k].drop)) : null, lock: false, got: 0, from: 'bench' });
        u.gear[g.slot] = iid; }
      s.units.push(u); s.party.push({ uid, row, slot });
    });
    return s;
  }

  const api = Object.freeze({ rng, seedOf, dayOf, validate, floorOf, daily, isOpen, enter, rollReward, applyResult, waveOf, roundSeed, roundData, runFloor, benchSave, RUN_KEEP });
  if(typeof module !== 'undefined' && module.exports) module.exports = api; else root.TaleliaDungeon = api;
})(typeof window !== 'undefined' ? window : globalThis);
