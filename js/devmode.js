/* =====================================================================
 * TALELIA · devmode.js — 개발용 표시 스위치 (지인 배포 2단계)
 *  주소에 ?dev=1 이 있을 때만: <html class="is-dev"> · 제목은 <title data-dev-title> 로
 *  없으면 [data-dev-only] 요소가 숨겨짐 (css/reset.css) · window.TaleliaDev = true | false
 *  페이지마다 따로 봄: 다음 화면으로 이어 붙이지 않고 저장도 하지 않음
 *  개발 기능(소환 화면의 재화 지급 · 초기화 등)도 모두 이 스위치(window.TaleliaDev)만 봄
 *  배포 빌드(tools/publish_build.py)는 아래 LOCKED 를 true 로 바꿔 씀 → ?dev=1 을 붙여도 늘 꺼짐 (window.TaleliaDevLocked = true)
 * ===================================================================== */
(function(){
  'use strict';
  const LOCKED = true;   // 배포 빌드가 true 로 바꿈 (이 줄 모양을 바꾸면 빌드가 멈춤)
  const dev = !LOCKED && new URLSearchParams(location.search).get('dev') === '1';
  window.TaleliaDev = dev; window.TaleliaDevLocked = LOCKED;
  if(!dev) return;
  document.documentElement.classList.add('is-dev');
  const t = document.querySelector('title[data-dev-title]');
  if(t) document.title = t.dataset.devTitle;
})();
