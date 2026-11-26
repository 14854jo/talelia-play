/* =====================================================================
 * TALELIA · stage/ui.js — 스테이지 화면 (S4 · docs/design/stage-system.md 1 · 3 · 4장 · 화면 전용 · 규칙은 js/stage/rules.js · 저장은 뽑기 저장 v4 의 stage)
 *
 *  지도: 1장 월드맵 (배경 그림 + 길 SVG + 노드 6개 · 잠김 · 열림 · 클리어 · 배치 = js/stage/map-layout.js 의 % 좌표 · ?dev=1 = 10% 격자 · 좌표) · 스테이지 시트(나오는 적 · 적 전투력 · 내 편성 전투력 · 첫 클리어 보상 · 장비 미적용 안내) · [입장]
 *  입장:  (1-1 처음이면 안내 ② 편성 · 장비) → X.enter(입장 순번 · runId · 입장에는 비용 없음) → 저장 → story.html?scene=st1_N_pre&run=runId  (전후 대사 · 전투)
 *         클리어한 스테이지는 [대사 건너뛰고 전투] = battle.html?stage=…&run=…&return=stage.html (보상 없음)
 *  결과 반영 (돌아온 주소 ?stage=1-N&run=runId&result=win|lose|draw|error) — 딱 한 번 (던전과 같은 방식):
 *    1) 저장소에서 다시 읽음 (다른 탭이 먼저 반영했을 수 있음)  2) X.applyResult (이미 반영한 runId = 지급 없음 · 진행 중인 판과 다르면 반영 안 함 · 첫 클리어만 보상)
 *    3) 저장 → history.replaceState 로 stage · run · result 를 주소에서 지움 (새로고침해도 다시 반영되지 않음)
 *    4) 1-6 첫 클리어 = 던전 개방 · 안내 ③
 *    · 1-1 첫 클리어 + 편성이 덜 참 = 동료 모으기 안내(소환 / 편성) · 패배 · 무승부 알림 = [소환하러 가기] [편성 확인] · 1-2 첫 패배는 한 번만 강조(stage.guide.defeat)
 *  끝나지 않은 판(stage.open) = [이어서 하기] (같은 runId · 같은 전투 · 입장 비용 없음)
 *  시험용 window.TaleliaStageUI = { S, save, render, select, enter, resume, applyReturn, urls, setNav, setNow, commit, reload, power }
 * ===================================================================== */
(function(){
  'use strict';
  const G = window.TaleliaGacha, D = window.TALELIA_GACHA, DS = window.TALELIA_STAGE, X = window.TaleliaStage;
  const q = new URLSearchParams(location.search);
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const fmt = n => Math.round(n).toLocaleString('ko-KR');
  const enc = encodeURIComponent;
  const RUN_RE = /^\d{4}-\d{2}-\d{2}#st\d{3}$/, RESULTS = ['win', 'lose', 'draw'];
  const PLACE = { farm_field: '마을 밭', meadow: '들판', forest_edge: '숲 가장자리', warehouse: '버려진 창고', village: '마을', stream_upper: '개울 상류', village_dusk: '마을 어귀', village_fire: '불타는 마을 광장' };
  const RES_NAME = { win: '승리', lose: '패배', draw: '무승부' };
  const STORY_PARTY = ['s24', 'hamster_hammer', 'hamster_explorer'];   // 편성이 비었을 때 함께하는 캐릭터 (결정 6 · view.js 와 같음)

  const store = window.TaleliaGachaStore.create(D, { key: q.get('savekey') || undefined });
  const loaded = store.load();
  let save = loaded.save;
  const S = { sel: null, notice: null, guide: null, last: null, status: loaded.status };
  let clock = () => Date.now(), nav = url => { location.href = url; };
  { const t = Date.parse(q.get('now') || ''); if(isFinite(t)) clock = () => t; }

  /** 주인공 이름 (24호 → 엘피 · 1-1 클리어 저장이면 엘피) */
  const hero = () => (window.TaleliaNames && window.TaleliaNames.nameOf('s24', save, 'call')) || '24호';
  function commit(next){ save = next; store.save(next); if(window.TaleliaNames) window.TaleliaNames.apply(next); render(); }   // 1-1 첫 클리어가 반영되면 이름도 바로 엘피로
  function reload(){ const r = store.load(); save = r.save; return save; }

  /* ---------- 주소 ---------- */
  const kq = () => q.get('savekey') ? '&savekey=' + enc(q.get('savekey')) : '';
  const k1 = () => q.get('savekey') ? '?savekey=' + enc(q.get('savekey')) : '';
  const urls = {
    town: () => 'town.html' + k1(),
    party: () => 'gacha.html?tab=party' + kq(),
    dungeon: () => 'gacha.html?tab=dungeon' + kq(),
    summonFrom: id => 'gacha.html?tab=pull' + kq() + '&from=stage&stage=' + enc(id),   // 소환 · 편성 화면에 [스테이지로] 링크가 생김
    partyFrom: id => 'gacha.html?tab=party' + kq() + '&from=stage&stage=' + enc(id),
    story: (st, runId) => 'story.html?scene=st1_' + st.n + '_pre&run=' + enc(runId) + kq(),
    skip: (st, runId) => 'battle.html?stage=' + enc(st.id) + '&run=' + enc(runId) + kq() + '&return=' + enc('stage.html' + k1())
  };
  /** 돌아온 결과 주소 부분만 지움 (저장한 뒤에 부름) */
  function cleanUrl(){
    try{ const u = new URL(location.href); ['stage', 'run', 'result', 'go'].forEach(k => u.searchParams.delete(k)); history.replaceState(null, '', u.pathname.split('/').pop() + u.search + u.hash); }catch(e){}
  }

  /* ---------- 전투력 (보기용 · 뽑기 화면과 같은 식 · 스토리 전투는 장비 미적용이라 성급 · 강화 · 초월만) ---------- */
  const pw = s => s.hp / 10 + s.atk + s.def * 1.5 + s.spd / 2;
  function partyUnits(sv){
    const list = sv.party.length ? sv.party.map(p => sv.units.find(u => u.uid === p.uid)).filter(Boolean) : STORY_PARTY.map(sp => sv.units.find(u => u.species === sp)).filter(Boolean);
    return { units: list, auto: !sv.party.length };
  }
  const myPower = sv => Math.round(partyUnits(sv).units.reduce((a, u) => a + pw(G.statsOf(D, u)), 0));
  const enemyPower = id => Math.round((X.waveOf(DS, id) || []).reduce((a, e) => a + pw(e), 0));
  const nextOf = id => { const i = X.indexOf(DS, id); return DS.stages[i + 1] || null; };
  const stateOf = (sv, st) => (sv.stage.cleared[st.id] ? 'cleared' : X.isOpen(DS, sv, st.id) ? 'open' : 'locked');

  /* ---------- 그리기 ---------- */
  /** 장 제목: 데이터의 "(가제)" 는 ?dev=1 에서만 · 일반 접속은 장 번호 + 무대 이름 (데이터는 바꾸지 않음) */
  const chapterTitle = () => window.TaleliaDev ? DS.chapter.title : DS.chapter.title.replace(/\s*\(가제\)\s*$/, ' · 토끼마을');
  function defaultSel(sv){ const o = DS.stages.find(st => !sv.stage.cleared[st.id] && X.isOpen(DS, sv, st.id)); return (o || DS.stages[DS.stages.length - 1]).id; }
  function render(){
    const sv = save;
    if(!S.sel || !X.stageOf(DS, S.sel)) S.sel = defaultSel(sv);
    $('#sgTitle').textContent = chapterTitle(); $('#sgStones').textContent = fmt(sv.stones); $('#sgGold').textContent = fmt(sv.gold);
    $('#sgTown').setAttribute('href', urls.town());
    renderMap(sv);
    // 끝나지 않은 판
    const op = sv.stage.open, ol = $('#sgOpen');
    ol.hidden = !op;
    ol.innerHTML = op ? '<li><span>끝나지 않은 전투 · ' + esc(op.id) + ' <small data-dev-only>' + esc(op.runId) + '</small></span><button type="button" class="gc-btn gc-btn--small" data-resume="' + esc(op.id) + '">이어서 하기</button></li>' : '';
    renderSheet(); renderNotice(); renderGuide();
  }
  /* ---------- 월드맵 (화면 전용 · 상태는 stateOf 그대로) ---------- */
  const MAP = window.TALELIA_STAGE_MAP || { bg: null, nodes: {}, paths: [] };
  const posOf = (st, i) => MAP.nodes[st.id] || { x: 10 + i * 80 / Math.max(1, DS.stages.length - 1), y: 50 };   // 좌표가 빠진 스테이지는 가운데 줄에 차례로
  /** 길 상태: done = 도착 스테이지 클리어 · next = 출발은 클리어 · 도착은 도전 가능 · locked = 그 밖 */
  function pathState(sv, p){
    const a = X.stageOf(DS, p.from), b = X.stageOf(DS, p.to); if(!a || !b) return 'locked';
    const sa = stateOf(sv, a), sb = stateOf(sv, b);
    return sb === 'cleared' && sa === 'cleared' ? 'done' : sa === 'cleared' && sb === 'open' ? 'next' : 'locked';
  }
  /** 점들을 지나는 부드러운 곡선 (Catmull-Rom → 3차 베지어) · 좌표는 viewBox 1600×900 */
  function curve(pts){
    const P = pts.map(([x, y]) => [x * 16, y * 9]), f = n => Math.round(n * 10) / 10;
    let d = 'M' + f(P[0][0]) + ' ' + f(P[0][1]);
    for(let i = 0; i < P.length - 1; i++){
      const p0 = P[i - 1] || P[i], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2] || p2;
      d += ' C' + f(p1[0] + (p2[0] - p0[0]) / 6) + ' ' + f(p1[1] + (p2[1] - p0[1]) / 6) + ' ' + f(p2[0] - (p3[0] - p1[0]) / 6) + ' ' + f(p2[1] - (p3[1] - p1[1]) / 6) + ' ' + f(p2[0]) + ' ' + f(p2[1]);
    }
    return d;
  }
  let bgSet = false;
  function renderMap(sv){
    const world = $('#sgWorld'), img = $('#sgMapBg');
    if(!bgSet){ bgSet = true;   // 배경 그림: 한 번만 · 못 불러오면 임시 배경
      if(MAP.bg){ img.onload = () => { img.hidden = false; world.classList.remove('is-noart'); }; img.onerror = () => { img.hidden = true; world.classList.add('is-noart'); }; img.src = MAP.bg; }
      else world.classList.add('is-noart');
    }
    // 길
    $('#sgPaths').innerHTML = (MAP.paths || []).filter(p => MAP.nodes[p.from] && MAP.nodes[p.to]).map(p => {
      const st = pathState(sv, p), d = curve([[MAP.nodes[p.from].x, MAP.nodes[p.from].y]].concat(p.via || [], [[MAP.nodes[p.to].x, MAP.nodes[p.to].y]]));
      return '<g class="sg-path" data-from="' + esc(p.from) + '" data-to="' + esc(p.to) + '" data-state="' + st + '">'
        + (st === 'done' ? '<path class="sg-path__glow" d="' + d + '"/>' : '') + '<path class="sg-path__case" d="' + d + '"/><path class="sg-path__line" d="' + d + '"/></g>';   // case = 그림 위에서도 보이게 깔아 두는 어두운 테두리 선
    }).join('');
    // 노드 (클래스 · 속성은 예전 그대로: .sg-node · data-stage · data-state · aria-selected)
    $('#sgNodes').innerHTML = DS.stages.map((st, i) => {
      const s = stateOf(sv, st), label = s === 'locked' ? '🔒 ' + DS.stages[X.indexOf(DS, st.id) - 1].id + ' 클리어 필요' : s === 'cleared' ? '★ 클리어' : '도전 가능';
      const p = posOf(st, i), side = ['above', 'left', 'right'].includes(p.label) ? p.label : 'below';
      return '<li class="sg-pin" data-label="' + side + '" style="left:' + p.x + '%;top:' + p.y + '%"><button type="button" class="sg-node" data-stage="' + st.id + '" data-state="' + s + '" aria-selected="' + (st.id === S.sel) + '" aria-label="' + esc(st.id + ' ' + st.title + ' · ' + label) + '">'
        + '<b>' + st.id + '</b><span class="sg-node__tag"><span>' + esc(st.title) + '</span><small>' + esc(label) + '</small></span>'
        + (window.TaleliaDev ? '<i class="sg-node__xy" aria-hidden="true">' + p.x + ', ' + p.y + '</i>' : '') + '</button></li>';
    }).join('');
    renderGrid();
  }
  /** 좌표 맞추기 도움 (?dev=1 만 · 배포 빌드는 TaleliaDev 가 늘 거짓): 10% 격자 + 누른 곳 좌표 */
  function renderGrid(){
    const g = $('#sgGrid'); if(!window.TaleliaDev){ g.hidden = true; g.innerHTML = ''; return; }
    if(g.dataset.ready) return; g.dataset.ready = '1'; g.hidden = false;
    let h = ''; for(let i = 1; i < 10; i++) h += '<i class="sg-grid__v" style="left:' + i * 10 + '%"><em>' + i * 10 + '</em></i><i class="sg-grid__h" style="top:' + i * 10 + '%"><em>' + i * 10 + '</em></i>';
    g.innerHTML = h + '<output class="sg-grid__out">x, y (%)</output>';
    $('#sgWorld').addEventListener('pointermove', e => { const r = $('#sgWorld').getBoundingClientRect(), o = g.querySelector('output');
      if(o) o.textContent = 'x ' + Math.round((e.clientX - r.left) / r.width * 1000) / 10 + ' · y ' + Math.round((e.clientY - r.top) / r.height * 1000) / 10; });
  }
  /** 가로 스크롤 지도(휴대폰 세로): 고른 노드를 지도 가운데로 */
  function centerSel(smooth){
    const map = $('#sgMap'), b = map && map.querySelector('.sg-node[aria-selected="true"]');
    if(!b || map.scrollWidth <= map.clientWidth + 1) return;
    const r = b.closest('.sg-pin').getBoundingClientRect(), m = map.getBoundingClientRect();
    const left = map.scrollLeft + (r.left - m.left) - map.clientWidth / 2;
    try{ map.scrollTo({ left: Math.max(0, left), behavior: smooth ? 'smooth' : 'auto' }); }catch(e){ map.scrollLeft = Math.max(0, left); }
  }

  function renderSheet(){
    const sv = save, st = X.stageOf(DS, S.sel), s = stateOf(sv, st), cleared = s === 'cleared';
    $('#sgShNo').textContent = st.id; $('#sgShTitle').textContent = st.title;
    $('#sgShState').textContent = s === 'locked' ? '🔒 잠김' : cleared ? '★ 클리어' : '도전 가능';
    $('#sgShPlace').textContent = '장소 · ' + (PLACE[st.place] || st.place) + ' · 적 ' + st.wave.length + '마리';
    // 나오는 적 (종류별 개수 · 변이는 보라빛 · 그림 없는 종류는 글자 자리)
    const groups = []; for(const [t, , , o] of st.wave){ const mut = !!(o && o.mutant), g = groups.find(x => x.t === t && x.mut === mut); if(g) g.n++; else groups.push({ t, mut, n: 1 }); }
    $('#sgShEnemies').innerHTML = groups.map(g => { const ty = DS.enemyTypes[g.t], name = (g.mut ? '변이 ' : '') + ty.name;
      const pic = ty.img ? '<img src="' + esc(ty.img) + '" alt="" draggable="false" onerror="this.replaceWith(Object.assign(document.createElement(\'i\'),{textContent:\'' + esc(ty.name[0]) + '\'}))">' : '<i aria-hidden="true">' + esc(ty.name[0]) + '</i>';
      return '<li' + (g.mut ? ' class="is-mutant"' : '') + '>' + pic + esc(name) + (ty.placeholder ? ' <small>(디자인 준비 중)</small>' : '') + (ty.boss ? ' <em>보스</em>' : '') + ' ×' + g.n + '</li>'; }).join('');
    $('#sgShEnemyPower').textContent = fmt(enemyPower(st.id));
    const pu = partyUnits(sv);
    $('#sgShMyPower').textContent = fmt(myPower(sv)) + (pu.auto ? ' (편성이 비어 ' + hero() + ' · 망치 · 탐험가가 함께해요)' : ' (' + pu.units.length + '명)');
    $('#sgShReward').textContent = cleared ? '받음 (첫 클리어 때만 줘요)' : '정령석 +' + fmt(st.reward.stones) + ' · 골드 +' + fmt(st.reward.gold) + (st.reward.tstones ? ' · 초월석 +' + fmt(st.reward.tstones) : '');
    // 버튼
    const e = enterState(sv, st), btn = $('#sgEnter'), skip = $('#sgSkip');
    btn.textContent = (sv.stage.open && sv.stage.open.id === st.id ? '이어서 하기 ' : '') + st.id + ' 입장'; btn.disabled = !e.ok;
    skip.hidden = !cleared; skip.disabled = !e.ok;
    $('#sgWhy').textContent = e.ok ? '' : e.why;
  }
  function enterState(sv, st){
    if(!X.isOpen(DS, sv, st.id)){ const prev = DS.stages[X.indexOf(DS, st.id) - 1]; return { ok: false, why: (prev ? prev.id : '앞 스테이지') + ' 를 먼저 클리어해야 해요' }; }
    if(!partyUnits(sv).units.length) return { ok: false, why: '함께할 캐릭터를 찾지 못했어요 · 편성 탭에서 캐릭터를 넣어 주세요' };
    return { ok: true };
  }
  function renderNotice(){
    const n = S.notice, box = $('#sgNotice'); box.hidden = !n; if(!n) return;
    box.classList.toggle('is-bad', !!n.bad); box.classList.toggle('is-first', !!n.big); $('#sgNoticeText').textContent = n.text;
    $('#sgNoticeSub').textContent = n.sub || ''; $('#sgNoticeSub').hidden = !n.sub;
    $('#sgNoticeActs').innerHTML = (n.acts || []).map(a => '<button type="button" class="gc-btn gc-btn--small' + (a.primary ? ' gc-btn--primary' : '') + '" data-act="' + esc(a.act) + '" data-arg="' + esc(a.arg || '') + '">' + esc(a.label) + '</button>').join('');
  }
  const recruitOf = sv => X.recruit(sv, D.cost.single, D.partyMax);
  /** 안내 ② 편성 · 장비 (1-1 처음 입장 때) · ③ 던전 개방 (1-6 첫 클리어 직후) */
  function renderGuide(){
    const g = S.guide, box = $('#sgGuide'); box.hidden = !g; if(!g) return;
    const btn = (act, label, primary) => '<button type="button" class="gc-btn' + (primary ? ' gc-btn--primary' : '') + '" data-gact="' + act + '">' + label + '</button>';
    if(g.kind === 'party'){
      $('#sgGuideTitle').textContent = '출전 준비';
      $('#sgGuideBody').innerHTML = '<p>편성한 동료가 함께 싸워요. 편성이 비어 있으면 ' + hero() + ' · 망치 햄스터 · 탐험가 햄스터가 함께해요.</p>'
        + '<ul><li>동료를 소환(뽑기)하면 편성의 빈 칸에 자동으로 들어가요. 편성 탭에서 [자동 편성]을 쓰거나 직접 바꿀 수 있어요.</li><li>장비는 <b>던전이 열리면</b> 얻을 수 있어요. 스토리 전투에는 장비 효과가 적용되지 않아요.</li></ul>';
      $('#sgGuideActs').innerHTML = btn('party', '편성 확인하러 가기') + btn('go', '바로 입장', true);
    } else if(g.kind === 'dungeon'){
      $('#sgGuideTitle').textContent = '던전이 열렸어요';
      $('#sgGuideBody').innerHTML = '<p>1장을 끝내서 던전에 들어갈 수 있어요. 던전에서 장비를 얻고, 강화하고, 세트를 모아 동료를 더 강하게 키워 보세요.</p><ul><li>장비는 던전과 장비 탭에서 다뤄요.</li><li>스토리 전투(1장)에는 장비 효과가 적용되지 않아요.</li></ul>';
      $('#sgGuideActs').innerHTML = btn('later', '나중에') + btn('dungeon', '던전으로', true);
    } else if(g.kind === 'recruit'){
      const summon = g.primary === 'summon';
      $('#sgGuideTitle').textContent = summon ? '소환으로 동료를 뽑자' : '동료를 편성하자';
      $('#sgGuideBody').innerHTML = summon
        ? '<p>다음 전투부터는 ' + D.partyMax + '명이 함께 싸워야 해요. 정령석으로 동료를 불러 보세요.</p><ul><li>뽑은 동료는 편성의 빈 칸에 자동으로 들어가요.</li></ul>'
        : '<p>다음 전투부터는 ' + D.partyMax + '명이 함께 싸워야 해요. 편성에 빈 칸이 있어요.</p><ul><li>편성 탭의 [자동 편성]을 누르면 한 번에 채워져요.</li></ul>';
      $('#sgGuideActs').innerHTML = btn('later', '나중에') + (summon ? btn('summon', '소환하러 가기', true) : btn('party', '편성 확인', true));
    }
    const first = box.querySelector('[data-gact]:last-of-type'); if(first) setTimeout(() => { try{ first.focus({ preventScroll: true }); }catch(e){} }, 0);
  }

  /* ---------- 고르기 · 입장 · 이어서 하기 ---------- */
  function select(id){ if(!X.stageOf(DS, id)) return false; S.sel = id; render(); centerSel(true); return true; }
  /** 입장: 저장소에서 다시 읽고(다른 탭 반영) → (1-1 처음이면 안내 ②) → runId 기록 → 저장 → 이야기(또는 클리어 스테이지 건너뛰기 = 전투) 로 */
  function enter(id, opts){
    opts = opts || {}; const cur = reload(), st = X.stageOf(DS, id);
    if(!st) return { ok: false, reason: '없는 스테이지' };
    const es = enterState(cur, st); if(!es.ok){ S.notice = { text: es.why, bad: true }; render(); return { ok: false, reason: es.why }; }
    if(id === DS.stages[0].id && !cur.stage.guide.party && !opts.noGuide){ S.guide = { kind: 'party', id, skip: !!opts.skip }; render(); return { ok: false, guide: 'party' }; }
    const e = X.enter(DS, cur, id, clock()); if(!e.ok){ S.notice = { text: e.reason, bad: true }; render(); return e; }
    if(!e.resume) commit(e.save);
    const skip = !!opts.skip && !!cur.stage.cleared[id], url = skip ? urls.skip(st, e.runId) : urls.story(st, e.runId);
    S.last = { kind: e.resume ? 'resume' : 'enter', id, runId: e.runId, url, skip }; nav(url);
    return Object.assign({}, e, { url });
  }
  function resume(id){ const op = reload().stage.open; if(!op || op.id !== id){ S.notice = { text: '이어서 할 전투를 찾지 못했어요', bad: true }; render(); return { ok: false }; } return enter(id, { noGuide: true }); }

  /* ---------- 결과 반영 (runId 로 딱 한 번) ---------- */
  function noticeFor(r, st){
    if(r.result === 'win' && r.first){
      const nx = nextOf(st.id), acts = [];
      if(nx) acts.push({ act: 'select', arg: nx.id, label: nx.id + ' 보러 가기' });
      return { text: st.id + ' 첫 클리어! 정령석 +' + fmt(r.reward.stones) + ' · 골드 +' + fmt(r.reward.gold) + (r.reward.tstones ? ' · 초월석 +' + fmt(r.reward.tstones) : ''), acts };
    }
    if(r.result === 'win'){ const nx = nextOf(st.id); return { text: st.id + ' 클리어 · 보상은 첫 클리어 때만 받아요', acts: nx && X.isOpen(DS, save, nx.id) ? [{ act: 'select', arg: nx.id, label: nx.id + ' 보러 가기' }] : [] }; }
    const rc = recruitOf(save), act = (a, label) => ({ act: a, arg: st.id, label, primary: rc.primary === a });
    const go = [act('summon', '소환하러 가기'), act('party', '편성 확인')]; if(rc.primary === 'party') go.reverse();
    return { text: st.id + ' ' + RES_NAME[r.result] + ' · 보상 없음 · 입장 비용 없이 다시 도전할 수 있어요', sub: rc.text, acts: go.concat({ act: 'retry', arg: st.id, label: '다시 도전' }) };
  }
  /** 돌아온 주소 처리 · 반환 = { status: 'applied' | 'duplicate' | 'rejected' | 'error' | 'none', … } */
  function applyReturn(p){
    const out = { status: 'none' };
    if(p.result === 'error'){ S.notice = { text: '전투를 시작하지 못했어요 · 끝나지 않은 전투에서 이어서 할 수 있어요', bad: true }; out.status = 'error'; cleanUrl(); render(); return out; }
    const st = X.stageOf(DS, p.stage);
    if(!st || !RUN_RE.test(p.run || '') || !RESULTS.includes(p.result)){ S.notice = { text: '확인되지 않은 전투라 반영하지 않았어요', bad: true }; out.status = 'rejected'; cleanUrl(); render(); return out; }
    const cur = reload(), r = X.applyResult(DS, cur, { runId: p.run, id: p.stage, result: p.result }, clock());
    if(r.ok){
      commit(r.save); out.status = 'applied'; out.first = r.first; out.reward = r.reward; out.dungeonUnlocked = r.dungeonUnlocked; S.sel = p.stage;
      S.notice = noticeFor(r, st);
      if(r.result !== 'win' && X.firstDefeat(save, p.stage)){   // 1-2 첫 패배: 이번 한 번만 크게
        S.notice.big = true;
        const m = X.markGuide(save, 'defeat'); if(m.ok) commit(m.save);
      }
      if(r.result === 'win' && r.first && p.stage === DS.stages[0].id){   // 1-1 첫 클리어: 편성이 덜 찼으면 동료 모으기 안내
        const rc = recruitOf(save);
        if(!rc.full && (rc.canPull || rc.canFill)) S.guide = { kind: 'recruit', primary: rc.primary, next: DS.stages[1].id };
      }
      if(r.result === 'win' && nextOf(p.stage) && X.isOpen(DS, save, nextOf(p.stage).id)) S.sel = nextOf(p.stage).id;
      if(r.dungeonUnlocked && !save.stage.guide.dungeon) S.guide = { kind: 'dungeon' };   // 안내 ③ (1-6 첫 클리어 직후)
    } else if(r.duplicate){ S.notice = { text: '이미 반영한 결과예요 (' + p.stage + ' · 다시 지급되지 않아요)' }; out.status = 'duplicate'; S.sel = p.stage; }
    else { S.notice = { text: '확인되지 않은 전투라 반영하지 않았어요', bad: true }; out.status = 'rejected'; out.reason = r.reason; }
    cleanUrl(); render();
    return out;
  }

  /* ---------- 눌림 ---------- */
  $('#sgNodes').addEventListener('click', e => { const b = e.target.closest('[data-stage]'); if(b) select(b.dataset.stage); });
  $('#sgOpen').addEventListener('click', e => { const b = e.target.closest('[data-resume]'); if(b) resume(b.dataset.resume); });
  $('#sgEnter').addEventListener('click', () => enter(S.sel));
  $('#sgSkip').addEventListener('click', () => enter(S.sel, { skip: true }));
  $('#sgParty').addEventListener('click', () => nav(urls.party()));
  $('#sgNotice').addEventListener('click', e => { const b = e.target.closest('[data-act]'); if(!b) return;
    if(b.dataset.act === 'summon') nav(urls.summonFrom(b.dataset.arg)); else if(b.dataset.act === 'party') nav(urls.partyFrom(b.dataset.arg));
    else if(b.dataset.act === 'select') select(b.dataset.arg); else if(b.dataset.act === 'retry'){ S.notice = null; enter(b.dataset.arg); } });
  $('#sgGuide').addEventListener('click', e => { const b = e.target.closest('[data-gact]'); if(!b || !S.guide) return;
    const g = S.guide, a = b.dataset.gact; S.guide = null;
    if(g.kind === 'party'){ const m = X.markGuide(reload(), 'party'); if(m.ok) commit(m.save); if(a === 'party') nav(urls.party()); else enter(g.id, { skip: g.skip, noGuide: true }); }
    else if(g.kind === 'dungeon'){ const m = X.markGuide(reload(), 'dungeon'); if(m.ok) commit(m.save); if(a === 'dungeon') nav(urls.dungeon()); else render(); }
    else if(g.kind === 'recruit') closeRecruit(g, a); });
  /** 동료 모으기 안내를 닫음 (저장 칸 없음) · [마을로] 를 눌러 온 길이면 [나중에] 는 마을로 */
  function closeRecruit(g, a){
    if(a === 'summon') nav(urls.summonFrom(g.next)); else if(a === 'party') nav(urls.partyFrom(g.next));
    else { render(); if(g.town) nav(urls.town()); }
  }
  document.addEventListener('keydown', e => { if(e.key === 'Escape' && S.guide){ const g = S.guide; S.guide = null; if(g.kind === 'recruit'){ closeRecruit(g, 'later'); return; } const m = X.markGuide(reload(), g.kind === 'party' ? 'party' : 'dungeon'); if(m.ok && g.kind === 'dungeon') commit(m.save); else render(); } });

  window.TaleliaStageUI = { S, get save(){ return save; }, render, select, centerSel, map: MAP, pathState: p => pathState(save, p), enter, resume, applyReturn, urls, setNav: fn => { nav = fn; }, setNow: fn => { clock = fn; render(); }, commit, reload, power: { my: myPower, enemy: enemyPower } };
  { const F = window.TaleliaStageRewardFix;   // 1장 보상 분배 변경의 차액 보충 (한 번만 · 저장 버전은 그대로)
    if(F){ const r = F.fix(DS, reload()); if(r.ok && !r.already){ save = r.save; store.save(save); if(r.added > 0 || r.tAdded > 0) S.notice = { text: F.message(r) }; } } }
  if(loaded.status === 'corrupt') S.notice = { text: '저장이 망가져 새로 시작했어요 (예전 저장은 따로 보관됐어요)', bad: true };
  render();
  if(q.get('stage') && q.get('run') && q.get('result')){
    const go = q.get('go'), id = q.get('stage'), r = applyReturn({ stage: id, run: q.get('run'), result: q.get('result') });
    // 전투 결과 [마을로] (H4) · [소환하러 가기] · [편성 확인]: 결과를 한 번 반영한 뒤 그 화면으로 · 안내(1-1 동료 모으기 · 1-6 던전)가 떠 있으면 안내를 먼저 보여 줌 · 반영하지 못한 결과는 알림을 보여 주고 머무름
    const dest = go === 'town' ? urls.town() : go === 'summon' ? urls.summonFrom(id) : go === 'party' ? urls.partyFrom(id) : null;
    if(dest && (r.status === 'applied' || r.status === 'duplicate')){
      if(!S.guide) nav(dest); else if(go === 'town' && S.guide.kind === 'recruit') S.guide.town = true;
    }
  }
  else if(q.get('stage') && X.stageOf(DS, q.get('stage'))) select(q.get('stage'));
  /* 휴대폰: 아래에 고정한 [입장] 줄의 실제 높이를 지도 여백으로 · 처음 열 때 고른 스테이지가 가려져 있으면 보이는 자리로 (알림 · 안내가 있으면 위를 그대로 둠) */
  { const bar = $('#sgBar'), fit = () => $('#stage').style.setProperty('--sg-bar-h', Math.ceil(bar.getBoundingClientRect().height) + 'px');
    if(window.ResizeObserver) new ResizeObserver(fit).observe(bar); fit();
    const node = $('.sg-node[aria-selected="true"]');
    if(node && !S.notice && !S.guide && getComputedStyle(bar).position === 'fixed' && node.getBoundingClientRect().bottom > window.innerHeight - bar.getBoundingClientRect().height) node.scrollIntoView({ block: 'center' });
    centerSel(false); addEventListener('orientationchange', () => setTimeout(() => centerSel(false), 300)); }   // 가로 스크롤 지도(휴대폰 세로): 고른 스테이지를 가운데로
})();
