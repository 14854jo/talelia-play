/* =====================================================================
 * TALELIA · gacha/gear.js — 장비 규칙 (docs/design/equipment-dungeon.md · E1 · 화면 코드 없음 · 저장 없음 · 서버 없음)
 *
 *  모든 함수는 받은 저장(save · 뽑기 저장 v3)을 바꾸지 않고 새 상태를 돌려줌 → { ok, reason?, save, … }
 *  난수는 넘겨받은 rng() 만 씀 (G.rng(seed) 시드 고정 난수) · E = window.TALELIA_EQUIP · D = window.TALELIA_GACHA
 *
 *  R = TaleliaGear
 *   R.validate(E)                          장비 데이터 검사 → 문제 목록
 *   R.checkSave(E, D, save)                장비 값 검사 (등급 · 강화 · 보너스 · 세트) → 문제 목록 (모양 검사는 G.checkSave)
 *   R.itemStats(E, item)                   장비 1개 능력치 { atk, def, hp } (소수 첫째 자리 · 강화 · 5강 보너스 반영)
 *   R.makeItem(E, save, { slot, grade, set }, from)   새 장비 → { ok, save, item } (전설은 세트 필수 · 다른 등급은 세트 없음)
 *   R.randomItem(E, save, { grade, slot? }, rng, from)  부위(없으면 3부위 같은 확률) · 전설 세트(drop 세트 같은 확률)를 굴려 새 장비
 *   R.upgradeCost(E, item) · R.upgradeRate(E, item)   다음 강화 골드 · 성공률 (5강이면 null)
 *   R.enhance(E, save, iid, rng)           골드로 강화 1번 → { ok, save, success, rate, cost, before, after, bonus } (실패해도 단계 유지 · 골드는 씀)
 *                                          5강에 처음 오르면 보너스 1개 굴림 (공 · 방 · 체 · 기준 대비 고정값)
 *   R.dismantle(E, save, iids)             분해 → 골드 · 장착 중 · 잠긴 장비는 빼고 나머지만 → { count, skipped, skip: { equipped, locked }, message: "분해 n개, 제외 m개(장착 · 잠금)" } (전부 빠지면 거절)
 *   R.equip(E, D, save, uid, iid)          장착 (부위 칸에 · 다른 캐릭터가 끼고 있으면 옮겨 옴 · 그 칸의 원래 장비는 보관함으로)
 *   R.unequip(E, D, save, uid, slot)       벗기
 *   R.setLock(E, save, iid, on) · R.addGold(E, save, n) · R.ownerOf(save, iid) · R.gearOf(save, unit)
 *   R.setOf(E, save, unit)                 완성된 세트 id 목록 (같은 세트 setPieces 부위 이상)
 *   R.statsWithGear(D, E, save, unit)      전투에 넘길 능력치 { hp, atk, def, spd, eff, res, set, gear }
 *                                          = round((G.statsOf + 장비 합계) × (1 + 세트 %) + 세트 더하기) · 장비가 없으면 G.statsOf 와 같음
 * ===================================================================== */
(function(root){
  'use strict';
  const clone = o => JSON.parse(JSON.stringify(o));
  const fail = (save, reason) => ({ ok: false, reason, save });
  const r1 = v => Math.round(v * 10) / 10;
  const STATS = ['hp', 'atk', 'def'];
  const G = () => root.TaleliaGacha;

  /* ---------- 데이터 검사 ---------- */
  function validate(E){
    const P = [];
    if(!E || !E.slots || !E.grades) return ['장비 데이터가 없음'];
    for(const s of E.slotOrder || []) if(!E.slots[s]) P.push('부위가 없음: ' + s);
    for(const [g, d] of Object.entries(E.grades)){
      for(const s of E.slotOrder){ const p = d.pct && d.pct[s];
        if(!Array.isArray(p) || p.length !== E.slots[s].stats.length || p.some(x => !(x > 0))) P.push(g + ' ' + s + ' % 표가 부위 능력치 수와 다름'); }
      if(!(d.bonus > 0)) P.push(g + ' 5강 보너스가 없음');
      if(!(d.costMul > 0)) P.push(g + ' 강화 비용 배수가 없음');
      if(!(Number.isInteger(d.dismantle) && d.dismantle >= 0)) P.push(g + ' 분해 골드가 정수가 아님');
    }
    if(!(E.enhRate && E.enhRate.length === E.maxEnh) || !(E.enhCost && E.enhCost.length === E.maxEnh)) P.push('강화 성공률 · 비용 표 길이가 maxEnh 가 아님');
    if((E.enhRate || []).some(x => !(x > 0 && x <= 1))) P.push('강화 성공률이 0~1 밖');
    for(const k of E.bonusStats || []) if(!STATS.includes(k)) P.push('보너스 능력치가 틀림: ' + k);
    for(const [k, s] of Object.entries(E.sets || {})) if(!s.pct && !s.add) P.push('세트 효과가 없음: ' + k);
    for(const k of STATS) if(!(E.benchmark && E.benchmark[k] > 0)) P.push('기준 능력치 없음: ' + k);
    return P;
  }
  function checkSave(E, D, s){
    const P = [];
    for(const it of (s && s.items) || []){
      const g = E.grades[it.grade];
      if(!g){ P.push(it.iid + ' 모르는 등급: ' + it.grade); continue; }
      if(!(Number.isInteger(it.enh) && it.enh >= 0 && it.enh <= E.maxEnh)) P.push(it.iid + ' 강화 범위 밖: ' + it.enh);
      if(it.bonus != null && (it.enh !== E.maxEnh || !E.bonusStats.includes(it.bonus.stat))) P.push(it.iid + ' 5강 보너스가 틀림');
      if(it.enh === E.maxEnh && it.bonus == null) P.push(it.iid + ' 5강인데 보너스가 없음');
      if(g.hasSet ? !(it.set && E.sets[it.set]) : it.set != null) P.push(it.iid + ' 세트가 틀림: ' + it.set);
    }
    return P;
  }

  /* ---------- 장비 1개 ---------- */
  function itemStats(E, it){
    const g = E.grades[it.grade], sl = E.slots[it.slot], out = { hp: 0, atk: 0, def: 0 }, k = 1 + E.enhStep * (it.enh || 0);
    sl.stats.forEach((st, i) => { out[st] += E.benchmark[st] * g.pct[it.slot][i] * k; });
    if(it.bonus) out[it.bonus.stat] += E.benchmark[it.bonus.stat] * g.bonus;
    for(const st of STATS) out[st] = r1(out[st]);
    return out;
  }
  function makeItem(E, save, spec, from){
    spec = spec || {};
    const g = E.grades[spec.grade]; if(!g) return fail(save, '모르는 등급: ' + spec.grade);
    if(!E.slots[spec.slot]) return fail(save, '모르는 부위: ' + spec.slot);
    if(g.hasSet && !(spec.set && E.sets[spec.set])) return fail(save, '전설 장비는 세트가 있어야 함');
    if(!g.hasSet && spec.set) return fail(save, g.name + ' 장비에는 세트가 없음');
    const s = clone(save), item = { iid: 'e' + String(s.nextItemUid++).padStart(6, '0'), slot: spec.slot, grade: spec.grade, enh: 0, bonus: null,
      set: g.hasSet ? spec.set : null, lock: false, got: s.clock++, from: from || 'dev' };
    s.items.push(item);
    return { ok: true, save: s, item };
  }
  function randomItem(E, save, spec, rng, from){
    const slot = spec.slot || E.slotOrder[Math.floor(rng() * E.slotOrder.length)];
    let set = null;
    if(E.grades[spec.grade] && E.grades[spec.grade].hasSet){ const pool = Object.keys(E.sets).filter(k => E.sets[k].drop); set = pool[Math.floor(rng() * pool.length)]; }
    return makeItem(E, save, { slot, grade: spec.grade, set }, from);
  }

  /* ---------- 강화 · 분해 ---------- */
  const findItem = (save, iid) => (save.items || []).find(x => x.iid === iid) || null;
  function upgradeCost(E, it){ return it.enh >= E.maxEnh ? null : E.enhCost[it.enh] * E.grades[it.grade].costMul; }
  function upgradeRate(E, it){ return it.enh >= E.maxEnh ? null : E.enhRate[it.enh]; }
  function enhance(E, save, iid, rng){
    const it0 = findItem(save, iid); if(!it0) return fail(save, '없는 장비: ' + iid);
    if(it0.enh >= E.maxEnh) return fail(save, '이미 ' + E.maxEnh + '강');
    const cost = upgradeCost(E, it0), rate = upgradeRate(E, it0);
    if(save.gold < cost) return fail(save, '골드가 부족함 (' + cost + ' 필요)');
    const s = clone(save), it = findItem(s, iid), before = it.enh;
    s.gold -= cost;
    const success = rng() < rate;
    let bonus = null;
    if(success){ it.enh++;
      if(it.enh === E.maxEnh && !it.bonus){ bonus = { stat: E.bonusStats[Math.floor(rng() * E.bonusStats.length)] }; it.bonus = bonus; } }
    return { ok: true, save: s, success, rate, cost, before, after: it.enh, bonus };
  }
  function dismantle(E, save, iids){
    const list = [...new Set(iids || [])]; if(!list.length) return fail(save, '고른 장비가 없음');
    for(const iid of list) if(!findItem(save, iid)) return fail(save, '없는 장비: ' + iid);
    // 장착 중 · 잠긴 장비는 빼고 나머지만 분해 (전부 빠지면 거절)
    const skipped = list.filter(iid => findItem(save, iid).lock || ownerOf(save, iid)), go = list.filter(iid => !skipped.includes(iid));
    const skip = { equipped: skipped.filter(iid => ownerOf(save, iid)).length, locked: skipped.filter(iid => !ownerOf(save, iid)).length };
    const msg = '분해 ' + go.length + '개, 제외 ' + skipped.length + '개(장착 ' + skip.equipped + ' · 잠금 ' + skip.locked + ')';
    if(!go.length) return Object.assign(fail(save, '분해할 수 있는 장비가 없음 (장착 · 잠금)'), { count: 0, skipped, skip, message: msg });
    const s = clone(save); let gold = 0;
    s.items = s.items.filter(it => { if(!go.includes(it.iid)) return true; gold += E.grades[it.grade].dismantle; return false; });
    s.gold += gold;
    return { ok: true, save: s, gold, count: go.length, dismantled: go, skipped, skip, message: msg };
  }

  /* ---------- 장착 ---------- */
  function ownerOf(save, iid){ return (save.units || []).find(u => u.gear && Object.values(u.gear).includes(iid)) || null; }
  function equip(E, D, save, uid, iid){
    const u0 = save.units.find(u => u.uid === uid); if(!u0) return fail(save, '없는 캐릭터: ' + uid);
    const it = findItem(save, iid); if(!it) return fail(save, '없는 장비: ' + iid);
    const s = clone(save), u = s.units.find(x => x.uid === uid), prev = ownerOf(s, iid);
    if(prev && prev.uid === uid && u.gear[it.slot] === iid) return { ok: true, save: s, moved: null, replaced: null };
    if(prev) for(const k of Object.keys(prev.gear)) if(prev.gear[k] === iid) prev.gear[k] = null;   // 다른 캐릭터에게서 옮겨 옴
    const replaced = u.gear[it.slot] || null;
    u.gear[it.slot] = iid;
    return { ok: true, save: s, moved: prev && prev.uid !== uid ? prev.uid : null, replaced };
  }
  function unequip(E, D, save, uid, slot){
    const u0 = save.units.find(u => u.uid === uid); if(!u0) return fail(save, '없는 캐릭터: ' + uid);
    if(!E.slots[slot]) return fail(save, '모르는 부위: ' + slot);
    if(!u0.gear || u0.gear[slot] == null) return fail(save, '그 칸은 비어 있음');
    const s = clone(save), u = s.units.find(x => x.uid === uid), iid = u.gear[slot]; u.gear[slot] = null;
    return { ok: true, save: s, iid };
  }
  function setLock(E, save, iid, on){
    if(!findItem(save, iid)) return fail(save, '없는 장비: ' + iid);
    const s = clone(save); findItem(s, iid).lock = !!on; return { ok: true, save: s };
  }
  function addGold(E, save, n){ if(!(Number.isInteger(n) && n > 0)) return fail(save, '1 이상 정수만'); const s = clone(save); s.gold += n; return { ok: true, save: s }; }

  /* ---------- 능력치 ---------- */
  function gearOf(save, u){ return Object.values(u.gear || {}).map(iid => iid && findItem(save, iid)).filter(Boolean); }
  function setOf(E, save, u){
    const n = {}; for(const it of gearOf(save, u)) if(it.set) n[it.set] = (n[it.set] || 0) + 1;
    return Object.keys(n).filter(k => n[k] >= E.setPieces && E.sets[k]);
  }
  function statsWithGear(D, E, save, u){
    const base = G().statsOf(D, u), items = gearOf(save, u), sets = setOf(E, save, u), sum = { hp: 0, atk: 0, def: 0 };
    for(const it of items){ const st = itemStats(E, it); for(const k of STATS) sum[k] = r1(sum[k] + st[k]); }
    const mul = { hp: 1, atk: 1, def: 1 }, add = { spd: 0, eff: 0, res: 0 };
    for(const k of sets){ const se = E.sets[k]; for(const [st, v] of Object.entries(se.pct || {})) mul[st] += v; for(const [st, v] of Object.entries(se.add || {})) add[st] = (add[st] || 0) + v; }
    const out = { spd: base.spd + add.spd, eff: add.eff, res: add.res, set: sets, gear: sum };
    for(const k of STATS) out[k] = Math.round((base[k] + sum[k]) * mul[k]);
    return out;
  }

  const api = Object.freeze({ validate, checkSave, itemStats, makeItem, randomItem, upgradeCost, upgradeRate, enhance, dismantle, ownerOf, equip, unequip, setLock, addGold, gearOf, setOf, statsWithGear });
  if(typeof module !== 'undefined' && module.exports) module.exports = api; else root.TaleliaGear = api;
})(typeof window !== 'undefined' ? window : globalThis);
