/* =====================================================================
 * TALELIA · gacha/rules.js — 뽑기 · 강화 · 승급 · 초월 · 편성 규칙 (화면 코드 없음 · 저장 없음 · 서버 없음)
 *
 *  모든 함수는 받은 저장 데이터(save)를 바꾸지 않고 새 상태를 돌려줌 → { ok, reason?, save, … }
 *  난수는 넘겨받은 rng() (0 이상 1 미만) 만 씀 → 시드 고정 난수로 결과를 똑같이 다시 만들 수 있음
 *
 *  G = TaleliaGacha
 *   G.rng(seed)                         시드 고정 난수 (mulberry32)
 *   G.validate(data)                    도감 데이터 검사 → 문제 목록 (빈 배열 = 정상)
 *   G.newSave(data, opts)               새 저장 (정령석 · 스토리 캐릭터 3종)
 *   G.checkSave(data, save)             저장 데이터 모양 검사 → 문제 목록
 *   G.migrate(data, save)               예전 · 빠진 필드를 채운 새 저장 (버전 맞춤 · 3판 = 장비 · 골드 · 던전 진행 · 장비 규칙은 js/gacha/gear.js)
 *   G.pull(data, save, 'single'|'ten', rng)   뽑기 → { ok, reason, save, results: [{ uid, species, rarity, star, pity, guaranteed }] }
 *   G.materialRate(data, target, material)    강화 성공률 (0 = 재료로 못 씀)
 *   G.enhance(data, save, targetUid, material, rng)   material = 개체 uid 또는 { shard: true } (별의 조각)
 *                                       → { ok, reason, save, success, rate, before, after, used }
 *   G.promote(data, save, targetUid, materialUid)      승급 (5강 + 같은 성급 5강 1마리 · 100%) → { ok, reason, save, before, after, used }
 *   G.transcend(data, save, targetUid, materialUid)    초월 (같은 캐릭터 중복 1마리 · 100% · 최대 data.transcend.max) → { ok, reason, save, before, after, used }
 *   G.canMaterial(data, save, targetUid, materialUid)  재료로 쓸 수 있는지 { enhance, promote, transcend } (화면의 재료 고르기용)
 *   G.transcendBonus(data, tr)          초월 단계까지 쌓인 능력치 보너스 (예: 6단계 = 0.25)
 *   G.setParty(data, save, list)        편성 [{ uid, row: 'front'|'back', slot: 0~2 }] 최대 6명 · 같은 캐릭터(같은 종류)는 1마리만
 *   G.dedupeParty(data, save)           편성에서 같은 종류 중복을 뒤쪽부터 뺀 목록 (예전 저장 · 시험 전투 불러올 때)
 *   G.bestParty(data, save) · G.autoFill(data, save) · G.strongerParty(data, save)   추천 편성(24호 + 종류 안 겹치는 전투력 상위) · 빈 칸 채우기(배치는 그대로) · 추천이 더 센지
 *   G.setLock(data, save, uid, on)     잠금 (잠긴 캐릭터는 강화 재료가 안 됨)
 *   G.addStones · G.addShards(data, save, n)   개발용 지급
 *   G.statsOf(data, unit) · G.skillOf(data, unit, skillId)   성급 · 강화 반영 능력치 · 스킬
 *
 *  뽑기 처리 순서 (한 장마다): 천장 횟수 +1 → 50 이면 전설 이상 확정(천장) · 횟수 0 / 아니면 확률표로 등급
 *   (확률표로 전설이 나와도 횟수는 그대로 쌓임) → 등급 안 종류는 같은 확률 (스토리 캐릭터 제외) → 새 개체(시작 성급 · 0강)
 *  10회 뽑기: 10장을 위처럼 뽑은 뒤, 영웅 이상이 하나도 없으면 마지막 장을 영웅 이상으로 다시 뽑음 (천장 횟수는 그대로)
 *  강화: 성공률 = 0.5 ^ (대상 성급 − 재료 성급) · 별의 조각 = 100% (같은 성급 1마리 대신) · 실패해도 재료는 사라짐 · 5강에서 멈춤 (자동 승급 없음)
 *  승급: 5강 캐릭터 + 같은 성급의 5강 캐릭터 1마리(종류 상관없음) → 다음 성급 0강 · 100% · 별의 조각으로 대신할 수 없음 · 6성이 끝
 *  초월: 같은 캐릭터 중복 1마리(성급 · 강화 상관없음) → 초월 +1 · 100% · 최대 6단계 · 체력 · 공격 · 방어 보너스 누적(속도 제외) (data.transcend.bonus)
 *        중복 캐릭터를 강화 재료로 쓸지 초월 재료로 쓸지는 플레이어가 고름 (두 함수 모두 받아 줌)
 * ===================================================================== */
(function(root){
  'use strict';
  const SAVE_VERSION = 4;   // 2 = 초월(tr) 추가 · 5강 자동 승급 없앰 (1 → 2 는 migrate 가 tr: 0 을 채움)
                            // 3 = 장비 · 골드 · 던전 진행 (docs/design/equipment-dungeon.md · E1 · 2 → 3 은 migrate 가 gold 0 · items [] · 캐릭터 gear 빈 칸 · dungeon · daily 를 채움)
                            // 4 = 스테이지 진행 (docs/design/stage-system.md · S1 · 3 → 4 는 migrate 가 stage 를 채움 · 이미 뽑기 · 던전을 한 저장은 안내 · 마을 구경을 본 것으로 채움)
  const GEAR_SLOTS = ['weapon', 'armor', 'accessory'];   // 장비 칸 (data/gacha/equipment.js slotOrder 와 같아야 함 · tests/gear-rules.test.html 이 확인)
  const emptyGear = () => ({ weapon: null, armor: null, accessory: null });
  const newDungeon = () => ({ cleared: 0, day: null, used: 0, pity: 0, runs: [] });   // 최고 클리어 층 · 하루 횟수(날짜 · 쓴 횟수) · 7~10층 전설 불운 보정 카운트 · 반영한 runId

  const newStage = () => ({ cleared: {}, open: null, runs: [], seq: 0, guide: { gacha: false, party: false, dungeon: false }, intro: false });   // 클리어한 스테이지(첫 클리어 시각) · 끝나지 않은 판 { runId, id, at } · 반영한 runId · 입장 순번 · 안내를 본 적 · 마을 구경(ch1_01)을 끝냈는지

  function rng(seed){
    let a = (seed >>> 0) || 1;
    return function(){ a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const clone = o => JSON.parse(JSON.stringify(o));
  const fail = (save, reason) => ({ ok: false, reason, save });
  const rarityKeys = D => Object.keys(D.rarities).sort((a, b) => D.rarities[a].order - D.rarities[b].order);
  const rank = (D, r) => r && D.rarities[r] ? D.rarities[r].order : 0;
  const startStar = (D, sp) => sp.startStar || (sp.rarity && D.rarities[sp.rarity].startStar) || 1;

  /* ---------- 도감 검사 ---------- */
  function validate(D){
    const P = [], R = D.rarities || {}, keys = Object.keys(R);
    const sum = keys.reduce((s, k) => s + (+R[k].rate || 0), 0);
    if(Math.abs(sum - 100) > 1e-9) P.push('확률 합이 100 이 아님: ' + sum);
    for(const k of keys){ const r = R[k];
      if(!(r.rate >= 0)) P.push(k + ' 확률이 음수이거나 숫자가 아님');
      if(!(r.startStar >= 1 && r.startStar <= D.maxStar)) P.push(k + ' 시작 성급이 1~' + D.maxStar + ' 밖');
      if(r.rate > 0 && !Object.values(D.species).some(s => s.gacha && s.rarity === k)) P.push(k + ' 등급에 뽑기 캐릭터가 없음'); }
    if(!(D.starMul && D.starMul.length === D.maxStar + 1) || !(D.skillMul && D.skillMul.length === D.maxStar + 1)) P.push('성급 배율표 길이가 maxStar + 1 이 아님');
    if(D.tenGuarantee && !R[D.tenGuarantee]) P.push('10회 보장 등급이 없음: ' + D.tenGuarantee);
    if(D.transcend && !(Array.isArray(D.transcend.bonus) && D.transcend.bonus.length === D.transcend.max + 1)) P.push('초월 보너스 표 길이가 max + 1 이 아님');
    for(const k of D.pityPool || []) if(!R[k]) P.push('천장 등급이 없음: ' + k);
    for(const [id, sp] of Object.entries(D.species)){
      if(sp.gacha && sp.story) P.push(id + ' 스토리 캐릭터가 뽑기에 들어 있음');
      if(sp.gacha && !R[sp.rarity]) P.push(id + ' 등급이 없음: ' + sp.rarity);
      for(const st of ['hp', 'atk', 'def', 'spd']) if(!(sp.base && sp.base[st] > 0)) P.push(id + ' 능력치 ' + st + ' 없음');
      if(sp.skillSource !== 'battle') for(const s of sp.skills || []){ const d = D.skills[s];
        if(!d){ P.push(id + ' 없는 스킬: ' + s); continue; }
        if(d.status && !(D.statuses || []).includes(d.status.type)) P.push(s + ' 알 수 없는 상태이상: ' + d.status.type);
        if(d.reach != null && d.reach !== 'back') P.push(s + ' 알 수 없는 reach: ' + d.reach); }   // V3-5a 후열 우선
    }
    return P;
  }

  /* ---------- 저장 ---------- */
  function newUnit(D, save, speciesId, from){
    const sp = D.species[speciesId], uid = (sp.story ? 'story_' + speciesId : 'u' + String(save.nextUid++).padStart(6, '0'));
    return { uid, species: speciesId, star: startStar(D, sp), enh: 0, tr: 0, lock: false, from: from || (sp.story ? 'story' : 'gacha'), got: save.clock++, gear: emptyGear() };
  }
  function newSave(D, opts){
    opts = opts || {};
    const save = { v: SAVE_VERSION, stones: opts.stones != null ? opts.stones : D.currency.start, shards: opts.shards || 0, pity: 0,
                   units: [], party: [], seen: {}, nextUid: 1, clock: 1, history: [], stats: { pulls: 0, pityHits: 0, guarantees: 0 },
                   gold: opts.gold || 0, items: [], nextItemUid: 1, dungeon: newDungeon(), daily: { claimed: null }, stage: newStage(),
                   userId: opts.userId != null ? String(opts.userId) : null };   // V3-5b 사용자 id 자리 (선택 · 비어 있어도 됨 · 계정 연동은 아직 없음 · 예전 v4 저장에는 없어도 그대로 열림 = migrate 가 채우지 않음)
    for(const [id, sp] of Object.entries(D.species)) if(sp.story){ const u = newUnit(D, save, id, 'story'); save.units.push(u); save.seen[id] = u.got; }
    return save;
  }
  function checkSave(D, s){
    const P = [];
    if(!s || typeof s !== 'object') return ['저장이 객체가 아님'];
    if(s.v !== SAVE_VERSION) P.push('버전이 다름: ' + s.v);
    for(const k of ['stones', 'shards', 'pity', 'nextUid', 'clock']) if(!(Number.isInteger(s[k]) && s[k] >= 0)) P.push(k + ' 가 0 이상 정수가 아님');
    if(!Array.isArray(s.units)) P.push('units 가 배열이 아님'); else {
      const seen = new Set();
      for(const u of s.units){
        if(!u || !u.uid || seen.has(u.uid)){ P.push('uid 없음 · 겹침: ' + (u && u.uid)); continue; } seen.add(u.uid);
        if(!D.species[u.species]) P.push(u.uid + ' 도감에 없는 종류: ' + u.species);
        if(!(Number.isInteger(u.star) && u.star >= 1 && u.star <= D.maxStar)) P.push(u.uid + ' 성급 범위 밖: ' + u.star);
        if(!(Number.isInteger(u.enh) && u.enh >= 0 && u.enh <= D.maxEnh)) P.push(u.uid + ' 강화 범위 밖: ' + u.enh);
        if(!(Number.isInteger(u.tr) && u.tr >= 0 && u.tr <= trMax(D))) P.push(u.uid + ' 초월 범위 밖: ' + u.tr); }
    }
    if(!Array.isArray(s.party)) P.push('party 가 배열이 아님'); else if(Array.isArray(s.units)) P.push(...partyProblems(D, s, s.party));
    if(s.pity >= (D.pity || Infinity) && D.pity) P.push('천장 횟수가 ' + D.pity + ' 이상');
    if(s.userId != null && typeof s.userId !== 'string') P.push('userId 가 글자가 아님');   // 선택 칸 (없음 · null 허용)
    P.push(...gearProblems(s));
    P.push(...stageProblems(s));
    return P;
  }
  /** 저장 v3 장비 모양 검사 (장비 데이터 없이 할 수 있는 것만 · 등급 · 강화 · 세트 값은 TaleliaGear.checkSave) */
  function gearProblems(s){
    const P = [];
    for(const k of ['gold', 'nextItemUid']) if(!(Number.isInteger(s[k]) && s[k] >= 0)) P.push(k + ' 가 0 이상 정수가 아님');
    if(!Array.isArray(s.items)){ P.push('items 가 배열이 아님'); return P; }
    const ids = new Map();
    for(const it of s.items){ if(!it || !it.iid || ids.has(it.iid)){ P.push('장비 iid 없음 · 겹침: ' + (it && it.iid)); continue; } if(!GEAR_SLOTS.includes(it.slot)) P.push(it.iid + ' 부위가 틀림: ' + it.slot); ids.set(it.iid, it); }
    const used = new Set();
    for(const u of s.units || []){
      if(!u || !u.gear || typeof u.gear !== 'object'){ P.push((u && u.uid) + ' 장비 칸 없음'); continue; }
      for(const slot of GEAR_SLOTS){ const iid = u.gear[slot]; if(iid == null) continue;
        const it = ids.get(iid);
        if(!it) P.push(u.uid + ' 없는 장비를 장착: ' + iid);
        else if(it.slot !== slot) P.push(u.uid + ' ' + slot + ' 칸에 다른 부위 장비: ' + iid);
        if(used.has(iid)) P.push('한 장비를 두 캐릭터가 장착: ' + iid); used.add(iid); }
    }
    if(!s.dungeon || typeof s.dungeon !== 'object' || !Array.isArray(s.dungeon.runs)) P.push('dungeon 진행 모양이 틀림');
    if(!s.daily || typeof s.daily !== 'object') P.push('daily 모양이 틀림');
    return P;
  }
  /** 저장 v4 스테이지 모양 검사 (스테이지 데이터 없이 할 수 있는 것만 · 어느 스테이지인지는 TaleliaStage 가 봄) */
  function stageProblems(s){
    const P = [], t = s.stage;
    if(!t || typeof t !== 'object'){ P.push('stage 진행 모양이 틀림'); return P; }
    if(!t.cleared || typeof t.cleared !== 'object' || Array.isArray(t.cleared) || Object.values(t.cleared).some(v => !Number.isFinite(v))) P.push('stage.cleared 가 { 스테이지: 시각 } 모양이 아님');
    if(!Array.isArray(t.runs)) P.push('stage.runs 가 배열이 아님');
    if(!Number.isInteger(t.seq) || t.seq < 0) P.push('stage.seq 가 0 이상 정수가 아님');
    if(t.open != null && !(typeof t.open === 'object' && t.open.runId && t.open.id)) P.push('stage.open 모양이 틀림');
    if(!t.guide || typeof t.guide !== 'object' || ['gacha', 'party', 'dungeon'].some(k => typeof t.guide[k] !== 'boolean')) P.push('stage.guide 모양이 틀림');
    if(typeof t.intro !== 'boolean') P.push('stage.intro 가 참 · 거짓이 아님');
    return P;
  }
  function migrate(D, s){
    const out = clone(s || {}), base = newSave(D, { stones: 0 });
    if(!Array.isArray(out.units) || !Array.isArray(out.party) || (out.stats != null && typeof out.stats !== 'object')) return out;   // 모양이 크게 다르면 고치지 않음 → checkSave 가 망가진 것으로 판정
    for(const k of Object.keys(base)) if(out[k] == null && k !== 'userId') out[k] = k === 'units' ? base.units : clone(base[k]);   // userId 는 선택 칸이라 채우지 않음 (예전 v4 저장이 한 글자도 안 바뀌고 열림)
    for(const k of ['pulls', 'pityHits', 'guarantees']) if(out.stats[k] == null) out.stats[k] = 0;
    // 스토리 캐릭터는 늘 있어야 함
    for(const [id, sp] of Object.entries(D.species)) if(sp.story && !out.units.some(u => u.species === id)){ const u = newUnit(D, out, id, 'story'); out.units.push(u); out.seen[id] = out.seen[id] || u.got; }
    for(const u of out.units){ if(u.lock == null) u.lock = false; if(u.enh == null) u.enh = 0; if(u.tr == null) u.tr = 0;
      if(!u.gear || typeof u.gear !== 'object') u.gear = emptyGear(); else for(const k of GEAR_SLOTS) if(u.gear[k] === undefined) u.gear[k] = null; }   // 3판: 장비 칸
    if(out.dungeon && typeof out.dungeon === 'object'){ const d0 = newDungeon(); for(const k of Object.keys(d0)) if(out.dungeon[k] == null) out.dungeon[k] = d0[k]; }
    if(out.stage && typeof out.stage === 'object'){ const t0 = newStage();   // 4판: 스테이지 진행 (빠진 칸만 채움)
      for(const k of Object.keys(t0)) if(out.stage[k] == null) out.stage[k] = clone(t0[k]);
      if(typeof out.stage.guide === 'object') for(const k of Object.keys(t0.guide)) if(out.stage.guide[k] == null) out.stage.guide[k] = false; }
    if((+s.v || 0) < 4 && out.stage && typeof out.stage === 'object'){   // 3 → 4: 이미 뽑기 · 던전을 한 저장은 안내 · 마을 구경을 본 것으로 (새 안내가 갑자기 뜨지 않게)
      const pulled = out.stats && out.stats.pulls > 0, dg = out.dungeon && ((out.dungeon.cleared || 0) > 0 || (Array.isArray(out.dungeon.runs) && out.dungeon.runs.length > 0));
      if(pulled || dg){ out.stage.intro = true; out.stage.guide.gacha = true; }
      if(dg){ out.stage.guide.party = true; out.stage.guide.dungeon = true; } }
    out.party = dedupeParty(D, out);   // 예전 저장의 같은 캐릭터 중복 편성은 뒤쪽을 뺌
    out.v = SAVE_VERSION;
    return out;
  }

  /* ---------- 뽑기 ---------- */
  /** 확률표(가중치)에서 하나 · keys 가 비면 null */
  function weighted(D, keys, rnd){
    const w = keys.map(k => Math.max(0, +D.rarities[k].rate || 0)), total = w.reduce((a, b) => a + b, 0);
    if(!keys.length) return null;
    if(total <= 0) return keys[Math.min(keys.length - 1, Math.floor(rnd() * keys.length))];   // 가중치가 모두 0 이면 같은 확률
    let x = rnd() * total;
    for(let i = 0; i < keys.length; i++){ x -= w[i]; if(x < 0) return keys[i]; }
    return keys[keys.length - 1];
  }
  const atLeast = (D, min) => rarityKeys(D).filter(k => rank(D, k) >= rank(D, min));
  function pickSpecies(D, rarity, rnd){
    const pool = Object.keys(D.species).filter(id => D.species[id].gacha && D.species[id].rarity === rarity);
    return pool[Math.min(pool.length - 1, Math.floor(rnd() * pool.length))];
  }
  function pull(D, save, kind, rnd){
    const n = kind === 'ten' ? 10 : kind === 'single' ? 1 : 0;
    if(!n) return fail(save, '알 수 없는 뽑기: ' + kind);
    const cost = kind === 'ten' ? D.cost.ten : D.cost.single;
    if(save.stones < cost) return fail(save, '정령석이 모자람 (' + save.stones + ' / ' + cost + ')');
    const s = clone(save), rolls = [];
    s.stones -= cost;
    for(let i = 0; i < n; i++){
      s.pity++; s.stats.pulls++;
      let rarity, pity = false;
      if(D.pity && s.pity >= D.pity){ rarity = weighted(D, D.pityPool, rnd); pity = true; s.pity = 0; s.stats.pityHits++; }
      else rarity = weighted(D, rarityKeys(D), rnd);
      rolls.push({ rarity, pity, guaranteed: false });
    }
    if(n === 10 && D.tenGuarantee && !rolls.some(r => rank(D, r.rarity) >= rank(D, D.tenGuarantee))){
      const last = rolls[rolls.length - 1];
      last.rarity = weighted(D, atLeast(D, D.tenGuarantee), rnd); last.guaranteed = true; s.stats.guarantees++;
    }
    const results = rolls.map(r => {
      const speciesId = pickSpecies(D, r.rarity, rnd), u = newUnit(D, s, speciesId, 'gacha');
      s.units.push(u); if(s.seen[speciesId] == null) s.seen[speciesId] = u.got;
      return { uid: u.uid, species: speciesId, rarity: r.rarity, star: u.star, pity: r.pity, guaranteed: r.guaranteed };
    });
    s.history.push({ at: s.clock - 1, kind, cost, results: results.map(r => ({ species: r.species, rarity: r.rarity, pity: r.pity, guaranteed: r.guaranteed })) });
    if(s.history.length > D.historyMax) s.history.splice(0, s.history.length - D.historyMax);
    return { ok: true, save: s, results, pity: s.pity };
  }

  /* ---------- 능력치 · 스킬 ---------- */
  const trMax = D => (D.transcend && D.transcend.max) || 0;
  /** 초월 tr 단계까지 쌓인 보너스 (bonus[1..tr] 합) */
  function transcendBonus(D, tr){
    const b = (D.transcend && D.transcend.bonus) || []; let sum = 0;
    for(let i = 1; i <= Math.min(tr || 0, trMax(D)); i++) sum += b[i] || 0;
    return Math.round(sum * 10000) / 10000;
  }
  function statsOf(D, u){
    const sp = D.species[u.species], m = D.starMul[u.star] * (1 + D.enhStep * u.enh), t = 1 + transcendBonus(D, u.tr), tStats = (D.transcend && D.transcend.stats) || [], out = {};
    for(const k of ['hp', 'atk', 'def', 'spd']){
      const v = D.scaleStats.includes(k) ? sp.base[k] * m : sp.base[k];
      out[k] = Math.round(tStats.includes(k) ? v * t : v);
    }
    return out;
  }
  function skillOf(D, u, id){
    const sp = D.species[u.species]; if(sp.skillSource === 'battle') return null;   // 스토리 캐릭터 스킬은 전투 데이터 그대로
    const d = D.skills[id]; if(!d) return null;
    const o = clone(d), k = D.skillMul[u.star];
    if(o.mult != null) o.mult = Math.round(o.mult * k * 1000) / 1000;
    if(o.pctMaxHp != null) o.pctMaxHp = Math.round(o.pctMaxHp * k * 1000) / 1000;
    o.hits = o.hits || 1; o.perHit = o.mult != null ? Math.round(o.mult / o.hits * 1000) / 1000 : null;
    return o;
  }

  /* ---------- 강화 · 승급 ---------- */
  const inParty = (s, uid) => s.party.some(p => p.uid === uid);
  function materialRate(D, t, m){
    if(!t || !m) return 0;
    if(m.shard) return 1;
    if(m.star > t.star) return 0;
    return Math.pow(0.5, t.star - m.star);
  }
  /** 대상 · 재료 공통 검사 → 문제 문구 (없으면 null) */
  function targetProblem(D, t, targetUid){
    if(!t) return '없는 캐릭터: ' + targetUid;
    if(D.species[t.species].story) return '스토리 캐릭터는 진화석으로 성장 (강화 · 승급 · 초월 대상 아님)';
    return null;
  }
  function materialProblem(D, save, t, m, materialUid){
    if(!m) return '없는 재료: ' + materialUid;
    if(m.uid === t.uid) return '자기 자신은 재료가 될 수 없음';
    if(D.species[m.species].story) return '스토리 캐릭터는 재료가 될 수 없음';
    if(m.lock) return '잠긴 캐릭터는 재료가 될 수 없음';
    if(inParty(save, m.uid)) return '편성 중인 캐릭터는 재료가 될 수 없음';
    return null;
  }
  const consume = (s, uid) => { s.units = s.units.filter(u => u.uid !== uid); };
  const snap = u => ({ star: u.star, enh: u.enh, tr: u.tr || 0 });

  function enhance(D, save, targetUid, material, rnd){
    const t = save.units.find(u => u.uid === targetUid), tp = targetProblem(D, t, targetUid);
    if(tp) return fail(save, tp);
    if(t.enh >= D.maxEnh) return fail(save, t.star >= D.maxStar ? '이미 최대 (' + D.maxStar + '성 ' + D.maxEnh + '강)' : D.maxEnh + '강 · 승급이 필요함 (같은 성급 ' + D.maxEnh + '강 1마리)');
    const useShard = material && typeof material === 'object' && material.shard;
    let m = null;
    if(useShard){ if(save.shards < 1) return fail(save, D.shard.name + '이 없음'); }
    else {
      m = save.units.find(u => u.uid === material);
      const mp = materialProblem(D, save, t, m, material); if(mp) return fail(save, mp);
      if(m.star > t.star) return fail(save, '대상보다 성급이 높은 캐릭터는 재료가 될 수 없음');
    }
    const rate = materialRate(D, t, useShard ? { shard: true } : m);
    const s = clone(save), T = s.units.find(u => u.uid === targetUid), before = snap(T);
    if(useShard) s.shards--; else consume(s, m.uid);   // 실패해도 재료는 사라짐
    const success = rate >= 1 || rnd() < rate;
    if(success) T.enh++;                               // 5강에서 멈춤 · 승급은 promote 로
    return { ok: true, save: s, success, rate, before, after: snap(T), used: useShard ? 'shard' : m.uid };
  }

  /** 승급: 5강 + 같은 성급 5강 1마리 (종류 상관없음 · 별의 조각은 안 됨) → 다음 성급 0강 · 100% */
  function promote(D, save, targetUid, materialUid){
    const t = save.units.find(u => u.uid === targetUid), tp = targetProblem(D, t, targetUid);
    if(tp) return fail(save, tp);
    if(t.star >= D.maxStar) return fail(save, '이미 최고 성급 (' + D.maxStar + '성)');
    if(t.enh < D.maxEnh) return fail(save, D.maxEnh + '강이 되어야 승급할 수 있음 (지금 ' + t.enh + '강)');
    if(materialUid && typeof materialUid === 'object') return fail(save, D.shard.name + '은 승급 재료가 될 수 없음');
    const m = save.units.find(u => u.uid === materialUid), mp = materialProblem(D, save, t, m, materialUid);
    if(mp) return fail(save, mp);
    if(m.star !== t.star) return fail(save, '같은 성급(' + t.star + '성) 캐릭터만 승급 재료가 됨');
    if(m.enh < D.maxEnh) return fail(save, '승급 재료도 ' + D.maxEnh + '강이어야 함 (지금 ' + m.enh + '강)');
    const s = clone(save), T = s.units.find(u => u.uid === targetUid), before = snap(T);
    consume(s, m.uid); T.star++; T.enh = 0;
    return { ok: true, save: s, before, after: snap(T), used: m.uid };
  }

  /** 초월: 같은 캐릭터 중복 1마리 (성급 · 강화 상관없음) → 초월 +1 · 100% · 최대 transcend.max */
  function transcend(D, save, targetUid, materialUid){
    const t = save.units.find(u => u.uid === targetUid), tp = targetProblem(D, t, targetUid);
    if(tp) return fail(save, tp);
    if(!trMax(D)) return fail(save, '초월이 꺼져 있음');
    if((t.tr || 0) >= trMax(D)) return fail(save, '이미 최대 초월 (' + trMax(D) + '단계)');
    const m = save.units.find(u => u.uid === materialUid), mp = materialProblem(D, save, t, m, materialUid);
    if(mp) return fail(save, mp);
    if(m.species !== t.species) return fail(save, '같은 캐릭터만 초월 재료가 됨');
    const s = clone(save), T = s.units.find(u => u.uid === targetUid), before = snap(T);
    consume(s, m.uid); T.tr = (T.tr || 0) + 1;
    return { ok: true, save: s, before, after: snap(T), used: m.uid };
  }

  /** 화면용: 이 재료를 강화 · 승급 · 초월에 쓸 수 있는지 (각각 true 또는 이유 문구) */
  function canMaterial(D, save, targetUid, materialUid){
    const r = f => { const x = f(); return x.ok ? true : x.reason; };
    return { enhance: r(() => enhance(D, save, targetUid, materialUid, () => 0)), promote: r(() => promote(D, save, targetUid, materialUid)), transcend: r(() => transcend(D, save, targetUid, materialUid)) };
  }

  /* ---------- 편성 · 잠금 · 개발용 지급 ---------- */
  function partyProblems(D, s, list){
    const P = [];
    if(!Array.isArray(list)) return ['편성이 배열이 아님'];
    if(list.length > D.partyMax) P.push('최대 ' + D.partyMax + '명');
    const uids = new Set(), spots = new Set(), kinds = new Set();
    for(const p of list){
      if(!p || !s.units.some(u => u.uid === p.uid)) P.push('보유하지 않은 캐릭터: ' + (p && p.uid));
      if(p && uids.has(p.uid)) P.push('같은 캐릭터를 두 번: ' + p.uid);
      const pu = p && s.units.find(u => u.uid === p.uid);
      if(pu && kinds.has(pu.species) && !uids.has(p.uid)) P.push('같은 캐릭터는 1마리만 편성할 수 있어요: ' + ((D.species[pu.species] || {}).name || pu.species));
      if(pu) kinds.add(pu.species);
      if(!p || !['front', 'back'].includes(p.row) || !(Number.isInteger(p.slot) && p.slot >= 0 && p.slot <= 2)) P.push('자리가 잘못됨: ' + JSON.stringify(p));
      else { const k = p.row + p.slot; if(spots.has(k)) P.push('같은 자리에 둘: ' + k); spots.add(k); }
      if(p) uids.add(p.uid);
    }
    return P;
  }
  /** 편성 목록에서 같은 종류가 다시 나오면 뒤쪽(목록에서 나중) 것을 뺌 · 저장은 바꾸지 않고 새 목록만 돌려줌 */
  function dedupeParty(D, s){
    const seen = new Set();
    return (s.party || []).filter(p => { const u = p && (s.units || []).find(x => x.uid === p.uid); if(!u) return true; if(seen.has(u.species)) return false; seen.add(u.species); return true; });
  }
  function setParty(D, save, list){
    const P = partyProblems(D, save, list); if(P.length) return fail(save, P.join(' · '));
    const s = clone(save); s.party = list.map(p => ({ uid: p.uid, row: p.row, slot: p.slot })); return { ok: true, save: s };
  }

  /* ---------- 자동 편성 (스토리 전투 기준: 장비를 빼고 statsOf 의 전투력 · 24호 고정) ---------- */
  const HERO = 's24';
  const unitPower = (D, u) => { const s = statsOf(D, u); return s.hp / 10 + s.atk + s.def * 1.5 + s.spd / 2; };   // 편성 화면과 같은 식
  /** 보유 캐릭터를 센 순서로: 전투력 → 등급 → 먼저 얻은 것 */
  function ranked(D, save){
    const grade = u => (D.rarities[D.species[u.species].rarity] || {}).order || 0;
    return save.units.map(u => ({ u, p: unitPower(D, u), r: grade(u) })).sort((a, b) => b.p - a.p || b.r - a.r || a.u.got - b.u.got).map(x => x.u);
  }
  /** list 의 빈 칸에 한 명: 추천 줄 → 다른 줄 */
  function placeInto(D, list, u){
    const pref = D.species[u.species].row || 'front';
    for(const row of [pref, pref === 'front' ? 'back' : 'front']) for(let slot = 0; slot < 3; slot++)
      if(!list.some(p => p.row === row && p.slot === slot)){ list.push({ uid: u.uid, row, slot }); return true; }
    return false;
  }
  /** 추천 편성: 24호 + 나머지에서 종류가 겹치지 않게 전투력 상위 (모두 partyMax 명) → 편성 목록 */
  function bestParty(D, save){
    const all = ranked(D, save), hero = all.find(u => u.species === HERO), pick = hero ? [hero] : [], seen = new Set(pick.map(u => u.species));
    for(const u of all){ if(pick.length >= D.partyMax) break; if(!seen.has(u.species)){ pick.push(u); seen.add(u.species); } }
    const list = []; pick.forEach(u => placeInto(D, list, u)); return list;
  }
  /** 빈 칸 채우기: 편성이 비었으면 추천 편성 · 아니면 배치된 캐릭터는 옮기지도 빼지도 않고 빈 칸만 채움 → { ok, save, added } (더할 것이 없으면 받은 저장 그대로) */
  function autoFill(D, save){
    let list;
    if(!save.party.length) list = bestParty(D, save);
    else {
      list = save.party.slice();
      const seen = new Set(list.map(p => (save.units.find(u => u.uid === p.uid) || {}).species));
      for(const u of ranked(D, save)){ if(list.length >= D.partyMax) break; if(!seen.has(u.species) && placeInto(D, list, u)) seen.add(u.species); }
    }
    const added = list.length - save.party.length;
    if(!added) return { ok: true, save, added: 0 };
    const r = setParty(D, save, list);
    return r.ok ? { ok: true, save: r.save, added } : { ok: false, reason: r.reason, save, added: 0 };
  }
  /** 추천 편성이 지금 편성보다 전투력 합계가 높은지 */
  function strongerParty(D, save){
    const sum = list => list.reduce((a, p) => { const u = save.units.find(x => x.uid === p.uid); return a + (u ? unitPower(D, u) : 0); }, 0);
    return sum(bestParty(D, save)) > sum(save.party) + 0.5;
  }

  function setLock(D, save, uid, on){
    if(!save.units.some(u => u.uid === uid)) return fail(save, '없는 캐릭터: ' + uid);
    const s = clone(save); s.units.find(u => u.uid === uid).lock = !!on; return { ok: true, save: s };
  }
  function addStones(D, save, n){ if(!(Number.isInteger(n) && n > 0)) return fail(save, '1 이상 정수만'); const s = clone(save); s.stones += n; return { ok: true, save: s }; }
  function addShards(D, save, n){ if(!(Number.isInteger(n) && n > 0)) return fail(save, '1 이상 정수만'); const s = clone(save); s.shards += n; return { ok: true, save: s }; }

  const api = Object.freeze({ SAVE_VERSION, GEAR_SLOTS, rng, validate, newSave, checkSave, migrate, pull, statsOf, skillOf, materialRate, enhance, promote, transcend, canMaterial, transcendBonus, setParty, dedupeParty, bestParty, autoFill, strongerParty, setLock, addStones, addShards, rarityKeys });
  if(typeof module !== 'undefined' && module.exports) module.exports = api; else root.TaleliaGacha = api;
})(typeof window !== 'undefined' ? window : globalThis);
