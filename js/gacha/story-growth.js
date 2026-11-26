/* =====================================================================
 * TALELIA · gacha/story-growth.js — 스토리 캐릭터 3종의 성장 (V3-3 · docs/design/battle-balance-v3.md 4장 · 화면 없음 · 서버 없음)
 *
 *  스토리 캐릭터(24호 · 망치 햄스터 · 탐험가 햄스터)는 뽑기로 중복을 얻을 수 없어서 재료가 다르다.
 *    강화 0→5      별의 조각 1개 (100%)
 *    승급 (성급+1) 5강 + 초월석 (2→3성 10 · 3→4성 15 · 4→5성 25 · 5→6성 40)
 *    초월 0→6      초월석 (5 · 5 · 10 · 10 · 15 · 20)
 *  초월석 = 저장의 save.tstones (없으면 0 · 저장 버전은 그대로 4 · js/gacha/rules.js 는 이 칸을 몰라도 됨)
 *  능력치 = G.statsOf 그대로 (스토리 캐릭터의 base 는 "전투 값 ÷ 2성 배율" 이라 2성 0강 0초월 = 전투 값)
 *  스킬: 3성부터 성급 스킬 배율(skillMul[성급] ÷ skillMul[2]) · 4성 필살기 강화 · 6성 추가 효과 → skillOverrides
 *  기본 상태(2성)에서는 아무것도 바뀌지 않음 → 프로토타입 · 이야기 전투 기준 로그 46개와 같음
 *
 *  SG = TaleliaStoryGrowth   (모든 함수는 받은 저장을 바꾸지 않고 새 저장을 돌려줌)
 *   SG.isStory(D, unit) · SG.tstones(save)
 *   SG.promoteCost(star) · SG.transcendCost(tr)       다음 단계에 드는 초월석 (끝이면 null)
 *   SG.enhance(D, save, uid) · SG.promote(D, save, uid) · SG.transcend(D, save, uid)   → { ok, reason, save, before, after, used }
 *   SG.skillOverrides(D, unit, skills)                 → { 스킬id: 바꾼 스킬 } (성급 스킬 배율 · 강화 · 추가 효과)
 *   SG.totalCost()                                     1명을 끝까지 키우는 초월석 합계
 * ===================================================================== */
(function(root){
  'use strict';
  const PROMOTE = { 2: 10, 3: 15, 4: 25, 5: 40 };
  const TRANSCEND = [5, 5, 10, 10, 15, 20];
  const clone = o => JSON.parse(JSON.stringify(o));
  const r3 = v => Math.round(v * 1000) / 1000;
  const fail = (save, reason) => ({ ok: false, reason, save });
  const isStory = (D, u) => !!(u && D.species[u.species] && D.species[u.species].story);
  const tstones = save => (save && Number.isInteger(save.tstones) && save.tstones > 0) ? save.tstones : 0;
  const snap = u => ({ star: u.star, enh: u.enh, tr: u.tr || 0 });
  const promoteCost = star => PROMOTE[star] != null ? PROMOTE[star] : null;
  const transcendCost = tr => TRANSCEND[tr] != null ? TRANSCEND[tr] : null;
  const totalCost = () => Object.values(PROMOTE).reduce((a, b) => a + b, 0) + TRANSCEND.reduce((a, b) => a + b, 0);

  function target(D, save, uid){
    const t = save.units.find(u => u.uid === uid);
    if(!t) return [null, '없는 캐릭터: ' + uid];
    if(!isStory(D, t)) return [null, '스토리 캐릭터만 이 방법으로 성장해요'];
    return [t, null];
  }
  function enhance(D, save, uid){
    const [t, why] = target(D, save, uid); if(why) return fail(save, why);
    if(t.enh >= D.maxEnh) return fail(save, t.star >= D.maxStar ? '이미 최대 (' + D.maxStar + '성 ' + D.maxEnh + '강)' : D.maxEnh + '강이에요 · 승급에는 초월석이 필요해요');
    if((save.shards || 0) < 1) return fail(save, D.shard.name + '이 없음');
    const s = clone(save), T = s.units.find(u => u.uid === uid), before = snap(T);
    s.shards--; T.enh++;
    return { ok: true, save: s, success: true, rate: 1, before, after: snap(T), used: 'shard' };
  }
  function promote(D, save, uid){
    const [t, why] = target(D, save, uid); if(why) return fail(save, why);
    if(t.star >= D.maxStar) return fail(save, '이미 최고 성급 (' + D.maxStar + '성)');
    if(t.enh < D.maxEnh) return fail(save, D.maxEnh + '강이 되어야 승급할 수 있음 (지금 ' + t.enh + '강)');
    const cost = promoteCost(t.star); if(cost == null) return fail(save, '승급할 수 없는 성급');
    if(tstones(save) < cost) return fail(save, '초월석이 모자라요 (' + tstones(save) + ' / ' + cost + ')');
    const s = clone(save), T = s.units.find(u => u.uid === uid), before = snap(T);
    s.tstones = tstones(save) - cost; T.star++; T.enh = 0;
    return { ok: true, save: s, before, after: snap(T), used: cost };
  }
  function transcend(D, save, uid){
    const [t, why] = target(D, save, uid); if(why) return fail(save, why);
    const max = D.transcend ? D.transcend.max : 0;
    if((t.tr || 0) >= max) return fail(save, '이미 최대 초월 (' + max + '단계)');
    const cost = transcendCost(t.tr || 0); if(cost == null) return fail(save, '초월할 수 없는 단계');
    if(tstones(save) < cost) return fail(save, '초월석이 모자라요 (' + tstones(save) + ' / ' + cost + ')');
    const s = clone(save), T = s.units.find(u => u.uid === uid), before = snap(T);
    s.tstones = tstones(save) - cost; T.tr = (T.tr || 0) + 1;
    return { ok: true, save: s, before, after: snap(T), used: cost };
  }

  /** 성급별 스킬 (스토리 캐릭터 전용) · 기본 상태(2성)는 {} */
  function skillOverrides(D, u, skills){
    const out = {};
    if(!isStory(D, u) || !skills) return out;
    const star = u.star || 2, f = D.skillMul[star] / D.skillMul[2], sp = D.species[u.species];
    for(const sid of (sp.skills || [])){
      const base = skills[sid]; if(!base) continue;
      const d = clone(base);
      if(star >= 4){   // 필살기 강화
        if(sid === 'ult_carrot') d.mult = 3.0;
        if(sid === 'ult_walnut') d.mult = 1.25;
        if(sid === 'heal_potion') d.pctMaxHp = 0.30;
      }
      if(star >= 6){   // 추가 효과
        if(sid === 'ult_carrot') d.hits = 2;
        if(sid === 'ult_walnut') d.status = { type: 'stun', chance: 0.2, turns: 1 };
        if(sid === 'buff_atk' || sid === 'buff_def') d.duration = (d.duration || 2) + 1;
      }
      if(f !== 1 && d.kind === 'attack' && d.mult != null) d.mult = r3(d.mult * f);
      if(f !== 1 && d.kind === 'heal' && d.pctMaxHp != null) d.pctMaxHp = r3(d.pctMaxHp * f);
      if(JSON.stringify(d) !== JSON.stringify(base)) out[sid] = d;
    }
    return out;
  }

  const api = Object.freeze({ PROMOTE, TRANSCEND, isStory, tstones, promoteCost, transcendCost, totalCost, enhance, promote, transcend, skillOverrides });
  if(typeof module !== 'undefined' && module.exports) module.exports = api; else root.TaleliaStoryGrowth = api;
})(typeof window !== 'undefined' ? window : globalThis);
