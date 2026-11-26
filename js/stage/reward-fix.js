/* =====================================================================
 * TALELIA · stage/reward-fix.js — 1장 정령석 보상 분배 변경(2,550 → 3,000)의 차액 보충 (docs/design/town-hub-ui.md 5장 · 안 A)
 *
 *  const F = TaleliaStageRewardFix
 *   F.fix(DS, save)  → { ok, save, added, ids, already }   (순수 함수 · 받은 저장을 바꾸지 않음 · 저장 버전은 올리지 않음)
 *       stage.rewardRev 가 DS.rewardRev 이상이면 아무것도 하지 않음 · 아니면 이미 클리어한 스테이지마다
 *       (지금 보상 − 옛 보상 DS.legacyStones) 를 정령석에 더하고 stage.rewardRev 를 기록 (한 번만 · 새 저장도 기록)
 *   F.message(r)     → 알림 문구
 *  불러 오는 곳: 스테이지 화면(js/stage/ui.js) · 소환 화면(아래 자동 연결). 마을은 저장을 읽기만 하므로 부르지 않음.
 *  js/stage/rules.js · js/gacha/rules.js · 전투 코드는 바꾸지 않음 (stage 에 rewardRev 칸을 더해도 checkSave 가 막지 않음)
 * ===================================================================== */
(function(root){
  'use strict';
  function fix(DS, save){
    const want = DS.rewardRev || 1, t = save && save.stage;
    if(!t || typeof t !== 'object') return { ok: false, reason: 'stage 없음', save, added: 0, tAdded: 0, ids: [] };
    if((t.rewardRev || 1) >= want && t.rewardRev != null) return { ok: true, save, added: 0, tAdded: 0, ids: [], already: true };
    const rev = t.rewardRev || 1, s = JSON.parse(JSON.stringify(save)), ids = []; let added = 0, tAdded = 0;
    for(const st of DS.stages){
      if(!s.stage.cleared[st.id]) continue;
      if(rev < 2){   // 판 1 → 2: 정령석 분배 차액
        const old = (DS.legacyStones || {})[st.id], d = old == null ? 0 : st.reward.stones - old;
        if(d > 0){ added += d; ids.push(st.id); }
      }
      if(rev < 3 && st.reward.tstones > 0) tAdded += st.reward.tstones;   // 판 2 → 3: 이미 클리어한 스테이지의 초월석
    }
    s.stones += added; if(tAdded > 0) s.tstones = (s.tstones || 0) + tAdded; s.stage.rewardRev = want;
    return { ok: true, save: s, added, tAdded, ids, already: false };
  }
  const message = r => '1장 보상이 바뀌어 ' + [r.added > 0 ? '정령석 +' + r.added.toLocaleString('ko-KR') : '', r.tAdded > 0 ? '초월석 +' + r.tAdded.toLocaleString('ko-KR') : ''].filter(Boolean).join(' · ') + '을 더 드렸어요';
  const api = Object.freeze({ fix, message });
  if(typeof module !== 'undefined' && module.exports) module.exports = api; else root.TaleliaStageRewardFix = api;

  /* 소환 화면: 불러온 직후 한 번 (다른 화면은 직접 부름) */
  if(typeof document !== 'undefined' && root.TaleliaGachaUI && root.TALELIA_STAGE){
    try{
      const UI = root.TaleliaGachaUI, r = fix(root.TALELIA_STAGE, UI.reload());
      if(r.ok && !r.already){ UI.commit(r.save); if(r.added > 0) UI.toast(message(r)); }
    }catch(e){ console.error(e); }
  }
})(typeof window !== 'undefined' ? window : globalThis);
