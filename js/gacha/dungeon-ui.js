/* =====================================================================
 * TALELIA · gacha/dungeon-ui.js — 던전 탭 (E5c · docs/design/e5-gear-dungeon-screen.md · 화면 전용 · 규칙은 js/dungeon/rules.js · 저장 반영은 ui.js 의 commit)
 *
 *  던전 탭: 오늘 남은 횟수 · 초기화까지 · 편성 요약 [편성 바꾸기] · 층 목록(높은 층이 위 · 잠김 / 개방 / 클리어 · 입장 횟수 · 골드 · 드롭) · 전설 확정까지 · [n층 입장]
 *  입장:  DR.enter(횟수 차감) → 저장 + dungeon.open 에 { runId, floor } 기록 → battle.html?dungeon=층&run=runId&savekey…&return=gacha.html?tab=dungeon
 *  결과 반영 (돌아온 주소 &dungeon=층&run=runId&result=win|lose|draw[&again=1]) — 딱 한 번:
 *    1) 저장소에서 다시 읽음 (다른 탭이 먼저 반영했을 수 있음)
 *    2) 이미 반영한 runId(dungeon.runs) 면 지급 없음 ("이미 받은 보상이에요") · open 에 없거나 층이 다르면 반영 안 함 (위조 · 지난 번호)
 *    3) DR.applyResult (골드 · 장비 · cleared · runs · 불운 보정 pity 가 같은 저장 쓰기에서 한 번만 바뀜) → open 에서 지움 → 저장
 *    4) 저장한 뒤 history.replaceState 로 dungeon · run · result · again 을 주소에서 지움
 *    5) again=1 이고 방금 새로 반영했을 때만 같은 층 다시 입장 (새로고침 · 같은 주소 다시 → 다시 입장 안 함)
 *  끝나지 않은 전투(open) = "이어 보기" : 같은 runId = 같은 시드 = 같은 전투 · 같은 보상 (횟수는 다시 안 씀) · 최근 10개
 *  시험용 window.TaleliaDungeonUI = { state, render, select, enter, resume, applyReturn, applyRuns, settle, setNow, setNav, battleUrl, floorList }
 * ===================================================================== */
(function(){
  'use strict';
  const SD = window.TALELIA_STAGE, SX = window.TaleliaStage;   // 던전 개방 조건 (S4): 1-6 첫 클리어 · 던전 기록이 있는 기존 저장은 계속 열림 (js/stage/rules.js dungeonOpen)
  const UI = window.TaleliaGachaUI, G = window.TaleliaGacha, D = window.TALELIA_GACHA, E = window.TALELIA_EQUIP, DGD = window.TALELIA_DUNGEON, DR = window.TaleliaDungeon;
  if(!UI || !E || !DGD || !DR) return;
  const q = new URLSearchParams(location.search);
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const fmt = n => Math.round(n).toLocaleString('ko-KR');
  const RUN_RE = /^\d{4}-\d{2}-\d{2}#\d{3}$/, RESULTS = ['win', 'lose', 'draw'], OPEN_KEEP = 10;
  const RES_NAME = { win: '승리', lose: '패배', draw: '무승부' };
  const S = { floor: 0, notice: null, last: null };
  let clock = () => Date.now(), nav = url => { location.href = url; };
  { const t = Date.parse(q.get('now') || ''); if(isFinite(t)) clock = () => t; }   // 시험용: ?now=2026-11-19T12:00:00 (기기 시계 대신 · 자정 넘김 · 같은 날 runId)

  const dg = save => save.dungeon || {};
  const openList = save => (dg(save).open || []).filter(o => o && RUN_RE.test(o.runId));
  const gradeLabel = it => E.grades[it.grade].name + ' ' + E.slots[it.slot].name;

  /* ---------- 주소 ---------- */
  function battleUrl(floor, runId){
    const key = q.get('savekey'), kq = key ? '&savekey=' + encodeURIComponent(key) : '';
    return 'battle.html?dungeon=' + floor + '&run=' + encodeURIComponent(runId) + kq + '&return=' + encodeURIComponent('gacha.html?tab=dungeon' + kq);
  }
  /** 돌아온 결과 주소 부분만 지움 (저장한 뒤에 부름 · 새로고침 · 뒤로 가기로 같은 주소가 와도 runs 에 있어 다시 지급되지 않음 = 두 겹 보호) */
  function cleanUrl(){
    try{ const u = new URL(location.href); ['dungeon', 'run', 'result', 'again', 'go'].forEach(k => u.searchParams.delete(k)); history.replaceState(null, '', u.pathname.split('/').pop() + u.search + u.hash); }catch(e){}
  }

  /* ---------- 층 · 횟수 ---------- */
  function floorList(save){
    const cleared = dg(save).cleared || 0;
    return DGD.floors.slice().sort((a, b) => b.floor - a.floor).map(fl => ({ fl, open: DR.isOpen(DGD, save, fl.floor), cleared: cleared >= fl.floor }));
  }
  const topOpen = save => { const o = floorList(save).find(x => x.open); return o ? o.fl.floor : 1; };
  function untilReset(now){ const d = new Date(now), next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime(), m = Math.max(0, Math.ceil((next - now) / 60000)); return Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0'); }
  function dropText(fl){
    return Object.keys(fl.drop).sort((a, b) => (E.grades[a] ? E.grades[a].order : 0) - (E.grades[b] ? E.grades[b].order : 0)).map(k => (E.grades[k] ? E.grades[k].name : k) + ' ' + fl.drop[k] + (k === 'legend' ? '%' : '')).join(' · ');
  }
  const powerOf = save => { const M = window.TaleliaGachaManage; return save.party.reduce((s, p) => { const u = save.units.find(x => x.uid === p.uid); return s + (u && M ? M.power(u) : 0); }, 0); };

  /* ---------- 그리기 ---------- */
  const locked = save => !!(SD && SX && !SX.dungeonOpen(SD, save));
  const LOCK_WHY = '1장을 끝내면 던전이 열려요 (1-6 첫 클리어)';
  function enterState(save){
    if(locked(save)) return { ok: false, why: LOCK_WHY };
    const f = S.floor, fl = DR.floorOf(DGD, f), t = DR.daily(DGD, save, clock());
    if(!fl) return { ok: false, why: '층을 골라 주세요' };
    if(!save.party.length) return { ok: false, why: '편성이 비어 있어요 · 편성 탭에서 캐릭터를 넣어 주세요' };
    if(!DR.isOpen(DGD, save, f)) return { ok: false, why: (f - 1) + '층을 먼저 클리어해야 해요' };
    if(t.left < fl.cost) return { ok: false, why: '오늘 남은 횟수가 모자라요 (남은 ' + t.left + ' / 필요 ' + fl.cost + ')' };
    return { ok: true, fl, t };
  }
  function render(){
    const save = UI.save, now = clock(), t = DR.daily(DGD, save, now), list = floorList(save);
    if(!S.floor || !DR.floorOf(DGD, S.floor)) S.floor = topOpen(save);
    const lk = locked(save), lockBox = $('#gcDgLock'); if(lockBox) lockBox.hidden = !lk; { const tb = $('#tabDungeon'); if(tb){ tb.dataset.locked = lk ? '1' : '0'; tb.title = lk ? LOCK_WHY : ''; } }   // 잠금: 탭에 자물쇠 표시 · 안내 상자 · 입장 막힘
    $('#gcDgDaily').innerHTML = '오늘 남은 횟수 <b>' + t.left + ' / ' + t.max + '</b> · 초기화까지 ' + untilReset(now);
    const n = save.party.length, max = D.partyMax || 6;
    $('#gcDgDots').textContent = '●'.repeat(n) + '○'.repeat(Math.max(0, max - n)); $('#gcDgDots').setAttribute('aria-label', '편성 ' + n + ' / ' + max);
    $('#gcDgPower').textContent = n ? '전투력 ' + fmt(powerOf(save)) : '편성 없음';
    // 끝나지 않은 전투 (이어 보기)
    const open = openList(save), ol = $('#gcDgOpen');
    ol.innerHTML = open.map(o => '<li><span>끝나지 않은 전투 · ' + o.floor + '층 <small data-dev-only>' + esc(o.runId) + '</small></span><button type="button" class="gc-btn gc-btn--small" data-resume="' + esc(o.runId) + '">이어 보기</button></li>').join('');
    ol.hidden = !open.length;
    // 층 목록
    $('#gcDgFloors').innerHTML = list.map(({ fl, open: isOpen, cleared }) => {
      const status = !isOpen ? '🔒 ' + (fl.floor - 1) + '층 클리어 필요' : cleared ? '✓ 클리어' : '개방';
      return '<li><button type="button" role="option" class="gc-dgfloor' + (isOpen ? '' : ' is-locked') + (cleared ? ' is-cleared' : '') + '" data-floor="' + fl.floor + '" aria-selected="' + (fl.floor === S.floor) + '">'
        + '<b class="gc-dgfloor__no">' + fl.floor + '층</b><span class="gc-dgfloor__st">' + esc(status) + '</span>'
        + '<span class="gc-dgfloor__info">입장 ' + fl.cost + '회 · ' + fmt(fl.gold) + '골드</span><span class="gc-dgfloor__drop">' + esc(dropText(fl)) + '</span></button></li>';
    }).join('');
    const left = Math.max(0, DGD.pity.after - (dg(save).pity || 0)), fs = DGD.pity.floors;
    $('#gcDgPity').textContent = '전설 확정까지 ' + left + '회 (' + Math.min(...fs) + '~' + Math.max(...fs) + '층)';
    const st = enterState(save), fl = DR.floorOf(DGD, S.floor), btn = $('#gcDgEnter');
    btn.textContent = S.floor + '층 입장 (−' + (fl ? fl.cost : 0) + '회)'; btn.disabled = !st.ok; $('#gcDgWhy').textContent = st.ok ? '' : st.why;
    renderNotice();
  }
  function renderNotice(){
    const n = S.notice, box = $('#gcDgNotice');
    box.hidden = !n; if(!n) return;
    $('#gcDgNoticeText').textContent = n.text;
    const b = $('#gcDgNoticeGear'); b.hidden = !n.iid || !UI.save.items.some(i => i.iid === n.iid); b.dataset.iid = n.iid || '';
  }
  function select(f){ if(!DR.floorOf(DGD, f)) return false; S.floor = f; render(); return true; }
  $('#gcDgFloors').addEventListener('click', e => { const b = e.target.closest('[data-floor]'); if(b) select(+b.dataset.floor); });
  $('#gcDgOpen').addEventListener('click', e => { const b = e.target.closest('[data-resume]'); if(b) resume(b.dataset.resume); });
  $('#gcDgEnter').addEventListener('click', () => enter(S.floor));
  $('#gcDgParty').addEventListener('click', () => UI.tab('party'));
  if($('#gcDgLockGo')) $('#gcDgLockGo').addEventListener('click', () => { const k = q.get('savekey'); nav('stage.html' + (k ? '?savekey=' + encodeURIComponent(k) : '')); });
  $('#gcDgNoticeGear').addEventListener('click', e => {
    const iid = e.currentTarget.dataset.iid, GU = window.TaleliaGearUI; if(!iid || !GU) return;
    UI.tab('gear'); GU.openSheet(iid);
  });

  /* ---------- 입장 · 이어 보기 ---------- */
  /** 입장: 저장소에서 다시 읽고(다른 탭 반영) → 횟수 차감 + open 기록 → 저장 → 전투 화면 */
  function enter(floor){
    const cur = UI.reload();
    if(locked(cur)){ UI.toast(LOCK_WHY); return { ok: false, reason: LOCK_WHY }; }
    if(!cur.party.length){ UI.toast('편성이 비어 있어요'); return { ok: false, reason: '편성이 비어 있어요' }; }
    const e = DR.enter(DGD, cur, floor, clock());
    if(!e.ok){ UI.toast(e.reason); render(); return e; }
    const s = e.save; s.dungeon.open = openList(s).concat({ runId: e.runId, floor }).slice(-OPEN_KEEP);
    UI.commit(s);
    const url = battleUrl(floor, e.runId); S.last = { kind: 'enter', floor, runId: e.runId, url }; nav(url);
    return Object.assign({}, e, { url });
  }
  function resume(runId){
    if(locked(UI.reload())){ UI.toast(LOCK_WHY); return { ok: false, reason: LOCK_WHY }; }
    const o = openList(UI.reload()).find(x => x.runId === runId); if(!o){ UI.toast('이어 볼 전투를 찾지 못했어요'); render(); return { ok: false }; }
    const url = battleUrl(o.floor, o.runId); S.last = { kind: 'resume', floor: o.floor, runId: o.runId, url }; nav(url);
    return { ok: true, url };
  }

  /* ---------- 결과 반영 (runId 로 딱 한 번) ---------- */
  /** 저장 1개 + 결과 1개 → { status: 'applied' | 'duplicate' | 'rejected', save?, reward? } (저장은 바꾸지 않음 · 순수) */
  function settle(save, run){
    const runs = dg(save).runs || [];
    if(!run || !RUN_RE.test(run.runId || '') || !Number.isInteger(run.floor) || !RESULTS.includes(run.result)) return { status: 'rejected', reason: '전투 번호나 결과가 잘못됐어요' };
    if(runs.includes(run.runId)) return { status: 'duplicate' };
    const rec = openList(save).find(o => o.runId === run.runId && o.floor === run.floor);
    if(!rec) return { status: 'rejected', reason: '입장 기록에 없는 전투예요' };
    const a = DR.applyResult(DGD, E, save, { runId: run.runId, floor: run.floor, result: run.result, seed: DR.seedOf(run.runId) });
    if(!a.ok) return a.duplicate ? { status: 'duplicate' } : { status: 'rejected', reason: a.reason };
    const s = a.save; s.dungeon.open = openList(s).filter(o => o.runId !== run.runId);
    return { status: 'applied', save: s, reward: a.reward, result: run.result, floor: run.floor, runId: run.runId };
  }
  /** 여러 개를 입장 순서(runId 순)로 반영 → 불운 보정 카운터 · 전설 확정 판정이 순서대로 쌓임 (한 번의 저장) */
  function applyRuns(list){
    let s = UI.reload(), changed = false; const out = [];
    for(const run of list.slice().sort((a, b) => String(a.runId) < String(b.runId) ? -1 : String(a.runId) > String(b.runId) ? 1 : 0)){
      const r = settle(s, run); out.push(Object.assign({ runId: run.runId }, r.status === 'applied' ? { status: r.status, reward: r.reward, result: r.result } : r));
      if(r.status === 'applied'){ s = r.save; changed = true; }
    }
    if(changed) UI.commit(s);
    return out;
  }
  function noticeFor(r){
    const nm = RES_NAME[r.result] || '';
    if(r.result === 'win' && r.reward){ const it = r.reward.item; return { text: r.floor + '층 ' + nm + ' · +' + fmt(r.reward.gold) + '골드 · ' + gradeLabel(it) + (r.reward.tstones ? ' · 초월석 +' + r.reward.tstones : '') + (r.reward.pityHit ? ' (불운 보정으로 전설 확정)' : ''), iid: r.reward.iid }; }
    return { text: r.floor + '층 ' + nm + ' · 보상 없음' };
  }
  /** 전투 화면에서 돌아온 주소 처리 · 반환 = { status, again? } */
  function applyReturn(p){
    const run = { runId: p.run, floor: +p.dungeon, result: p.result }, out = { status: 'none', again: false };
    if(p.result === 'error'){ S.notice = { text: '전투를 시작하지 못했어요 · 끝나지 않은 전투에서 이어 볼 수 있어요' }; out.status = 'error'; cleanUrl(); render(); return out; }
    const r = applyRuns([run])[0]; out.status = r.status; out.reward = r.reward || null;
    if(r.status === 'applied'){ S.notice = noticeFor({ result: r.result, floor: run.floor, reward: r.reward }); }
    else if(r.status === 'duplicate'){ S.notice = { text: '이미 받은 보상이에요 (' + run.floor + '층 · 다시 지급되지 않아요)' }; }
    else { S.notice = { text: '확인되지 않은 전투라 반영하지 않았어요' }; }
    cleanUrl();   // 저장한 뒤에 주소 정리 (applyRuns 가 이미 저장함)
    UI.tab('dungeon'); render();
    if(r.status === 'applied' && p.again === '1'){   // 방금 새로 반영했을 때만 다시 도전 (같은 주소가 다시 와도 입장 두 번 안 함)
      const e = enter(run.floor);
      out.again = !!e.ok;
      if(!e.ok){ S.notice = { text: S.notice.text + ' · 다시 도전하지 못했어요: ' + (e.reason || '입장 실패'), iid: S.notice.iid }; render(); }
    }
    S.last = Object.assign({}, S.last || {}, { kind: S.last && S.last.kind || 'return', ret: out });
    return out;
  }

  /* ---------- 연결 ---------- */
  UI.hooks.renderDungeon = render;
  setInterval(() => { if(UI.state.tab === 'dungeon') render(); }, 30000);   // 초기화까지 · 자정 넘김 갱신
  window.TaleliaDungeonUI = { state: S, render, select, enter, resume, applyReturn, applyRuns, settle, battleUrl, floorList: () => floorList(UI.save), enterState: () => enterState(UI.save),
    setNow: fn => { clock = fn; render(); }, setNav: fn => { nav = fn; } };
  if(q.get('dungeon') && q.get('run') && q.get('result')){
    const goTown = q.get('go') === 'town', r = applyReturn({ dungeon: q.get('dungeon'), run: q.get('run'), result: q.get('result'), again: q.get('again') });
    // 전투 결과 [마을로] (H4): 결과를 한 번 반영한 뒤 마을로 · 반영하지 못한 결과는 알림을 보여 주고 머무름
    if(goTown && r && (r.status === 'applied' || r.status === 'duplicate')){ const k = q.get('savekey'); nav('town.html' + (k ? '?savekey=' + encodeURIComponent(k) : '')); }
  }
  else if(q.get('tab') === 'dungeon'){ UI.tab('dungeon'); }
})();
