/* =====================================================================
 * TALELIA · stage/rules.js — 1장 스테이지 규칙 (순수 함수 · 받은 저장을 바꾸지 않음 · 화면 · 전투 코드를 부르지 않음)
 *  설계: docs/design/stage-system.md · 데이터: data/stage/chapter1.js (window.TALELIA_STAGE) · 저장: 뽑기 저장 v4 의 stage
 *
 *  const X = TaleliaStage
 *   X.validate(DS, battle?)             데이터 검사 → 문제 목록 (battle = data/battle-proto.js 를 주면 스킬 id · 상태이상 없음까지 확인)
 *   X.stageOf(DS, id) · X.indexOf(DS, id)
 *   X.isOpen(DS, save, id)              1-1 은 늘 열림 · 나머지는 바로 앞 스테이지를 클리어해야 열림
 *   X.dungeonOpen(DS, save)             던전 탭 개방: 마지막 스테이지(1-6) 첫 클리어 · 또는 던전 기록이 있는 기존 저장
 *   X.enter(DS, save, id, now)          입장 → { ok, save, runId, seed, id, resume } · 입장에는 비용이 없음 · 끝나지 않은 같은 스테이지가 있으면 같은 runId 로 이어 하기(resume, 저장 그대로)
 *   X.applyResult(DS, save, run, now)   run = { runId, id, result: 'win'|'lose'|'draw', at? } → { ok, save, result, first, reward, dungeonUnlocked } · runId 로 딱 한 번만 (던전과 같은 방식)
 *                                       - 이미 반영한 runId → { ok: false, duplicate: true } · 진행 중인 판(open)과 다르면 { ok: false, stale: true } (아무것도 바꾸지 않음)
 *                                       - 첫 클리어(승리 + 기록 없음)만 정령석 · 골드 보상 · 다시 이겨도 보상 없음 · 패배 · 무승부는 기록만
 *   X.markGuide(save, 'gacha'|'party'|'dungeon'|'defeat') · X.markIntro(save)   안내 · 마을 구경을 봤다고 기록
 *   X.firstDefeat(save, id) · X.recruit(save, 1회 뽑기 값, 편성 칸 수)   1-2 첫 패배인지 · 소환 / 편성 중 무엇을 권할지와 문구
 *   X.waveOf(DS, id)                    전투 규칙에 넘길 적 목록 (종류 + 스테이지 배율 s + 변이 배율) · 없는 스테이지 = null
 *   X.seedOf(글자) · X.dayOf(시각) · X.RUN_KEEP
 * ===================================================================== */
(function(root){
  'use strict';
  const RUN_KEEP = 200;                       // 반영한 runId 기억 개수 (던전과 같음)
  const GUIDES = ['gacha', 'party', 'dungeon', 'defeat'];   // defeat = 1-2 첫 패배 강조를 봤음 · 선택 칸이라 newSave · migrate 는 채우지 않음 (저장 버전 4 그대로)
  const OK_RESULT = ['win', 'lose', 'draw'];
  const clone = o => JSON.parse(JSON.stringify(o));
  const fail = (save, reason, extra) => Object.assign({ ok: false, reason, save }, extra || {});
  /** 글자 → 32비트 시드 (FNV-1a · 던전 규칙과 같은 식) */
  function seedOf(text){ let h = 0x811c9dc5; for(const ch of String(text)){ h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; } return h >>> 0 || 1; }
  /** 기기 날짜 YYYY-MM-DD */
  function dayOf(now){ const d = new Date(now == null ? Date.now() : now), p = n => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); }

  const indexOf = (DS, id) => DS.stages.findIndex(s => s.id === id);
  const stageOf = (DS, id) => DS.stages.find(s => s.id === id) || null;
  const stageSave = save => (save && save.stage && typeof save.stage === 'object') ? save.stage : { cleared: {}, open: null, runs: [], seq: 0, guide: {}, intro: false };

  function isOpen(DS, save, id){
    const i = indexOf(DS, id); if(i < 0) return false;
    return i === 0 || !!stageSave(save).cleared[DS.stages[i - 1].id];
  }
  function dungeonOpen(DS, save){
    const S = stageSave(save), d = (save && save.dungeon) || {};
    return !!S.cleared[DS.last] || (d.cleared || 0) > 0 || (Array.isArray(d.runs) && d.runs.length > 0);
  }

  function enter(DS, save, id, now){
    const st = stageOf(DS, id); if(!st) return fail(save, '없는 스테이지: ' + id);
    if(!isOpen(DS, save, id)){ const prev = DS.stages[indexOf(DS, id) - 1]; return fail(save, (prev ? prev.id : '앞 스테이지') + ' 를 먼저 클리어해야 해요'); }
    const S = stageSave(save);
    if(S.open && S.open.id === id) return { ok: true, save, runId: S.open.runId, seed: seedOf(S.open.runId), id, resume: true };
    const s = clone(save); s.stage.seq = (s.stage.seq || 0) + 1;
    const runId = dayOf(now) + '#st' + String(s.stage.seq).padStart(3, '0');
    s.stage.open = { runId, id, at: now == null ? Date.now() : now };
    return { ok: true, save: s, runId, seed: seedOf(runId), id, resume: false };
  }

  function applyResult(DS, save, run, now){
    run = run || {};
    if(!run.runId) return fail(save, 'runId 가 없음');
    const st = stageOf(DS, run.id); if(!st) return fail(save, '없는 스테이지: ' + run.id);
    if(!OK_RESULT.includes(run.result)) return fail(save, '알 수 없는 결과: ' + run.result);
    const S = stageSave(save);
    if((S.runs || []).includes(run.runId)) return fail(save, '이미 반영한 전투', { duplicate: true });
    if(!S.open || S.open.runId !== run.runId || S.open.id !== run.id) return fail(save, '진행 중인 판과 달라요', { stale: true });
    const s = clone(save), at = run.at != null ? run.at : (now != null ? now : Date.now());
    let first = false, reward = null;
    if(run.result === 'win' && !s.stage.cleared[run.id]){
      first = true; s.stage.cleared[run.id] = at; reward = { stones: st.reward.stones, gold: st.reward.gold };
      s.stones += reward.stones; s.gold += reward.gold;
      if(st.reward.tstones > 0){ reward.tstones = st.reward.tstones; s.tstones = (s.tstones || 0) + reward.tstones; }   // V3-3 초월석 (스토리 캐릭터 성장 재료)
    }
    s.stage.runs = (S.runs || []).concat(run.runId).slice(-RUN_KEEP); s.stage.open = null;
    return { ok: true, save: s, result: run.result, first, reward, duplicate: false, dungeonUnlocked: first && run.id === DS.last };
  }

  function markGuide(save, key){
    if(!GUIDES.includes(key)) return fail(save, '알 수 없는 안내: ' + key);
    const s = clone(save); s.stage.guide[key] = true; return { ok: true, save: s };
  }
  function markIntro(save){ const s = clone(save); s.stage.intro = true; return { ok: true, save: s }; }

  /* ---------- 동료 모으기 안내 (1-1 클리어 직후 · 패배했을 때 · 화면 문구의 바탕) ---------- */
  /** 1-1 을 깬 뒤 1-2 에서 처음 진 상황인지 (stage.guide.defeat 는 선택 칸: 없으면 아직 안 본 것) */
  function firstDefeat(save, id){
    const S = stageSave(save);
    return id === '1-2' && !!S.cleared['1-1'] && !S.cleared['1-2'] && !(S.guide && S.guide.defeat);
  }
  /** cost = 1회 뽑기 값 · max = 편성 칸 수 → { full, canPull, canFill, pulled, primary: 'summon'|'party', text } */
  function recruit(save, cost, max){
    const party = save.party || [], units = save.units || [];
    const placed = new Set(party.map(p => (units.find(u => u.uid === p.uid) || {}).species));
    const full = party.length >= max, canPull = save.stones >= cost, pulled = !!(save.stats && save.stats.pulls > 0);
    const canFill = !full && units.some(u => !placed.has(u.species));
    const primary = !pulled && canPull ? 'summon' : !full && canFill ? 'party' : canPull ? 'summon' : 'party';
    const text = !pulled && canPull ? '혼자 힘으로는 벅차요. 정령석으로 동료를 불러 ' + max + '명을 채워 보세요.'
      : !full && canFill ? '편성에 빈 칸이 있어요. 편성에서 [자동 편성]으로 동료를 채워 보세요.'
      : '동료를 키우거나 새 동료를 불러 편성을 바꿔 보세요.';
    return { full, canPull, canFill, pulled, primary, text };
  }

  /** 전투 규칙에 넘길 적 목록: 능력치 = 종류 기본값 × 스테이지 배율 s (× 변이 배율) · 방어 · 속도 · 스킬은 그대로 · 같은 이름이 겹치면 A · B · C */
  function waveOf(DS, id){
    const st = stageOf(DS, id); if(!st) return null;
    const names = st.wave.map(([t, , , o]) => (o && o.mutant ? '변이 ' : '') + DS.enemyTypes[t].name + (DS.enemyTypes[t].placeholder ? ' (디자인 준비 중)' : ''));
    const seen = {}, total = {}; names.forEach(n => { total[n] = (total[n] || 0) + 1; });
    return st.wave.map(([t, row, slot, o], i) => {
      const ty = DS.enemyTypes[t], mut = !!(o && o.mutant), mh = mut ? DS.mutant.hp : 1, ma = mut ? DS.mutant.atk : 1;
      const n = names[i]; seen[n] = (seen[n] || 0) + 1;
      const e = { id: 'sg_' + st.id.replace('-', '_') + '_' + (i + 1), name: total[n] > 1 ? n + ' ' + String.fromCharCode(64 + seen[n]) : n, row, slot,
        shape: ty.shape, color: ty.color, hp: Math.max(1, Math.round(ty.hp * st.s * mh)), atk: Math.max(1, Math.round(ty.atk * st.s * ma)), def: ty.def, spd: ty.spd, skills: ty.skills.slice() };
      if(ty.img) e.img = ty.img;
      return e;
    });
  }

  /** 데이터 검사 → 문제 목록 (battle 을 주면 스킬 id 가 있는지 · 상태이상 스킬이 없는지도 봄) */
  function validate(DS, battle){
    const P = [], ids = new Set(), T = DS.enemyTypes || {};
    if(!DS.chapter || !Array.isArray(DS.stages) || !DS.stages.length) return ['chapter · stages 가 없음'];
    if(!(DS.mutant && DS.mutant.hp > 0 && DS.mutant.atk > 0)) P.push('변이 배율이 양수가 아님');
    for(const [k, t] of Object.entries(T)){
      for(const st of ['hp', 'atk', 'def', 'spd']) if(!(t[st] > 0)) P.push(k + ' 능력치 ' + st + ' 없음');
      if(!Array.isArray(t.skills) || !t.skills.length) P.push(k + ' 스킬이 없음');
      else if(battle) for(const sk of t.skills){ const d = battle.skills[sk]; if(!d) P.push(k + ' 없는 스킬: ' + sk); else if(d.status) P.push(k + ' 상태이상 스킬은 1장 적에 쓰지 않음: ' + sk); }
    }
    DS.stages.forEach((st, i) => {
      if(st.id !== DS.chapter.id + '-' + (i + 1) || st.n !== i + 1) P.push((st.id || i) + ' id · 번호가 순서(' + DS.chapter.id + '-' + (i + 1) + ')와 다름');
      if(ids.has(st.id)) P.push(st.id + ' 겹침'); ids.add(st.id);
      if(!(st.s > 0)) P.push(st.id + ' 배율 s 가 양수가 아님');
      if(!st.reward || !Number.isInteger(st.reward.stones) || !Number.isInteger(st.reward.gold) || st.reward.stones < 0 || st.reward.gold < 0) P.push(st.id + ' 보상이 0 이상 정수가 아님');
      if(!Array.isArray(st.wave) || !st.wave.length || st.wave.length > 6){ P.push(st.id + ' 적이 1~6 마리가 아님'); return; }
      const spots = new Set();
      for(const [t, row, slot, o] of st.wave){
        if(!T[t]) P.push(st.id + ' 없는 적 종류: ' + t);
        if(row !== 'front' && row !== 'back') P.push(st.id + ' 줄이 틀림: ' + row);
        if(!(Number.isInteger(slot) && slot >= 0 && slot <= 2)) P.push(st.id + ' 칸이 0~2 가 아님: ' + slot);
        const k = row + slot; if(spots.has(k)) P.push(st.id + ' 같은 자리에 둘: ' + k); spots.add(k);
        if(o && Object.keys(o).some(x => x !== 'mutant')) P.push(st.id + ' 덮어쓰기는 mutant 만 가능');
      }
    });
    if(DS.last !== DS.stages[DS.stages.length - 1].id) P.push('last 가 마지막 스테이지가 아님: ' + DS.last);
    return P;
  }

  const api = Object.freeze({ RUN_KEEP, GUIDES, seedOf, dayOf, indexOf, stageOf, isOpen, dungeonOpen, enter, applyResult, markGuide, markIntro, firstDefeat, recruit, waveOf, validate });
  if(typeof module !== 'undefined' && module.exports) module.exports = api; else root.TaleliaStage = api;
})(typeof window !== 'undefined' ? window : globalThis);
