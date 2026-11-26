/* =====================================================================
 * TALELIA · battle/ai.js — 자동 행동 결정 (아군 자동 전투 · 적 행동 공용 · 화면 코드 없음)
 *
 *  choose(B, unit) → { skill, target }   (target 은 단일 대상 스킬일 때만) · 기절이면 { pass: true } → B.pass()
 *
 *  우선순위 (임시안 · 보고서 7장 C)
 *   1. 필살기(tag 'ultimate') · 자동 ON · 사용 가능 → 사용
 *   2. 회복 스킬 · 자동 ON · 사용 가능 · HP 비율 < rules.autoHealBelowPct 인 아군이 있으면 → HP 비율이 가장 낮은 아군
 *   3. 강화 스킬 · 자동 ON · 사용 가능 · 그 강화가 없는 아군이 있으면 → 사용 (공격력 → 방어력 순서 = 스킬 목록 순서)
 *   3.5 상태이상 스킬 (v2 3단계) · 필살기 · every 가 아닌 공격 스킬에 status 가 있고 · 자동 ON · 사용 가능
 *       그 상태를 걸 수 있는 상대(그 상태가 아직 없음 · 면역 아님 · 기절이면 기절 내성 아님)가 있을 때만 → 사용 (스킬 목록 순서)
 *       대상: 기절 · 약화 = 공격력(강화 · 약화 반영)이 가장 높은 상대 · 중독 = 최대 HP 가 가장 큰 상대 · 같으면 고를 수 있는 대상 순서 앞쪽 (난수 안 씀)
 *       적 n명 = 그 상대가 주대상 · 적 전체 = 대상 없음 · status 가 있는 스킬이 없으면 이 단계는 건너뜀 (기존 전투 난수 순서 그대로)
 *   3.6 쿨타임 공격 스킬 (v2 5단계) · 필살기 · every · 상태이상이 아닌 쿨타임 공격 스킬 · 자동 ON · 사용 가능 → 사용 (스킬 목록 순서 · 대상 고르기는 기본 공격과 같음)
 *       예: 저격 기계 조준 연사 · 이런 스킬이 없으면 이 단계는 건너뜀 (기존 전투 난수 순서 그대로)
 *   4. 정해진 턴에만 쓰는 스킬(every) · 그 턴이면 → 사용 (예: 저격수 3턴마다 광역)
 *   5. 기본 공격
 *   - 공격 대상: 고를 수 있는 대상 중 시드 난수로 무작위 (임시안 E)
 *   - 적 n명(enemy_n) 주대상: 실제로 맞는 대상 수가 가장 많은 후보 중 시드 난수로 무작위 (v2 · 지금 규칙에서는 늘 동률 → 단일과 같은 난수 1회)
 *   - 침묵(V3-5a): 침묵이 걸린 캐릭터는 rules.js usable 이 기본 공격만 허용하므로 위 우선순위가 자연히 5번(기본 공격)까지 내려감 (쓸 스킬이 없으면 pass)
 *     침묵을 거는 단일 스킬의 대상 = 침묵 없음 · 면역 아님 · 기본 공격 말고 쓸 스킬이 있는 상대 중 그 스킬 남은 쿨타임이 가장 짧은 상대 → 공격력 높은 상대 → 대상 순서 (난수 없음) · 없으면 무작위
 *   - 자동 사용 OFF 인 스킬은 절대 쓰지 않음 (수동으로는 사용 가능) · 기본 공격은 항상 가능
 * ===================================================================== */
(function(root){
  'use strict';
  function pick(B, list){ return list.length ? list[Math.floor(B.rand() * list.length)] : null; }

  function choose(B, u){
    if(B.isStunned && B.isStunned(u)) return { pass: true };   // 기절: 행동 없이 넘김 (v2 2단계)
    const skills = B.skillsOf(u), ok = s => s.usable && s.auto;
    if(B.isSilenced && B.isSilenced(u) && !skills.some(s => s.usable)) return { pass: true };   // 침묵인데 쓸 스킬이 하나도 없음 (안전장치 · V3-5a)
    const target = s => s.target === 'enemy_n' ? widest(B, s)
      : /_single$/.test(s.target) ? (s.kind === 'heal' ? lowest(B, s) : silenceTarget(B, u, s) || pick(B, B.legalTargets(s.id))) : null;
    const go = s => ({ skill: s.id, target: (t => t && t.id)(target(s)) });
    // 1. 필살기
    const ult = skills.find(s => s.tag === 'ultimate' && ok(s)); if(ult) return go(ult);
    // 2. 회복
    const heal = skills.find(s => s.kind === 'heal' && ok(s));
    if(heal && B.legalTargets(heal.id).some(t => t.hp / t.maxHp < B.rules.autoHealBelowPct)) return go(heal);
    // 3. 강화 (그 강화가 없는 아군이 있을 때)
    for(const s of skills.filter(s => s.kind === 'buff' && ok(s))){
      if(B.legalTargets(s.id).some(t => !t.buffs.some(b => b.skill === s.id))) return go(s);
    }
    // 3.5 상태이상 스킬 (그 상태를 걸 수 있는 상대가 있을 때)
    for(const s of skills.filter(s => s.kind === 'attack' && s.tag !== 'ultimate' && !s.every && ok(s))){
      const st = statusDef(u, s.id); if(!st) continue;
      const C = statusTargets(B, s, st); if(!C.length) continue;
      if(s.target === 'enemy_all') return { skill: s.id, target: null };
      const key = st.type === 'poison' ? t => t.maxHp : t => B.effAtk(t);
      return { skill: s.id, target: C.reduce((a, b) => key(b) > key(a) ? b : a).id };
    }
    // 3.6 쿨타임 공격 스킬 (필살기 · every · 상태이상 아님)
    const cdAtk = skills.find(s => s.kind === 'attack' && s.cooldown && s.tag !== 'ultimate' && !s.every && !statusDef(u, s.id) && ok(s)); if(cdAtk) return go(cdAtk);
    // 4. 정해진 턴 스킬
    const every = skills.find(s => s.every && ok(s)); if(every) return go(every);
    // 5. 기본 공격
    const basic = skills.find(s => s.basic && s.usable) || skills.find(s => s.kind === 'attack' && s.usable);
    return go(basic);
  }
  /** 스킬 데이터의 상태이상 (없으면 null) */
  function statusDef(u, id){ const k = (u.skills || []).find(x => x.id === id); return (k && k.def && k.def.status) || null; }
  /** 상태이상을 걸 수 있는 상대: 고를 수 있는 대상 중 그 상태가 없고 · 면역이 아니고 · (기절이면) 기절 내성이 아님 */
  function statusTargets(B, s, st){
    return B.legalTargets(s.id).filter(t => !(t.immune || []).includes(st.type) && !B.statusOf(t, st.type) && !(st.type === 'stun' && t.guard));
  }
  /** 침묵을 거는 단일 스킬의 대상 (V3-5a · 없으면 null → 지금처럼 무작위)
   *  침묵이 없고 면역이 아닌 상대 중 기본 공격 말고 쓸 스킬이 있는 상대 → 그 스킬의 남은 쿨타임이 가장 짧은 상대 → 같으면 공격력(강화 · 약화 반영)이 높은 상대 → 같으면 고를 수 있는 대상 순서 (난수 안 씀) */
  function silenceTarget(B, u, s){
    const st = statusDef(u, s.id); if(!st || st.type !== 'silence') return null;
    const cand = statusTargets(B, s, st).filter(t => (t.skills || []).some(k => !isBasicSkill(k.def)));
    if(!cand.length) return null;
    const cd = t => Math.min(...t.skills.filter(k => !isBasicSkill(k.def)).map(k => k.cd));
    return cand.reduce((a, b) => { const ca = cd(a), cb = cd(b); return cb < ca || (cb === ca && B.effAtk(b) > B.effAtk(a)) ? b : a; });
  }
  const isBasicSkill = d => d.kind === 'attack' && !d.cooldown && !d.tag && !d.every;
  function lowest(B, s){ return B.legalTargets(s.id).slice().sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0] || null; }
  /** 적 n명: 맞는 대상 수가 가장 많은 주대상 후보 → 동률이면 무작위 */
  function widest(B, s){
    const L = B.legalTargets(s.id), n = L.map(t => B.targetsOf(s.id, t.id).length), best = Math.max(0, ...n);
    return pick(B, L.filter((t, i) => n[i] === best));
  }

  /** 끝까지 자동으로 진행 (테스트 · 20회 요약용) · allyAuto=false 면 아군 차례에서 멈춤 */
  function runAuto(B, opts){
    opts = opts || {}; let guard = 0;
    for(;;){ const u = B.current(); if(!u) break; if(u.side === 'ally' && opts.allyAuto === false) break;
      const c = choose(B, u); if(c.pass) B.pass(); else B.act(c.skill, c.target); if(++guard > 100000) throw new Error('자동 진행이 끝나지 않음'); }
    return B.result();
  }

  const api = Object.freeze({ choose, runAuto, statusTargets });
  if(typeof module !== 'undefined' && module.exports) module.exports = api; else root.TaleliaBattleAI = api;
})(typeof window !== 'undefined' ? window : globalThis);
