/* =====================================================================
 * TALELIA · town/hub.js — 마을 허브: 하단 메뉴 5칸 = 스토리 · 던전 · 소환 · 장비 · 도감 (H3 · docs/design/town-hub-ui.md 2장)
 *
 *  스토리 = stage.html · 던전 = gacha.html?tab=dungeon · 소환 = ?tab=pull · 장비 = ?tab=gear · 도감 = ?tab=dex  (모두 ?savekey 를 이어 붙임 · &from=town)
 *  던전 잠김: TaleliaStage.dungeonOpen(DS, save) 가 거짓이면 칸을 흐리게 + 🔒 + "1-6 클리어" · 누르면 안내 시트 [스토리로 가기] [닫기] (이동하지 않음)
 *  저장은 읽기만 함: 쓰기를 막은 저장소 껍데기로 TaleliaGachaStore.load() 를 불러 (옮겨 적기 · 새 저장 만들기도 하지 않음) · HUD 의 정령석 · 골드를 채움
 *  스토리 칸: 마을 구경(프롤로그)을 끝내기 전(TaleliaProgress.started 가 거짓 · 저장 없음 포함)에는 숨김 · go('story') 도 이동하지 않음
 *   → 프롤로그 중 [← 마을] 로 나와 [스토리] 로 1-1 을 먼저 여는 길을 막음 (마을 구경을 끝내면 stage-link.js 가 다시 그림)
 *  시험용 window.TaleliaTownHub = { urls, go, state, refresh, setNav }
 * ===================================================================== */
(function(){
  'use strict';
  const q = new URLSearchParams(location.search), enc = encodeURIComponent;
  const key = q.get('savekey') || undefined, kq = key ? '&savekey=' + enc(key) : '';
  const urls = {
    story: () => 'stage.html' + (key ? '?savekey=' + enc(key) : ''),
    dungeon: () => 'gacha.html?tab=dungeon' + kq + '&from=town',
    summon: () => 'gacha.html?tab=pull' + kq + '&from=town',
    gear: () => 'gacha.html?tab=gear' + kq + '&from=town',
    dex: () => 'gacha.html?tab=dex' + kq + '&from=town'
  };
  const st = { save: null, readable: false, dungeonOpen: false, storyOpen: false, last: null };
  let nav = url => { location.href = url; };
  const fmt = n => Math.round(n).toLocaleString('ko-KR');

  /** 쓰기를 막은 저장소 (읽기 전용) */
  function readOnlyStorage(){
    let real = null; try{ real = window.localStorage; }catch(e){}
    return { getItem: k => { try{ return real ? real.getItem(k) : null; }catch(e){ return null; } }, setItem(){}, removeItem(){}, get length(){ return real ? real.length : 0; }, key: i => (real ? real.key(i) : null) };
  }
  function readSave(){
    const G = window.TaleliaGacha, D = window.TALELIA_GACHA, ST = window.TaleliaGachaStore;
    if(!G || !D || !ST) return null;
    const store = ST.create(D, { key, storage: readOnlyStorage() });
    // 저장이 없으면 load() 는 새 저장을 만들려 하지만 쓰기가 막혀 있어 아무것도 남지 않음
    try{ const r = store.load(); return r && r.save && r.status !== 'corrupt' ? r.save : null; }catch(e){ return null; }
  }
  function refresh(){
    const X = window.TaleliaStage, DS = window.TALELIA_STAGE;
    st.save = readSave(); st.readable = !!st.save;
    st.dungeonOpen = !!(st.save && X && DS && X.dungeonOpen(DS, st.save));
    st.storyOpen = !!(st.save && window.TaleliaProgress && window.TaleliaProgress.started(st.save));
    const sb = document.getElementById('townNavStory'); if(sb) sb.hidden = !st.storyOpen;
    const set = (n, v) => { const el = document.querySelector('[data-hud="' + n + '"]'); if(el) el.textContent = v; };
    set('stones', st.save ? fmt(st.save.stones) : '0'); set('gold', st.save ? fmt(st.save.gold) : '0');
    const b = document.getElementById('townNavDungeon');
    if(b){
      b.classList.toggle('is-locked', !st.dungeonOpen); b.setAttribute('aria-disabled', String(!st.dungeonOpen));
      b.innerHTML = '<span>' + (st.dungeonOpen ? '⚔️' : '🔒') + '</span>던전' + (st.dungeonOpen ? '' : '<small>1-6 클리어</small>');
    }
    return st;
  }
  function lockedSheet(){
    const U = window.TaleliaUI; if(!U || !U.sheet) return;
    U.sheet('던전은 아직 잠겨 있어요',
      '<p class="town-info__desc">1장(스테이지 1-1 ~ 1-6)을 끝내면 던전이 열려요. 1-6 을 처음 클리어하면 열립니다.</p><p class="tl-muted">던전에서는 장비를 얻고 강화할 수 있어요.</p>',
      [{ label: '스토리로 가기', kind: 'is-gold', run: () => { U.closeSheet(); if(st.storyOpen) go('story'); else nav('story.html' + (key ? '?savekey=' + enc(key) : '')); } },   // 프롤로그 중이면 프롤로그(이어 하기)로
       { label: '닫기', run: () => U.closeSheet() }]);
  }
  /** 칸 이동 (던전이 잠겨 있으면 이동하지 않고 안내 시트) */
  function go(name){
    if(!urls[name]) return { ok: false };
    if(name === 'story' && !st.storyOpen){ refresh(); if(!st.storyOpen){ st.last = { kind: 'intro' }; return { ok: false, intro: true }; } }
    if(name === 'dungeon' && !st.dungeonOpen){ refresh(); if(!st.dungeonOpen){ st.last = { kind: 'locked' }; lockedSheet(); return { ok: false, locked: true }; } }
    const url = urls[name](); st.last = { kind: 'go', name, url };
    if(name === 'story' && window.TaleliaTownStageLink) window.TaleliaTownStageLink.goStage(); else nav(url);
    return { ok: true, url };
  }
  const navEl = document.getElementById('townNav');
  if(navEl) navEl.addEventListener('click', e => { const b = e.target.closest('button[data-go]'); if(b) go(b.dataset.go); });
  window.TaleliaTownHub = { urls, go, state: st, refresh, setNav: fn => { nav = fn; } };
  const run = () => { try{ refresh(); }catch(e){ console.error(e); } };
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
  window.addEventListener('pageshow', run);   // 뒤로가기로 돌아왔을 때 다시 읽음
})();
