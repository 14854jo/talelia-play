/* =====================================================================
 * TALELIA · gacha/gear-ui.js — 장비 탭 (E5a · docs/design/e5-gear-dungeon-screen.md · 화면 전용 · 규칙은 gear.js · 저장 반영은 ui.js 의 commit)
 *
 *  장비 탭: 부위 · 등급으로 걸러 보기 · 정렬 · 4열(휴대폰 3열) 카드 (등급 색 테두리 · 강화 · 세트 문장 · 잠금 · 착용자)
 *   카드 누름 → 장비 시트: 능력치 지금 → 다음 단계 · 5강 보너스 · 세트 · 강화(성공률 · 비용 · 실패해도 단계 유지) · 잠금 · 분해
 *   [분해 고르기] (아래 고정 띠): 카드 여러 개 · 일반 / 고급 / 영웅은 등급 버튼으로 한꺼번에 (전설은 하나씩만) → 확인창 "분해 n개 · 제외 m개(장착 · 잠금) · +골드"
 *  E5b: 상세의 장착 칸 3개 · 장비 고르기(같은 부위 · 옮겨 오기 · 빼기) · 장비 시트의 [장착할 캐릭터 고르기] · 세트 줄 (renderSlots 를 manage.js 상세가 부름)
 *  아이콘은 임시 (부위 글자 · 세트 첫 글자)
 *  시험용 window.TaleliaGearUI = { state, render, openSheet, closeSheet, enhance, toggleLock, startDismantle, stopDismantle, pick, pickGrade, askDismantle, answer, setFilter, setSort, setRng }
 * ===================================================================== */
(function(){
  'use strict';
  const UI = window.TaleliaGachaUI, G = window.TaleliaGacha, E = window.TALELIA_EQUIP, Q = window.TaleliaGear, D = window.TALELIA_GACHA;
  if(!UI || !E || !Q) return;
  const $ = s => document.querySelector(s), $$ = s => Array.from(document.querySelectorAll(s));
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const fmt = n => Math.round(n).toLocaleString('ko-KR');
  const n1 = v => String(Math.round(v * 10) / 10);
  let rnd = G.rng(((UI.seed >>> 0) ^ 0x9e3779b9) >>> 0 || 5);

  const SLOT_MARK = { weapon: '무', armor: '방', accessory: '장' };   // 그림(icon_*.webp)을 못 불러올 때 대신 보이는 글자
  const iconImg = slot => '<img src="images/items/icon_' + slot + '.webp" alt="" draggable="false" decoding="async" data-letter="' + SLOT_MARK[slot] + '">';
  const setImg = k => '<img src="images/items/set_' + esc(k) + '.webp" alt="" draggable="false" decoding="async" data-letter="' + esc(setName(k)[0]) + '">';   // 세트 문장 (실패하면 첫 글자)
  const STAT_NAME = { hp: '체력', atk: '공격', def: '방어', spd: '속도', eff: '효과 적중', res: '효과 저항' };
  const GRADES = Object.keys(E.grades).sort((a, b) => E.grades[a].order - E.grades[b].order);
  const gOrder = it => E.grades[it.grade].order, slotIdx = it => E.slotOrder.indexOf(it.slot);
  const gName = it => E.grades[it.grade].name + ' ' + E.slots[it.slot].name;
  const setName = k => E.sets[k] ? E.sets[k].name : k;
  const GS = { slot: 'all', grade: 'all', sort: 'grade', sheet: null, msg: '', mode: false, picked: new Set(), opener: null, ask: null };

  const items = () => UI.save.items || [];
  const itemOf = iid => items().find(x => x.iid === iid) || null;
  const ownerOf = iid => Q.ownerOf(UI.save, iid);
  const unitName = u => D.species[u.species] ? D.species[u.species].name : u.species;

  /* ---------- 걸러 보기 · 정렬 ---------- */
  const SORT = {
    grade: (a, b) => gOrder(b) - gOrder(a) || b.enh - a.enh || slotIdx(a) - slotIdx(b) || b.got - a.got,
    enh: (a, b) => b.enh - a.enh || gOrder(b) - gOrder(a) || b.got - a.got,
    recent: (a, b) => b.got - a.got,
    slot: (a, b) => slotIdx(a) - slotIdx(b) || gOrder(b) - gOrder(a) || b.enh - a.enh || b.got - a.got
  };
  function visible(){
    return items().filter(it => (GS.slot === 'all' || it.slot === GS.slot) && (GS.grade === 'all' || it.grade === GS.grade)).sort(SORT[GS.sort] || SORT.grade);
  }
  function buildFilters(){
    const fs = $('#gcGearSlot'), fg = $('#gcGearGrade');
    if(!fs.children.length){
      fs.innerHTML = [['all', '전체']].concat(E.slotOrder.map(s => [s, E.slots[s].name])).map(([k, n]) => '<button type="button" data-slot="' + k + '" aria-pressed="false">' + esc(n) + '</button>').join('');
      fs.addEventListener('click', e => { const b = e.target.closest('button'); if(b) setFilter('slot', b.dataset.slot); });
      fg.innerHTML = [['all', '전체']].concat(GRADES.map(g => [g, E.grades[g].name])).map(([k, n]) => '<button type="button" data-grade="' + k + '" aria-pressed="false">' + esc(n) + '</button>').join('');
      fg.addEventListener('click', e => { const b = e.target.closest('button'); if(b) setFilter('grade', b.dataset.grade); });
    }
    for(const b of fs.children) b.setAttribute('aria-pressed', String(b.dataset.slot === GS.slot));
    for(const b of fg.children) b.setAttribute('aria-pressed', String(b.dataset.grade === GS.grade));
    $('#gcGearSort').value = GS.sort;
  }
  function setFilter(kind, v){ if(kind === 'slot') GS.slot = v; else GS.grade = v; render(); }
  function setSort(v){ if(SORT[v]){ GS.sort = v; render(); } }
  $('#gcGearSort').addEventListener('change', e => setSort(e.target.value));

  /* ---------- 목록 ---------- */
  function cardHTML(it){
    const o = ownerOf(it.iid), mark = it.set ? '<span class="gc-gear__set" data-set="' + esc(it.set) + '" title="' + esc(setName(it.set)) + ' 세트">' + setImg(it.set) + '</span>' : '';
    return '<button type="button" class="gc-gear g-' + it.grade + (GS.picked.has(it.iid) ? ' is-picked' : '') + (it.lock ? ' is-locked' : '') + '" data-iid="' + it.iid + '" data-slot="' + it.slot + '"'
      + (GS.mode ? ' aria-pressed="' + GS.picked.has(it.iid) + '"' : '')
      + ' aria-label="' + esc(gName(it) + (it.enh ? ' ' + it.enh + '강' : '') + (it.set ? ' ' + setName(it.set) + ' 세트' : '') + (it.lock ? ' 잠금' : '') + (o ? ' ' + unitName(o) + ' 착용' : '')) + '">'
      + '<span class="gc-gear__slot" aria-hidden="true">' + iconImg(it.slot) + '</span>'
      + '<span class="gc-gear__grade" aria-hidden="true">' + esc(E.grades[it.grade].name) + '</span>'
      + (it.enh ? '<span class="gc-gear__enh" aria-hidden="true">+' + it.enh + '</span>' : '')
      + (it.lock ? '<span class="gc-gear__lock" aria-hidden="true">🔒</span>' : '')
      + mark
      + (o ? '<span class="gc-gear__owner" aria-hidden="true" title="' + esc(unitName(o)) + '">' + esc(unitName(o)[0]) + '</span>' : '')
      + (GS.picked.has(it.iid) ? '<span class="gc-gear__check" aria-hidden="true">✓</span>' : '')
      + '</button>';
  }
  function render(){
    buildFilters();
    for(const iid of [...GS.picked]) if(!itemOf(iid)) GS.picked.delete(iid);
    const list = visible(), all = items(), worn = all.filter(it => ownerOf(it.iid)).length;
    $('#gcGearList').innerHTML = list.map(cardHTML).join('');
    $('#gcGearCount').textContent = '보유 ' + all.length + ' / 장착 ' + worn + (list.length !== all.length ? ' · 보이는 장비 ' + list.length + '개' : '');
    const empty = $('#gcGearEmpty'); empty.hidden = !!list.length;
    empty.textContent = all.length ? '조건에 맞는 장비가 없어요.' : '장비가 없어요. 던전에서 얻을 수 있어요 (1장을 끝내면 열려요).';
    renderBar();
    $('#panelGear').classList.toggle('is-dismantle', GS.mode);
    if(GS.sheet){ if(itemOf(GS.sheet)) renderSheet(); else closeSheet(true); }
  }
  $('#gcGearList').addEventListener('click', e => {
    const c = e.target.closest('.gc-gear[data-iid]'); if(!c) return;
    if(GS.mode) pick(c.dataset.iid); else openSheet(c.dataset.iid);
  });

  /* ---------- 분해 고르기 ---------- */
  const plan = iids => { const go = [], skip = { equipped: 0, locked: 0 }; let gold = 0;
    for(const iid of iids){ const it = itemOf(iid); if(!it) continue; if(ownerOf(iid)) skip.equipped++; else if(it.lock) skip.locked++; else { go.push(iid); gold += E.grades[it.grade].dismantle; } }
    return { go, skip, skipped: skip.equipped + skip.locked, gold }; };
  function renderBar(){
    const bar = $('#gcGearBar');
    if(!GS.mode){
      bar.innerHTML = '<button type="button" class="gc-btn gc-btn--small" data-bar="start"' + (items().length ? '' : ' disabled') + '>분해 고르기</button>';
      return;
    }
    const p = plan([...GS.picked]);
    bar.innerHTML = '<p class="gc-gearbar__sum" role="status">' + GS.picked.size + '개 고름 · 분해 ' + p.go.length + '개 +' + fmt(p.gold) + '골드' + (p.skipped ? ' · 제외 ' + p.skipped + '개(장착 · 잠금)' : '') + '</p>'
      + '<div class="gc-gearbar__row">'
      + GRADES.filter(g => !E.grades[g].hasSet).map(g => '<button type="button" class="gc-btn gc-btn--small" data-bar="grade" data-grade="' + g + '">' + esc(E.grades[g].name) + ' 모두</button>').join('')
      + '<button type="button" class="gc-btn gc-btn--small gc-btn--danger" data-bar="go"' + (GS.picked.size ? '' : ' disabled') + '>분해하기</button>'
      + '<button type="button" class="gc-btn gc-btn--small" data-bar="stop">그만</button></div>'
      + '<p class="gc-hint">전설은 한꺼번에 고를 수 없어요 · 카드를 하나씩 눌러 주세요</p>';
  }
  $('#gcGearBar').addEventListener('click', e => {
    const b = e.target.closest('[data-bar]'); if(!b || b.disabled) return;
    if(b.dataset.bar === 'start') startDismantle();
    else if(b.dataset.bar === 'stop') stopDismantle();
    else if(b.dataset.bar === 'grade') pickGrade(b.dataset.grade);
    else if(b.dataset.bar === 'go') askDismantle([...GS.picked]);
  });
  function startDismantle(){ closeSheet(true); GS.mode = true; GS.picked.clear(); render(); return true; }
  function stopDismantle(){ GS.mode = false; GS.picked.clear(); render(); }
  function pick(iid){ if(!GS.mode || !itemOf(iid)) return false; if(GS.picked.has(iid)) GS.picked.delete(iid); else GS.picked.add(iid); render(); return true; }
  /** 등급 버튼: 그 등급 전부 고름 (이미 다 골랐으면 모두 뺌) · 전설은 막음 · 장착 · 잠금은 골라도 확인창에서 제외 */
  function pickGrade(g){
    if(!GS.mode || !E.grades[g] || E.grades[g].hasSet) return false;
    const ids = items().filter(it => it.grade === g).map(it => it.iid), all = ids.length && ids.every(i => GS.picked.has(i));
    for(const i of ids) all ? GS.picked.delete(i) : GS.picked.add(i);
    render(); return true;
  }

  /* ---------- 분해 확인 ---------- */
  const cf = $('#gcGearConfirm');
  function askDismantle(iids){
    const r = Q.dismantle(E, UI.save, iids), p = plan(iids), legend = p.go.filter(i => itemOf(i).grade === 'legend').length;
    GS.ask = { iids: iids.slice(), r };
    const names = p.go.map(i => { const it = itemOf(i); return '<li>' + esc(gName(it)) + (it.enh ? ' +' + it.enh : '') + '</li>'; });
    $('#gcGcBody').innerHTML = (r.ok ? '<p><b>분해 ' + r.count + '개</b> → <b>+' + fmt(r.gold) + '골드</b></p>' : '<p><b>분해할 수 있는 장비가 없어요</b></p>')
      + (p.skipped ? '<p class="gc-gc__skip">제외 ' + p.skipped + '개 (장착 ' + p.skip.equipped + ' · 잠금 ' + p.skip.locked + ')</p>' : '')
      + (legend ? '<p class="gc-gc__warn">전설 장비 ' + legend + '개가 들어 있어요. 분해하면 되돌릴 수 없어요.</p>' : '')
      + (names.length ? '<ul class="gc-gc__list">' + names.slice(0, 8).join('') + (names.length > 8 ? '<li>… 외 ' + (names.length - 8) + '개</li>' : '') + '</ul>' : '');
    $('#gcGcYes').disabled = !r.ok; GS.askOpener = document.activeElement;
    cf.hidden = false; $('#gcGcNo').focus({ preventScroll: true });
    return r;
  }
  function answer(yes){
    const a = GS.ask; cf.hidden = true; GS.ask = null;
    if(GS.askOpener && document.contains(GS.askOpener)) GS.askOpener.focus({ preventScroll: true });
    if(!yes || !a) return null;
    const r = Q.dismantle(E, UI.save, a.iids);
    if(!r.ok){ UI.toast(r.reason); return r; }
    UI.commit(r.save);
    GS.picked.clear(); GS.mode = false; closeSheet(true); render();
    UI.toast(r.message + ' · +' + fmt(r.gold) + '골드');
    return r;
  }
  $('#gcGcYes').addEventListener('click', () => answer(true));
  $('#gcGcNo').addEventListener('click', () => answer(false));
  cf.addEventListener('click', e => { if(e.target === cf) answer(false); });

  /* ---------- 장비 시트 ---------- */
  const sheet = $('#gcGearSheet'), sbox = sheet.querySelector('.gc-gs');
  function effectText(k){
    const s = E.sets[k], parts = [];
    for(const [st, v] of Object.entries(s.pct || {})) parts.push(STAT_NAME[st] + ' +' + Math.round(v * 100) + '%');
    for(const [st, v] of Object.entries(s.add || {})) if(v) parts.push(STAT_NAME[st] + ' +' + v);
    return parts.length ? parts.join(' · ') : '효과 준비 중';
  }
  function statRows(it){
    const now = Q.itemStats(E, it), next = it.enh < E.maxEnh ? Q.itemStats(E, Object.assign({}, it, { enh: it.enh + 1 })) : null;
    return ['atk', 'def', 'hp'].filter(st => now[st] > 0).map(st => '<tr><th scope="row">' + STAT_NAME[st] + '</th><td>' + n1(now[st]) + '</td><td class="gc-gs__next">'
      + (next ? '→ ' + n1(next[st]) : '최대') + '</td></tr>').join('');
  }
  function bonusText(it){
    const g = E.grades[it.grade], val = st => n1(E.benchmark[st] * g.bonus);
    if(it.bonus) return '5강 보너스: ' + STAT_NAME[it.bonus.stat] + ' +' + val(it.bonus.stat);
    return '5강이 되면 ' + E.bonusStats.map(st => STAT_NAME[st] + ' +' + val(st)).join(' · ') + ' 중 하나가 더해져요';
  }
  function renderSheet(){
    const it = itemOf(GS.sheet); if(!it) return;
    const o = ownerOf(it.iid), maxed = it.enh >= E.maxEnh, cost = Q.upgradeCost(E, it), rate = Q.upgradeRate(E, it), gold = UI.save.gold || 0, g = E.grades[it.grade];
    const noGold = !maxed && gold < cost, blocked = o ? '착용 중인 장비는 분해할 수 없어요' : it.lock ? '잠긴 장비는 분해할 수 없어요' : '';
    const setN = it.set && o ? Q.gearOf(UI.save, o).filter(x => x.set === it.set).length : 0;
    sbox.className = 'gc-sheet__box gc-gs g-' + it.grade;
    sbox.innerHTML = '<header><h2 id="gcGsTitle"><span class="gc-gs__ico" aria-hidden="true">' + iconImg(it.slot) + '</span><span class="gc-gs__grade">' + esc(g.name) + '</span> ' + esc(E.slots[it.slot].name) + (it.enh ? ' <b>+' + it.enh + '</b>' : '') + '</h2>'
      + '<button type="button" class="gc-btn gc-btn--small" data-gs="close" aria-label="닫기">닫기</button></header>'
      + '<p class="gc-gs__owner">' + (o ? '착용: ' + esc(unitName(o)) : '착용 안 함') + (it.lock ? ' · 🔒 잠금' : '') + '</p>'
      + '<table class="gc-gs__stats" aria-label="능력치"><thead><tr><th></th><th>지금</th><th>다음 단계</th></tr></thead><tbody>' + statRows(it) + '</tbody></table>'
      + '<p class="gc-gs__bonus">' + esc(bonusText(it)) + '</p>'
      + (it.set ? '<p class="gc-gs__set"><b>' + esc(setName(it.set)) + ' 세트</b> · ' + E.setPieces + '부위를 같은 캐릭터가 끼면 ' + esc(effectText(it.set)) + ' · 지금 ' + setN + ' / ' + E.setPieces + '부위</p>' : '')
      + '<div class="gc-gs__enh">' + (maxed ? '<p>최대 강화예요 (' + E.maxEnh + '강)</p>'
        : '<p>' + it.enh + '강 → ' + (it.enh + 1) + '강 · 성공률 <b>' + Math.round(rate * 100) + '%</b> · 골드 <b>' + fmt(cost) + '</b><br><small>실패해도 단계는 그대로예요 (골드는 써요)</small></p>'
          + '<button type="button" class="gc-btn gc-btn--primary" data-gs="enhance"' + (noGold ? ' disabled' : '') + '>강화 · ' + fmt(cost) + '골드</button>'
          + (noGold ? '<p class="gc-gs__why" role="note">골드가 모자라요 (있음 ' + fmt(gold) + ')</p>' : '')) + '</div>'
      + '<p class="gc-gs__result" id="gcGsResult" role="status" aria-live="polite">' + esc(GS.msg) + '</p>'
      + '<div class="gc-gs__btns"><button type="button" class="gc-btn gc-btn--small gc-btn--primary" data-gs="equip">' + (o ? '다른 캐릭터에게' : '장착할 캐릭터 고르기') + '</button>'
      + (o ? '<button type="button" class="gc-btn gc-btn--small" data-gs="unequip">빼기</button>' : '') + '</div>'
      + '<div class="gc-gs__btns"><button type="button" class="gc-btn gc-btn--small" data-gs="lock" aria-pressed="' + !!it.lock + '">' + (it.lock ? '🔒 잠금 풀기' : '잠금') + '</button>'
      + '<button type="button" class="gc-btn gc-btn--small gc-btn--danger" data-gs="dismantle"' + (blocked ? ' disabled' : '') + '>분해 +' + g.dismantle + '골드</button></div>'
      + (blocked ? '<p class="gc-gs__why" role="note">' + blocked + '</p>' : '');
  }
  function openSheet(iid){
    if(!itemOf(iid)) return false;
    if(GS.sheet !== iid) GS.msg = '';
    GS.sheet = iid; GS.opener = GS.opener || document.activeElement; renderSheet(); sheet.hidden = false;
    const b = sbox.querySelector('[data-gs="close"]'); if(b) b.focus({ preventScroll: true });
    return true;
  }
  function closeSheet(quiet){
    if(sheet.hidden && !GS.sheet) return;
    sheet.hidden = true; GS.sheet = null; GS.msg = '';
    const op = GS.opener; GS.opener = null;
    if(!quiet && op && document.contains(op)) op.focus({ preventScroll: true });
  }
  sheet.addEventListener('click', e => {
    if(e.target === sheet){ closeSheet(); return; }
    const b = e.target.closest('[data-gs]'); if(!b || b.disabled || !GS.sheet) return;
    const k = b.dataset.gs;
    if(k === 'close') closeSheet(); else if(k === 'enhance') enhance(GS.sheet); else if(k === 'lock') toggleLock(GS.sheet); else if(k === 'dismantle') askDismantle([GS.sheet]); else if(k === 'equip') openUnitPicker(GS.sheet); else if(k === 'unequip') unequipItem(GS.sheet);
  });
  document.addEventListener('keydown', e => {
    if(e.key !== 'Escape') return;
    if(!cf.hidden){ e.preventDefault(); answer(false); }
    else if(!pk.hidden){ e.preventDefault(); closePicker(); }
    else if(!sheet.hidden){ e.preventDefault(); closeSheet(); }
    else if(GS.mode && UI.state.tab === 'gear'){ e.preventDefault(); stopDismantle(); }
  });

  /* ---------- 강화 · 잠금 ---------- */
  function enhance(iid){
    const r = Q.enhance(E, UI.save, iid, rnd);
    if(!r.ok){ GS.msg = r.reason; if(GS.sheet) renderSheet(); UI.toast(r.reason); return r; }
    GS.msg = r.success ? '강화 성공! +' + r.before + ' → +' + r.after + ' (−' + fmt(r.cost) + '골드)' + (r.bonus ? ' · 5강 보너스: ' + STAT_NAME[r.bonus.stat] + ' +' + n1(E.benchmark[r.bonus.stat] * E.grades[itemOf(iid).grade].bonus) : '')
      : '강화 실패 (+' + r.before + ' 그대로 · −' + fmt(r.cost) + '골드)';
    UI.commit(r.save); render();
    return r;
  }
  function toggleLock(iid){
    const it = itemOf(iid); if(!it) return { ok: false };
    const r = Q.setLock(E, UI.save, iid, !it.lock); if(!r.ok) return r;
    UI.commit(r.save); render(); return r;
  }

  /* ---------- E5b: 장착 · 옮겨 오기 · 빼기 (캐릭터 상세의 칸 · 장비 시트의 [장착할 캐릭터 고르기]) ---------- */
  const unitOf = uid => UI.save.units.find(u => u.uid === uid) || null;
  const statText = it => { const st = Q.itemStats(E, it); return ['atk', 'def', 'hp'].filter(k => st[k] > 0).map(k => STAT_NAME[k] + ' +' + n1(st[k])).join(' · '); };
  const itemLabel = it => gName(it) + (it.enh ? ' +' + it.enh : '');
  const pk = $('#gcGearPick'), pbox = pk.querySelector('.gc-pk');
  const PK = { kind: null, uid: null, slot: null, iid: null, opener: null };
  function equipItem(uid, iid){
    const u = unitOf(uid), it = itemOf(iid); if(!u || !it) return { ok: false, reason: '없는 캐릭터 또는 장비' };
    const prevOwner = ownerOf(iid), had = (u.gear || {})[it.slot] ? itemOf(u.gear[it.slot]) : null;
    const r = Q.equip(E, D, UI.save, uid, iid); if(!r.ok){ UI.toast(r.reason); return r; }
    UI.commit(r.save);
    UI.toast(unitName(u) + ' ← ' + itemLabel(it) + (prevOwner && prevOwner.uid !== uid ? ' (' + unitName(prevOwner) + '에게서 옮겨 왔어요)' : '') + (had && had.iid !== iid ? ' · ' + itemLabel(had) + ' 는 장비함으로' : ''));
    return r;
  }
  function unequipSlot(uid, slot){
    const u = unitOf(uid), r = Q.unequip(E, D, UI.save, uid, slot); if(!r.ok){ UI.toast(r.reason); return r; }
    UI.commit(r.save); UI.toast(unitName(u) + '의 ' + E.slots[slot].name + '을 뺐어요'); return r;
  }
  function unequipItem(iid){ const o = ownerOf(iid), it = itemOf(iid); if(!o || !it) return { ok: false }; return unequipSlot(o.uid, it.slot); }
  /** 캐릭터 상세 안: 장착 칸 3개 + 세트 줄 */
  function renderSlots(u){
    const wrap = $('#gcDtGear'), setEl = $('#gcDtSet'); if(!wrap) return;
    wrap.dataset.uid = u.uid;
    wrap.innerHTML = E.slotOrder.map(slot => {
      const it = (u.gear || {})[slot] ? itemOf(u.gear[slot]) : null;
      return '<button type="button" class="gc-gslot' + (it ? ' is-full g-' + it.grade : '') + '" data-slot="' + slot + '" aria-label="' + esc(E.slots[slot].name + ' 칸 · ' + (it ? itemLabel(it) + (it.set ? ' ' + setName(it.set) + ' 세트' : '') : '비어 있음') + ' · 누르면 장비를 골라요') + '">'
        + '<span class="gc-gslot__mark" aria-hidden="true">' + iconImg(slot) + '</span>'
        + '<span class="gc-gslot__txt"><small>' + esc(E.slots[slot].name) + '</small><b>' + (it ? esc(E.grades[it.grade].name) + (it.enh ? ' +' + it.enh : '') : '비어 있음') + '</b></span>'
        + (it && it.set ? '<span class="gc-gear__set" data-set="' + esc(it.set) + '">' + setImg(it.set) + '</span>' : '') + '</button>';
    }).join('');
    const worn = Q.gearOf(UI.save, u), cnt = {}; for(const it of worn) if(it.set) cnt[it.set] = (cnt[it.set] || 0) + 1;
    const done = Q.setOf(E, UI.save, u), part = Object.keys(cnt).filter(k => !done.includes(k));
    const lines = done.map(k => '<b>' + esc(setName(k)) + ' 세트</b> ' + esc(effectText(k))).concat(part.map(k => esc(setName(k)) + ' 세트 ' + cnt[k] + '/' + E.setPieces + '부위'));
    setEl.hidden = !lines.length; setEl.innerHTML = lines.join(' · '); setEl.classList.toggle('is-done', !!done.length);
  }
  $('#gcDtGear').addEventListener('click', e => { const b = e.target.closest('[data-slot]'); if(b) openSlotPicker(e.currentTarget.dataset.uid, b.dataset.slot); });
  function showPicker(){ PK.opener = document.activeElement; renderPicker(); pk.hidden = false; const b = pbox.querySelector('[data-pk="close"]'); if(b) b.focus({ preventScroll: true }); return true; }
  function openSlotPicker(uid, slot){ if(!unitOf(uid) || !E.slots[slot]) return false; Object.assign(PK, { kind: 'slot', uid, slot, iid: null }); return showPicker(); }
  function openUnitPicker(iid){ if(!itemOf(iid)) return false; Object.assign(PK, { kind: 'unit', uid: null, slot: null, iid }); return showPicker(); }
  function closePicker(){
    if(pk.hidden) return; pk.hidden = true; PK.kind = null;
    if(PK.opener && document.contains(PK.opener)) PK.opener.focus({ preventScroll: true });
  }
  function renderPicker(){
    if(PK.kind === 'slot'){
      const u = unitOf(PK.uid); if(!u){ closePicker(); return; }
      const cur = u.gear && u.gear[PK.slot] ? itemOf(u.gear[PK.slot]) : null, list = items().filter(it => it.slot === PK.slot).sort(SORT.grade);
      pbox.innerHTML = '<header><h2 id="gcPkTitle">' + esc(unitName(u)) + ' · ' + esc(E.slots[PK.slot].name) + '</h2><button type="button" class="gc-btn gc-btn--small" data-pk="close">닫기</button></header>'
        + (cur ? '<p class="gc-pk__cur">지금: ' + esc(itemLabel(cur)) + ' <button type="button" class="gc-btn gc-btn--small" data-pk="remove">빼기</button></p>' : '<p class="gc-pk__cur">지금: 비어 있어요</p>')
        + (list.length ? '<ul class="gc-pk__list">' + list.map(it => { const o = ownerOf(it.iid), here = cur && cur.iid === it.iid;
          return '<li><button type="button" class="gc-pk__row g-' + it.grade + (here ? ' is-here' : '') + '" data-pk-item="' + it.iid + '"><span class="gc-pk__chip">' + esc(E.grades[it.grade].name) + '</span>'
            + '<span class="gc-pk__main"><b>' + esc(itemLabel(it)) + (it.lock ? ' 🔒' : '') + (it.set ? ' · ' + esc(setName(it.set)) + ' 세트' : '') + '</b><small>' + esc(statText(it)) + '</small></span>'
            + '<span class="gc-pk__state">' + (here ? '끼는 중' : o ? esc(unitName(o)) + '에게서 옮겨 와요' : '') + '</span></button></li>'; }).join('') + '</ul>'
          : '<p class="gc-hint gc-pk__empty">이 부위 장비가 없어요. 던전에서 얻을 수 있어요.</p>');
    } else if(PK.kind === 'unit'){
      const it = itemOf(PK.iid); if(!it){ closePicker(); return; }
      const o = ownerOf(it.iid), us = UI.save.units.slice().sort((a, b) => (b.star - a.star) || (b.enh - a.enh) || a.uid.localeCompare(b.uid));
      pbox.innerHTML = '<header><h2 id="gcPkTitle">' + esc(itemLabel(it)) + ' 을(를) 누구에게?</h2><button type="button" class="gc-btn gc-btn--small" data-pk="close">닫기</button></header>'
        + (o ? '<p class="gc-pk__cur">지금: ' + esc(unitName(o)) + '이(가) 끼는 중 <button type="button" class="gc-btn gc-btn--small" data-pk="remove">빼기</button></p>' : '<p class="gc-pk__cur">지금: 아무도 안 끼고 있어요</p>')
        + '<ul class="gc-pk__list">' + us.map(u => { const had = (u.gear || {})[it.slot] ? itemOf(u.gear[it.slot]) : null, here = o && o.uid === u.uid;
          return '<li><button type="button" class="gc-pk__row' + (here ? ' is-here' : '') + '" data-pk-unit="' + u.uid + '"><span class="gc-pk__chip">' + u.star + '성</span>'
            + '<span class="gc-pk__main"><b>' + esc(unitName(u)) + (u.enh ? ' +' + u.enh : '') + '</b><small>' + esc(E.slots[it.slot].name) + ': ' + (had ? esc(itemLabel(had)) : '비어 있음') + '</small></span>'
            + '<span class="gc-pk__state">' + (here ? '끼는 중' : had ? '바꿔요' : '') + '</span></button></li>'; }).join('') + '</ul>';
    }
  }
  pk.addEventListener('click', e => {
    if(e.target === pk){ closePicker(); return; }
    const b = e.target.closest('[data-pk],[data-pk-item],[data-pk-unit]'); if(!b) return;
    if(b.dataset.pk === 'close') return closePicker();
    if(b.dataset.pk === 'remove'){ const r = PK.kind === 'slot' ? unequipSlot(PK.uid, PK.slot) : unequipItem(PK.iid); if(r.ok) closePicker(); return; }
    if(b.dataset.pkItem){ const u = unitOf(PK.uid); if(u.gear && u.gear[PK.slot] === b.dataset.pkItem) return closePicker(); const r = equipItem(PK.uid, b.dataset.pkItem); if(r.ok) closePicker(); return; }
    if(b.dataset.pkUnit){ const r = equipItem(b.dataset.pkUnit, PK.iid); if(r.ok) closePicker(); }
  });

  /* ---------- 개발용 (?dev=1): 골드 · 장비 6개 ---------- */
  $('#gcDev').addEventListener('click', e => {
    if(window.TaleliaDev !== true) return;   // 공통 개발 스위치 (js/devmode.js)
    const b = e.target.closest('[data-dev]'); if(!b) return;
    if(b.dataset.dev === 'gold'){ UI.commit(Q.addGold(E, UI.save, 5000).save); UI.toast('골드 +5,000'); }
    else if(b.dataset.dev === 'gear'){
      let s = UI.save;
      const spec = [['weapon', 'common', null, 0], ['armor', 'uncommon', null, 2], ['accessory', 'hero', null, 5, 'hp'], ['weapon', 'legend', 'might', 5, 'atk'], ['armor', 'legend', 'guard', 3], ['accessory', 'legend', 'life', 0]];
      for(const [slot, grade, set, enh, bonus] of spec){
        const r = Q.makeItem(E, s, { slot, grade, set }, 'dev'); s = r.save; const it = s.items.find(x => x.iid === r.item.iid); it.enh = enh; it.bonus = bonus ? { stat: bonus } : null;
      }
      UI.commit(s); UI.toast('장비 6개를 더했어요');
    }
  });

  // 그림을 못 불러오면 부위 글자로 대신 (error 는 위로 안 올라가므로 잡아서 처리)
  document.addEventListener('error', e => { const t = e.target; if(t && t.tagName === 'IMG' && t.dataset && t.dataset.letter){ const s = document.createElement('span'); s.textContent = t.dataset.letter; s.className = 'gc-ico-letter'; t.replaceWith(s); } }, true);
  UI.hooks.renderGear = render;
  UI.hooks.renderSlots = renderSlots;
  window.TaleliaGearUI = { state: GS, pickState: PK, renderSlots, openSlotPicker, openUnitPicker, closePicker, equipItem, unequipSlot, unequipItem, effectText, render, openSheet, closeSheet, enhance, toggleLock, startDismantle, stopDismantle, pick, pickGrade, askDismantle, answer, setFilter, setSort, setRng: fn => { rnd = fn; } };
})();
