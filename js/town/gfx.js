/* =====================================================================
 * TALELIA · town/gfx.js — SVG ↔ 그림 파일 공존 렌더링 (T1: 그림 없이 구조만)
 *
 *  바꾸지 않는 것: 좌표(iso.js) · 카메라 · 이동 · 길 찾기 · 충돌(walk) · 정문 · 깊이(zObject · zActor) · 배치 데이터
 *  하는 일
 *   - 매니페스트에 그림이 있는 물체만 <div.tobj.is-img><img/><svg.tobj__fx/></div> 로 바꿔 끼움
 *       위치 = scene 이 계산한 기준점 − anchor/scale · z-index · 클래스 · data-* 그대로 복사 · 요소 수 그대로 (replaceWith)
 *   - 불러오기 · 풀기 실패, 크기 불일치 → SVG 그대로 (같은 그림 다시 요청 안 함)
 *   - 그림자: 매니페스트 shadow — 'footprint' · 'blob'(기본) = 기존 그림자 유지 · 'none' = 숨김 · {rx, ry, dx, dy, opacity} = 타원
 *   - 움직임: 매니페스트 fx [{ type, at }] → 기존과 같은 CSS 클래스(tw-flag · tw-smoke · tw-jet · tw-glow · tw-ripple)로 덧그림
 *   - 클릭: 그림 물체는 pointer-events 없음(끌기 · 확대 그대로) → pick() 이 투명도 마스크로 계산 · 마스크가 없으면 바닥+높이 다각형
 *   - 땅 타일: 칸 <polygon> 은 그대로 두고 fill 만 그림 패턴(url(#…))으로 바꿈 → data-tile · 순서 · 옆면 · 절벽 그대로
 *   - 보기 모드: ?gfx=svg (매니페스트 무시 · 지금 화면) · ?gfx=debug (바닥 마름모 · 기준점 · 정문 · 그림 상자 겹쳐 그림)
 *  서버를 부르지 않습니다.
 * ===================================================================== */
(function(){
  const NS = 'http://www.w3.org/2000/svg';
  const TILE_KEYS = ['grass', 'meadow', 'forest', 'path', 'plaza', 'sand', 'water', 'dirt', 'stone', 'flower', 'snow'];
  const f1 = n => Math.round(n * 10) / 10;

  /** 매니페스트 fx 조각 (그림 픽셀 좌표 at 을 화면 px 로) */
  const FX = {
    // 위치는 바깥 <g> · 애니메이션은 안쪽 <g> (CSS 애니메이션의 transform 이 translate 속성을 덮어쓰지 않게)
    smoke: ([x, y]) => `<g transform="translate(${f1(x)},${f1(y)})"><g class="tw-smoke"><circle r="3.5" fill="#fff" opacity=".7"/><circle cx="3" cy="-7" r="4.5" fill="#fff" opacity=".55"/><circle cx="7" cy="-15" r="5.5" fill="#fff" opacity=".4"/></g></g>`,
    flag: ([x, y]) => `<path class="tw-flag" d="M${f1(x)},${f1(y)} l16,4 l-16,6z" fill="#d98772"/>`,
    glow: ([x, y]) => `<circle class="tw-glow" cx="${f1(x)}" cy="${f1(y)}" r="14" fill="url(#twGlow)"/>`,
    egg_glow: ([x, y]) => `<circle class="tw-glow" cx="${f1(x)}" cy="${f1(y)}" r="22" fill="url(#twGlow)"/>`,
    jet: ([x, y]) => `<g class="tw-jet" fill="none" stroke="#bfe9fb" stroke-width="2" stroke-linecap="round" opacity=".9"><path d="M${f1(x)},${f1(y)} c-4,-8 -10,-6 -14,8"/><path d="M${f1(x)},${f1(y)} c4,-8 10,-6 14,8"/></g>`,
    ripple: ([x, y]) => `<ellipse class="tw-ripple" cx="${f1(x)}" cy="${f1(y)}" rx="20" ry="10" fill="none" stroke="#eaf9ff" stroke-width="1.2"/>`
  };

  function create(o){
    const { world, ground, scene, layer } = o;
    const I = window.TaleliaIso, A = window.TaleliaTownAssets, D = window.TaleliaTownBuildings;
    const q = new URLSearchParams(location.search).get('gfx');
    const mode = q === 'svg' ? 'svg' : q === 'debug' ? 'debug' : 'mix';
    const report = { mode, applied: 0, swapped: 0, failed: [], tiles: {}, tileFailed: [], errors: [], warnings: [], unique: 0 };
    let camera = o.camera || null;

    // 허용 키: 배치된 물체(그림 키 · 변형 · 방향) + 모든 그림 키
    const objectKeys = {};
    Object.keys(D.TYPES).forEach(k => { const t = D.TYPES[k]; objectKeys[t.art] = { art: t.art, w: t.w, d: t.d }; });
    scene.list.forEach(r => A.objectKeys(r.def.art, r.variant, r.axis).forEach(k => { objectKeys[k] = { art: r.def.art, w: r.w, d: r.d }; }));

    /* ---------- 물체 바꿔 끼우기 ---------- */
    function shadowOf(r){ return scene.shadowSvg.querySelector(`g[data-obj="${r.id}"]`); }
    function applyShadow(r, s){
      const g = shadowOf(r);
      if(s === 'none'){ if(g) g.style.display = 'none'; return; }
      if(s && typeof s === 'object'){
        const html = `<ellipse cx="${f1(s.dx || 0)}" cy="${f1(s.dy || 0)}" rx="${f1(s.rx || 16)}" ry="${f1(s.ry || 7)}" fill="#1e3a22" opacity="${s.opacity == null ? .22 : s.opacity}"/>`;
        if(g) g.innerHTML = html;
        else scene.shadowSvg.insertAdjacentHTML('beforeend', `<g data-obj="${r.id}" transform="translate(${f1(r.anchor[0])},${f1(r.anchor[1])})">${html}</g>`);
      }
      // 'footprint' · 'blob' · 없음 → 기존 SVG 그림의 그림자를 그대로 씀 (같은 모양)
    }
    function swap(r, res, loaded, checked){
      const v = res.variant, sc = checked.scale, w = v.size[0] / sc, h = v.size[1] / sc;
      const left = r.anchor[0] - v.anchor[0] / sc, top = r.anchor[1] - v.anchor[1] / sc;
      const el = document.createElement('div');
      el.className = r.el.getAttribute('class') + ' is-img';
      Object.assign(el.dataset, r.el.dataset); el.dataset.gfx = res.key;
      el.style.cssText = `left:${left}px;top:${top}px;width:${w}px;height:${h}px;z-index:${r.z}`;
      const img = document.createElement('img');
      img.alt = ''; img.draggable = false; img.decoding = 'async'; img.src = v.url; img.className = 'tobj__img';
      el.appendChild(img);
      const fx = (res.entry.fx || []).filter(f => f && FX[f.type] && Array.isArray(f.at));
      if(fx.length){
        const s = document.createElementNS(NS, 'svg');
        s.setAttribute('class', 'tobj__fx'); s.setAttribute('viewBox', `0 0 ${w} ${h}`); s.setAttribute('width', w); s.setAttribute('height', h);
        s.innerHTML = fx.map(f => FX[f.type]([f.at[0] / sc, f.at[1] / sc])).join('');
        el.appendChild(s);
      }
      r.el.replaceWith(el);
      r.svgEl = r.el; r.el = el;
      r.gfx = { key: res.key, url: v.url, box: { x: left, y: top, w, h }, scale: sc, mask: A.mask(v.url, loaded.img, w, h), hit: res.entry.hit };
      applyShadow(r, res.entry.shadow);
      report.swapped++;
      if(dbg) drawDebugBox(r);
    }

    /* ---------- 땅 타일 ---------- */
    function applyTile(key, entry, loadedVariants, checked){
      const svg = ground.svg, defs = svg.querySelector('defs') || svg.insertBefore(document.createElementNS(NS, 'defs'), svg.firstChild);
      const ok = loadedVariants.filter(Boolean);
      if(!ok.length){ report.tileFailed.push(key); return; }
      // 높이마다 패턴 (칸 윗면이 높이 × HU 만큼 올라가므로)
      const heights = new Set(world.tiles.filter(c => c.t === key).map(c => c.h));
      ok.forEach((v, vi) => heights.forEach(hh => {
        const id = `tlp-${key}-${vi}-h${hh}`; if(document.getElementById(id)) return;
        const p = document.createElementNS(NS, 'pattern');
        p.setAttribute('id', id); p.setAttribute('patternUnits', 'userSpaceOnUse'); p.setAttribute('width', 64); p.setAttribute('height', 32);
        p.setAttribute('patternTransform', `translate(0,${-hh * I.HU})`);
        // 마름모 격자: 기준점(위 꼭짓점)이 (0,0) · (64,0) · (32,±16) 에 오도록 4번 놓음
        p.innerHTML = [[-32, 0], [32, 0], [0, -16], [0, 16]].map(([x, y]) => `<image href="${v.url}" x="${x}" y="${y}" width="64" height="32" preserveAspectRatio="none"/>`).join('');
        defs.appendChild(p);
      }));
      let n = 0;
      svg.querySelectorAll(`.tg-tile.t-${key}`).forEach(pg => {
        const [x, y] = pg.dataset.tile.split(',').map(Number), c = world.at(x, y), vi = Math.min(ok.length - 1, Math.floor(world.hash(x, y) * ok.length));
        pg.dataset.fill0 = pg.getAttribute('fill');
        pg.setAttribute('fill', `url(#tlp-${key}-${vi}-h${c.h})`); pg.classList.add('is-tex'); n++;
      });
      if(!entry.detail) svg.querySelectorAll(`.tg-d.d-${key}`).forEach(g => { g.style.display = 'none'; });
      report.tiles[key] = n;
    }

    /** 매니페스트 적용 (여러 번 불러도 이미 바뀐 것은 건너뜀) → Promise<report> */
    function apply(man, opts){
      if(mode === 'svg') return Promise.resolve(Object.assign(report, { applied: report.applied + 1 }));
      const checked = A.validate(man, { tileKeys: TILE_KEYS, objectKeys }, opts);
      report.applied++; report.errors.push(...checked.errors); report.warnings.push(...checked.warnings); report.unique = checked.unique || 0;
      if(checked.errors.length) console.warn('[TALELIA 그래픽] 매니페스트 문제 (해당 항목은 SVG 로 표시)', checked.errors);
      if(checked.warnings.length) console.warn('[TALELIA 그래픽] 매니페스트 경고', checked.warnings);
      const jobs = [];
      scene.list.forEach(r => {
        if(r.gfx) return;
        const res = A.resolveObject(checked, r.def.art, r.variant, r.axis, r.rnd);
        if(!res) return;
        jobs.push(A.load(res.variant.url, res.variant.size).then(l => swap(r, res, l, checked)).catch(e => {
          r.gfxError = String(e && e.message || e); report.failed.push(res.key + ' (' + r.id + '): ' + r.gfxError);
        }));
      });
      Object.keys(checked.tiles).forEach(k => {
        const e = checked.tiles[k];
        jobs.push(Promise.all(e.variants.map(v => A.load(v.url, v.size).then(() => v, () => null))).then(ls => applyTile(k, e, ls, checked)));
      });
      return Promise.all(jobs).then(() => {
        if(report.failed.length) console.warn('[TALELIA 그래픽] 그림을 불러오지 못해 SVG 로 표시', report.failed);
        if(dbg) drawDebugAll();
        return report;
      });
    }

    /* ---------- 클릭 판정 (그림 물체) ---------- */
    function hitImg(r, wx, wy){
      const b = r.gfx.box, lx = wx - b.x, ly = wy - b.y;
      if(lx < 0 || ly < 0 || lx >= b.w || ly >= b.h) return false;
      const m = r.gfx.mask;
      if(m){ const px = Math.min(m.w - 1, Math.floor(lx * m.w / b.w)), py = Math.min(m.h - 1, Math.floor(ly * m.h / b.h)); return m.a[py * m.w + px] > 40; }
      // 마스크가 없으면(예: file:// 로 열어 캔버스가 막힘) 매니페스트 hit 다각형 또는 바닥+높이 다각형
      const sc = r.gfx.scale || 2;
      const poly = Array.isArray(r.gfx.hit) ? r.gfx.hit.map(([x, y]) => [b.x + x / sc, b.y + y / sc]) : footPoly(r, b);
      return inPoly(wx, wy, poly);
    }
    function footPoly(r, b){
      const [ax, ay] = r.anchor, hw = (r.w + r.d) * 16, top = b.y;
      const L = [ax - hw, ay + (r.d - r.w) * 8], Bm = [ax + (r.w - r.d) * 16, ay + (r.w + r.d) * 8], R = [ax + hw, ay + (r.w - r.d) * 8];
      return [[L[0], top], [R[0], top], R, Bm, L];
    }
    function inPoly(x, y, p){ let c = false; for(let i = 0, j = p.length - 1; i < p.length; j = i++){ const [xi, yi] = p[i], [xj, yj] = p[j]; if(((yi > y) !== (yj > y)) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; }
    /** 누른 위치의 그림 물체 중 가장 앞(z 큰) 것 */
    function pick(cx, cy){
      if(!camera) return null;
      const [wx, wy] = camera.clientToWorld(cx, cy);
      let best = null;
      for(const r of scene.list){ if(!r.gfx || !r.def.pick) continue; if((!best || r.z > best.z) && hitImg(r, wx, wy)) best = r; }
      return best;
    }

    /* ---------- 디버그 겹쳐 그리기 (?gfx=debug) ---------- */
    let dbg = null;
    function ensureDebug(){
      if(dbg) return dbg;
      const B = I.bounds(world.W, world.H, world.maxH, window.TaleliaTownGround.CLIFF);
      dbg = document.createElementNS(NS, 'svg');
      dbg.setAttribute('class', 'town-gfx-debug'); dbg.setAttribute('aria-hidden', 'true');
      dbg.setAttribute('viewBox', `${B.x} ${B.y} ${B.w} ${B.h}`); dbg.setAttribute('width', B.w); dbg.setAttribute('height', B.h);
      dbg.style.left = B.x + 'px'; dbg.style.top = B.y + 'px';
      layer.appendChild(dbg);
      return dbg;
    }
    function drawDebugAll(){
      const s = ensureDebug(); let html = '';
      scene.list.forEach(r => {
        const pts = [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.d], [r.x, r.y + r.d]].map(([u, v]) => I.toScreen(u, v, r.h));
        html += `<polygon class="gd-foot${r.def.walk === 'floor' ? ' is-floor' : ''}" points="${pts.map(p => f1(p[0]) + ',' + f1(p[1])).join(' ')}"/>`;
        html += `<path class="gd-anchor" d="M${f1(r.anchor[0] - 5)},${f1(r.anchor[1])} h10 M${f1(r.anchor[0])},${f1(r.anchor[1] - 5)} v10"/>`;
        if(r.door){ const c = world.at(r.door[0], r.door[1]); const dp = [[0, 0], [1, 0], [1, 1], [0, 1]].map(([du, dv]) => I.toScreen(r.door[0] + du, r.door[1] + dv, c ? c.h : 0)); html += `<polygon class="gd-door" points="${dp.map(p => f1(p[0]) + ',' + f1(p[1])).join(' ')}"/>`; }
      });
      s.innerHTML = html;
      scene.list.forEach(r => { if(r.gfx) drawDebugBox(r); });
    }
    function drawDebugBox(r){
      const s = ensureDebug(), b = r.gfx.box;
      s.insertAdjacentHTML('beforeend', `<rect class="gd-box" x="${f1(b.x)}" y="${f1(b.y)}" width="${f1(b.w)}" height="${f1(b.h)}"/><text class="gd-key" x="${f1(b.x + 2)}" y="${f1(b.y + 7)}">${r.gfx.key}</text>`);
    }
    if(mode === 'debug') drawDebugAll();

    return { mode, apply, pick, report, setCamera(c){ camera = c; }, get debugLayer(){ return dbg; }, TILE_KEYS, objectKeys };
  }

  window.TaleliaTownGfx = Object.freeze({ create, FX });
})();
