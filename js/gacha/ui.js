/* =====================================================================
 * TALELIA · gacha/ui.js — 정령 소환 화면 · 소환 연출 · 보관함 · 도감 (화면 전용 · 규칙은 rules.js · 저장은 store.js)
 *
 *  소환 화면
 *   summon_bg 전체 · 원형 제단 위에 고른 소환의 대표 캐릭터 (배경 · 캐릭터 위치는 layoutScene 이 화면 크기에 맞춰 계산)
 *   오른쪽 소환 목록 (D.banners · 한 줄 더하면 늘어남) · 아래 양피지 패널 (천장 · 10회 보장 · 확률 · 재화 · 1회 / 10회)
 *  소환 연출 (runShow)
 *   1) 영상 — 결과 중 가장 높은 등급으로 하나 (일반~영웅 basic · 전설 legend · 설화 myth) · 10회도 한 번만 · 원래 속도
 *      영상은 처음에 미리 불러 둠 · 1.2초 안에 재생이 시작되지 않거나 오류면 코드 연출로 대신
 *   2) 빛 화면 → 영웅 이상만 결과 순서대로 전체 화면 컷인 (D.cutin 초 · 설화는 은빛 효과 더 강하게)
 *   3) 결과 카드 — card_back 이 차례로 뒤집힘
 *   어느 때든 화면을 누르거나 Space · Enter · Esc = 바로 결과 화면 (모두 펼침) · 움직임 줄이기 = 영상 · 컷인 없이 바로 결과
 *  시험용 window.TaleliaGachaUI = { save, pull, skip, revealAll, closeResult, tab, banner, state, seed, layout, card }
 *  상세 · 강화 · 승급 · 초월 · 편성 화면은 js/gacha/manage.js (hooks 로 연결: 보관함 카드 누름 → hooks.openDetail · 편성 탭 → hooks.renderParty)
 *   state.show = { phase: 'video'|'flash'|'cutin'|'result'|'done', video, how: 'video'|'fallback'|'none', cutins: [{species, rarity, ms}], skipped }
 * ===================================================================== */
(function(){
  'use strict';
  const G = window.TaleliaGacha, D = window.TALELIA_GACHA, q = new URLSearchParams(location.search);
  const $ = s => document.querySelector(s), $$ = s => Array.from(document.querySelectorAll(s));
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const root = $('#gacha');
  const reduced = q.get('motion') === 'reduce' ? true : q.get('motion') === 'full' ? false : !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  root.classList.toggle('is-reduced', reduced);
  const num = (k, d) => { const v = parseFloat(q.get(k)); return isFinite(v) && v > 0 ? v : d; };
  const VIDEO_RATE = num('videorate', 1), CUTIN_SCALE = num('cutinscale', 1), START_WAIT = 1200;

  // 저장 · 난수
  const store = window.TaleliaGachaStore.create(D, { key: q.get('savekey') || undefined });
  const loaded = store.load(); let save = loaded.save;
  const seed = (+q.get('seed') >>> 0) || ((window.crypto && crypto.getRandomValues) ? (crypto.getRandomValues(new Uint32Array(1))[0] || 1) : (Date.now() >>> 0));
  const rnd = G.rng(seed);
  const banners = (D.banners && D.banners.length) ? D.banners : [{ id: 'standard', kind: 'standard', name: '일반 소환', tag: '상시', desc: '', featured: Object.keys(D.species).filter(id => D.species[id].gacha).slice(0, 1) }];
  const S = { tab: 'pull', filter: 'all', sort: 'rarity', banner: banners[0].id, pick: 0, res: null, show: null, lastShow: null, timers: [] };
  const notice = { memory: '이 브라우저에 저장할 수 없어 화면을 닫으면 결과가 사라져요.', corrupt: '저장 내용이 망가져 새로 시작했어요. (예전 내용은 따로 보관해 두었어요)' }[loaded.status];
  if(notice){ $('#gcNotice').textContent = notice; $('#gcNotice').hidden = false; }
  const persist = () => { if(!store.save(save) && store.available) toast('저장하지 못했어요'); };
  const fmt = n => n.toLocaleString('ko-KR');

  // 아이콘 · 가격
  const UI = D.ui || {};
  $$('img[data-ico]').forEach(img => { const src = UI[img.dataset.ico]; if(src) img.src = src; else img.remove(); });
  $$('[data-cost]').forEach(b => { b.textContent = fmt(D.cost[b.dataset.cost]); });

  /* ---------- 카드 ---------- */
  const rarityOf = sp => sp.story ? 'story' : sp.rarity;
  const rarityName = sp => sp.story ? '스토리' : D.rarities[sp.rarity].name;
  const artOf = sp => sp.card || sp.art || null;
  const startStar = sp => sp.startStar || (sp.rarity && D.rarities[sp.rarity].startStar) || 1;
  /** 카드 한 장 (unit = 보유 개체 · 없으면 도감용 종류 카드) */
  function card(speciesId, opt){
    opt = opt || {};
    const sp = D.species[speciesId], u = opt.unit, star = u ? u.star : startStar(sp);
    const el = document.createElement('div');
    el.className = 'gc-card r-' + rarityOf(sp) + (opt.unseen ? ' is-unseen' : '');
    el.dataset.species = speciesId; if(u) el.dataset.uid = u.uid;
    const art = artOf(sp), ph = sp.placeholder || { icon: '❔', color: '#888' };
    const tags = [];
    if(opt.isNew) tags.push('<span class="gc-tag gc-tag--new">NEW</span>');
    if(opt.pity) tags.push('<span class="gc-tag gc-tag--pity">천장 확정</span>');
    if(opt.guaranteed) tags.push('<span class="gc-tag gc-tag--guar">10회 보장</span>');
    if(u && u.enh) tags.push('<span class="gc-tag gc-tag--enh">+' + u.enh + '</span>');
    if(u && u.tr) tags.push('<span class="gc-tag gc-tag--tr">초월 ' + u.tr + '</span>');
    if(u && save.party.some(p => p.uid === u.uid)) tags.push('<span class="gc-tag gc-tag--party">편성</span>');
    if(u && u.lock) tags.push('<span class="gc-tag gc-tag--lock">🔒</span>');
    el.innerHTML = '<div class="gc-card__face">'
      + '<div class="gc-card__art">' + (art ? '<img alt="" draggable="false" decoding="async" src="' + esc(art) + '">' : '<div class="gc-card__ph" style="--ph:' + esc(ph.color) + '"><span>' + esc(ph.icon) + '</span><small>그림 준비 중</small></div>') + '</div>'
      + '<span class="gc-card__rar">' + esc(rarityName(sp)) + '</span>'
      + (opt.unseen ? '' : '<span class="gc-card__stars" aria-label="' + star + '성">' + '★'.repeat(star) + '</span>')
      + '<div class="gc-card__tags">' + tags.join('') + '</div>'
      + '<div class="gc-card__name">' + esc(opt.unseen ? '???' : sp.name) + '</div></div>';
    el.setAttribute('aria-label', opt.unseen ? '아직 만나지 못한 캐릭터' : rarityName(sp) + ' ' + sp.name + (u ? ' ' + u.star + '성' + (u.enh ? ' ' + u.enh + '강' : '') + (u.tr ? ' 초월 ' + u.tr : '') : ''));
    const img = el.querySelector('.gc-card__art img');
    if(img) img.addEventListener('error', () => { img.parentNode.innerHTML = '<div class="gc-card__ph" style="--ph:' + esc(ph.color) + '"><span>' + esc(ph.icon) + '</span><small>그림 준비 중</small></div>'; }, { once: true });
    return el;
  }

  /* ---------- 소환 화면: 배경 · 제단 위 캐릭터 ---------- */
  // 배경 그림(1672×941) 안 원형 제단 윗면 가운데 (비율) · 캐릭터 그림(544×728) 안 발끝 높이 (비율)
  const BG = { w: 1672, h: 941, ax: .352, ay: .768 }, ART_FOOT = .965;
  const scene = $('#panelPull'), bgEl = $('.gc-scene__bg'), heroEl = $('.gc-hero'), heroImg = $('#gcHeroArt');
  let lastLayout = null;
  function layoutScene(){
    const W = scene.clientWidth, H = scene.clientHeight;
    if(!W || !H) return null;
    const portrait = W / H < 1;
    const dock = $('.gc-dock').getBoundingClientRect(), sc = scene.getBoundingClientRect(), bn = $('.gc-banners').getBoundingClientRect(), plate = $('#gcHeroPlate').getBoundingClientRect();
    scene.style.setProperty('--dock-h', Math.round(dock.height) + 'px');
    const stageTop = portrait ? Math.max(bn.bottom, plate.bottom) - sc.top + 6 : 10;
    const stageBottom = dock.top - sc.top - 4;
    const stageL = 0, stageR = portrait ? W : bn.left - sc.left - 8;
    // 캐릭터 발 = 제단 윗면 · 제단은 패널 바로 위 (제단 몸통이 조금 보이게)
    const wantX = portrait ? W / 2 : (stageL + stageR) / 2;
    const lift = Math.min(H * .1, portrait ? 56 : 52);
    const wantY = stageBottom - lift;
    const heroH = Math.max(120, (wantY - stageTop) * (portrait ? .98 : .94));
    // 배경 크기: 화면을 덮고 · 캐릭터 키가 배경 높이의 50% 정도 · 제단을 원하는 곳에 놓을 수 있는 크기
    let bgH = Math.max(H, W * BG.h / BG.w, heroH / .52, (H - wantY) / (1 - BG.ay) + 1);
    let bgW = bgH * BG.w / BG.h;
    const left = Math.min(0, Math.max(W - bgW, wantX - BG.ax * bgW)), top = Math.min(0, Math.max(H - bgH, wantY - BG.ay * bgH));
    bgEl.style.width = bgW + 'px'; bgEl.style.height = bgH + 'px'; bgEl.style.left = left + 'px'; bgEl.style.top = top + 'px';
    const ax = left + BG.ax * bgW, ay = top + BG.ay * bgH;
    const h = Math.min(heroH, bgH * .6), w = h * 544 / 728;
    heroEl.style.width = w + 'px'; heroEl.style.height = h + 'px';
    heroEl.style.left = (ax - w / 2 - left) + 'px'; heroEl.style.top = (ay - h * ART_FOOT - top) + 'px';
    lastLayout = { W, H, portrait, bg: { left, top, w: bgW, h: bgH }, altar: { x: ax, y: ay }, hero: { x: ax - w / 2, y: ay - h * ART_FOOT, w, h }, stageTop, stageBottom };
    return lastLayout;
  }
  if(window.ResizeObserver) new ResizeObserver(() => layoutScene()).observe(scene);
  addEventListener('resize', layoutScene);

  const bannerOf = id => banners.find(b => b.id === id) || banners[0];
  function renderBanners(){
    const list = $('#gcBannerList');
    list.innerHTML = banners.map(b => {
      const sp = D.species[(b.featured || [])[0]], art = sp && artOf(sp);
      return '<button type="button" role="radio" class="gc-ban" data-banner="' + esc(b.id) + '" data-kind="' + esc(b.kind || 'standard') + '" aria-checked="' + (b.id === S.banner) + '">'
        + '<span class="gc-ban__thumb">' + (art ? '<img alt="" src="' + esc(art) + '">' : '') + '</span>'
        + '<span class="gc-ban__name">' + esc(b.name) + (b.tag ? ' <span class="gc-ban__tag">' + esc(b.tag) + '</span>' : '') + '</span>'
        + '<span class="gc-ban__desc">' + esc(b.desc || '') + '</span></button>';
    }).join('');
  }
  function setBanner(id){
    if(!banners.some(b => b.id === id)) return false;
    S.banner = id; S.pick = 0;
    $$('#gcBannerList .gc-ban').forEach(b => b.setAttribute('aria-checked', String(b.dataset.banner === id)));
    renderHero(true); return true;
  }
  $('#gcBannerList').addEventListener('click', e => { const b = e.target.closest('[data-banner]'); if(b) setBanner(b.dataset.banner); });
  $('#gcBannerList').addEventListener('keydown', e => {
    if(!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    e.preventDefault(); const i = banners.findIndex(b => b.id === S.banner), n = banners.length, d = (e.key === 'ArrowDown' || e.key === 'ArrowRight') ? 1 : -1;
    setBanner(banners[(i + d + n) % n].id); $('#gcBannerList [aria-checked="true"]').focus();
  });
  function renderHero(swap){
    const b = bannerOf(S.banner), feat = (b.featured || []).filter(id => D.species[id]);
    const id = feat[S.pick] || feat[0], sp = D.species[id];
    $('#gcBannerName').textContent = b.name;
    if(!sp){ heroImg.removeAttribute('src'); return; }
    const r = rarityOf(sp), plate = $('#gcHeroPlate');
    plate.className = 'gc-hero-plate gc-paper r-' + r; plate.dataset.species = id;
    $('#gcHeroRar').textContent = rarityName(sp); $('#gcHeroName').textContent = sp.name;
    const st = startStar(sp); $('#gcHeroStars').textContent = '★'.repeat(st); $('#gcHeroStars').setAttribute('aria-label', st + '성');
    if(artOf(sp)) heroImg.src = artOf(sp); heroImg.alt = sp.name; heroEl.dataset.species = id;
    $('#gcHeroPick').innerHTML = feat.length > 1 ? feat.map((f, i) => '<button type="button" class="gc-pick r-' + rarityOf(D.species[f]) + '" data-pick="' + i + '" aria-pressed="' + (i === S.pick) + '" aria-label="' + esc(D.species[f].name) + ' 보기"><img alt="" src="' + esc(artOf(D.species[f]) || '') + '"></button>').join('') : '';
    if(swap && !reduced){ heroEl.classList.remove('is-swap'); void heroEl.offsetWidth; heroEl.classList.add('is-swap'); }
    layoutScene();
  }
  $('#gcHeroPick').addEventListener('click', e => { const b = e.target.closest('[data-pick]'); if(!b) return; S.pick = +b.dataset.pick; renderHero(true); });

  function renderTop(){
    $$('[data-v="stones"]').forEach(el => { el.textContent = fmt(save.stones); });
    $$('[data-v="shards"]').forEach(el => { el.textContent = fmt(save.shards); });
    $$('[data-v="gold"]').forEach(el => { el.textContent = fmt(save.gold || 0); });
    { const chip = $('#gcTstoneChip'); if(chip){ chip.hidden = !(save.tstones > 0); const b = chip.querySelector('b'); if(b) b.textContent = fmt(save.tstones || 0); } }   // 초월석 (V3-3 · 있을 때만 보임)
    const left = D.pity ? D.pity - save.pity : 0;
    $('#gcPityLeft').textContent = left + '회';
    $('#gcPityBar').style.width = (save.pity / D.pity * 100) + '%';
    $('.gc-pity__bar').setAttribute('aria-valuenow', String(save.pity)); $('.gc-pity__bar').setAttribute('aria-valuemax', String(D.pity));
    $('#gcPull1').disabled = save.stones < D.cost.single; $('#gcPull10').disabled = save.stones < D.cost.ten;
    $('#gcPullMsg').textContent = save.stones < D.cost.single ? '정령석이 모자라요.' : save.stones < D.cost.ten ? '10회 소환에는 정령석 ' + fmt(D.cost.ten) + '개가 필요해요.' : '';
  }
  function renderRates(){
    const rows = G.rarityKeys(D).slice().reverse().map(k => {
      const r = D.rarities[k], list = Object.keys(D.species).filter(id => D.species[id].gacha && D.species[id].rarity === k);
      const each = list.length ? r.rate / list.length : 0;
      return '<tr><td><span class="gc-dot" style="--rc:var(--r-' + k + ')"></span>' + esc(r.name) + '</td><td>' + r.rate + '%</td><td>'
        + list.map(id => esc(D.species[id].name) + ' (' + (Math.round(each * 100) / 100) + '%)').join(', ') + '</td></tr>';
    });
    $('#gcRatesBody').innerHTML = rows.join('');
  }

  /* ---------- 보관함 · 도감 ---------- */
  const order = sp => sp.story ? 0 : D.rarities[sp.rarity].order;
  function renderBox(){
    const f = $('#gcFilter');
    if(!f.children.length){
      const items = [['all', '전체']].concat(G.rarityKeys(D).map(k => [k, D.rarities[k].name]), [['story', '스토리']]);
      f.innerHTML = items.map(([k, n]) => '<button type="button" data-f="' + k + '" aria-pressed="false">' + esc(n) + '</button>').join('');
      f.addEventListener('click', e => { const b = e.target.closest('button'); if(!b) return; S.filter = b.dataset.f; renderBox(); });
    }
    for(const b of f.children) b.setAttribute('aria-pressed', String(b.dataset.f === S.filter));
    let list = save.units.slice().filter(u => S.filter === 'all' || rarityOf(D.species[u.species]) === S.filter);
    const by = {
      rarity: (a, b) => order(D.species[b.species]) - order(D.species[a.species]) || b.star - a.star || b.enh - a.enh || a.species.localeCompare(b.species) || b.got - a.got,
      recent: (a, b) => b.got - a.got,
      name: (a, b) => D.species[a.species].name.localeCompare(D.species[b.species].name, 'ko') || b.star - a.star };
    list.sort(by[S.sort] || by.rarity);
    const box = $('#gcBox'); box.textContent = '';
    for(const u of list){ const c = card(u.species, { unit: u }); c.tabIndex = 0; c.setAttribute('role', 'button'); box.appendChild(c); }
    $('#gcBoxCount').textContent = '보유 ' + save.units.length + '명' + (S.filter === 'all' ? '' : ' · 보이는 카드 ' + list.length + '장');
  }
  function renderDex(){
    const ids = Object.keys(D.species).filter(id => !D.species[id].hidden).sort((a, b) => (D.species[a].story - D.species[b].story) || order(D.species[b]) - order(D.species[a]) || a.localeCompare(b));
    const dex = $('#gcDex'); dex.textContent = '';
    let seen = 0;
    for(const id of ids){
      const isSeen = save.seen[id] != null; if(isSeen) seen++;
      const n = save.units.filter(u => u.species === id).length, wrap = document.createElement('div'); wrap.className = 'gc-dex-item';
      wrap.appendChild(card(id, { unseen: !isSeen }));
      const s = document.createElement('small'); s.textContent = isSeen ? '보유 ' + n : '미발견'; wrap.appendChild(s);
      dex.appendChild(wrap);
    }
    $('#gcDexCount').textContent = '도감 ' + seen + ' / ' + ids.length + '종';
  }
  const hooks = {};   // manage.js 가 채움 (openDetail · renderParty · refreshDetail)
  function renderAll(){ renderTop(); if(S.tab === 'box') renderBox(); if(S.tab === 'dex') renderDex(); if(S.tab === 'party' && hooks.renderParty) hooks.renderParty(); if(S.tab === 'gear' && hooks.renderGear) hooks.renderGear(); if(S.tab === 'dungeon' && hooks.renderDungeon) hooks.renderDungeon(); if(hooks.refreshDetail) hooks.refreshDetail(); }
  // 보관함 카드 누름 · Enter → 캐릭터 상세
  $('#gcBox').addEventListener('click', e => { const c = e.target.closest('.gc-card[data-uid]'); if(c && hooks.openDetail) hooks.openDetail(c.dataset.uid); });
  $('#gcBox').addEventListener('keydown', e => { if(e.key !== 'Enter' && e.key !== ' ') return; const c = e.target.closest('.gc-card[data-uid]'); if(c && hooks.openDetail){ e.preventDefault(); hooks.openDetail(c.dataset.uid); } });

  /* ---------- 탭 ---------- */
  const TABS = { pull: ['#tabPull', '#panelPull'], box: ['#tabBox', '#panelBox'], party: ['#tabParty', '#panelParty'], gear: ['#tabGear', '#panelGear'], dungeon: ['#tabDungeon', '#panelDungeon'], dex: ['#tabDex', '#panelDex'] };
  function tab(name){
    S.tab = name; root.dataset.tab = name;
    for(const k in TABS){ const on = k === name; $(TABS[k][0]).setAttribute('aria-selected', String(on)); $(TABS[k][1]).hidden = !on; }
    renderAll(); if(name === 'pull') layoutScene();
  }
  for(const k in TABS) $(TABS[k][0]).addEventListener('click', () => tab(k));
  $('#gcSort').addEventListener('change', e => { S.sort = e.target.value; renderBox(); });

  /* ---------- 소환 ---------- */
  function pull(kind){
    if(S.res || S.show) return { ok: false, reason: '결과를 닫은 뒤에 소환할 수 있어요' };
    const seenBefore = Object.assign({}, save.seen), r = G.pull(D, save, kind, rnd);
    if(!r.ok){ toast(r.reason); return r; }
    const hadParty = r.save.party.length > 0, filled = G.autoFill(D, r.save);   // 뽑기 직후 빈 편성 칸 채우기 (배치해 둔 캐릭터는 그대로) · 뽑기 결과와 함께 한 번에 저장
    save = filled.save; persist(); renderAll();
    S.note = { text: !filled.added ? '' : hadParty ? '빈 칸에 동료 ' + filled.added + '명이 들어갔어요' : '편성 ' + save.party.length + '명을 자동으로 꾸렸어요', better: G.strongerParty(D, save) };
    const shown = {};   // 같은 결과 안에서 처음 나온 종류에만 NEW
    const results = r.results.map(x => { const isNew = seenBefore[x.species] == null && !shown[x.species]; shown[x.species] = true; return Object.assign({}, x, { isNew }); });
    runShow(results, { banner: S.banner, kind });
    return Object.assign({}, r, { save });
  }
  /** 결과 카드 아래 한 줄: 편성에 들어간 동료 · 더 강한 편성이 있으면 [자동 편성] */
  function renderNote(){
    const n = S.note, box = $('#gcResNote');
    box.hidden = !n || (!n.text && !n.better); if(box.hidden) return;
    $('#gcResNoteText').textContent = [n.text, n.better ? '더 강한 동료가 있어요' : ''].filter(Boolean).join(' · ');
    $('#gcResAuto').hidden = !n.better;
  }
  $('#gcResAuto').addEventListener('click', () => { closeResult(); tab('party'); if(hooks.autoParty) hooks.autoParty(); });
  $('#gcPull1').addEventListener('click', () => pull('single'));
  $('#gcPull10').addEventListener('click', () => pull('ten'));

  /* ---------- 소환 연출 ---------- */
  const rank = r => D.rarities[r] ? D.rarities[r].order : 0;
  const topOf = results => results.reduce((a, x) => rank(x.rarity) > rank(a) ? x.rarity : a, results[0].rarity);
  const videoKeyFor = r => { const V = D.summonVideo || {}; for(const k in V) if((V[k].for || []).includes(r)) return k; return Object.keys(V)[0] || null; };
  // 영상 미리 불러 두기 (궁극기 영상과 같은 방식 · 소리 없음 · 화면 안에서 재생)
  const videos = {};
  (function preload(){
    const V = D.summonVideo || {}, box = $('.gc-show__video'), over = q.get('videosrc');
    if(reduced) return;   // 움직임 줄이기 = 영상을 쓰지 않으므로 받지도 않음
    for(const k in V){
      const v = document.createElement('video');
      v.muted = true; v.defaultMuted = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.setAttribute('muted', ''); v.preload = 'auto';
      v.dataset.key = k; v.src = over || V[k].src; v.setAttribute('aria-hidden', 'true');
      v.addEventListener('error', () => { v.dataset.failed = '1'; });
      box.appendChild(v); videos[k] = v;
      try { v.load(); } catch(e){}
      if(V[k].first){ const im = new Image(); im.src = V[k].first; }
    }
  })();

  const showEl = $('#gcShow');
  /** 취소할 수 있는 기다리기 (건너뛰면 바로 끝남) */
  function waitFor(token, ms){
    return new Promise(res => { if(token.dead) return res(false); const t = setTimeout(() => { token.waits.delete(fin); res(true); }, ms); const fin = () => { clearTimeout(t); res(false); }; token.waits.add(fin); });
  }
  function kill(token){ token.dead = true; token.waits.forEach(f => f()); token.waits.clear(); }

  /** 영상 재생 → 'video' | 'fallback' (실패) | null (건너뜀) */
  async function playVideo(token, key, top){
    const v = videos[key], meta = (D.summonVideo || {})[key] || {};
    showEl.dataset.top = top; showEl.dataset.video = key || '';
    const poster = showEl.querySelector('.gc-show__poster');
    if(meta.first) poster.src = meta.first; else poster.removeAttribute('src');
    showEl.classList.add('is-wait');
    let ok = false;
    if(v && !v.dataset.failed){
      ok = await new Promise(res => {
        let done = false; const fin = val => { if(done) return; done = true; clearTimeout(t); v.removeEventListener('playing', onP); v.removeEventListener('error', onE); token.waits.delete(onK); res(val); };
        const onP = () => fin(true), onE = () => fin(false), onK = () => fin(false), t = setTimeout(() => fin(false), START_WAIT);
        v.addEventListener('playing', onP); v.addEventListener('error', onE); token.waits.add(onK);
        try { v.currentTime = 0; } catch(e){}
        v.playbackRate = VIDEO_RATE;
        const p = v.play(); if(p && p.catch) p.catch(() => fin(false));
      });
    }
    if(token.dead){ stopVideos(); return null; }
    showEl.classList.remove('is-wait');
    if(ok){
      S.show.how = 'video'; v.classList.add('is-on');
      const dur = (isFinite(v.duration) && v.duration > 0 ? v.duration : 4.5) * 1000 / VIDEO_RATE;
      await new Promise(res => {
        let done = false; const fin = () => { if(done) return; done = true; clearTimeout(t); v.removeEventListener('ended', fin); v.removeEventListener('error', fin); token.waits.delete(fin); res(); };
        const t = setTimeout(fin, dur + 1500); v.addEventListener('ended', fin); v.addEventListener('error', fin); token.waits.add(fin);
      });
      return token.dead ? null : 'video';
    }
    // 코드 연출로 대신 (빛 덩어리가 모였다가 터짐)
    S.show.how = 'fallback'; stopVideos();
    const ms = 2600 / VIDEO_RATE;
    showEl.style.setProperty('--fx-dur', ms + 'ms'); showEl.classList.add('is-fallback');
    await waitFor(token, ms);
    return token.dead ? null : 'fallback';
  }
  function stopVideos(){ for(const k in videos){ const v = videos[k]; v.classList.remove('is-on'); try { v.pause(); } catch(e){} } }

  const sparkHTML = n => Array.from({ length: n }, (_, i) => {
    const a = (i * 137.5) % 360, r = 18 + (i * 29) % 30;
    return '<i style="left:' + (50 + Math.cos(a * Math.PI / 180) * r * 1.3).toFixed(1) + '%;top:' + (50 + Math.sin(a * Math.PI / 180) * r).toFixed(1) + '%;--s:' + (8 + (i * 7) % 18) + 'px;--d:' + (1.2 + (i % 5) * .25) + 's;--dl:' + ((i * .17) % 1.4).toFixed(2) + 's"></i>';
  }).join('');
  async function playCutin(token, x){
    const sp = D.species[x.species], ci = $('.gc-cutin'), u = save.units.find(v => v.uid === x.uid);
    const ms = Math.round((D.cutin && D.cutin[x.rarity] || 1.5) * 1000 * CUTIN_SCALE);
    S.show.cutins.push({ species: x.species, rarity: x.rarity, ms, isNew: !!x.isNew });
    ci.className = 'gc-cutin r-' + x.rarity; ci.dataset.species = x.species;
    const img = ci.querySelector('.gc-cutin__art'); img.src = artOf(sp) || ''; img.alt = sp.name;
    ci.querySelector('.gc-cutin__rar').textContent = rarityName(sp);
    ci.querySelector('.gc-cutin__name').textContent = sp.name;
    const st = u ? u.star : startStar(sp); ci.querySelector('.gc-cutin__stars').textContent = '★'.repeat(st);
    ci.querySelector('.gc-cutin__new').hidden = !x.isNew;
    ci.querySelector('.gc-cutin__sparks').innerHTML = x.rarity === 'myth' ? sparkHTML(26) : x.rarity === 'legend' ? sparkHTML(10) : '';
    showEl.classList.add('is-cutin');
    void ci.offsetWidth; ci.classList.add('is-on');
    await waitFor(token, ms);
    ci.classList.remove('is-on');
  }

  async function runShow(results, info){
    const top = topOf(results), key = videoKeyFor(top), token = { dead: false, waits: new Set() };
    const sh = S.show = { phase: 'video', video: key, top, how: reduced ? 'none' : null, cutins: [], skipped: false, count: results.length, banner: info.banner, token, results };
    if(reduced){ return toResult(results, true); }
    showEl.className = 'gc-show'; showEl.hidden = false;
    showEl.setAttribute('tabindex', '-1'); showEl.focus({ preventScroll: true });
    const how = await playVideo(token, key, top);
    if(!how) return;
    // 빛 화면
    sh.phase = 'flash'; showEl.style.setProperty('--flash-dur', Math.round(550 * CUTIN_SCALE) + 'ms'); showEl.classList.add('is-flash');
    if(!await waitFor(token, Math.round(450 * Math.min(1, CUTIN_SCALE * 2)))) return;
    stopVideos(); showEl.classList.remove('is-fallback');
    // 컷인 (영웅 이상 · 결과 순서대로)
    const big = results.filter(x => rank(x.rarity) >= rank('hero'));
    if(big.length){ sh.phase = 'cutin'; for(const x of big){ await playCutin(token, x); if(token.dead) return; } }
    toResult(results, false);
  }
  /** 연출을 끝내고 결과 카드로 (instant = 모두 펼친 채) */
  function toResult(results, instant){
    const sh = S.show; if(!sh) return;
    if(sh.token) kill(sh.token);
    stopVideos();
    showEl.hidden = true; showEl.className = 'gc-show'; $('.gc-cutin').className = 'gc-cutin';
    sh.phase = 'result'; S.lastShow = sh; S.show = null;
    showResult(results, instant);
  }
  function skip(){ const sh = S.show; if(!sh) return false; sh.skipped = true; toResult(sh.results, true); return true; }
  showEl.addEventListener('click', () => skip());

  /* ---------- 결과 카드 ---------- */
  function showResult(results, instant){
    const ov = $('#gcResult'), grid = $('#gcResGrid'), top = topOf(results);
    grid.textContent = ''; grid.classList.toggle('is-one', results.length === 1);
    $('#gcResNote').hidden = true;
    ov.dataset.top = top; ov.querySelector('.gc-result__btns').hidden = true; $('#gcResHint').hidden = false;
    const flips = results.map(x => {
      const u = save.units.find(v => v.uid === x.uid), f = document.createElement('div');
      f.className = 'gc-flip'; f.dataset.r = x.rarity; f.dataset.species = x.species;
      f.innerHTML = '<div class="gc-flip__in"><div class="gc-flip__back"></div><div class="gc-flip__front"></div></div>';
      f.querySelector('.gc-flip__front').appendChild(card(x.species, { unit: u, isNew: x.isNew, pity: x.pity, guaranteed: x.guaranteed }));
      if(x.pity) f.dataset.pity = '1';
      if(x.guaranteed) f.dataset.guaranteed = '1';
      grid.appendChild(f); return f;
    });
    S.res = { flips, results, opened: 0, done: false };
    ov.hidden = false; ov.setAttribute('tabindex', '-1'); ov.focus({ preventScroll: true });
    $('#gcResLive').textContent = '';
    if(instant || reduced) return finish();
    const T = (fn, ms) => S.timers.push(setTimeout(fn, ms));
    T(() => flips.forEach(f => { if(rank(f.dataset.r) >= rank('hero')) f.classList.add('is-hint'); }), 100);
    const start = 350, step = results.length === 1 ? 0 : 140;
    flips.forEach((f, i) => T(() => open(i), start + i * step));
    T(finish, start + flips.length * step + 600);
  }
  function open(i){ const R = S.res; if(!R || R.flips[i].classList.contains('is-open')) return; R.flips[i].classList.add('is-open'); R.opened++; }
  function finish(){
    const R = S.res; if(!R || R.done) return;
    R.flips.forEach((f, i) => open(i)); R.done = true;
    S.timers.forEach(clearTimeout); S.timers = [];
    $('#gcResHint').hidden = true;
    $('#gcResult .gc-result__btns').hidden = false;
    renderNote();
    $('#gcResAgain1').disabled = save.stones < D.cost.single; $('#gcResAgain10').disabled = save.stones < D.cost.ten;
    $('#gcResLive').textContent = R.results.map(x => D.rarities[x.rarity].name + ' ' + D.species[x.species].name).join(', ');
    $('#gcResClose').focus({ preventScroll: true });
  }
  /** 연출 중이면 건너뛰고 · 카드가 뒤집히는 중이면 모두 펼침 */
  function revealAll(){ if(S.show) skip(); else finish(); }
  function closeResult(){
    if(S.show) skip();
    if(!S.res) return;
    S.timers.forEach(clearTimeout); S.timers = [];
    S.res = null; $('#gcResult').hidden = true; $('#gcResGrid').textContent = '';
    renderAll(); $(S.tab === 'pull' ? '#gcPull1' : TABS[S.tab][0]).focus({ preventScroll: true });
  }
  $('#gcResult').addEventListener('click', e => { if(e.target.closest('button')) return; if(S.res && !S.res.done) finish(); });
  $('#gcResClose').addEventListener('click', closeResult);
  $('#gcResAgain1').addEventListener('click', () => { closeResult(); pull('single'); });
  $('#gcResAgain10').addEventListener('click', () => { closeResult(); pull('ten'); });
  document.addEventListener('keydown', e => {
    if(!$('#gcRates').hidden && e.key === 'Escape'){ closeRates(); return; }
    if(S.show){ if(e.key === ' ' || e.key === 'Enter' || e.key === 'Escape'){ e.preventDefault(); skip(); } return; }
    if(!S.res) return;
    if(e.key === ' ' || e.key === 'Enter'){ if(!S.res.done){ e.preventDefault(); finish(); } }
    else if(e.key === 'Escape'){ e.preventDefault(); if(!S.res.done) finish(); else closeResult(); }
  });

  /* ---------- 확률표 · 알림 ---------- */
  function closeRates(){ $('#gcRates').hidden = true; $('#gcRatesBtn').focus({ preventScroll: true }); }
  $('#gcRatesBtn').addEventListener('click', () => { $('#gcRates').hidden = false; $('#gcRatesClose').focus({ preventScroll: true }); });
  $('#gcRatesClose').addEventListener('click', closeRates);
  $('#gcRates').addEventListener('click', e => { if(e.target === e.currentTarget) closeRates(); });
  let toastT = 0;
  function toast(msg){ const t = $('#gcToast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 2200); }

  /* ---------- 개발용 (?dev=1 · 공통 스위치 js/devmode.js · 배포 빌드에서는 늘 꺼짐) ---------- */
  if(window.TaleliaDev === true){
    $('#gcDev').hidden = false;
    $('#gcDev').addEventListener('click', e => {
      const b = e.target.closest('[data-dev]'); if(!b) return; const k = b.dataset.dev, ta = $('#gcDevText');
      if(k === 'stones'){ save = G.addStones(D, save, 3000).save; persist(); renderAll(); toast('정령석 +3,000'); }
      else if(k === 'tstones'){ save = Object.assign({}, save, { tstones: (save.tstones || 0) + 50 }); persist(); renderAll(); toast('초월석 +50'); }
      else if(k === 'shards'){ save = G.addShards(D, save, 5).save; persist(); renderAll(); toast('별의 조각 +5'); }
      else if(k === 'export'){ ta.value = store.exportText(save); ta.select(); toast('저장 내용을 아래 칸에 꺼냈어요'); }
      else if(k === 'import'){ const r = store.importText(ta.value); if(r.ok){ save = r.save; renderAll(); toast('가져왔어요'); } else toast('가져오지 못했어요: ' + r.reason); }
      else if(k === 'reset'){ if(confirm('저장을 처음 상태로 되돌릴까요? (지금 내용은 따로 보관돼요)')){ save = store.reset(); renderAll(); toast('처음 상태로 되돌렸어요'); } }
    });
  }
  store.onChange(s => { if(!S.res && !S.show){ save = s; renderAll(); } });

  /* 스테이지에서 온 사람(?from=stage&stage=1-2): 돌아가는 링크 */
  if(q.get('from') === 'stage'){
    const a = $('#gcStageBack'), id = /^\d{1,2}-\d{1,2}$/.test(q.get('stage') || '') ? q.get('stage') : '', k = q.get('savekey');
    const p = [k ? 'savekey=' + encodeURIComponent(k) : '', id ? 'stage=' + id : ''].filter(Boolean).join('&');
    a.href = 'stage.html' + (p ? '?' + p : ''); a.textContent = (id ? id + ' ' : '') + '스테이지로 →'; a.hidden = false;
  }

  renderBanners(); renderHero(false); renderRates(); tab('pull');
  /** manage.js 가 쓰는 저장 반영: 새 저장으로 바꾸고 저장 · 다시 그림 */
  function commit(next){ save = next; persist(); renderAll(); }
  /** 저장소에서 다시 읽음 (다른 탭이 먼저 바꿨을 수 있는 결과 반영 · 입장 직전에 씀 · dungeon-ui.js) */
  function reload(){ const l = store.load(); if(l.status !== 'corrupt') save = l.save; return save; }
  window.TaleliaGachaUI = { get save(){ return save; }, commit, reload, hooks, toast, rarityOf, rarityName, artOf, startStar, pull, skip, revealAll, closeResult, tab, banner: setBanner, state: S, seed, storeStatus: loaded.status, card,
    layout: () => lastLayout || layoutScene(), videos, reduced };
})();
