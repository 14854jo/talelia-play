/* TALELIA · topbar.js — [← 마을] 링크에 ?savekey 를 이어 붙임 (H2 · 저장은 읽지도 쓰지도 않음)
 *   <a class="tl-back" data-town href="town.html">← 마을</a>  →  town.html?savekey=이름 (주소에 savekey 가 있을 때만)
 *   window.TaleliaTopbar = { townUrl() } */
(function(){
  'use strict';
  const q = new URLSearchParams(location.search), key = q.get('savekey');
  const townUrl = extra => 'town.html' + (key || extra ? '?' + [key ? 'savekey=' + encodeURIComponent(key) : '', extra || ''].filter(Boolean).join('&') : '');
  const apply = () => document.querySelectorAll('a.tl-back[data-town]').forEach(a => a.setAttribute('href', townUrl(a.dataset.townQuery)));
  // data-confirm-if="run" : 주소에 ?run= 이 있을 때만 확인 (진행 중인 스테이지 · 던전 전투)
  document.addEventListener('click', e => { const a = e.target.closest && e.target.closest('a.tl-back[data-confirm]'); if(!a) return;
    const cond = a.dataset.confirmIf; if(cond && !q.get(cond)) return;
    if(!window.confirm(a.dataset.confirm)) e.preventDefault(); });
  window.TaleliaTopbar = { townUrl, apply };
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply); else apply();
})();
