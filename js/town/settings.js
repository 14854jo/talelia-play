/* =====================================================================
 * TALELIA · town/settings.js — 마을 [설정]: 저장 백업 · 저장 불러오기 · 처음부터 다시 (지인 배포 3단계 · 재화 지급 기능 없음)
 *
 *  - 설정을 여는 것만으로는 저장을 쓰지 않음 · 쓰는 것은 [덮어쓰기] 와 [지우고 처음부터] 를 눌렀을 때뿐
 *  - 저장 규칙 = js/save-backup.js · 창 = js/ui.js 의 하단 시트 · ?savekey 가 있으면 그 키를 씀
 *  - 불러온 뒤 = 마을을 다시 열어 반영 · 처음부터 다시 = 프롤로그(story.html?scene=prologue_01)로 · 프롤로그 중간 저장(talelia.story.progress)도 지움
 *  시험용 window.TaleliaTownSettings = { open, choose(text), download(), key, setNav, setDownload, setStorage }
 * ===================================================================== */
(function(){
  'use strict';
  const B = window.TaleliaSaveBackup, U = window.TaleliaUI, G = window.TaleliaGacha, D = window.TALELIA_GACHA;
  const btn = document.getElementById('townSettings'), file = document.getElementById('townSaveFile');
  if(!B || !U || !G || !D || !btn || !file) return;
  const q = new URLSearchParams(location.search), param = q.get('savekey');
  const KEY = param || window.TaleliaGachaStore.KEY;
  const kq = param ? 'savekey=' + encodeURIComponent(param) : '';
  const NOTICE = '테스트 버전이라 저장이 사라질 수 있어요. 브라우저 데이터를 지우거나 다른 기기·브라우저로 접속하면 이어서 할 수 없으니, 가끔 [저장 백업]을 해 주세요.';
  let storage = null; try{ storage = window.localStorage; }catch(e){}
  let nav = url => { location.href = url; };
  let save = (name, text) => {   // 파일로 내려받기
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' })), a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };
  let message = '';

  const say = (text, isBad) => { const el = document.querySelector('.town-set__msg'); message = text; if(el){ el.textContent = text; el.classList.toggle('is-bad', !!isBad); } };

  function open(){
    U.sheet('설정',
      '<p class="town-set__notice">' + U.esc(NOTICE) + '</p>'
      + '<div class="town-set__list">'
      + '<button type="button" class="tl-btn is-gold" data-set="backup">저장 백업</button>'
      + '<button type="button" class="tl-btn" data-set="load">저장 불러오기</button>'
      + '<button type="button" class="tl-btn town-set__danger" data-set="reset">처음부터 다시</button>'
      + '</div><p class="town-set__msg" role="status" aria-live="polite"></p>');
    message = '';
    document.querySelector('.town-set__list').addEventListener('click', e => {
      const b = e.target.closest('[data-set]'); if(!b) return;
      if(b.dataset.set === 'backup') download();
      else if(b.dataset.set === 'load'){ file.value = ''; file.click(); }
      else askReset();
    });
  }
  function download(){
    const text = storage && B.read(storage, KEY);
    if(text == null){ say('아직 백업할 저장이 없어요.', true); return { ok: false }; }
    const name = B.fileName();
    try{ save(name, text); }catch(e){ say('이 브라우저에서는 파일을 내려받지 못했어요.', true); return { ok: false }; }
    say('백업 파일을 내려받아요: ' + name);
    return { ok: true, name };
  }
  /** 고른 파일의 글을 검사 → 괜찮으면 덮어쓰기 확인창 (아직 아무것도 쓰지 않음) */
  function choose(text){
    const r = B.inspect({ G, D, Q: window.TaleliaGear, E: window.TALELIA_EQUIP }, text);
    if(!r.ok){ if(!document.querySelector('.town-set__msg')) open(); say(r.reason + ' 지금 저장은 그대로예요.', true); return r; }
    const s = r.summary;
    U.sheet('저장을 덮어쓸까요?',
      '<p class="town-info__desc">지금 저장이 고른 백업 파일의 내용으로 바뀌어요.</p>'
      + '<dl class="tl-dl"><dt>클리어</dt><dd>' + U.esc(s.cleared.length ? s.cleared[s.cleared.length - 1] + ' 까지' : '아직 없음') + '</dd><dt>동료</dt><dd>' + s.units + '명</dd><dt>정령석</dt><dd>' + U.num(s.stones) + '</dd></dl>',
      [{ label: '그만두기', run: open }, { label: '덮어쓰기', kind: 'is-gold', run: () => {
        const w = storage ? B.restore(storage, KEY, r.save) : { ok: false, reason: '저장 공간을 쓸 수 없어요.' };
        if(!w.ok){ open(); say(w.reason + ' 지금 저장은 그대로예요.', true); return; }
        nav('town.html' + (kq ? '?' + kq : ''));
      } }]);
    return r;
  }
  function askReset(){
    U.sheet('처음부터 다시 할까요?',
      '<p class="town-info__desc">저장을 지우고 프롤로그부터 시작해요. <b>되돌릴 수 없어요.</b></p><p class="tl-muted">남겨 두고 싶으면 먼저 [저장 백업]을 해 주세요.</p>',
      [{ label: '그만두기', run: open }, { label: '지우고 처음부터', kind: 'town-set__danger', run: () => {
        const r = storage ? B.reset(storage, KEY) : { ok: false, reason: '저장 공간을 쓸 수 없어요.' };
        if(!r.ok){ open(); say(r.reason, true); return; }
        try{ ['talelia.story.battle', 'talelia.story.stage'].forEach(k => sessionStorage.removeItem(k)); }catch(e){}   // 이야기가 잠깐 들고 있던 전투 정보
        if(window.TaleliaProgress) window.TaleliaProgress.clear(param, storage || undefined);   // 프롤로그 중간 저장
        nav('story.html?scene=prologue_01' + (kq ? '&' + kq : ''));
      } }]);
  }

  btn.addEventListener('click', open);
  file.addEventListener('change', () => {
    const f = file.files && file.files[0]; if(!f) return;
    if(f.size > B.MAX_CHARS * 3){ say('파일이 너무 커요. 지금 저장은 그대로예요.', true); return; }
    f.text().then(choose, () => say('파일을 읽지 못했어요. 지금 저장은 그대로예요.', true));
  });

  window.TaleliaTownSettings = { open, choose, download, key: KEY, notice: NOTICE, get message(){ return message; },
    setNav: fn => { nav = fn; }, setDownload: fn => { save = fn; }, setStorage: s => { storage = s; } };
})();
