/* =====================================================================
 * TALELIA · town/stage-link.js — 마을 ↔ 스테이지 연결 (S4 · docs/design/stage-system.md 1 · 4장)
 *
 *  - [모험] 메뉴 = stage.html (town.js 가 부름 · ?savekey 는 그대로 넘김)
 *  - 마더의 마을 구경(story.html ch1_01)을 끝내고 오면 (?from=ch1_01) 뽑기 저장 v4 stage.intro 를 참으로 기록 + 안내 ① "뽑기" (stage.guide.gacha 가 거짓일 때만)
 *      안내 ①: 마을에서 뽑기 안내 → [뽑기로 가기] = gacha.html · [나중에] = 닫기 · 어느 쪽이든 본 것으로 기록
 *      이때 프롤로그 중간 저장(talelia.story.progress · js/story/progress.js)을 지우고 [스토리] 칸을 다시 그림 (js/town/hub.js)
 *  - 그냥 마을을 열 때(?from 없음)는 저장을 읽지도 쓰지도 않음 (마을 프로토타입은 지금처럼 아무것도 저장하지 않음)
 *  시험용 window.TaleliaTownStageLink = { goStage, onTour, state }
 * ===================================================================== */
(function(){
  'use strict';
  const q = new URLSearchParams(location.search), enc = encodeURIComponent;
  const key = q.get('savekey') || undefined, k1 = key ? '?savekey=' + enc(key) : '', kq = key ? '&savekey=' + enc(key) : '';
  const st = { from: q.get('from') || null, shown: false, marked: false };
  let nav = url => { location.href = url; };

  function goStage(){ nav('stage.html' + k1); }

  /** 마을 구경을 끝내고 왔을 때: intro 기록 + 안내 ① (한 번) */
  function onTour(){
    const G = window.TaleliaGacha, D = window.TALELIA_GACHA, X = window.TaleliaStage, ST = window.TaleliaGachaStore;
    if(!G || !D || !X || !ST) return st;
    const store = ST.create(D, { key }); let save = store.load().save;
    if(!save.stage.intro){ const m = X.markIntro(save); if(m.ok){ save = m.save; store.save(save); st.marked = true; } }
    if(save.stage.intro){ if(window.TaleliaProgress) window.TaleliaProgress.clear(key); if(window.TaleliaTownHub) window.TaleliaTownHub.refresh(); }
    if(!save.stage.guide.gacha){
      st.shown = true;
      const U = window.TaleliaUI, mark = () => { const m = X.markGuide(store.load().save, 'gacha'); if(m.ok) store.save(m.save); };
      const html = '<p class="town-info__desc">마을 광장에서 정령석으로 새로운 동료를 불러 모을 수 있어요. 동료가 늘면 스테이지 전투가 훨씬 쉬워져요.</p>'
        + '<p class="tl-muted">뽑은 동료는 편성의 빈 칸에 자동으로 들어가요. 편성 탭에서 바꿀 수 있어요.</p>';
      U.sheet('동료를 불러 보자', html, [
        { label: '뽑기로 가기', kind: 'is-gold', run: () => { mark(); nav('gacha.html' + k1); } },
        { label: '나중에', run: () => { mark(); U.closeSheet(); } }
      ]);
    }
    return st;
  }

  window.TaleliaTownStageLink = { goStage, onTour, state: st, setNav: fn => { nav = fn; } };
  if(st.from === 'ch1_01'){
    const run = () => { try{ onTour(); }catch(e){ console.error(e); } };
    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(run, 400)); else setTimeout(run, 400);
  }
})();
