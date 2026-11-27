/* =====================================================================
 * TALELIA · town/stage-link.js — 마을 ↔ 스테이지 연결 (S4 · docs/design/stage-system.md 1 · 4장)
 *
 *  - [모험] 메뉴 = stage.html (town.js 가 부름 · ?savekey 는 그대로 넘김)
 *  - 마더의 마을 구경(story.html ch1_01)을 끝내고 오면 (?from=ch1_01) 뽑기 저장 v4 stage.intro 를 참으로 기록 + 안내 ① "뽑기" (stage.guide.gacha 가 거짓일 때만)
 *      안내 ①: 마을에서 뽑기 안내 → [뽑기로 가기] = gacha.html · [나중에] = 닫기 · 어느 쪽이든 본 것으로 기록
 *      이때 프롤로그 중간 저장(talelia.story.progress · js/story/progress.js)을 지우고 [스토리] 칸을 다시 그림 (js/town/hub.js)
 *  - 그냥 마을을 열 때(?from 없음)는 이 파일이 저장을 쓰지 않음. 예외 하나 = 테스트 선물(js/town/welcome-bonus.js): 받을 저장일 때만 한 번 쓰고 안내 창 [뽑기로 가기] [확인]
 *      마을 구경을 끝내고 온 때에는 안내 ① 시트에 선물 문구 한 줄을 넣음 (안내 ① 을 이미 본 저장이면 선물 창)
 *  시험용 window.TaleliaTownStageLink = { goStage, onTour, onOpen, state }
 * ===================================================================== */
(function(){
  'use strict';
  const q = new URLSearchParams(location.search), enc = encodeURIComponent;
  const key = q.get('savekey') || undefined, k1 = key ? '?savekey=' + enc(key) : '', kq = key ? '&savekey=' + enc(key) : '';
  const st = { from: q.get('from') || null, shown: false, marked: false, bonus: 0 };
  let nav = url => { location.href = url; };

  function goStage(){ nav('stage.html' + k1); }

  /** 테스트 선물: 받을 저장이면 지급하고 상단 정령석 숫자를 다시 그림 · 지급했으면 true */
  function claimBonus(){
    const B = window.TaleliaWelcomeBonus; if(!B) return false;
    const r = B.claim(window.TALELIA_GACHA, { key, search: location.search }); if(!r.added) return false;
    st.bonus = r.added; if(window.TaleliaTownHub) window.TaleliaTownHub.refresh();
    return true;
  }
  const bonusLine = () => '<p class="town-info__desc" data-bonus>' + window.TaleliaUI.esc(window.TaleliaWelcomeBonus.MESSAGE) + '</p>';
  function bonusSheet(){
    const U = window.TaleliaUI;
    U.sheet('정령석 선물', bonusLine(), [
      { label: '뽑기로 가기', kind: 'is-gold', run: () => nav('gacha.html' + k1) },
      { label: '확인', run: () => U.closeSheet() }
    ]);
  }
  /** 그냥 마을을 열었을 때: 이미 프롤로그를 끝낸 저장이 선물을 아직 안 받았으면 한 번 */
  function onOpen(){ if(claimBonus()) bonusSheet(); return st; }

  /** 마을 구경을 끝내고 왔을 때: intro 기록 + 안내 ① (한 번) */
  function onTour(){
    const G = window.TaleliaGacha, D = window.TALELIA_GACHA, X = window.TaleliaStage, ST = window.TaleliaGachaStore;
    if(!G || !D || !X || !ST) return st;
    const store = ST.create(D, { key }); let save = store.load().save;
    if(!save.stage.intro){ const m = X.markIntro(save); if(m.ok){ save = m.save; store.save(save); st.marked = true; } }
    if(save.stage.intro){ if(window.TaleliaProgress) window.TaleliaProgress.clear(key); if(window.TaleliaTownHub) window.TaleliaTownHub.refresh(); }
    const gifted = !!save.stage.intro && claimBonus();
    if(!save.stage.guide.gacha){
      st.shown = true;
      const U = window.TaleliaUI, mark = () => { const m = X.markGuide(store.load().save, 'gacha'); if(m.ok) store.save(m.save); };
      const html = '<p class="town-info__desc">마을 광장에서 정령석으로 새로운 동료를 불러 모을 수 있어요. 동료가 늘면 스테이지 전투가 훨씬 쉬워져요.</p>'
        + '<p class="tl-muted">뽑은 동료는 편성의 빈 칸에 자동으로 들어가요. 편성 탭에서 바꿀 수 있어요.</p>';
      U.sheet('동료를 불러 보자', (gifted ? bonusLine() : '') + html, [
        { label: '뽑기로 가기', kind: 'is-gold', run: () => { mark(); nav('gacha.html' + k1); } },
        { label: '나중에', run: () => { mark(); U.closeSheet(); } }
      ]);
    } else if(gifted) bonusSheet();
    return st;
  }

  window.TaleliaTownStageLink = { goStage, onTour, onOpen, state: st, setNav: fn => { nav = fn; } };
  const run = () => { try{ if(st.from === 'ch1_01') onTour(); else onOpen(); }catch(e){ console.error(e); } };
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(run, 400)); else setTimeout(run, 400);
})();
