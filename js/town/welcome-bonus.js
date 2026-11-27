/* =====================================================================
 * TALELIA · town/welcome-bonus.js — 테스트 기간 한정 정령석 선물 (지인들이 캐릭터 조합을 써 보게 하는 용도)
 *
 *  끄는 법: 아래 TESTER_BONUS_ON 을 false 로. 새 지급만 멈추고, 이미 받은 저장(정령석 · testerBonus 칸)은 그대로 열립니다.
 *
 *  const B = TaleliaWelcomeBonus
 *   B.allowed(search)        이 주소에서 지급해도 되는가: 시험용 ?savekey= 주소는 안 됨 (&testerbonus=1 을 붙인 경우만 됨)
 *   B.eligible(save)         프롤로그를 끝냈고(js/story/progress.js started) 받은 표시(testerBonus: 1)가 없는 저장
 *   B.grant(save)            → { ok, save, added }   순수 함수 · 받은 저장을 바꾸지 않음 · 정령석 + 표시를 한 번에
 *   B.claim(D, opts)         → { added, save }       opts { key, search, storage } · 받을 저장일 때만 씀 (그 밖에는 읽기만 · 저장이 없거나 망가졌으면 아무것도 쓰지 않음)
 *  저장 버전은 올리지 않음 (선택 칸 testerBonus 만 더함 · 저장 검사 · 변환은 모르는 칸을 그대로 둠)
 *  부르는 곳: 마을(js/town/stage-link.js)만
 * ===================================================================== */
(function(root){
  'use strict';
  const TESTER_BONUS_ON = true;
  const TESTER_BONUS_STONES = 9000;
  const MESSAGE = '테스트 참여 선물로 정령석 9,000을 드렸어요. 10회 소환을 6번 할 수 있어요.';

  function allowed(search){
    const q = new URLSearchParams(search || '');
    return !q.has('savekey') || q.get('testerbonus') === '1';
  }
  function eligible(save){
    const P = root.TaleliaProgress;
    return !!(TESTER_BONUS_ON && save && P && P.started(save) && save.testerBonus !== 1 && Number.isInteger(save.stones));
  }
  function grant(save){
    if(!eligible(save)) return { ok: false, save, added: 0 };
    const s = JSON.parse(JSON.stringify(save)); s.stones += TESTER_BONUS_STONES; s.testerBonus = 1;
    return { ok: true, save: s, added: TESTER_BONUS_STONES };
  }
  /** 저장소를 읽기만 하는 겉싸개 (저장이 없거나 망가진 경우에 새 저장 · 보관본이 만들어지지 않게) */
  const readOnly = real => ({ getItem: k => real.getItem(k), setItem(){}, removeItem(){}, get length(){ return real.length; }, key: i => real.key(i) });

  function claim(D, opts){
    opts = opts || {};
    const none = { added: 0, save: null }, ST = root.TaleliaGachaStore;
    if(!TESTER_BONUS_ON || !D || !ST || !allowed(opts.search)) return none;
    try{
      const real = opts.storage || root.localStorage;
      const peek = ST.create(D, { key: opts.key, storage: readOnly(real) }).load();
      if((peek.status !== 'loaded' && peek.status !== 'migrated') || !eligible(peek.save)) return none;
      const store = ST.create(D, { key: opts.key, storage: real }), r = grant(store.load().save);
      return r.ok && store.save(r.save) ? { added: r.added, save: r.save } : none;   // 저장에 실패하면 안내도 띄우지 않음
    }catch(e){ console.error(e); return none; }
  }

  const api = Object.freeze({ ON: TESTER_BONUS_ON, STONES: TESTER_BONUS_STONES, MESSAGE, allowed, eligible, grant, claim });
  if(typeof module !== 'undefined' && module.exports) module.exports = api; else root.TaleliaWelcomeBonus = api;
})(typeof window !== 'undefined' ? window : globalThis);
