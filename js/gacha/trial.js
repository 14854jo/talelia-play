/* =====================================================================
 * TALELIA · gacha/trial.js — 뽑기 편성 → 시험 전투 데이터 (화면 코드 없음 · 브라우저 / 테스트 공용)
 *
 *  T = window.TaleliaGachaTrial
 *   T.readSave(D, G, { key, storage })   뽑기 저장을 "읽기만" (쓰지 않음 · 없거나 망가졌으면 { ok:false, reason })
 *   T.build(D, G, save, battle, trial, { tier, k })   (편성에 같은 캐릭터가 두 번 있으면 뒤쪽은 빼고 꾸림)
 *       → { ok, reason, data, tier, notes, rigKeys, power, enemyPower, scale }
 *       data = js/battle/rules.js 가 받는 모양 { version, rules, skills, allies, enemies } (전투 규칙 · 자동 행동 코드는 그대로)
 *   T.power(stats)                        전투력 = 체력/10 + 공격 + 방어×1.5 + 속도/2 (뽑기 화면과 같은 식)
 *
 *  아군 (편성 { uid, row, slot } 그대로 · 최대 6명)
 *   - 능력치 = TaleliaGear.statsWithGear (성급 · 강화 · 초월 + 장비 · 세트 · E2) · 장비 규칙이 없으면 G.statsOf · 장비가 없으면 둘이 같음
 *     세트의 효과 적중 · 저항 = eff · res (지금은 해당 세트가 없어 0 · rules.js statusChance 가 읽음) · opts.equip · opts.gear 로 데이터 · 규칙을 직접 넘길 수 있음
 *   - 뽑기 캐릭터: id = uid (같은 종류 2마리도 겹치지 않음) · 스킬 = G.skillOf(성급 배율 반영) 사본, id = uid:스킬
 *   - 스토리 캐릭터: id = 전투 id(subject_24 · hamster_*) · 스킬 · 그림 = data/battle-proto.js 그대로 (24호 필살기 영상 · 리그 연결이 그대로 동작)
 *   - rigKeys[id] = 리그 이름 후보 (뽑기 = 종류 id · 스토리 = 전투 id) → 화면이 TALELIA_RIGS 에 있을 때만 리그로 그림
 *
 *  스킬은 데이터 그대로 (v2 4단계): 여러 번 타격(hits) · 적 n명(enemy_n · count) · 상태이상(status) 을 전투 규칙(rules.js)이 직접 처리
 *   (예전 임시 변환 — 1회 타격 · 적 전체에 나눠 맞음 · 상태이상 제외 — 은 없앰)
 *   적 = trial.skills (시험 전투 적 전용 스킬) 를 battle.skills 사본에 더해 씀 (battle-proto.js 는 그대로)
 * ===================================================================== */
(function(root){
  'use strict';
  const DEFAULT_KEY = 'talelia.gacha.v1';
  const r3 = v => Math.round(v * 1000) / 1000;
  const clone = o => JSON.parse(JSON.stringify(o));

  function power(s){ return s.hp / 10 + s.atk + s.def * 1.5 + s.spd / 2; }

  function readSave(D, G, opts){
    opts = opts || {};
    let raw = null;
    try{ const st = opts.storage || root.localStorage; raw = st.getItem(opts.key || DEFAULT_KEY); }catch(e){ return { ok: false, reason: '저장을 읽을 수 없어요' }; }
    if(raw == null) return { ok: false, reason: '뽑기 저장이 없어요' };
    let s = null; try{ s = G.migrate(D, JSON.parse(raw)); }catch(e){ return { ok: false, reason: '저장이 망가졌어요' }; }
    const P = G.checkSave(D, s);
    if(P.length) return { ok: false, reason: '저장이 망가졌어요 (' + P[0] + ')' };
    return { ok: true, save: s };
  }

  function build(D, G, save, battle, trial, opts){
    opts = opts || {};
    const tierId = trial.tiers[opts.tier] ? opts.tier : trial.defaultTier, tier = trial.tiers[tierId];
    const fail = reason => ({ ok: false, reason, tier: tierId });
    if(save && Array.isArray(save.party) && G.dedupeParty){ const dd = G.dedupeParty(D, save); if(dd.length !== save.party.length) save = Object.assign({}, save, { party: dd }); }   // 같은 캐릭터 중복은 뒤쪽을 빼고 시작
    if(!save || !Array.isArray(save.party) || !save.party.length) return fail('편성이 비었어요');
    if(save.party.length > D.partyMax) return fail('편성이 ' + D.partyMax + '명을 넘어요');

    // 스킬 = 전투 데이터 스킬 + 시험 전투 적 전용 스킬 (사본)
    const skills = Object.assign({}, battle.skills, clone(trial.skills || {}));
    // 적
    const pool = battle.enemies;
    const enemies = tier.enemies.map(e => { const b = pool.find(x => x.id === e.base); if(!b) return null; const o = clone(Object.assign({}, b, e)); delete o.base; return o; });
    if(enemies.includes(null)) return fail('적 구성이 잘못됐어요');
    if(enemies.some(e => e.skills.some(k => !skills[k]))) return fail('적 스킬이 없어요');

    // 아군
    const E = opts.equip || root.TALELIA_EQUIP, Q = opts.gear || root.TaleliaGear, gearOn = !!(E && Q && Array.isArray(save.items));   // 장비 규칙(js/gacha/gear.js)이 없는 화면이면 장비 없이
    const allies = [], rigKeys = {}, notes = [], seen = new Set();
    for(const p of save.party){
      const u = save.units.find(x => x.uid === p.uid); if(!u) return fail('편성에 없는 캐릭터가 있어요');
      const sp = D.species[u.species]; if(!sp) return fail('모르는 캐릭터: ' + u.species);
      if(seen.has(p.row + p.slot)) return fail('같은 칸에 두 명이 있어요'); seen.add(p.row + p.slot);
      const st = gearOn ? Q.statsWithGear(D, E, save, u) : G.statsOf(D, u);   // 장비 · 세트 반영 (E2 · 장비가 없으면 G.statsOf 와 같음)
      let a;
      if(sp.skillSource === 'battle'){
        const b = battle.allies.find(x => x.id === sp.battleId); if(!b) return fail('전투 데이터에 없는 캐릭터: ' + sp.battleId);
        a = { id: b.id, name: sp.name, img: b.img, skills: b.skills.slice() };
        const SG = opts.growth || root.TaleliaStoryGrowth;   // V3-3: 성급에 따른 스토리 스킬 (2성 = 변화 없음)
        if(SG){ const ov = SG.skillOverrides(D, u, battle.skills); a.skills = a.skills.map(sid => { if(!ov[sid]) return sid; const key = u.uid + ':' + sid; skills[key] = ov[sid]; return key; }); }
        rigKeys[a.id] = sp.battleId;
      } else {
        a = { id: u.uid, name: sp.name, img: sp.card || sp.art || null, skills: [] };
        for(const sid of sp.skills){
          const so = G.skillOf(D, u, sid); if(!so) return fail('스킬 없음: ' + sid);
          const key = u.uid + ':' + sid;
          skills[key] = so; a.skills.push(key);   // G.skillOf 사본 그대로 (hits · enemy_n · status 유지)
        }
        rigKeys[a.id] = u.species;
      }
      const PS = opts.passive || root.TaleliaPassive;   // V3-2: 패시브 (없는 캐릭터 · 닫힌 패시브 = 붙이지 않음)
      if(PS){ const ps = PS.passivesOf(D, u); if(ps.length) a.passives = ps; }
      Object.assign(a, { row: p.row, slot: p.slot, hp: st.hp, atk: st.atk, def: st.def, spd: st.spd, eff: st.eff || 0, res: st.res || 0, species: u.species, star: u.star, enh: u.enh, tr: u.tr || 0 });
      allies.push(a);
    }
    // 아군 순서: 전열 → 후열 · 칸 번호 순 (같은 속도일 때 순서 · 화면 순서가 늘 같게)
    allies.sort((a, b) => (a.row === b.row ? 0 : a.row === 'front' ? -1 : 1) || a.slot - b.slot);

    // 난이도: 편성의 전투 세기에 맞춰 적 체력 · 공격에 같은 배율 s (방어 · 속도 · 스킬은 그대로)
    //  유효 세기 = 버티는 체력 × 한 턴 평균 피해 × (1 − 상대의 제어율) (strength 참고)
    //  적 세기는 s² 로 커짐 · 아군 중독 피해는 적 체력에 따라 바뀌므로 s 를 몇 번 다시 계산 (v2 4-2단계)
    const P = allies.reduce((s, a) => s + power(a), 0);
    const mul = tier.mul * (opts.k > 0 ? opts.k : 1), R = battle.rules, est = trial.est || {};
    const base = enemies.map(e => ({ hp: e.hp, atk: e.atk }));
    const put = sc => enemies.forEach((e, i) => { e.hp = Math.max(1, Math.round(base[i].hp * sc)); e.atk = Math.max(1, Math.round(base[i].atk * sc)); });
    const eff = () => { const A = strength(allies, skills, R, enemies, est), E = strength(enemies, skills, R, allies, est);
      return { ally: A.hp * A.dmg * (1 - E.ctrl), enemy: E.hp * E.dmg * (1 - A.ctrl), A, E }; };
    let scale = 1;
    for(let it = 0; it < 8; it++){ put(1); const E0 = eff(); put(scale); const cur = eff();
      const next = Math.min(trial.sMax, Math.max(trial.sMin, Math.sqrt(mul * cur.ally / E0.enemy)));
      if(Math.abs(next - scale) < 1e-4){ scale = next; break; } scale = next; }
    put(scale);
    const fin = eff(), EP = enemies.reduce((s, e) => s + power(e), 0);

    return { ok: true, tier: tierId, tierName: tier.name, notes, rigKeys, power: Math.round(P), enemyPower: Math.round(EP), scale: r3(scale), mul,
      strength: { ally: Math.round(fin.ally), enemy: Math.round(fin.enemy), allyCtrl: r3(fin.A.ctrl), enemyCtrl: r3(fin.E.ctrl) },
      data: { version: battle.version, rules: battle.rules, skills, allies, enemies } };
  }

  /** 전투 세기 (난이도 맞춤용 어림값 · 전투 결과에는 쓰지 않음) → { hp, dmg, ctrl }
   *  버티는 체력 hp = Σ 체력 × (defK + 방어) / defK · (전열은 받는 피해 보정만큼 더 버팀)
   *  한 턴 평균 피해 dmg = Σ 공격 × 평균 배율 × (후열 보정)
   *   평균 배율 = 기본 공격 배율 + Σ 쿨타임 · every 공격 스킬마다 (그 스킬 배율 − 기본) ÷ 주기 (회복 · 강화는 피해 0 · 기본 공격보다 약하면 0)
   *   스킬 배율 = 배율 × 맞는 대상 수 (적 전체 = 상대 수 · 적 n명 = min(n, 상대 수) · 단일 1)   ← v2 4-2단계: 적 n명 반영
   *            + 중독 어림값 = 확률 × 걸리는 대상 수 × 턴 × min(최대 HP 평균 × 비율, 공격력) × 상대 방어 · 전열 보정(중독은 무시) ÷ 공격력
   *  제어율 ctrl = 상대 한 턴 피해를 줄이는 비율 (v2 4-2단계 · 상한 est.ctrlMax)
   *   기절 = 확률 × 걸리는 대상 수 × 턴 ÷ (상대 수 × 주기) · 약화 = 확률 × 걸리는 대상 수 × 수치 × min(턴, 주기) ÷ 주기 ÷ 상대 수
   *   (면역인 상대는 걸리는 대상 수에서 뺌 · 상대와 속도가 비슷하다고 봄) · est.stunW · weakenW · poisonW = 가중치 (데이터로 조정) */
  function strength(units, skills, R, foes, est){
    est = est || {};
    const F = Math.max(1, foes.length), W = { stun: est.stunW == null ? 1 : est.stunW, weaken: est.weakenW == null ? 1 : est.weakenW, poison: est.poisonW == null ? 1 : est.poisonW, silence: est.silenceW == null ? 1 : est.silenceW };
    const SILENCE_SHARE = est.silenceShare == null ? 0.3 : est.silenceShare;   // V3-5a 침묵: 상대 피해 중 스킬이 차지하는 몫 어림값
    const foeHp = foes.reduce((s, f) => s + f.hp, 0) / F, foeBulk = foes.reduce((s, f) => s + (R.defK + f.def) / R.defK / (f.row === 'front' ? R.frontTakenMul : 1), 0) / F;
    let hp = 0, dmg = 0, ctrl = 0;
    for(const u of units){
      hp += u.hp * (R.defK + u.def) / R.defK / (u.row === 'front' ? R.frontTakenMul : 1);
      const backK = u.row === 'back' ? R.backDealtMul : 1;
      const list = u.skills.map(k => skills[k]).filter(Boolean);
      const hit = s => s.target === 'enemy_all' ? F : s.target === 'enemy_n' ? Math.min(s.count || 1, F) : 1;
      const open = (s, type) => hit(s) * foes.filter(f => !(f.immune || []).includes(type)).length / F;   // 면역 빼고 걸리는 대상 수
      const pc = st => Math.min(0.95, (st.chance || 0) * (1 + (u.eff || 0)));
      const per = s => { if(s.kind !== 'attack') return 0; let m = (s.mult || 0) * hit(s); const st = s.status;
        if(st && st.type === 'poison') m += W.poison * pc(st) * open(s, 'poison') * (st.turns || 1) * Math.min(foeHp * (st.value || 0), u.atk) * foeBulk / u.atk / backK;
        return m; };
      const basic = list.find(s => s.kind === 'attack' && !s.cooldown && !s.tag && !s.every), b = basic ? per(basic) : 0;
      let avg = b;
      for(const s of list){
        const n = s === basic ? 1 : s.cooldown || s.every || 0; if(n <= 0 && s !== basic) continue;
        if(s !== basic) avg += Math.max(0, per(s) - b) / n;
        const st = s.kind === 'attack' && s.status; if(!st) continue;
        if(st.type === 'stun') ctrl += W.stun * pc(st) * open(s, 'stun') * (st.turns || 1) / (F * n);
        if(st.type === 'weaken') ctrl += W.weaken * pc(st) * open(s, 'weaken') * (st.value || 0) * Math.min(st.turns || 1, n) / n / F;
        if(st.type === 'silence') ctrl += W.silence * SILENCE_SHARE * pc(st) * open(s, 'silence') * Math.min(st.turns || 1, n) / n / F;
      }
      dmg += u.atk * avg * backK;
    }
    return { hp, dmg, ctrl: Math.min(est.ctrlMax == null ? 0.6 : est.ctrlMax, ctrl) };
  }

  root.TaleliaGachaTrial = Object.freeze({ readSave, build, power, strength, DEFAULT_KEY });
})(typeof window !== 'undefined' ? window : globalThis);
