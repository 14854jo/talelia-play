/* =====================================================================
 * TALELIA · gacha/passive.js — 캐릭터 패시브 (V3-2 · docs/design/battle-balance-v3.md 3장 · 화면 없음 · 저장 없음)
 *
 *  데이터: data/gacha/species.js 의 species[id].passive = { from, list: [패시브…], aux: [{ idx, field, add }] }
 *    from  = 이 성급부터 열림 (없으면 처음부터 · 스토리 캐릭터는 3성부터)
 *    list  = 전투 규칙(js/battle/rules.js V3-1)이 알아듣는 패시브 (type · name · 수치)
 *    aux   = 초월 6단계 보조 효과 (list[idx][field] 에 add 를 더함)
 *  단계 (성급): 5성 = 수치 ×1.5 · 6성 = ×2 · 초월 3단계 이상 = 추가로 ×1.25 · 초월 6단계 = 보조 효과
 *
 *  P = TaleliaPassive
 *   P.levelOf(D, unit)        → { mul, tr3, tr6 }
 *   P.passivesOf(D, unit)     → 전투 규칙에 넘길 패시브 목록 (닫혀 있으면 [])
 *   P.infoOf(D, unit)         → { name, locked, from, lines: [글자…] } | null  (화면용)
 *   P.describe(p)             → 패시브 1개 설명 글자
 * ===================================================================== */
(function(root){
  'use strict';
  const SCALE_KEYS = ['pct', 'chance'];
  const CHANCE_MAX = 0.8;
  const r3 = v => Math.round(v * 1000) / 1000;
  const pc = v => Math.round(v * 100) + '%';
  const STAT = { atk: '공격', def: '방어', hp: '체력', spd: '속도' };

  function levelOf(D, u){
    const star = u.star || 1, tr = u.tr || 0;
    const base = star >= 6 ? 2 : star >= 5 ? 1.5 : 1;
    return { mul: base * (tr >= 3 ? 1.25 : 1), tr3: tr >= 3, tr6: tr >= (D.transcend ? D.transcend.max : 6) };
  }
  function passivesOf(D, u){
    const sp = D.species[u.species], def = sp && sp.passive; if(!def || !Array.isArray(def.list)) return [];
    if((u.star || 1) < (def.from || 0)) return [];
    const lv = levelOf(D, u), out = def.list.map(p => Object.assign({}, p));
    if(lv.tr6) for(const a of def.aux || []) if(out[a.idx] && out[a.idx][a.field] != null) out[a.idx][a.field] = r3(out[a.idx][a.field] + a.add);
    for(const p of out) for(const k of SCALE_KEYS) if(p[k] != null){ p[k] = r3(p[k] * lv.mul); if(k === 'chance') p[k] = Math.min(CHANCE_MAX, p[k]); }
    return out;
  }
  function describe(p){
    switch(p.type){
      case 'stat': return STAT[p.stat] + ' +' + pc(p.pct) + ' (전투 내내)';
      case 'dmgIf': return (p.single ? '단일 대상 공격' : '공격') + (p.hpOver != null ? ' · 체력 ' + pc(p.hpOver) + ' 초과 적에게' : '') + (p.poisoned ? ' · 중독된 적에게' : '') + (p.stunned ? ' · 기절한 적에게' : '') + (p.back ? ' · 후열 적에게' : '') + (p.silenced ? ' · 침묵한 적에게' : '') + ' 피해 +' + pc(p.pct);
      case 'thornWear': return '가시 ' + p.max + '개 · 쏜 타수만큼 줄고 자기 턴마다 ' + p.regen + '개 자람 · ' + p.low + '개 이하면 방어 -' + pc(p.defLoss);
      case 'pierce': return '방어 ' + (p.minDef || 0) + ' 이상인 적의 방어 ' + pc(p.pct) + ' 무시';
      case 'takenIf': return (p.front ? '전열일 때 ' : '') + '받는 피해 -' + pc(p.pct);
      case 'defIfLowHp': return '체력 ' + pc(p.hpBelow || 0.5) + ' 이하면 방어 +' + pc(p.pct);
      case 'roundAtk': return '자기 턴마다 공격 +' + pc(p.pct) + ' (최대 ' + (p.max || 5) + '번 쌓임)';
      case 'turnHeal': return '자기 턴 시작: 가장 다친 아군 최대 체력의 ' + pc(p.pct) + ' 회복';
      case 'startBuff': return '전투 시작: 아군 전체 ' + STAT[p.stat] + ' +' + pc(p.pct) + ' (' + p.duration + '턴)';
      case 'afterUlt': return p.effect === 'healAll' ? '필살기 뒤: 아군 전체 최대 체력의 ' + pc(p.pct) + ' 회복' : '필살기 뒤: 자기 ' + STAT[p.stat] + ' +' + pc(p.pct) + ' (' + p.duration + '턴)';
      case 'extraHit': return '기본 공격 뒤 ' + pc(p.chance) + ' 확률로 ' + pc(p.mult) + ' 추가타';
      default: return p.type;
    }
  }
  function infoOf(D, u){
    const sp = D.species[u.species], def = sp && sp.passive; if(!def || !Array.isArray(def.list) || !def.list.length) return null;
    const open = (u.star || 1) >= (def.from || 0), list = open ? passivesOf(D, u) : def.list;
    const lv = levelOf(D, u);
    return { name: def.list[0].name, locked: !open, from: def.from || 0, lines: list.map(describe), level: lv };
  }
  const api = Object.freeze({ levelOf, passivesOf, infoOf, describe });
  if(typeof module !== 'undefined' && module.exports) module.exports = api; else root.TaleliaPassive = api;
})(typeof window !== 'undefined' ? window : globalThis);
