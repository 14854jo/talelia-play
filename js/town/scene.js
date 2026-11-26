/* =====================================================================
 * TALELIA · town/scene.js — ② 장면 계층 (건물 · 장식) + 그림자 층
 *
 *  - 물체 하나 = 요소 하나 (<svg> 또는 그림 파일이 있으면 <img>). 처음에 한 번 만들고 다시 만들지 않습니다.
 *  - 위치: 바닥 발자국 가운데의 화면 좌표(높이 반영). 크기: 그림이 알려 준 상자. → "바닥 위치"와 "화면 크기"가 분리됨
 *  - 앞뒤: z-index = iso.js 의 zObject(…) — 3단계 동물도 같은 컨테이너 · 같은 규칙(zActor)을 씁니다.
 *  - 그림자는 별도 층(<svg> 1개)에 모아 땅 위 · 물체 아래에 그립니다.
 *  - 걷기 정보: 막는 물체의 칸은 walk=false, 계단 · 다리 · 잔교 칸은 walk=true (+ ramp · bridge · pier 표시),
 *    꽃밭 칸은 soft (지나갈 수 있지만 돌아감). 정문 앞 칸은 각 물체의 door 에 기록. 3단계 길 찾기용
 *  - 누르기 판정: pick(clientX, clientY) → 누른 위치의 건물 배치 (꽃 · 나무 같은 장식은 누를 수 없음)
 * ===================================================================== */
(function(){
  const NS = 'http://www.w3.org/2000/svg';

  function build(world, layer){
    const I = window.TaleliaIso, A = window.TaleliaTownArt, D = window.TaleliaTownBuildings;
    const list = D.build(world);
    const B = window.TaleliaTownGround ? I.bounds(world.W, world.H, world.maxH, window.TaleliaTownGround.CLIFF) : null;

    // 공용 그라데이션 (한 번만)
    if(!document.getElementById('twGlass')) document.body.insertAdjacentHTML('afterbegin', A.DEFS);

    // 그림자 층
    const shadowSvg = document.createElementNS(NS, 'svg');
    shadowSvg.setAttribute('class', 'town-shadows');
    shadowSvg.setAttribute('aria-hidden', 'true');
    if(B){ shadowSvg.setAttribute('viewBox', `${B.x} ${B.y} ${B.w} ${B.h}`); shadowSvg.setAttribute('width', B.w); shadowSvg.setAttribute('height', B.h); shadowSvg.style.left = B.x + 'px'; shadowSvg.style.top = B.y + 'px'; }

    // 장면 층
    const scene = document.createElement('div');
    scene.className = 'town-scene';

    let shadows = '';
    const byId = new Map(), problems = [];
    list.forEach(p => {
      const t = D.TYPES[p.type];
      const h = Math.max(...p.cells.map(([x, y]) => (world.at(x, y) || { h: 0 }).h));
      const [ax, ay] = I.toScreen(p.x + t.w / 2, p.y + t.d / 2, h);
      const rnd = world.hash(p.x * 13 + 5, p.y * 17 + 3);
      const floor = t.walk === 'floor';
      const z = I.zObject(p.x, p.y, t.w, t.d, floor);
      const img = A.IMAGES[t.art];
      let el;
      if(img){
        el = document.createElement('img');
        el.src = img.src; el.alt = ''; el.width = img.w; el.height = img.h;
        el.style.left = (ax - img.ax) + 'px'; el.style.top = (ay - img.ay) + 'px';
      } else {
        const art = A.ART[t.art](t, p, rnd);
        const half = (t.w + t.d) * 16, pad = 26;
        const bx = -half * 2 - pad, by = -(art.top || 40) - pad, bw = half * 4 + pad * 2, bh = (art.top || 40) + half + pad * 2;
        el = document.createElementNS(NS, 'svg');
        el.setAttribute('viewBox', `${bx} ${by} ${bw} ${bh}`); el.setAttribute('width', bw); el.setAttribute('height', bh);
        el.style.left = (ax + bx) + 'px'; el.style.top = (ay + by) + 'px';
        el.innerHTML = art.body;
        if(art.shadow) shadows += `<g data-obj="${p.id}" transform="translate(${Math.round(ax * 10) / 10},${Math.round(ay * 10) / 10})">${art.shadow}</g>`;
      }
      el.classList.add('tobj', 't-' + t.kind, 'a-' + t.art);
      if(t.pick) el.classList.add('is-pick');
      if(floor) el.classList.add('is-floor');
      el.dataset.obj = p.id; el.dataset.type = p.type;
      el.style.zIndex = z;
      scene.appendChild(el);
      const rec = { id: p.id, type: p.type, def: t, x: p.x, y: p.y, w: t.w, d: t.d, h, cells: p.cells, z, anchor: [ax, ay], el, axis: p.axis, variant: p.variant, scatter: !!p.scatter,
                    door: D.doorTile(t, p.x, p.y), rnd, gfx: null };   // rnd: SVG 와 같은 무늬값 → 그림 변형도 같은 규칙으로 고정 선택 (gfx.js)
      byId.set(p.id, rec);
      // 걷기 정보 반영
      p.cells.forEach(([x, y]) => {
        const c = world.at(x, y); if(!c){ problems.push(p.id + ' 지도 밖 ' + x + ',' + y); return; }
        if(c.obj && c.obj !== p.id) problems.push(p.id + ' 이(가) ' + c.obj + ' 와(과) 겹침 ' + x + ',' + y);
        c.obj = p.id;
        if(t.walk === 'block') c.walk = false;
        else if(t.walk === 'floor'){ c.walk = true; if(p.type === 'stairs') c.ramp = true; if(p.type === 'bridge') c.bridge = true; if(p.type === 'pier') c.pier = true; }
        else if(t.walk === 'pass') c.soft = true;   // 꽃밭: 걸을 수 있지만 길 찾기가 돌아가게 함
      });
    });
    shadowSvg.innerHTML = shadows;
    layer.appendChild(shadowSvg);
    layer.appendChild(scene);

    /** 누른 위치의 건물 (누를 수 있는 것만)
     *  SVG 물체: 그려진 도형으로 판정 (elementsFromPoint) · 그림 파일 물체: gfx.js 가 투명도로 판정 → 둘 중 앞(z 큰) 것 */
    let imagePicker = null;
    function pick(cx, cy){
      let hit = null;
      const els = document.elementsFromPoint(cx, cy);
      for(const e of els){ const o = e.closest && e.closest('.tobj.is-pick'); if(o){ hit = byId.get(o.dataset.obj) || null; break; } if(e.classList && e.classList.contains('town-viewport')) break; }
      const im = imagePicker ? imagePicker(cx, cy) : null;
      if(im && (!hit || im.z > hit.z)) hit = im;
      return hit;
    }
    let selected = null;
    function select(id){
      if(selected){ const r = byId.get(selected); if(r) r.el.classList.remove('is-selected'); }
      selected = id || null;
      if(selected){ const r = byId.get(selected); if(r) r.el.classList.add('is-selected'); }
    }
    return { scene, shadowSvg, objects: byId, list: [...byId.values()], pick, select, get selected(){ return selected; }, problems,
             setImagePicker(fn){ imagePicker = fn; } };
  }

  window.TaleliaTownScene = Object.freeze({ build });
})();
