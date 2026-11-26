/* =====================================================================
 * TALELIA · gacha/manage.js — 캐릭터 상세 · 강화 · 승급 · 초월 · 편성 화면 (규칙은 rules.js · 저장 반영은 ui.js 의 commit)
 *
 *  상세 (보관함 카드 누름)
 *   무대: 전투 리그가 있는 캐릭터는 대기 동작(js/battle/rig.js · data/rigs/*.js 를 읽기만 함) · 없으면 카드 그림
 *   능력치(성급 · 강화 · 초월 반영) · 스킬 · 잠금 · 성장 3가지
 *    강화  재료 1마리 또는 별의 조각 → 강화 +1 (성공률 = 0.5^(성급 차) · 조각 100%) · 5강에서 멈춤
 *    승급  5강 + 같은 성급 5강 1마리 → 다음 성급 0강 (100% · 조각 안 됨)
 *    초월  같은 캐릭터 중복 1마리 → 초월 +1 (100% · 최대 6)
 *   중복 캐릭터는 강화 · 초월 탭 어느 쪽에서도 재료로 고를 수 있음 (플레이어가 고름)
 *   사라지는 재료가 영웅 이상 · 강화 · 초월된 캐릭터이거나 성공률이 100% 미만이면 한 번 더 물어봄
 *  편성 (6칸 · 전열 3 · 후열 3)
 *   칸을 고른 뒤 캐릭터를 누르면 그 칸에 · 캐릭터만 누르면 추천 줄(species.row)의 빈칸에 · ✕ 로 빼기
 *   [자동 편성] = G.bestParty (24호 + 종류 안 겹치는 전투력 상위) · 편성이 비어 있지 않으면 확인창 · 뽑기 직후 빈 칸 채우기는 ui.js 의 pull (G.autoFill)
 *  시험 전투 (편성 탭 아래 · 4단계): 난이도 고르기 → battle.html?party=1&tier=…&return=gacha.html?tab=party (편성이 비면 버튼 꺼짐)
 *   돌아오면 ?tab=party 로 편성 탭 · &trial=win|lose|draw 면 결과 알림 (알림 뒤 주소에서 결과 부분은 지움)
 *  시험용 window.TaleliaGachaManage = { openDetail, closeDetail, setMode, pick, go, confirm, partyPlace, partyRemove, state, trialUrl }
 * ===================================================================== */
(function(){
  'use strict';
  const UI = window.TaleliaGachaUI, G = window.TaleliaGacha, D = window.TALELIA_GACHA, RIGS = window.TALELIA_RIGS || {}, RigLib = window.TaleliaRig;
  if(!UI) return;
  const q = new URLSearchParams(location.search);
  const $ = s => document.querySelector(s), $$ = s => Array.from(document.querySelectorAll(s));
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const fmt = n => Math.round(n).toLocaleString('ko-KR');
  const rnd = G.rng(((UI.seed >>> 0) ^ 0x5bd1e995) >>> 0 || 7);
  const reduced = !!UI.reduced;
  const unitOf = uid => UI.save.units.find(u => u.uid === uid);
  const inParty = uid => UI.save.party.some(p => p.uid === uid);
  const rankOf = sp => sp.story ? 0 : D.rarities[sp.rarity].order;
  const STATS = [['hp', '체력'], ['atk', '공격'], ['def', '방어'], ['spd', '속도']];
  /** 전투력 (보기용 · 규칙과 무관): 체력 ÷ 10 + 공격 + 방어 × 1.5 + 속도 ÷ 2 */
  const E = window.TALELIA_EQUIP, Q = window.TaleliaGear;   // 장비 (E5b · 결정 6 A: 전투력에 장비 포함 · 장비가 없으면 statsOf 와 같음)
  const gearStats = u => (Q && E) ? Q.statsWithGear(D, E, UI.save, u) : G.statsOf(D, u);
  const power = u => { const s = gearStats(u); return Math.round(s.hp / 10 + s.atk + s.def * 1.5 + s.spd / 2); };
  const trMax = (D.transcend && D.transcend.max) || 0;

  /* =================== 상세 =================== */
  const DT = { uid: null, mode: 'enhance', pick: null, rig: null, rigId: null, raf: 0, last: 0, opener: null, result: null };
  const box = $('#gcDetail'), canvas = $('#gcDtCanvas'), stage = $('#gcDtStage');

  function rigIdOf(id){ const sp = D.species[id]; if(RIGS[id]) return id; if(sp && sp.battleId && RIGS[sp.battleId]) return sp.battleId; return null; }
  const rigCache = {};
  function loadRig(id){ if(!rigCache[id]){ const def = RIGS[id]; rigCache[id] = RigLib.load(def, def.base).catch(e => { delete rigCache[id]; throw e; }); } return rigCache[id]; }

  function openDetail(uid){
    const u = unitOf(uid); if(!u) return false;
    DT.uid = uid; DT.pick = null; DT.result = null; DT.opener = document.activeElement;
    DT.mode = (u.enh >= D.maxEnh && u.star < D.maxStar) ? 'promote' : 'enhance';
    box.hidden = false; renderDetail(); startStage(u);
    $('#gcDtClose').focus({ preventScroll: true });
    return true;
  }
  function closeDetail(){
    if(box.hidden) return;
    box.hidden = true; stopStage(); DT.uid = null;
    if(DT.opener && document.contains(DT.opener)) DT.opener.focus({ preventScroll: true });
  }
  $('#gcDtClose').addEventListener('click', closeDetail);
  box.addEventListener('click', e => { if(e.target === box) closeDetail(); });
  document.addEventListener('keydown', e => {
    if(e.key !== 'Escape') return;
    if(!$('#gcConfirm').hidden){ e.preventDefault(); answer(false); return; }
    if(!box.hidden){ e.preventDefault(); closeDetail(); }
  });

  /* ---- 무대: 리그 대기 동작 · 없으면 카드 그림 ---- */
  function startStage(u){
    stopStage();
    const id = rigIdOf(u.species), art = $('#gcDtArt'), sp = D.species[u.species];
    art.src = UI.artOf(sp) || ''; art.alt = sp.name;
    stage.dataset.mode = 'art'; DT.rigId = id; DT.rig = null;
    stage.className = 'gc-detail__stage r-' + UI.rarityOf(sp);
    if(!id || !RigLib) return;
    stage.dataset.mode = 'loading';
    const want = DT.uid;
    loadRig(id).then(rig => {
      if(DT.uid !== want) return;
      DT.rig = rig; stage.dataset.mode = 'rig'; rig.play('idle', { blend: 0 });
      DT.last = 0; DT.raf = requestAnimationFrame(frame);
    }).catch(() => { if(DT.uid === want) stage.dataset.mode = 'art'; });
  }
  function stopStage(){ cancelAnimationFrame(DT.raf); DT.raf = 0; DT.rig = null; }
  function frame(ts){
    const rig = DT.rig; if(!rig) return;
    const dt = DT.last ? Math.min(0.05, (ts - DT.last) / 1000) : 0; DT.last = ts;
    if(!reduced) rig.update(dt); else if(!DT.drawnOnce){ rig.update(0); }
    const d = window.devicePixelRatio || 1, r = canvas.getBoundingClientRect(), w = Math.round(r.width * d), h = Math.round(r.height * d);
    if(w && h){
      if(canvas.width !== w || canvas.height !== h){ canvas.width = w; canvas.height = h; }
      const ctx = canvas.getContext('2d'); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, w, h);
      const def = rig.def, ch = Math.min(r.height * 0.8, r.width * 0.95 * def.height / ((def.anchor[0] + def.height * 0.6) || def.height));
      rig.draw(ctx, r.width * 0.46, r.height * 0.92, ch, 1, d);
    }
    DT.raf = requestAnimationFrame(frame);
  }
  function celebrate(ok){
    const fx = $('#gcDtFx'); fx.className = 'gc-detail__fx'; void fx.offsetWidth; fx.className = 'gc-detail__fx ' + (ok ? 'is-up' : 'is-fail');
    if(DT.rig && !reduced && ok){ const rig = DT.rig; rig.play(rig.has('skill') ? 'skill' : 'attack', { onEnd: () => { if(DT.rig === rig) rig.play('idle'); } }); }
  }

  /* ---- 본문 ---- */
  const TARGET = { enemy_single: '적 1명', enemy_n: '적 {n}명', enemy_all: '적 전체', ally_single: '아군 1명', ally_all: '아군 전체' };
  const STATUS = { stun: '기절', poison: '중독', weaken: '약화' };
  function skillHTML(u, id){
    const sp = D.species[u.species];
    if(sp.skillSource === 'battle') return '<li><b>' + esc(id === sp.skills[0] ? '기본 공격' : '필살기') + '</b> <span>전투 데이터 기술 그대로 (스토리 캐릭터)</span></li>';
    const k = G.skillOf(D, u, id); if(!k) return '';
    const parts = [TARGET[k.target] ? TARGET[k.target].replace('{n}', k.count || '') : k.target];
    if(k.kind === 'heal') parts.push('최대 체력의 ' + Math.round(k.pctMaxHp * 100) + '% 회복');
    else { parts.push(k.hits > 1 ? k.hits + '회 · 합계 ' + Math.round(k.mult * 100) + '%' : Math.round(k.mult * 100) + '%'); }
    if(k.status) parts.push(STATUS[k.status.type] + ' ' + Math.round(k.status.chance * 100) + '% (' + k.status.turns + '턴)');
    if(k.cooldown) parts.push('재사용 ' + k.cooldown + '턴');
    return '<li' + (k.tag === 'ultimate' ? ' class="is-ult"' : '') + '><b>' + esc(k.name) + '</b> <span>' + esc(parts.join(' · ')) + '</span></li>';
  }
  /** 패시브 (V3-2): 이름 · 설명 · 단계 · 닫혀 있으면 열리는 성급 */
  function passiveHTML(u){
    const P = window.TaleliaPassive, i = P && P.infoOf(D, u); if(!i) return '';
    const lv = u.star >= 6 ? 3 : u.star >= 5 ? 2 : 1;
    return '<h3>패시브</h3><ul><li class="gc-passive' + (i.locked ? ' is-locked' : '') + '" data-passive><b>' + esc(i.name) + '</b> <span>' + (i.locked ? i.from + '성부터 열려요 · ' : '') + esc(i.lines.join(' · ')) + '</span>'
      + (i.locked ? '' : ' <small>단계 ' + lv + (i.level.tr3 ? ' · 초월 보너스' : '') + (i.level.tr6 ? ' · 보조 효과' : '') + '</small>') + '</li></ul>';
  }
  /** 고른 재료로 성공하면 어떻게 되는지 (능력치 미리보기용) */
  function previewOf(u){
    if(!DT.pick) return null;
    const n = Object.assign({}, u);
    if(DT.mode === 'enhance' && u.enh < D.maxEnh) n.enh = u.enh + 1;
    else if(DT.mode === 'promote') { n.star = u.star + 1; n.enh = 0; }
    else if(DT.mode === 'transcend') n.tr = (u.tr || 0) + 1;
    else return null;
    return n;
  }
  function renderDetail(){
    const u = unitOf(DT.uid); if(!u){ closeDetail(); return; }
    const sp = D.species[u.species];
    $('#gcDtRar').textContent = UI.rarityName(sp); $('#gcDtRar').className = 'gc-detail__rar r-' + UI.rarityOf(sp);
    $('#gcDtName').textContent = sp.name;
    $('#gcDtStars').textContent = '★'.repeat(u.star) + '☆'.repeat(D.maxStar - u.star); $('#gcDtStars').setAttribute('aria-label', u.star + '성');
    $('#gcDtEnh').textContent = '+' + u.enh + ' 강';
    $('#gcDtTr').innerHTML = trMax ? '초월 ' + Array.from({ length: trMax }, (_, i) => '<i class="' + (i < (u.tr || 0) ? 'on' : '') + '"></i>').join('') + ' <small>' + (u.tr || 0) + '/' + trMax + '</small>' : '';
    $('#gcDtSub').textContent = [sp.role, sp.row === 'front' ? '전열 추천' : '후열 추천', inParty(u.uid) ? '편성 중' : '', '전투력 ' + fmt(power(u))].filter(Boolean).join(' · ');
    const lock = $('#gcDtLock'); lock.checked = !!u.lock; lock.disabled = !!sp.story;
    // 능력치 (+ 고른 재료로 성공했을 때)
    const st = G.statsOf(D, u), pv = previewOf(u), ns = pv ? G.statsOf(D, pv) : null, gs = gearStats(u);
    const gearDelta = k => { const d = Math.round(gs[k] - st[k]); return d > 0 ? ' <small class="gc-stats__gear" title="장비 · 세트로 더해진 값">+' + fmt(d) + '</small>' : ''; };
    $('#gcDtStats').innerHTML = STATS.map(([k, n]) => '<tr data-stat="' + k + '"><th>' + n + '</th><td>' + fmt(st[k]) + gearDelta(k) + '</td><td class="gc-stats__next">' + (ns && ns[k] !== st[k] ? '→ <b>' + fmt(ns[k]) + '</b> <small>+' + fmt(ns[k] - st[k]) + '</small>' : '') + '</td></tr>').join('')
      + '<tr class="gc-stats__mul"><th>배율</th><td colspan="2">성급 ×' + D.starMul[u.star] + ' · 강화 +' + Math.round(D.enhStep * u.enh * 100) + '% · 초월 +' + Math.round(G.transcendBonus(D, u.tr) * 100) + '%</td></tr>';
    if(UI.hooks.renderSlots) UI.hooks.renderSlots(u);   // 장착 칸 3개 · 세트 줄 (js/gacha/gear-ui.js)
    $('#gcDtSkills').innerHTML = '<h3>스킬</h3><ul>' + (sp.skills || []).map(id => skillHTML(u, id)).join('') + '</ul>' + passiveHTML(u);
    renderGrow(u);
  }

  /* ---- 성장: 강화 · 승급 · 초월 ---- */
  const MODE = {
    enhance: { go: '강화하기', desc: u => u.enh >= D.maxEnh ? (u.star >= D.maxStar ? '최대 강화예요 (' + D.maxStar + '성 ' + D.maxEnh + '강).' : D.maxEnh + '강이에요. 승급 탭에서 같은 성급 ' + D.maxEnh + '강 1마리를 넣으면 다음 성급이 돼요.')
      : '재료 1마리 또는 ' + D.shard.name + ' 1개로 강화 +1 (같은 성급 100% · 한 단계 아래 50% · 두 단계 아래 25% · ' + D.shard.name + ' 100%). 실패해도 재료는 사라져요.' },
    promote: { go: '승급하기', desc: u => u.star >= D.maxStar ? '최고 성급(' + D.maxStar + '성)이에요.' : u.enh < D.maxEnh ? D.maxEnh + '강이 되면 승급할 수 있어요 (지금 ' + u.enh + '강).'
      : '같은 성급(' + u.star + '성)의 ' + D.maxEnh + '강 캐릭터 1마리를 넣으면 ' + (u.star + 1) + '성 0강이 돼요 (100% · ' + D.shard.name + '은 못 써요).' },
    transcend: { go: '초월하기', desc: u => (u.tr || 0) >= trMax ? '최대 초월이에요 (' + trMax + '단계 · 체력 · 공격 · 방어 +' + Math.round(G.transcendBonus(D, trMax) * 100) + '%).'
      : '같은 캐릭터 1마리(성급 · 강화 상관없음)를 넣으면 초월 ' + ((u.tr || 0) + 1) + '단계 · 체력 · 공격 · 방어 +' + Math.round((G.transcendBonus(D, (u.tr || 0) + 1) - G.transcendBonus(D, u.tr)) * 100) + '% (100%).' }
  };
  function candidates(u){
    const mode = DT.mode, list = [];
    if(mode === 'enhance'){ const r = G.enhance(D, UI.save, u.uid, { shard: true }, () => 0); list.push({ id: 'shard', ok: r.ok, reason: r.ok ? null : r.reason, rate: 1 }); }
    for(const m of UI.save.units){
      if(m.uid === u.uid || D.species[m.species].story) continue;
      if(mode === 'promote' && m.star !== u.star) continue;            // 같은 성급만 보여 줌
      if(mode === 'transcend' && m.species !== u.species) continue;    // 같은 캐릭터만
      const can = G.canMaterial(D, UI.save, u.uid, m.uid)[mode];
      list.push({ id: m.uid, unit: m, ok: can === true, reason: can === true ? null : can, rate: mode === 'enhance' ? G.materialRate(D, u, m) : 1, dup: m.species === u.species });
    }
    const val = c => c.unit ? rankOf(D.species[c.unit.species]) * 100 + c.unit.star * 10 + c.unit.enh + (c.unit.tr || 0) * 3 : -1;
    list.sort((a, b) => (b.ok - a.ok) || (b.rate - a.rate) || (val(a) - val(b)));   // 쓸 수 있는 것 → 성공률 높은 것 → 값싼 것 먼저
    return list;
  }
  function renderGrow(u){
    $$('.gc-grow__tabs [data-grow]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.grow === DT.mode)));
    const M = MODE[DT.mode], story = D.species[u.species].story;
    const SG = window.TaleliaStoryGrowth, sg = story && SG;
    $('#gcGrowDesc').textContent = sg ? storyDesc(u) : story ? '스토리 캐릭터는 초월석으로 성장해요.' : M.desc(u);
    const pick = $('#gcGrowPick'); pick.textContent = '';
    const list = sg ? storyCandidates(u) : story ? [] : candidates(u);
    if(DT.pick && !list.some(c => c.id === DT.pick && c.ok)) DT.pick = null;
    if(!list.length && !story){ const p = document.createElement('p'); p.className = 'gc-grow__empty'; p.textContent = DT.mode === 'promote' ? '같은 성급(' + u.star + '성) 캐릭터가 없어요.' : DT.mode === 'transcend' ? '같은 캐릭터가 더 없어요.' : '재료가 없어요.'; pick.appendChild(p); }
    for(const c of list){
      const b = document.createElement('button'); b.type = 'button'; b.className = 'gc-mat' + (c.ok ? '' : ' is-off') + (DT.pick === c.id ? ' is-on' : '');
      b.setAttribute('role', 'option'); b.setAttribute('aria-selected', String(DT.pick === c.id)); b.disabled = !c.ok; b.dataset.mat = c.id;
      if(c.id === 'tstone'){
        b.innerHTML = '<span class="gc-mat__shard"><b>초월석</b><small>' + fmt(SG.tstones(UI.save)) + '개 남음' + (c.cost != null ? ' · 필요 ' + c.cost : '') + '</small></span>';
      } else if(c.id === 'shard'){
        b.innerHTML = '<span class="gc-mat__shard"><img alt="" src="' + esc((D.ui && D.ui.shard) || '') + '"><b>' + esc(D.shard.name) + '</b><small>' + UI.save.shards + '개 남음</small></span>';
      } else b.appendChild(UI.card(c.unit.species, { unit: c.unit }));
      const lab = document.createElement('span'); lab.className = 'gc-mat__lab';
      lab.textContent = c.id === 'tstone' ? (c.ok ? (DT.mode === 'promote' ? '승급 재료' : '초월 재료') : shortReason(c.reason)) : c.ok ? (DT.mode === 'enhance' ? Math.round(c.rate * 100) + '%' + (c.dup ? ' · 중복' : '') : DT.mode === 'promote' ? '승급 재료' : '초월 재료') : shortReason(c.reason);
      if(c.ok && c.dup && DT.mode === 'enhance' && (u.tr || 0) < trMax) lab.title = '같은 캐릭터예요 · 초월 탭에서 초월 재료로도 쓸 수 있어요';
      b.appendChild(lab);
      b.setAttribute('aria-label', (c.id === 'tstone' ? '초월석' : c.id === 'shard' ? D.shard.name : D.species[c.unit.species].name + ' ' + c.unit.star + '성 ' + c.unit.enh + '강') + ' · ' + lab.textContent);
      pick.appendChild(b);
    }
    const sel = DT.pick ? list.find(c => c.id === DT.pick) : null;
    $('#gcGrowSel').textContent = sel ? '재료: ' + (sel.id === 'tstone' ? '초월석 ' + sel.cost + '개' : sel.id === 'shard' ? D.shard.name + ' 1개' : D.species[sel.unit.species].name + ' ' + sel.unit.star + '성 ' + sel.unit.enh + '강' + (sel.unit.tr ? ' 초월 ' + sel.unit.tr : '')) + (DT.mode === 'enhance' ? ' · 성공 ' + Math.round(sel.rate * 100) + '%' : '') : (story ? '' : '재료를 골라 주세요');
    const go = $('#gcGrowGo'); go.textContent = M.go; go.disabled = !sel;
    $('#gcGrowResult').textContent = DT.result || '';
  }
  /** 스토리 캐릭터의 성장 설명 · 재료 (V3-3: 강화 = 별의 조각 · 승급 · 초월 = 초월석) */
  function storyDesc(u){
    const SG = window.TaleliaStoryGrowth;
    if(DT.mode === 'enhance') return u.enh >= D.maxEnh ? (u.star >= D.maxStar ? '최대 강화예요.' : D.maxEnh + '강이에요. 승급 탭에서 초월석으로 다음 성급이 돼요.') : D.shard.name + ' 1개로 강화 +1 (100%). 스토리 캐릭터는 같은 캐릭터를 재료로 쓸 수 없어요.';
    if(DT.mode === 'promote'){ const c = SG.promoteCost(u.star); return u.star >= D.maxStar ? '최고 성급이에요.' : u.enh < D.maxEnh ? D.maxEnh + '강이 되면 승급할 수 있어요 (지금 ' + u.enh + '강).' : '초월석 ' + c + '개로 ' + (u.star + 1) + '성 0강이 돼요 (3성부터 패시브 · 4성 필살기 강화 · 6성 추가 효과).'; }
    const c = SG.transcendCost(u.tr || 0); return c == null ? '최대 초월이에요.' : '초월석 ' + c + '개로 초월 ' + ((u.tr || 0) + 1) + '단계 · 체력 · 공격 · 방어 +' + Math.round((G.transcendBonus(D, (u.tr || 0) + 1) - G.transcendBonus(D, u.tr)) * 100) + '%.';
  }
  function storyCandidates(u){
    const SG = window.TaleliaStoryGrowth, mode = DT.mode;
    if(mode === 'enhance'){ const r = SG.enhance(D, UI.save, u.uid); return [{ id: 'shard', ok: r.ok, reason: r.ok ? null : r.reason, rate: 1 }]; }
    const r = mode === 'promote' ? SG.promote(D, UI.save, u.uid) : SG.transcend(D, UI.save, u.uid);
    return [{ id: 'tstone', ok: r.ok, reason: r.ok ? null : r.reason, rate: 1, cost: mode === 'promote' ? SG.promoteCost(u.star) : SG.transcendCost(u.tr || 0) }];
  }
  const shortReason = r => !r ? '' : /초월석이 모자/.test(r) ? '초월석 부족' : /잠긴/.test(r) ? '잠김' : /편성/.test(r) ? '편성 중' : /성급이 높은/.test(r) ? '성급 높음' : /5강이어야|재료도/.test(r) ? D.maxEnh + '강 아님' : /같은 성급/.test(r) ? '성급 다름'
    : /같은 캐릭터만/.test(r) ? '다른 캐릭터' : /승급이 필요|최대|최고/.test(r) ? '지금은 불가' : /없음/.test(r) ? '없음' : r;
  $('.gc-grow__tabs').addEventListener('click', e => { const b = e.target.closest('[data-grow]'); if(b) setMode(b.dataset.grow); });
  function setMode(m){ if(!MODE[m]) return; DT.mode = m; DT.pick = null; DT.result = null; renderDetail(); }
  $('#gcGrowPick').addEventListener('click', e => { const b = e.target.closest('[data-mat]'); if(b && !b.disabled) pick(b.dataset.mat); });
  function pick(id){ DT.pick = DT.pick === id ? null : id; DT.result = null; renderDetail(); }
  $('#gcDtLock').addEventListener('change', e => { const r = G.setLock(D, UI.save, DT.uid, e.target.checked); if(r.ok) UI.commit(r.save); });

  /* ---- 실행 (필요하면 한 번 더 물어봄) ---- */
  let pending = null;
  function needConfirm(u, sel){
    if(sel === 'shard' || sel === 'tstone') return null;
    const m = unitOf(sel), sp = D.species[m.species], why = [];
    if(rankOf(sp) >= D.rarities.hero.order) why.push(D.rarities[sp.rarity].name + ' 캐릭터예요');
    if(m.enh > 0) why.push(m.enh + '강까지 강화했어요');
    if(m.tr > 0) why.push('초월 ' + m.tr + '단계예요');
    if(DT.mode === 'enhance'){ const rate = G.materialRate(D, u, m); if(rate < 1) why.push('성공률 ' + Math.round(rate * 100) + '% · 실패해도 재료는 사라져요'); }
    if(DT.mode === 'enhance' && m.species === u.species && (u.tr || 0) < trMax) why.push('같은 캐릭터라 초월 재료로도 쓸 수 있어요');
    // 장비 (결정 7 A): 끼고 있던 장비는 사라지지 않고 장비함으로 돌아옴 → 확인창에 알림
    const worn = Q && E ? Q.gearOf(UI.save, m) : [];
    if(worn.length) why.push('끼고 있던 장비 ' + worn.length + '개는 장비함으로 돌아가요');
    return why.length ? { m, why, worn } : null;
  }
  function go(){
    const u = unitOf(DT.uid); if(!u || !DT.pick) return;
    const c = needConfirm(u, DT.pick);
    if(!c) return run();
    pending = run; cfBack = $('#gcGrowGo');
    $('#gcCfTitle').textContent = '재료로 쓸까요?';
    const body = $('#gcCfBody'); body.textContent = ''; body.classList.remove('is-list');
    body.appendChild(UI.card(c.m.species, { unit: c.m }));
    const ul = document.createElement('ul'); ul.innerHTML = c.why.map(w => '<li>' + esc(w) + '</li>').join('')
      + (c.worn && c.worn.length ? '<li class="gc-cf__gear">' + c.worn.map(it => esc(E.grades[it.grade].name + ' ' + E.slots[it.slot].name + (it.enh ? ' +' + it.enh : ''))).join(' · ') + '</li>' : '')
      + '<li><b>이 캐릭터는 재료로 쓰면 사라져요.</b></li>'; body.appendChild(ul);
    $('#gcCfYes').textContent = MODE[DT.mode].go;
    $('#gcConfirm').hidden = false; $('#gcCfNo').focus({ preventScroll: true });
  }
  let cfBack = null;   // 확인창을 닫고 취소하면 돌아갈 버튼
  function answer(yes){ $('#gcConfirm').hidden = true; const f = pending; pending = null; if(yes && f) f(); else if(cfBack) cfBack.focus({ preventScroll: true }); }
  $('#gcCfYes').addEventListener('click', () => answer(true));
  $('#gcCfNo').addEventListener('click', () => answer(false));
  $('#gcConfirm').addEventListener('click', e => { if(e.target === e.currentTarget) answer(false); });
  $('#gcGrowGo').addEventListener('click', go);

  function run(){
    const u = unitOf(DT.uid), mat = DT.pick === 'shard' ? { shard: true } : DT.pick, mode = DT.mode;
    const SGx = D.species[u.species].story && window.TaleliaStoryGrowth;   // 스토리 캐릭터 = 별의 조각 · 초월석 (js/gacha/story-growth.js)
    const r = SGx ? (mode === 'enhance' ? SGx.enhance(D, UI.save, u.uid) : mode === 'promote' ? SGx.promote(D, UI.save, u.uid) : SGx.transcend(D, UI.save, u.uid))
      : mode === 'enhance' ? G.enhance(D, UI.save, u.uid, mat, rnd) : mode === 'promote' ? G.promote(D, UI.save, u.uid, mat) : G.transcend(D, UI.save, u.uid, mat);
    if(!r.ok){ UI.toast(r.reason); return r; }
    // 재료가 사라져도 장비(items)는 그대로 · 끼고 있던 칸은 캐릭터와 함께 없어져 장비함으로 (ownerOf 가 못 찾음) → 저장 규칙으로 한 번 더 확인 (결정 7 A)
    if(Q && E){ const bad = G.checkSave(D, r.save).concat(Q.checkSave(E, D, r.save)); if(bad.length){ console.error('재료 사용 뒤 저장 확인 실패: ' + bad.join(' | ')); UI.toast('저장을 확인하지 못해 취소했어요'); return { ok: false, reason: bad[0], save: UI.save }; } }
    const a = r.after, ok = mode !== 'enhance' || r.success;
    DT.result = mode === 'enhance' ? (r.success ? '강화 성공! ' + a.star + '성 ' + a.enh + '강' + (a.enh >= D.maxEnh && a.star < D.maxStar ? ' · 이제 승급할 수 있어요' : '') : '강화 실패… 재료는 사라졌어요 (' + a.star + '성 ' + a.enh + '강 그대로)')
      : mode === 'promote' ? '승급! ' + a.star + '성 0강이 됐어요' : '초월 ' + a.tr + '단계! 체력 · 공격 · 방어 +' + Math.round(G.transcendBonus(D, a.tr) * 100) + '%';
    DT.pick = null;
    if(mode === 'enhance' && a.enh >= D.maxEnh && a.star < D.maxStar) DT.mode = 'promote';
    UI.commit(r.save);   // → renderAll → refreshDetail
    $('#gcGrowResult').textContent = DT.result;
    celebrate(ok);
    return r;
  }

  /* =================== 편성 =================== */
  const PT = { slot: null, filter: 'all' };
  const SLOT_N = 3, ROWS = ['back', 'front'], ROW_NAME = { front: '전열', back: '후열' };
  function partyAt(row, slot){ return UI.save.party.find(p => p.row === row && p.slot === slot); }
  function renderParty(){
    const save = UI.save, party = save.party;
    for(const row of ROWS){
      const wrap = $('#gcFormation [data-row="' + row + '"] .gc-formation__slots'); wrap.textContent = '';
      for(let i = 0; i < SLOT_N; i++){
        const p = partyAt(row, i), u = p && save.units.find(x => x.uid === p.uid), key = row + i;
        const cell = document.createElement('div'); cell.className = 'gc-slot' + (PT.slot === key ? ' is-on' : '') + (u ? ' is-full' : '');
        cell.dataset.slot = key; cell.setAttribute('role', 'button'); cell.tabIndex = 0;
        cell.setAttribute('aria-pressed', String(PT.slot === key));
        cell.setAttribute('aria-label', ROW_NAME[row] + ' ' + (i + 1) + '번 칸 · ' + (u ? D.species[u.species].name : '비어 있음'));
        if(u){
          cell.appendChild(UI.card(u.species, { unit: u }));
          const x = document.createElement('button'); x.type = 'button'; x.className = 'gc-slot__x'; x.dataset.remove = p.uid; x.setAttribute('aria-label', D.species[u.species].name + ' 빼기'); x.textContent = '✕'; cell.appendChild(x);
          const sp = D.species[u.species]; if(sp.row && sp.row !== row){ const w = document.createElement('span'); w.className = 'gc-slot__warn'; w.textContent = ROW_NAME[sp.row] + ' 추천'; cell.appendChild(w); }
        } else cell.innerHTML = '<span class="gc-slot__empty">＋<small>' + ROW_NAME[row] + ' ' + (i + 1) + '</small></span>';
        wrap.appendChild(cell);
      }
    }
    $('#gcPartyCount').textContent = party.length + ' / ' + D.partyMax;
    renderTrial();
    $('#gcPartyPower').textContent = fmt(party.reduce((s, p) => { const u = save.units.find(x => x.uid === p.uid); return s + (u ? power(u) : 0); }, 0));
    // 고르기 목록
    const f = $('#gcPartyFilter');
    if(!f.children.length){ f.innerHTML = [['all', '전체'], ['front', '전열 추천'], ['back', '후열 추천']].map(([k, n]) => '<button type="button" data-pf="' + k + '" aria-pressed="false">' + n + '</button>').join('');
      f.addEventListener('click', e => { const b = e.target.closest('[data-pf]'); if(b){ PT.filter = b.dataset.pf; renderParty(); } }); }
    for(const b of f.children) b.setAttribute('aria-pressed', String(b.dataset.pf === PT.filter));
    const pool = $('#gcPartyPool'); pool.textContent = '';
    const units = save.units.filter(u => PT.filter === 'all' || D.species[u.species].row === PT.filter).sort((a, b) => power(b) - power(a));
    for(const u of units){
      const c = UI.card(u.species, { unit: u }); c.dataset.pick = u.uid; c.tabIndex = 0; c.setAttribute('role', 'button');
      if(inParty(u.uid)) c.classList.add('is-placed');
      const pw = document.createElement('span'); pw.className = 'gc-card__power'; pw.textContent = '전투력 ' + fmt(power(u)); c.appendChild(pw);
      pool.appendChild(c);
    }
  }
  function commitParty(list, msg){ const r = G.setParty(D, UI.save, list); if(!r.ok){ UI.toast(r.reason); return r; } UI.commit(r.save); if(msg) UI.toast(msg); return r; }
  /** uid 를 칸(row · slot)에 넣음 · 칸이 없으면 추천 줄의 빈칸 → 다른 줄의 빈칸 */
  function partyPlace(uid, row, slot){
    const u = unitOf(uid); if(!u) return { ok: false, reason: '없는 캐릭터' };
    let list = UI.save.party.filter(p => p.uid !== uid);   // 이미 있으면 옮김
    if(row == null){
      const pref = D.species[u.species].row || 'front', order = [pref, pref === 'front' ? 'back' : 'front'];
      for(const r of order){ for(let i = 0; i < SLOT_N; i++) if(!list.some(p => p.row === r && p.slot === i)){ row = r; slot = i; break; } if(row != null) break; }
      if(row == null){ UI.toast(D.partyMax + '칸이 다 찼어요 · 칸을 고르거나 한 명을 빼 주세요'); return { ok: false, reason: '가득 참' }; }
    }
    list = list.filter(p => !(p.row === row && p.slot === slot));   // 그 칸에 있던 캐릭터는 빠짐
    if(list.some(p => { const o = unitOf(p.uid); return o && o.species === u.species; })){ UI.toast('이미 편성된 캐릭터예요 · 같은 캐릭터는 1마리만'); return { ok: false, reason: '같은 캐릭터' }; }
    list.push({ uid, row, slot });
    PT.slot = null;
    return commitParty(list, D.species[u.species].name + ' → ' + ROW_NAME[row] + ' ' + (slot + 1) + '번');
  }
  function partyRemove(uid){ return commitParty(UI.save.party.filter(p => p.uid !== uid)); }
  /** [자동 편성]: 추천 편성(G.bestParty)으로 바꿈 · 이미 편성한 캐릭터가 있으면 한 번 물어봄 */
  function autoParty(){
    const list = G.bestParty(D, UI.save), key = l => l.map(p => p.row + p.slot + ':' + p.uid).sort().join();
    if(key(list) === key(UI.save.party)){ UI.toast('이미 추천 편성이에요'); return { ok: true, same: true }; }
    const apply = () => { PT.slot = null; return commitParty(list, '추천 편성으로 ' + list.length + '명을 세웠어요'); };
    if(!UI.save.party.length) return apply();
    pending = apply; cfBack = $('#gcPartyAuto');
    $('#gcCfTitle').textContent = '편성을 바꿀까요?';
    const names = row => list.filter(p => p.row === row).sort((a, b) => a.slot - b.slot).map(p => D.species[unitOf(p.uid).species].name).join(' · ') || '없음';
    const body = $('#gcCfBody'); body.classList.add('is-list');
    body.innerHTML = '<ul><li><b>전열</b> ' + esc(names('front')) + '</li><li><b>후열</b> ' + esc(names('back')) + '</li><li>지금 편성은 바뀌어요.</li></ul>';
    $('#gcCfYes').textContent = '바꾸기';
    $('#gcConfirm').hidden = false; $('#gcCfNo').focus({ preventScroll: true });
    return { ok: false, confirm: true };
  }
  $('#gcPartyAuto').addEventListener('click', autoParty);
  $('#gcFormation').addEventListener('click', e => {
    const x = e.target.closest('[data-remove]'); if(x){ e.stopPropagation(); partyRemove(x.dataset.remove); return; }
    const c = e.target.closest('[data-slot]'); if(!c) return;
    PT.slot = PT.slot === c.dataset.slot ? null : c.dataset.slot; renderParty();
  });
  $('#gcFormation').addEventListener('keydown', e => { if(e.key !== 'Enter' && e.key !== ' ') return; const c = e.target.closest('[data-slot]'); if(c && !e.target.closest('[data-remove]')){ e.preventDefault(); c.click(); } });
  const poolPick = el => { const c = el.closest('[data-pick]'); if(!c) return; const s = PT.slot; if(s) partyPlace(c.dataset.pick, s.replace(/\d$/, ''), +s.slice(-1)); else partyPlace(c.dataset.pick); };
  $('#gcPartyPool').addEventListener('click', e => poolPick(e.target));
  $('#gcPartyPool').addEventListener('keydown', e => { if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); poolPick(e.target); } });
  $('#gcPartyClear').addEventListener('click', () => { if(UI.save.party.length) commitParty([], '편성을 모두 뺐어요'); });

  /* =================== 시험 전투 (battle.html?party=1) =================== */
  const TRIAL = window.TALELIA_GACHA_TRIAL, RES_NAME = { win: '승리', lose: '패배', draw: '무승부', error: '시작하지 못함' };
  PT.tier = TRIAL && TRIAL.tiers[q.get('tier')] ? q.get('tier') : (TRIAL ? TRIAL.defaultTier : 'normal');
  /** 시험 전투 주소 (시험용 저장 키가 있으면 전투 · 돌아오는 주소 모두에 붙임) */
  function trialUrl(){
    const key = q.get('savekey'), back = 'gacha.html?tab=party' + (key ? '&savekey=' + encodeURIComponent(key) : '');
    return 'battle.html?party=1&tier=' + encodeURIComponent(PT.tier) + (key ? '&savekey=' + encodeURIComponent(key) : '') + '&return=' + encodeURIComponent(back);
  }
  function renderTrial(){
    const box = $('#gcTrialTier'); if(!box) return;
    if(!box.children.length && TRIAL){
      box.innerHTML = Object.keys(TRIAL.tiers).map(k => '<button type="button" data-tier="' + k + '" aria-pressed="false">' + esc(TRIAL.tiers[k].name) + '</button>').join('');
      box.addEventListener('click', e => { const b = e.target.closest('[data-tier]'); if(b){ PT.tier = b.dataset.tier; renderTrial(); } });
    }
    for(const b of box.children) b.setAttribute('aria-pressed', String(b.dataset.tier === PT.tier));
    const go = $('#gcTrialGo'), n = UI.save.party.length;
    go.disabled = !n || !TRIAL; go.title = n ? '' : '편성에 캐릭터를 넣어 주세요';
  }
  $('#gcTrialGo').addEventListener('click', () => { if(UI.save.party.length && TRIAL) location.href = trialUrl(); });

  UI.hooks.openDetail = openDetail;
  UI.hooks.renderParty = renderParty;
  UI.hooks.autoParty = autoParty;
  UI.hooks.refreshDetail = () => { if(!box.hidden && DT.uid) renderDetail(); };
  window.TaleliaGachaManage = { openDetail, closeDetail, setMode, pick, go, confirm: answer, partyPlace, partyRemove, autoParty, power, state: DT, party: PT, trialUrl };
  // 다른 화면에서 돌아옴: ?tab=party · 시험 전투 결과 알림 (새로 고쳐도 다시 뜨지 않게 주소에서 결과 부분을 지움)
  if(['pull', 'box', 'party', 'gear', 'dungeon', 'dex'].includes(q.get('tab'))) UI.tab(q.get('tab'));
  if(q.get('trial') && RES_NAME[q.get('trial')]){
    const tn = TRIAL && TRIAL.tiers[q.get('tier')] ? TRIAL.tiers[q.get('tier')].name : '';
    UI.toast('시험 전투: ' + RES_NAME[q.get('trial')] + (tn ? ' (' + tn + (+q.get('rounds') ? ' · ' + (+q.get('rounds')) + '라운드' : '') + ')' : ''));
    try{ const u = new URL(location.href); ['trial', 'rounds'].forEach(k => u.searchParams.delete(k)); history.replaceState(null, '', u.pathname.split('/').pop() + u.search + u.hash); }catch(e){}
  }
  if(q.get('detail')) setTimeout(() => openDetail(q.get('detail')), 0);   // 캡처 · 시험용
})();
