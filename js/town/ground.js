/* =====================================================================
 * TALELIA · town/ground.js — ① 땅 계층 (SVG · 처음에 한 번만 그림)
 *
 *  - 칸 마름모 · 높이 옆면 · 섬 절벽 · 잔디 무늬 · 물결 · 정원 경계선을 하나의 <svg> 로 만듭니다.
 *  - 카메라 이동·확대 때는 다시 그리지 않습니다. (camera.js 가 바깥 요소의 transform 만 바꿈)
 *  - 그림 파일을 쓰지 않습니다. 타일 그림이 생기면 이 파일에서 칸 채우기만 <image> 로 바꿉니다.
 *  - 그리는 순서: (x + y) 가 작은 칸(화면 뒤)부터, 칸마다 옆면 → 윗면 → 무늬.
 *    높이가 있는 칸의 옆면과 뒤 칸의 무늬가 앞 칸에 올바르게 가려지게 하기 위해서입니다.
 * ===================================================================== */
(function(){
  const NS = 'http://www.w3.org/2000/svg';
  const CLIFF = 46;   // 섬 바깥 절벽 깊이(px)

  // 바닥 색 (칸마다 무늬값으로 하나 고름)
  const FILL = {
    grass:  ['#93cc6c', '#8bc665', '#99d073', '#8fc969'],
    meadow: ['#a2d57c', '#9ad176'],
    forest: ['#5c9a51', '#57954d', '#61a056'],
    path:   ['#dcc092', '#d6b98a', '#e0c599'],
    plaza:  ['#e7e0cf', '#dfd7c4', '#ebe5d6'],
    sand:   ['#eedca6', '#ead6a0'],
    water:  ['#6fc3e3', '#69bddf'],
    dirt:   ['#c9a072', '#c39a6c'],
    stone:  ['#bcc0c6', '#b5b9c0'],
    flower: ['#a6d982'],
    snow:   ['#f2f6f8', '#eaf0f3']
  };
  const SIDE = { soil: ['#9b7146', '#83603b'], lip: ['#7fb85a', '#6ea64d'], water: ['#4f9fc4', '#468fb2'] };   // [왼쪽 면, 오른쪽 면]

  const f1 = n => Math.round(n * 10) / 10;
  const pts = arr => arr.map(p => f1(p[0]) + ',' + f1(p[1])).join(' ');

  /** world(world-data.build 결과)로 땅 <svg> 를 만들어 돌려줍니다. */
  function render(world, opts){
    const I = window.TaleliaIso, o = opts || {};
    const B = I.bounds(world.W, world.H, world.maxH, CLIFF);
    const hOf = (x, y) => { const c = (x >= 0 && y >= 0 && x < world.W && y < world.H) ? world.at(x, y) : null; return c ? c.h : -CLIFF / I.HU; };
    const order = world.tiles.slice().sort((a, b) => (a.x + a.y) - (b.x + b.y) || a.x - b.x);

    // 칸마다 [옆면 → 윗면 → 무늬] 를 한 번에 이어 붙입니다. (뒤 칸의 무늬가 앞 칸 언덕 위로 올라오지 않게)
    let body = '';
    for(const c of order){
      let tiles = '', sides = '', deco = '', water = '';
      const r = world.hash(c.x, c.y), d = I.diamond(c.x, c.y, c.h), [T, R, Bm, L] = d;
      // 옆면: 왼쪽 앞 이웃 (x, y+1) · 오른쪽 앞 이웃 (x+1, y) 이 더 낮으면
      const hl = hOf(c.x, c.y + 1), hr = hOf(c.x + 1, c.y);
      if(hl < c.h){
        const dh = (c.h - hl) * I.HU, out = hl < -1;
        sides += `<polygon class="tg-side" points="${pts([L, Bm, [Bm[0], Bm[1] + dh], [L[0], L[1] + dh]])}" fill="${SIDE.soil[0]}"/>`;
        sides += `<polygon points="${pts([L, Bm, [Bm[0], Bm[1] + 5], [L[0], L[1] + 5]])}" fill="${SIDE.lip[0]}"/>`;
        if(out) sides += `<polyline class="tg-strata" points="${pts([[L[0], L[1] + dh * .55], [Bm[0], Bm[1] + dh * .55]])}"/>`;
      }
      if(hr < c.h){
        const dh = (c.h - hr) * I.HU, out = hr < -1;
        sides += `<polygon class="tg-side" points="${pts([Bm, R, [R[0], R[1] + dh], [Bm[0], Bm[1] + dh]])}" fill="${SIDE.soil[1]}"/>`;
        sides += `<polygon points="${pts([Bm, R, [R[0], R[1] + 5], [Bm[0], Bm[1] + 5]])}" fill="${SIDE.lip[1]}"/>`;
        if(out) sides += `<polyline class="tg-strata" points="${pts([[Bm[0], Bm[1] + dh * .55], [R[0], R[1] + dh * .55]])}"/>`;
      }
      // 윗면
      const pal = FILL[c.t] || FILL.grass, fill = pal[Math.floor(r * pal.length)];
      tiles += `<polygon class="tg-tile t-${c.t}${c.garden ? ' is-garden' : ''}" data-tile="${c.x},${c.y}" points="${pts(d)}" fill="${fill}"/>`;
      // 무늬 (칸마다 고정)
      const cx = T[0], cy = T[1] + I.HH;
      if(c.t === 'grass' && r < .32){
        const ox = (r * 97 % 1 - .5) * 28, oy = (r * 53 % 1 - .5) * 10;
        deco += `<path class="tg-tuft" d="M${f1(cx + ox - 4)},${f1(cy + oy + 2)} l2,-5 l2,4 l2,-6 l2,7"/>`;
      } else if(c.t === 'meadow' || c.t === 'flower'){
        const col = ['#fff3a8', '#ffc4d8', '#ffffff', '#c9b6ff'][Math.floor(r * 4)];
        for(let k = 0; k < 3; k++){ const a = (r * (k + 3) * 41) % 1, b = (r * (k + 5) * 17) % 1; deco += `<circle cx="${f1(cx + (a - .5) * 34)}" cy="${f1(cy + (b - .5) * 14)}" r="1.9" fill="${col}"/>`; }
      } else if(c.t === 'forest'){
        deco += `<ellipse class="tg-bush" cx="${f1(cx + (r - .5) * 18)}" cy="${f1(cy - 2)}" rx="${f1(10 + r * 6)}" ry="${f1(5 + r * 3)}"/>`;
      } else if(c.t === 'plaza'){
        deco += `<polyline class="tg-joint" points="${pts([[cx - 16, cy], [cx, cy + 8], [cx + 16, cy]])}"/>`;
      } else if(c.t === 'path' && r < .25){
        deco += `<circle class="tg-pebble" cx="${f1(cx + (r * 7 % 1 - .5) * 30)}" cy="${f1(cy + (r * 13 % 1 - .5) * 10)}" r="1.6"/>`;
      } else if(c.t === 'water'){
        if(r < .45) water += `<path class="tg-wave" style="--wd:${f1(r * 3)}s" d="M${f1(cx - 9)},${f1(cy + (r - .5) * 10)} q4.5,-3 9,0 t9,0"/>`;
      }
      // 무늬는 종류별 묶음으로 (타일 그림이 들어오면 gfx.js 가 그 종류의 무늬만 숨김 · 그리는 순서는 같음)
      body += sides + tiles + (deco ? `<g class="tg-d d-${c.t}">${deco}</g>` : '') + water;
    }

    // 정원 경계선 (현재 땅 크기)
    const g = world.garden, gp = [I.toScreen(g.x0, g.y0), I.toScreen(g.x0 + g.size, g.y0), I.toScreen(g.x0 + g.size, g.y0 + g.size), I.toScreen(g.x0, g.y0 + g.size)];
    const outline = `<polygon class="tg-garden-line" points="${pts(gp)}"/>`;

    // 디버그: 구역 이름 · 좌표
    let dbg = '';
    if(o.debug){
      world.zones.forEach(z => { const [x, y] = I.center((z.x[0] + z.x[1]) / 2, (z.y[0] + z.y[1]) / 2); dbg += `<text class="tg-label" x="${f1(x)}" y="${f1(y)}">${z.name}</text>`; });
      for(let y = 0; y < world.H; y += 5) for(let x = 0; x < world.W; x += 5){ const [px, py] = I.center(x, y, world.at(x, y).h); dbg += `<text class="tg-coord" x="${f1(px)}" y="${f1(py + 3)}">${x},${y}</text>`; }
    }

    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'town-ground' + (o.debug ? ' is-debug' : ''));
    svg.setAttribute('viewBox', `${B.x} ${B.y} ${B.w} ${B.h}`);
    svg.setAttribute('width', B.w); svg.setAttribute('height', B.h);
    svg.style.left = B.x + 'px'; svg.style.top = B.y + 'px';
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = `<defs><linearGradient id="tgWater" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fd4ee"/><stop offset="1" stop-color="#4fb0d8"/></linearGradient></defs>` +
      `<g class="tg-body">${body}</g>${outline}<g class="tg-debug">${dbg}</g>`;
    return { svg, bounds: B, count: world.tiles.length };
  }

  window.TaleliaTownGround = Object.freeze({ render, CLIFF });
})();
