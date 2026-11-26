/* =====================================================================
 * TALELIA · town/art.js — 건물 · 장식 임시 그림 (블록형 아이소메트릭 SVG)
 *
 *  - 그림만 담당합니다. 위치 · 크기 · 이름 · 설명은 buildings.js 가 가집니다.
 *  - 좌표계: 물체 바닥(발자국) 가운데가 (0, 0). 칸 오프셋 (du, dv) 와 높이 h(px) 를 P(du, dv, h) 로 화면 좌표로 바꿉니다.
 *  - 벽면 장식(창문 · 문 · 간판)은 벽면 좌표계(face)에서 그립니다.
 *      왼쪽 앞 벽 (v = +d/2, u 방향) : matrix(1, .5, 0, 1, …)   ← 빛을 받는 면 (밝게)
 *      오른쪽 앞 벽 (u = +w/2, −v 방향): matrix(1, −.5, 0, 1, …) ← 그늘진 면 (어둡게)
 *  - 각 그림 함수는 { body, shadow, top } 을 돌려줍니다.
 *      body   : 물체 SVG 조각
 *      shadow : 땅에 드리우는 그림자 (그림자 층에 모아 그림)
 *      top    : 바닥 가운데에서 위로 얼마나 높은지(px) — SVG 상자 크기 계산용
 *  - 나중에 그림 파일로 바꿀 때: IMAGES[키] = { src, w, h, ax, ay } 를 채우면 scene.js 가 SVG 대신 <img> 를 씁니다.
 * ===================================================================== */
(function(){
  const HW = 32, HH = 16;
  const f = n => Math.round(n * 10) / 10;
  const P = (du, dv, h) => [(du - dv) * HW, (du + dv) * HH - (h || 0)];
  const pts = a => a.map(p => f(p[0]) + ',' + f(p[1])).join(' ');
  const up = (p, h) => [p[0], p[1] - h];
  const LINE = 'stroke="#4a3626" stroke-opacity=".38" stroke-width=".9" stroke-linejoin="round"';
  const poly = (a, fill, x) => `<polygon points="${pts(a)}" fill="${fill}" ${x == null ? LINE : x}/>`;

  /** 색 밝기 조절: amt −1(검정) ~ +1(흰색) */
  function shade(hex, amt){
    const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = n >> 8 & 255, b = n & 255;
    const t = amt < 0 ? 0 : 255, k = Math.abs(amt);
    r = Math.round(r + (t - r) * k); g = Math.round(g + (t - g) * k); b = Math.round(b + (t - b) * k);
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  }
  const C3 = c => ({ l: shade(c, .06), r: shade(c, -.16), t: shade(c, .2) });

  /** 상자: 가운데 (cu, cv), 크기 w×d 칸, 바닥 높이 z, 높이 h(px) */
  function box(cu, cv, w, d, z, h, color, o){
    o = o || {};
    const c = typeof color === 'string' ? C3(color) : color;
    const L = P(cu - w / 2, cv + d / 2, z), B = P(cu + w / 2, cv + d / 2, z), R = P(cu + w / 2, cv - d / 2, z), T = P(cu - w / 2, cv - d / 2, z);
    let s = poly([L, B, up(B, h), up(L, h)], c.l) + poly([B, R, up(R, h), up(B, h)], c.r);
    if(!o.noTop) s += poly([up(T, h), up(R, h), up(B, h), up(L, h)], c.t);
    return s;
  }
  /** 벽면 좌표계 그룹. side 'L' = 왼쪽 앞 벽, 'R' = 오른쪽 앞 벽. x 는 벽을 따라 0 → 칸수×32, y 는 위로 음수 */
  function face(side, cu, cv, w, d, z, inner){
    const o = side === 'L' ? P(cu - w / 2, cv + d / 2, z) : P(cu + w / 2, cv + d / 2, z);
    return `<g transform="matrix(1,${side === 'L' ? .5 : -.5},0,1,${f(o[0])},${f(o[1])})">${inner}</g>`;
  }
  /** 창문 (벽면 좌표) */
  function win(x, y, w, h, o){
    o = o || {};
    const fr = o.frame || '#7a5236', gl = o.lit === false ? 'url(#twGlassDay)' : 'url(#twGlass)';
    let s = `<rect x="${f(x - 1.5)}" y="${f(y - 1.5)}" width="${f(w + 3)}" height="${f(h + 3)}" rx="${o.round ? f((w + 3) / 2) : 1.5}" fill="${fr}"/>` +
            `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="${o.round ? f(w / 2) : 1}" fill="${gl}"/>`;
    if(!o.round) s += `<path d="M${f(x + w / 2)},${f(y)} v${f(h)} M${f(x)},${f(y + h / 2)} h${f(w)}" stroke="${fr}" stroke-width="1.2"/>`;
    else s += `<path d="M${f(x + w / 2)},${f(y)} v${f(h)}" stroke="${fr}" stroke-width="1"/>`;
    if(o.sill) s += `<rect x="${f(x - 3)}" y="${f(y + h + 1)}" width="${f(w + 6)}" height="2.4" rx="1" fill="${shade(fr, .15)}"/>`;
    if(o.flowers) s += `<rect x="${f(x - 1)}" y="${f(y + h + 2.5)}" width="${f(w + 2)}" height="4" rx="1" fill="#9a6a42"/>` +
      [0, .3, .6, .9].map((k, i) => `<circle cx="${f(x + w * k + .5)}" cy="${f(y + h + 2)}" r="2" fill="${['#ff8fb1', '#ffd34d', '#ffffff', '#c9b6ff'][i]}"/>`).join('');
    if(o.shutter) s += `<rect x="${f(x - 6)}" y="${f(y - 1)}" width="4" height="${f(h + 2)}" rx="1" fill="${o.shutter}"/><rect x="${f(x + w + 2)}" y="${f(y - 1)}" width="4" height="${f(h + 2)}" rx="1" fill="${o.shutter}"/>`;
    return s;
  }
  /** 문 (벽면 좌표, 아래가 y=0) */
  function door(x, w, h, col, o){
    o = o || {};
    const r = w / 2, c = col || '#8a5534';
    return `<path d="M${f(x - 2)},0 v${f(-(h - r))} a${f(r + 2)},${f(r + 2)} 0 0 1 ${f(w + 4)},0 v${f(h - r)} z" fill="${o.frame || '#5e3b26'}"/>` +
      `<path d="M${f(x)},0 v${f(-(h - r))} a${f(r)},${f(r)} 0 0 1 ${f(w)},0 v${f(h - r)} z" fill="${c}"/>` +
      `<path d="M${f(x + w / 2)},${f(-(h - 1))} v${f(h - 1)}" stroke="${shade(c, -.3)}" stroke-width=".9"/>` +
      `<circle cx="${f(x + w * .75)}" cy="${f(-h * .42)}" r="1.3" fill="#ffd77a"/>` +
      (o.step ? `<rect x="${f(x - 4)}" y="0" width="${f(w + 8)}" height="3" rx="1" fill="#c9bfae"/>` : '');
  }
  /** 나무 기둥 · 들보 (벽면 좌표) */
  const beam = (x, y, w, h, c) => `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="${c || '#8a5a3a'}"/>`;

  /** 모임지붕 (가운데 cu,cv · 처마 높이 z · 오름 rise · 처마 내밀기 o 칸) */
  function hipRoof(cu, cv, w, d, z, rise, o, col){
    const W = w + o * 2, D = d + o * 2, c = typeof col === 'string' ? { l: shade(col, .08), r: shade(col, -.2), back: shade(col, -.3) } : col;
    const T = P(cu - W / 2, cv - D / 2, z), R = P(cu + W / 2, cv - D / 2, z), B = P(cu + W / 2, cv + D / 2, z), L = P(cu - W / 2, cv + D / 2, z);
    const rl = Math.abs(W - D) / 2;
    let a, b;   // 용마루 양 끝
    if(W >= D){ a = P(cu - rl, cv, z + rise); b = P(cu + rl, cv, z + rise); }   // u 방향 (a 뒤-왼쪽, b 앞-오른쪽)
    else { a = P(cu, cv - rl, z + rise); b = P(cu, cv + rl, z + rise); }        // v 방향 (a 뒤-오른쪽, b 앞-왼쪽)
    let s = '';
    if(W >= D){
      s += poly([T, R, b, a], c.back) + poly([T, L, a], c.back);       // 뒤쪽 (대부분 가려짐)
      s += poly([L, B, b, a], c.l) + poly([B, R, b], c.r);              // 앞쪽
    } else {
      s += poly([T, L, b, a], c.back) + poly([T, R, a], c.back);
      s += poly([B, R, a, b], c.r) + poly([L, B, b], c.l);
    }
    s += `<polyline points="${pts([L, B, R])}" fill="none" stroke="${shade(typeof col === 'string' ? col : '#888888', .45)}" stroke-width="1.6" stroke-linejoin="round" opacity=".8"/>`;
    return { s, apex: Math.max(z + rise) };
  }

  /** 맞배지붕 (용마루가 axis 방향 'u' 또는 'v') + 박공벽 */
  function gableRoof(cu, cv, w, d, z, rise, o, col, wallCol, axis){
    const c = { l: shade(col, .06), r: shade(col, -.22), back: shade(col, -.32) }, wc = C3(wallCol);
    let s = '';
    if(axis === 'u'){
      const D = d + o * 2, W = w + o * 2;
      const T = P(cu - W / 2, cv - D / 2, z), R = P(cu + W / 2, cv - D / 2, z), B = P(cu + W / 2, cv + D / 2, z), L = P(cu - W / 2, cv + D / 2, z);
      const a = P(cu - W / 2, cv, z + rise), b = P(cu + W / 2, cv, z + rise);
      // 박공벽 (오른쪽 끝, 벽 두께 안쪽)
      const gB = P(cu + w / 2, cv + d / 2, z), gR = P(cu + w / 2, cv - d / 2, z), gA = P(cu + w / 2, cv, z + rise * (d / D));
      s += poly([T, R, b, a], c.back);
      s += poly([gB, gR, gA], wc.r);
      s += poly([L, B, b, a], c.l);
      s += `<polyline points="${pts([R, b, B])}" fill="none" stroke="${shade(col, -.35)}" stroke-width="2.2" stroke-linejoin="round"/>`;
      s += `<polyline points="${pts([a, b])}" stroke="${shade(col, .35)}" stroke-width="2" stroke-linecap="round"/>`;
      s += `<polyline points="${pts([L, B])}" stroke="${shade(col, .4)}" stroke-width="1.4" opacity=".8"/>`;
      return { s, apex: z + rise, gable: { side: 'R', center: d * 32 / 2 } };
    }
    const W = w + o * 2, D = d + o * 2;
    const T = P(cu - W / 2, cv - D / 2, z), R = P(cu + W / 2, cv - D / 2, z), B = P(cu + W / 2, cv + D / 2, z), L = P(cu - W / 2, cv + D / 2, z);
    const a = P(cu, cv - D / 2, z + rise), b = P(cu, cv + D / 2, z + rise);
    const gL = P(cu - w / 2, cv + d / 2, z), gB = P(cu + w / 2, cv + d / 2, z), gA = P(cu, cv + d / 2, z + rise * (w / W));
    s += poly([T, L, b, a], c.back);
    s += poly([gL, gB, gA], wc.l);
    s += poly([B, R, a, b], c.r);
    s += `<polyline points="${pts([L, b, B])}" fill="none" stroke="${shade(col, -.3)}" stroke-width="2.2" stroke-linejoin="round"/>`;
    s += `<polyline points="${pts([a, b])}" stroke="${shade(col, .35)}" stroke-width="2" stroke-linecap="round"/>`;
    s += `<polyline points="${pts([B, R])}" stroke="${shade(col, .3)}" stroke-width="1.4" opacity=".8"/>`;
    return { s, apex: z + rise, gable: { side: 'L', center: w * 32 / 2 } };
  }

  /** 땅 그림자: 발자국 다이아몬드를 오른쪽 아래로 늘인 모양 */
  function footShadow(w, d, grow, dx, dy, op){
    const g = grow || .15, W = w + g * 2, D = d + g * 2;
    const pts4 = [P(-W / 2, -D / 2), P(W / 2, -D / 2), P(W / 2, D / 2), P(-W / 2, D / 2)].map(p => [p[0] + (dx || 0), p[1] + (dy || 0)]);
    return `<polygon points="${pts(pts4)}" fill="#1e3a22" opacity="${op || .2}"/>`;
  }
  const blobShadow = (rx, ry, dx, dy, op) => `<ellipse cx="${f(dx || 0)}" cy="${f(dy || 0)}" rx="${f(rx)}" ry="${f(ry)}" fill="#1e3a22" opacity="${op || .22}"/>`;

  /* ================== 건물 ================== */
  const ART = {};

  /** 마을회관 3×3 : 돌 받침 · 크림색 벽 · 나무 들보 · 청록 모임지붕 · 가운데 시계탑 · 깃발 */
  ART.town_hall = (def) => {
    const w = 2.5, d = 2.5, H = 40, z0 = 6;
    let s = '';
    s += box(0, 0, 3.05, 3.05, 0, 3, { l: '#cfc6b4', r: '#b3a993', t: '#e3dccb' });                 // 광장 바닥과 이어지는 받침
    s += box(0, 0, 2.8, 2.8, 3, z0 - 3, { l: '#b9b2a4', r: '#9b9384', t: '#cfc8b8' });              // 돌 기단
    // 앞 계단 (왼쪽 앞 벽 가운데)
    s += box(0, 1.55, .9, .3, 0, 3, '#d8d0c0') + box(0, 1.45, .8, .25, 3, 3, '#d8d0c0');
    s += box(0, 0, w, d, z0, H, { l: '#f7ead0', r: '#e2cfab', t: '#f2e4c6' });
    // 왼쪽 앞 벽: 들보 · 창 2 · 큰 문 · 간판
    const LW = w * 32;
    s += face('L', 0, 0, w, d, z0,
      beam(0, -H, LW, 4, '#7d5235') + beam(0, -4, LW, 4, '#7d5235') + beam(0, -H, 4, H) + beam(LW - 4, -H, 4, H) +
      // 처마가 벽 위쪽 약 7px 를 가리므로 간판 · 창은 그 아래에 둠
      win(9, -27, 12, 14, { sill: true, flowers: true, shutter: '#3f7f78' }) + win(LW - 21, -27, 12, 14, { sill: true, flowers: true, shutter: '#3f7f78' }) +
      door(LW / 2 - 8, 16, 20, '#8a5534', { frame: '#6a4228' }) +
      `<rect x="${f(LW / 2 - 16)}" y="-31" width="32" height="8.5" rx="2" fill="#3f7f78" stroke="#d7b779" stroke-width="1.2"/>` +
      `<text x="${f(LW / 2)}" y="-24.8" font-size="6" font-weight="700" text-anchor="middle" fill="#fff7dc">마을회관</text>` +
      `<path d="M${f(LW / 2 - 22)},-21 v11 l3,-3 l3,3 v-11 z" fill="#d98772"/><path d="M${f(LW / 2 + 16)},-21 v11 l3,-3 l3,3 v-11 z" fill="#9c83c7"/>`);
    // 오른쪽 앞 벽: 들보 · 창 3
    const RW = d * 32;
    s += face('R', 0, 0, w, d, z0,
      beam(0, -H, RW, 4, '#6b452c') + beam(0, -4, RW, 4, '#6b452c') + beam(RW - 4, -H, 4, H) +
      win(10, -27, 11, 14, { sill: true }) + win(RW / 2 - 5.5, -27, 11, 14, { sill: true }) + win(RW - 21, -27, 11, 14, { sill: true }));
    const roof = hipRoof(0, 0, w, d, z0 + H, 26, .22, { l: '#4f948b', r: '#3a7068', back: '#2f5d56' });
    s += roof.s;
    // 시계탑
    const tz = z0 + H + 14, th = 30;
    s += box(0, 0, .78, .78, tz, th, { l: '#f7ead0', r: '#ddc8a2', t: '#f2e4c6' });
    s += face('L', 0, 0, .78, .78, tz, `<circle cx="12.5" cy="-17" r="8" fill="#fffaf0" stroke="#d7b779" stroke-width="1.6"/><path d="M12.5,-17 v-5.5 M12.5,-17 l4,2" stroke="#3b2c12" stroke-width="1.2" stroke-linecap="round"/>`);
    s += face('R', 0, 0, .78, .78, tz, win(7, -24, 10, 12, { round: true }));
    const cap = hipRoof(0, 0, .78, .78, tz + th, 22, .14, { l: '#d7b779', r: '#b8955a', back: '#9c7a40' });
    s += cap.s;
    const top = tz + th + 22;
    s += `<path d="M0,${-top} v-16" stroke="#6b4a2e" stroke-width="1.6"/><path class="tw-flag" d="M0,${-top - 16} l14,4 l-14,5 z" fill="#d98772"/>`;
    return { body: s, shadow: footShadow(3, 3, .22, 16, 6, .2), top: top + 20 };
  };

  /** 광장 분수 2×2 : 돌 수반 · 물 · 가운데 기둥 · 윗 그릇 · 물줄기 */
  ART.fountain = () => {
    const R = .92, rx = R * 45.25, ry = R * 22.63, rim = 9;
    let s = '';
    // 수반 옆면
    s += `<path d="M${-rx},0 v${-rim} a${rx},${ry} 0 0 0 ${2 * rx},0 v${rim} a${rx},${ry} 0 0 1 ${-2 * rx},0 z" fill="#a9a395" stroke="#5a4a38" stroke-opacity=".3"/>`;
    s += `<ellipse cx="0" cy="${-rim}" rx="${f(rx)}" ry="${f(ry)}" fill="#ddd6c6" stroke="#5a4a38" stroke-opacity=".3"/>`;
    s += `<ellipse cx="0" cy="${-rim + .5}" rx="${f(rx - 5)}" ry="${f(ry - 2.6)}" fill="url(#twWater)"/>`;
    s += `<ellipse class="tw-ripple" cx="0" cy="${-rim + 1}" rx="${f(rx * .55)}" ry="${f(ry * .55)}" fill="none" stroke="#eaf9ff" stroke-width="1.2"/>`;
    // 기둥 · 윗 그릇
    s += `<rect x="-5" y="${-rim - 26}" width="10" height="26" fill="#cfc8b8" stroke="#5a4a38" stroke-opacity=".3"/><rect x="-5" y="${-rim - 26}" width="4" height="26" fill="#ddd6c6"/>`;
    s += `<path d="M-17,${-rim - 26} a17,8 0 0 0 34,0 v-4 a17,8 0 0 0 -34,0 z" fill="#b5ae9f"/><ellipse cx="0" cy="${-rim - 30}" rx="17" ry="8" fill="#e6dfd0"/><ellipse cx="0" cy="${-rim - 29.6}" rx="13" ry="5.6" fill="url(#twWater)"/>`;
    s += `<rect x="-2.5" y="${-rim - 44}" width="5" height="14" fill="#cfc8b8"/><circle cx="0" cy="${-rim - 46}" r="4" fill="#e6dfd0"/>`;
    // 물줄기
    s += `<g class="tw-jet" fill="none" stroke="#bfe9fb" stroke-width="2" stroke-linecap="round" opacity=".9">` +
      `<path d="M0,${-rim - 49} c-4,-8 -10,-6 -14,${8}"/><path d="M0,${-rim - 49} c4,-8 10,-6 14,${8}"/><path d="M-14,${-rim - 33} c-6,4 -10,10 -12,${18}"/><path d="M14,${-rim - 33} c6,4 10,10 12,${18}"/></g>`;
    s += `<g class="tw-drops" fill="#eaf9ff"><circle cx="-20" cy="${-rim - 4}" r="1.4"/><circle cx="22" cy="${-rim - 2}" r="1.2"/><circle cx="4" cy="${-rim + 6}" r="1.1"/></g>`;
    return { body: s, shadow: blobShadow(rx + 4, ry + 3, 8, 6, .2), top: rim + 60 };
  };

  /** 게시판 1×1 */
  ART.notice_board = () => {
    let s = '';
    s += box(-.32, .28, .1, .1, 0, 26, '#7a5236') + box(.32, .28, .1, .1, 0, 26, '#7a5236');
    s += face('L', 0, .25, .9, .1, 8, `<rect x="0" y="-20" width="28.8" height="18" rx="1.5" fill="#b07a4c" stroke="#6b452c" stroke-width="1.2"/>` +
      `<rect x="3" y="-17.5" width="8" height="7" fill="#fffaf0" transform="rotate(-4 7 -14)"/><rect x="13" y="-18" width="7" height="9" fill="#ffe9a8"/><rect x="21.5" y="-16" width="5" height="6" fill="#d6ecff" transform="rotate(5 24 -13)"/>` +
      `<rect x="5" y="-8.5" width="9" height="5" fill="#ffd1dc"/><circle cx="7" cy="-17" r="1" fill="#d98772"/><circle cx="16.5" cy="-17.6" r="1" fill="#3f7f78"/>`);
    s += face('L', 0, .25, .9, .1, 29, `<path d="M-3,0 h34.8 l-4,-6 h-26.8 z" fill="#3f7f78"/>`);
    return { body: s, shadow: blobShadow(16, 6, 6, 4, .18), top: 40 };
  };

  /** 상점 3×2 : 나무 판자 벽 · 줄무늬 차양 · 큰 진열창 · 간판 · 상자 · 통 */
  ART.shop = () => {
    const w = 2.6, d = 1.7, H = 30;
    let s = '';
    s += box(0, 0, 2.95, 2.05, 0, 3, { l: '#cdb48c', r: '#b29873', t: '#dcc7a2' });
    s += box(0, 0, w, d, 3, H, { l: '#d9a873', r: '#b98a5c', t: '#e3b787' });
    const LW = w * 32, RW = d * 32;
    let planks = ''; for(let y = -H + 6; y < 0; y += 6) planks += `<path d="M0,${y} h${LW}" stroke="#a7784c" stroke-width=".7" opacity=".6"/>`;
    s += face('L', 0, 0, w, d, 3, planks + beam(0, -H, 3.5, H, '#7a5236') + beam(LW - 3.5, -H, 3.5, H, '#7a5236') +
      `<rect x="8" y="-22" width="34" height="15" rx="1.5" fill="#6b452c"/><rect x="10" y="-20.5" width="30" height="12" rx="1" fill="url(#twGlass)"/>` +
      `<circle cx="16" cy="-12" r="3" fill="#ffcf4a"/><circle cx="23" cy="-11.5" r="2.6" fill="#ff8fb1"/><rect x="28" y="-15" width="6" height="6" fill="#8fd3ff"/><circle cx="36" cy="-12" r="2.4" fill="#a6d982"/>` +
      door(LW - 26, 14, 21, '#3f7f78', { frame: '#6b452c' }));
    let pl2 = ''; for(let y = -H + 6; y < 0; y += 6) pl2 += `<path d="M0,${y} h${RW}" stroke="#94693f" stroke-width=".7" opacity=".6"/>`;
    s += face('R', 0, 0, w, d, 3, pl2 + beam(RW - 3.5, -H, 3.5, H, '#5e3b26') + win(14, -23, 13, 13, { sill: true, flowers: true, frame: '#5e3b26' }));
    // 줄무늬 차양 (왼쪽 앞 벽 위)
    let aw = ''; const n = 10, aw0 = 4, awW = LW - 8;
    for(let i = 0; i < n; i++){ const x = aw0 + awW / n * i, c = i % 2 ? '#fffaf0' : '#d98772'; aw += `<path d="M${f(x)},-27 h${f(awW / n)} l1.5,9 q${f(-awW / n / 2 - 1.5)},4 ${f(-awW / n)},0 z" fill="${c}"/>`; }
    s += face('L', 0, 0, w, d, 3, `<g transform="translate(0,0) skewY(0)">${aw}</g>`);
    const roof = gableRoof(0, 0, w, d, 3 + H, 22, .18, '#c4573f', '#d9a873', 'u');
    s += roof.s;
    s += face('R', 0, 0, w, d, 3 + H, `<circle cx="${f(RW / 2)}" cy="-8" r="4.2" fill="#6b452c"/><circle cx="${f(RW / 2)}" cy="-8" r="3" fill="url(#twGlass)"/>`);
    // 간판 (지붕 앞)
    s += face('L', 0, 0, w, d, 3 + H, `<rect x="${f(LW / 2 - 17)}" y="-5" width="34" height="11" rx="2.5" fill="#fff3d6" stroke="#8a5a3a" stroke-width="1.4"/>` +
      `<circle cx="${f(LW / 2 - 10)}" cy=".5" r="3.2" fill="#ffcf4a" stroke="#c98a1b" stroke-width=".8"/><text x="${f(LW / 2 + 3)}" y="2.6" font-size="6.6" font-weight="700" text-anchor="middle" fill="#6b3f22">상점</text>`);
    // 굴뚝
    s += box(-.7, -.35, .28, .28, 3 + H + 8, 18, '#a35d48');
    // 상자 · 통 (오른쪽 앞)
    s += box(1.55, .55, .32, .32, 0, 9, '#c08a52') + box(1.55, .55, .3, .3, 9, 7, '#d4a06a');
    s += `<g transform="translate(${f(P(1.55, -.15)[0])},${f(P(1.55, -.15)[1])})"><path d="M-6,0 v-12 a6,2.6 0 0 1 12,0 v12 a6,2.6 0 0 1 -12,0z" fill="#9a6a42"/><ellipse cx="0" cy="-12" rx="6" ry="2.6" fill="#b7835a"/><path d="M-6,-4 a6,2.6 0 0 0 12,0 M-6,-9 a6,2.6 0 0 0 12,0" stroke="#5e3b26" stroke-width="1" fill="none"/></g>`;
    return { body: s, shadow: footShadow(3, 2, .2, 14, 5, .2), top: 3 + H + 34 };
  };

  /** 동물의 집 2×2 (색 변형 3종) */
  const HOUSE = [
    { wall: '#fbe9d0', roof: '#d9785a', door: '#7a9fd1', trim: '#8a5a3a', axis: 'u' },
    { wall: '#e6f1dc', roof: '#6f9bd1', door: '#d98772', trim: '#6b4a2e', axis: 'v' },
    { wall: '#f6e2ea', roof: '#8c6fbf', door: '#e2b04a', trim: '#6b4a2e', axis: 'u' }
  ];
  ART.animal_house = (def, inst) => {
    const v = HOUSE[(inst.variant || 0) % HOUSE.length], w = 1.6, d = 1.6, H = 26;
    let s = '';
    s += box(0, 0, 1.95, 1.95, 0, 3, { l: '#cdb48c', r: '#b29873', t: '#dcc7a2' });
    s += box(0, 0, w, d, 3, H, v.wall);
    const LW = w * 32, RW = d * 32;
    s += face('L', 0, 0, w, d, 3, beam(0, -H, 3, H, v.trim) + beam(LW - 3, -H, 3, H, v.trim) + beam(0, -H, LW, 3, v.trim) +
      door(LW / 2 - 7, 14, 19, v.door, { frame: v.trim, step: true }) + win(5, -19, 8, 10, { round: true, frame: v.trim }) +
      `<g transform="translate(${f(LW - 10)},-14)"><circle r="4.2" fill="#fff7dc" stroke="${v.trim}" stroke-width="1"/><g fill="${v.roof}"><circle cy="1" r="1.5"/><circle cx="-1.8" cy="-1.3" r=".9"/><circle cy="-2.2" r=".9"/><circle cx="1.8" cy="-1.3" r=".9"/></g></g>`);
    s += face('R', 0, 0, w, d, 3, beam(RW - 3, -H, 3, H, shade(v.trim, -.1)) + beam(0, -H, RW, 3, shade(v.trim, -.1)) + win(RW / 2 - 7, -20, 14, 11, { sill: true, flowers: true, frame: v.trim }));
    const roof = gableRoof(0, 0, w, d, 3 + H, 22, .2, v.roof, v.wall, v.axis);
    s += roof.s;
    // 박공벽의 둥근 창
    if(roof.gable) s += face(roof.gable.side, 0, 0, w, d, 3 + H, `<circle cx="${f(roof.gable.center)}" cy="-8" r="3.4" fill="${v.trim}"/><circle cx="${f(roof.gable.center)}" cy="-8" r="2.4" fill="url(#twGlass)"/>`);
    // 굴뚝 · 연기
    const ch = v.axis === 'u' ? [-.4, -.3] : [.3, -.4];
    s += box(ch[0], ch[1], .26, .26, 3 + H + 6, 16, '#b07a5a');
    const cp = P(ch[0], ch[1], 3 + H + 22);
    // 위치(translate)는 바깥 <g> 에 · 애니메이션은 안쪽 <g> 에 (CSS 애니메이션 transform 이 SVG transform 속성을 덮어써 연기가 원점으로 가던 문제)
    s += `<g transform="translate(${f(cp[0])},${f(cp[1])})"><g class="tw-smoke"><circle r="3.5" fill="#fff" opacity=".7"/><circle cx="3" cy="-7" r="4.5" fill="#fff" opacity=".55"/><circle cx="7" cy="-15" r="5.5" fill="#fff" opacity=".4"/></g></g>`;
    // 앞마당 화분
    s += box(-.25, 1.05, .22, .22, 0, 5, '#b9744a');
    const fp = P(-.25, 1.05, 6); s += `<g transform="translate(${f(fp[0])},${f(fp[1])})"><circle cx="-2" cy="-2" r="2.4" fill="#5aa04a"/><circle cx="2" cy="-3" r="2.2" fill="#6cb85a"/><circle cx="0" cy="-4.5" r="1.8" fill="#ff8fb1"/></g>`;
    return { body: s, shadow: footShadow(2, 2, .2, 12, 5, .2), top: 3 + H + 44 };
  };

  /* ================== 지형 장식 ================== */

  /** 언덕 계단 2×1 : v 방향으로 한 단(12px) 올라감 (바닥층) */
  ART.stairs = (def) => {
    const w = def.w, steps = 3, rise = 12;
    let s = '';
    s += box(-w / 2 + .06, 0, .12, 1, 0, rise + 2, '#9b9384') + box(w / 2 - .06, 0, .12, 1, 0, rise + 2, '#9b9384');   // 옆 돌
    for(let k = steps; k >= 1; k--){   // 뒤(높은 단)부터
      const dv = 1 / steps, cv = .5 - dv * (k - .5);
      s += box(0, cv, w - .24, dv + .02, 0, rise * k / steps, { l: '#ddd6c6', r: '#c2baa9', t: '#ebe5d6' });
    }
    return { body: s, shadow: '', top: rise + 8 };
  };

  /** 연못 다리 w×1 (u 방향 · 가운데가 살짝 솟은 나무 다리 · 바닥층) */
  ART.bridge = (def) => {
    const n = def.w, arch = 9, base = 5;
    const hAt = u => base + arch * Math.sin(Math.PI * (u + n / 2) / n);
    let deck = '', rails = '', posts = '';
    for(let i = 0; i < n * 2; i++){
      const u0 = -n / 2 + i / 2, u1 = u0 + .5, h0 = hAt(u0), h1 = hAt(u1);
      const a = P(u0, -.42, h0), b = P(u1, -.42, h1), c = P(u1, .42, h1), d = P(u0, .42, h0);
      deck += `<polygon points="${pts([d, c, [c[0], c[1] + 4], [d[0], d[1] + 4]])}" fill="#8a5a3a"/>`;
      deck += `<polygon points="${pts([a, b, c, d])}" fill="${i % 2 ? '#c99566' : '#d4a272'}" stroke="#7a5236" stroke-width=".6"/>`;
    }
    // 다리 기둥 (물에 잠김)
    for(let u = -n / 2 + 1.5; u < n / 2 - 1; u += 2){ const p = P(u, .42, 0); posts += `<rect x="${f(p[0] - 2)}" y="${f(p[1] - hAt(u))}" width="4" height="${f(hAt(u) + 4)}" fill="#6b452c"/>`; }
    // 난간: 뒤 → 앞
    const rail = (v, col) => {
      let line = [], ps = '';
      for(let i = 0; i <= n * 2; i++){ const u = -n / 2 + i / 2, p = P(u, v, hAt(u) + 11); line.push(p); if(i % 2 === 0){ const q = P(u, v, hAt(u)); ps += `<rect x="${f(q[0] - 1.4)}" y="${f(p[1])}" width="2.8" height="${f(q[1] - p[1])}" fill="${col}"/>`; } }
      return ps + `<polyline points="${pts(line)}" fill="none" stroke="${col}" stroke-width="2.4" stroke-linejoin="round"/>`;
    };
    rails = rail(-.42, '#7a5236') ;
    const front = rail(.42, '#8a5a3a');
    return { body: posts + rails + deck + front, shadow: '', top: base + arch + 16 };
  };

  /** 둥근 나무 (크기 · 색 변형) */
  ART.tree_round = (def, inst, rnd) => {
    const k = .85 + rnd * .35, g = ['#6cb85a', '#5fae52', '#78c062'][Math.floor(rnd * 3)], dk = shade(g, -.22), lt = shade(g, .25);
    const th = 16 * k;
    let s = `<path d="M-3,0 l1,${f(-th)} h4 l1,${f(th)} z" fill="#8a5a3a"/>`;
    s += `<circle cx="${f(-9 * k)}" cy="${f(-th - 8 * k)}" r="${f(11 * k)}" fill="${dk}"/><circle cx="${f(9 * k)}" cy="${f(-th - 9 * k)}" r="${f(11 * k)}" fill="${dk}"/>`;
    s += `<circle cx="0" cy="${f(-th - 16 * k)}" r="${f(15 * k)}" fill="${g}"/><circle cx="${f(-7 * k)}" cy="${f(-th - 6 * k)}" r="${f(10 * k)}" fill="${g}"/><circle cx="${f(8 * k)}" cy="${f(-th - 7 * k)}" r="${f(9.5 * k)}" fill="${g}"/>`;
    s += `<circle cx="${f(-5 * k)}" cy="${f(-th - 21 * k)}" r="${f(6 * k)}" fill="${lt}" opacity=".7"/>`;
    if(rnd > .6) s += `<circle cx="${f(6 * k)}" cy="${f(-th - 12 * k)}" r="1.8" fill="#ff8a7a"/><circle cx="${f(-8 * k)}" cy="${f(-th - 4 * k)}" r="1.8" fill="#ff8a7a"/>`;
    return { body: s, shadow: blobShadow(16 * k, 7 * k, 7, 3, .22), top: th + 32 * k };
  };
  /** 침엽수 */
  ART.tree_pine = (def, inst, rnd) => {
    const k = .9 + rnd * .4, g = ['#3f8a55', '#4a9660'][Math.floor(rnd * 2)], dk = shade(g, -.2), lt = shade(g, .18);
    let s = `<rect x="-2.5" y="${f(-10 * k)}" width="5" height="${f(10 * k)}" fill="#7a5236"/>`;
    [[0, 15, 26], [10, 12, 22], [19, 9, 18]].forEach(([y, hw, hh], i) => {
      const yb = -10 * k - y * k;
      s += `<path d="M${f(-hw * k)},${f(yb)} L0,${f(yb - hh * k)} L${f(hw * k)},${f(yb)} q${f(-hw * k)},${f(4 * k)} ${f(-2 * hw * k)},0z" fill="${i % 2 ? g : dk}"/>`;
      s += `<path d="M0,${f(yb - hh * k)} L${f(-hw * k * .55)},${f(yb - 1)} L0,${f(yb)}z" fill="${lt}" opacity=".45"/>`;
    });
    return { body: s, shadow: blobShadow(13 * k, 6 * k, 6, 3, .22), top: 52 * k };
  };
  /** 덤불 */
  ART.bush = (def, inst, rnd) => {
    const g = rnd > .5 ? '#5fae52' : '#6cb85a';
    let s = `<circle cx="-7" cy="-7" r="7.5" fill="${shade(g, -.18)}"/><circle cx="7" cy="-7" r="7.5" fill="${shade(g, -.12)}"/><circle cx="0" cy="-11" r="9" fill="${g}"/><circle cx="-3" cy="-14" r="3.5" fill="${shade(g, .25)}" opacity=".7"/>`;
    if(rnd > .4) s += `<circle cx="4" cy="-9" r="1.6" fill="#ff5f7e"/><circle cx="-5" cy="-6" r="1.6" fill="#ff5f7e"/><circle cx="1" cy="-15" r="1.5" fill="#ff5f7e"/>`;
    return { body: s, shadow: blobShadow(14, 5, 4, 1, .2), top: 22 };
  };
  /** 꽃밭 (걸어서 지나갈 수 있음) */
  ART.flowers = (def, inst, rnd) => {
    const cols = [['#ff8fb1', '#ffd34d', '#ffffff'], ['#c9b6ff', '#8fd3ff', '#ffffff'], ['#ffd34d', '#ff9a52', '#fff3a8']][Math.floor(rnd * 3)];
    let s = `<ellipse cx="0" cy="0" rx="20" ry="8" fill="#7cc95e" opacity=".75"/>`;
    for(let i = 0; i < 7; i++){
      const a = (rnd * 7 + i * 2.39) % (Math.PI * 2), r = 4 + (i * 37 % 11), x = Math.cos(a) * r * 1.5, y = Math.sin(a) * r * .55, c = cols[i % 3];
      s += `<path d="M${f(x)},${f(y)} v-6" stroke="#4fa94a" stroke-width="1.2"/><g transform="translate(${f(x)},${f(y - 7)})">${[0, 72, 144, 216, 288].map(t => `<ellipse cy="-2" rx="1.6" ry="2.3" fill="${c}" transform="rotate(${t})"/>`).join('')}<circle r="1.2" fill="#fff3a8"/></g>`;
    }
    return { body: s, shadow: '', top: 16 };
  };
  /** 바위 */
  ART.rock = (def, inst, rnd) => {
    const k = .8 + rnd * .5;
    let s = `<path d="M${f(-14 * k)},0 L${f(-11 * k)},${f(-9 * k)} L${f(-3 * k)},${f(-15 * k)} L${f(8 * k)},${f(-12 * k)} L${f(14 * k)},${f(-3 * k)} L${f(10 * k)},${f(3 * k)} L${f(-8 * k)},${f(4 * k)} Z" fill="#a3a7ad" stroke="#5a5f66" stroke-opacity=".35"/>`;
    s += `<path d="M${f(-11 * k)},${f(-9 * k)} L${f(-3 * k)},${f(-15 * k)} L${f(8 * k)},${f(-12 * k)} L${f(1 * k)},${f(-6 * k)} Z" fill="#c4c8cd"/>`;
    s += `<path d="M${f(1 * k)},${f(-6 * k)} L${f(8 * k)},${f(-12 * k)} L${f(14 * k)},${f(-3 * k)} L${f(10 * k)},${f(3 * k)} Z" fill="#8d9298"/>`;
    if(rnd > .45) s += `<path d="M${f(-10 * k)},${f(-8 * k)} q${f(5 * k)},${f(-6 * k)} ${f(11 * k)},${f(-5 * k)} l-3,3 q-4,-1 -8,3z" fill="#7fb85a" opacity=".85"/>`;
    return { body: s, shadow: blobShadow(15 * k, 5 * k, 4, 2, .2), top: 18 * k };
  };
  /** 울타리 (axis 'u' = 칸의 왼쪽 앞 가장자리 · 'v' = 오른쪽 앞 가장자리) */
  ART.fence = (def, inst) => {
    const axis = inst.axis || def.axis || 'u', ph = 13;
    const at = t => axis === 'u' ? [t, .42] : [.42, -t];
    let s = '';
    const a = at(-.5), b = at(.5);
    for(const r of [5, 10]){ s += `<polygon points="${pts([P(a[0], a[1], r + 1.6), P(b[0], b[1], r + 1.6), P(b[0], b[1], r), P(a[0], a[1], r)])}" fill="#e8c18a" stroke="#8a5a3a" stroke-opacity=".5" stroke-width=".7"/>`; }
    for(const t of [-.45, 0, .45]){ const [cu, cv] = at(t); s += box(cu, cv, .09, .09, 0, ph, { l: '#f2d4a2', r: '#d4ab72', t: '#f7e2bd' }); }
    return { body: s, shadow: '', top: ph + 6 };
  };
  /** 가로등 (따뜻한 불빛) */
  ART.lamp = () => {
    let s = box(0, 0, .14, .14, 0, 3, '#4a4a58') + box(0, 0, .07, .07, 3, 30, '#3d4250');
    s += `<circle class="tw-glow" cx="0" cy="-40" r="16" fill="url(#twGlow)"/>`;
    s += box(0, 0, .26, .26, 32, 10, { l: '#fff1b8', r: '#f5d77a', t: '#fff6d0' });
    s += `<path d="M-10,-42 L0,-50 L10,-42 L0,-38 z" fill="#3d4250"/><circle cx="0" cy="-51" r="1.8" fill="#d7b779"/>`;
    return { body: s, shadow: blobShadow(6, 2.6, 3, 1, .22), top: 58 };
  };
  /** 벤치 */
  ART.bench = (def, inst) => {
    const axis = inst.axis || 'u', w = axis === 'u' ? .8 : .3, d = axis === 'u' ? .3 : .8;
    let s = '';
    for(const t of [-.32, .32]){ const [cu, cv] = axis === 'u' ? [t, 0] : [0, t]; s += box(cu, cv, .08, .08, 0, 7, '#6b452c'); }
    s += box(0, 0, w, d, 7, 2.5, { l: '#d9a06a', r: '#b88050', t: '#e7b787' });
    const bk = axis === 'u' ? [0, -.13] : [-.13, 0], bw = axis === 'u' ? .8 : .06, bd = axis === 'u' ? .06 : .8;
    s += box(bk[0], bk[1], bw, bd, 9.5, 8, { l: '#d9a06a', r: '#b88050', t: '#e7b787' });
    return { body: s, shadow: footShadow(w, d, .05, 4, 2, .18), top: 22 };
  };
  /** 화분 (광장) */
  ART.planter = (def, inst, rnd) => {
    let s = box(0, 0, .55, .55, 0, 9, { l: '#c9874e', r: '#a96c3a', t: '#8a5a3a' });
    const c = ['#ff8fb1', '#ffd34d', '#c9b6ff'][Math.floor(rnd * 3)];
    s += `<g transform="translate(0,-10)"><circle cx="-6" cy="-3" r="5" fill="#5aa04a"/><circle cx="6" cy="-3" r="5" fill="#5aa04a"/><circle cx="0" cy="-7" r="6" fill="#6cb85a"/>` +
      [[-5, -6], [4, -8], [0, -11], [7, -3], [-7, -2]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2" fill="${c}"/>`).join('') + '</g>';
    return { body: s, shadow: footShadow(.55, .55, .05, 4, 2, .18), top: 26 };
  };

  /* ================== 4단계: 중심부 시설 7종 ================== */
  /** 지붕 앞 간판 (벽면 좌표 · 처마 높이 z 위에) */
  const roofSign = (cx, text, o) => { o = o || {}; const wdt = o.w || 36;
    return `<rect x="${f(cx - wdt / 2)}" y="-5" width="${wdt}" height="11" rx="2.5" fill="${o.bg || '#fff3d6'}" stroke="${o.line || '#8a5a3a'}" stroke-width="1.4"/>` +
      (o.icon || '') + `<text x="${f(cx + (o.icon ? 4 : 0))}" y="2.6" font-size="${o.size || 6.2}" font-weight="700" text-anchor="middle" fill="${o.ink || '#6b3f22'}">${text}</text>`; };

  /** 알 부화소 2×2 : 라벤더 기단 · 둥근 창 속 알 실루엣 · 보라 모임지붕 위 커다란 알 · 둥지 */
  ART.hatchery = () => {
    const w = 1.6, d = 1.6, H = 24, LW = w * 32, RW = d * 32;
    let s = box(0, 0, 1.95, 1.95, 0, 3, { l: '#dccfe8', r: '#c1b2d2', t: '#ebe0f4' });
    s += box(0, 0, w, d, 3, H, { l: '#fbf1e4', r: '#e7d6c3', t: '#f6ead8' });
    s += face('L', 0, 0, w, d, 3, beam(0, -H, LW, 3, '#8c6fbf') + beam(0, -3, LW, 3, '#8c6fbf') +
      door(LW / 2 - 7, 14, 17, '#9c83c7', { frame: '#5e4a86', step: true }) +
      `<g transform="translate(9,-13)"><circle r="5" fill="#5e4a86"/><circle r="3.8" fill="url(#twGlass)"/><ellipse cy=".3" rx="1.8" ry="2.4" fill="#fffaf0"/></g>` +
      `<g transform="translate(${f(LW - 9)},-13)"><circle r="5" fill="#5e4a86"/><circle r="3.8" fill="url(#twGlass)"/></g>`);
    s += face('R', 0, 0, w, d, 3, beam(0, -H, RW, 3, '#7a5ea8') + beam(0, -3, RW, 3, '#7a5ea8') +
      `<g transform="translate(${f(RW / 2)},-13)"><circle r="8.5" fill="#5e4a86"/><circle r="7" fill="url(#twGlass)"/><ellipse cy=".5" rx="3.6" ry="4.6" fill="#fff6d8" stroke="#d7b779" stroke-width=".8"/><circle cx="-1" cy="-1" r=".8" fill="#ff8fb1"/><circle cx="1.2" cy="1.6" r=".7" fill="#8fd3ff"/></g>`);
    s += hipRoof(0, 0, w, d, 3 + H, 17, .18, { l: '#a58bd0', r: '#7f66b0', back: '#6a5398' }).s;
    s += face('L', 0, 0, w, d, 3 + H, roofSign(LW / 2, '알 부화소', { w: 38, size: 5.6, bg: '#fbf4ff', line: '#6a5398', ink: '#4e3a76' }));
    // 지붕 위 커다란 알 (빛)
    const ap = P(0, 0, 3 + H + 17);
    s += `<g transform="translate(${f(ap[0])},${f(ap[1])})"><circle class="tw-glow" cy="-13" r="20" fill="url(#twGlow)"/>` +
      `<path d="M0,-30 C9,-30 13,-16 13,-10 C13,-2 7,1 0,1 C-7,1 -13,-2 -13,-10 C-13,-16 -9,-30 0,-30Z" fill="url(#twEgg)" stroke="#a98ad8" stroke-width="1.2"/>` +
      `<path d="M-12,-12 l4,-3 l4,3 l4,-3 l4,3 l4,-3 l3,2" fill="none" stroke="#d7b779" stroke-width="1.6"/><circle cx="-5" cy="-20" r="2" fill="#ff8fb1" opacity=".8"/><circle cx="5" cy="-6" r="2.3" fill="#8fd3ff" opacity=".8"/>` +
      `<ellipse cx="-4" cy="-21" rx="2.4" ry="4" fill="#fff" opacity=".6" transform="rotate(20 -4 -21)"/></g>`;
    // 앞마당 둥지
    const np = P(1.05, .5, 0);
    s += `<g transform="translate(${f(np[0])},${f(np[1])})"><ellipse cy="-2" rx="9" ry="4.5" fill="#b0834d" stroke="#7a5236" stroke-width=".8"/><path d="M-8,-3 q8,3 16,0" stroke="#d9b07a" stroke-width="1" fill="none"/>` +
      `<ellipse cx="-3" cy="-5" rx="3" ry="3.8" fill="#fffaf0" stroke="#c9b6ff" stroke-width=".7"/><ellipse cx="3" cy="-5.5" rx="3" ry="3.8" fill="#fff3c4" stroke="#d7b779" stroke-width=".7"/></g>`;
    return { body: s, shadow: footShadow(2, 2, .2, 12, 5, .2), top: 3 + H + 17 + 36 };
  };

  /** 도서관 2×2 : 청회색 돌벽 · 책이 보이는 아치 창 · 남색 맞배지붕 · 책 간판 · 책 더미 */
  ART.library = () => {
    const w = 1.6, d = 1.6, H = 32, LW = w * 32, RW = d * 32;
    let s = box(0, 0, 1.95, 1.95, 0, 3, { l: '#c9cdd4', r: '#aeb3bb', t: '#dadde2' });
    s += box(0, 0, w, d, 3, H, { l: '#e3e8ef', r: '#c3ccd8', t: '#edf1f6' });
    const books = (x, y, wd, ht) => { let b = `<rect x="${f(x)}" y="${f(y)}" width="${f(wd)}" height="${f(ht)}" fill="#6b452c"/>`; const cols = ['#d98772', '#7aa4d6', '#e2b04a', '#8fbf7a', '#9c83c7', '#f2a8c4'];
      for(let r = 0; r < 2; r++){ let bx = x + 1; const by = y + 1 + r * (ht / 2); let k = 0; while(bx < x + wd - 1.5){ const bw = 1.4 + (k * 7 % 3) * .5, bh = Math.max(.6, ht / 2 - 1.6 - (k % 3) * .4); b += `<rect x="${f(bx)}" y="${f(by + (k % 3) * .4)}" width="${f(bw)}" height="${f(bh)}" fill="${cols[(k + r) % cols.length]}"/>`; bx += bw + .3; k++; } b += `<rect x="${f(x)}" y="${f(by + ht / 2 - 1.2)}" width="${f(wd)}" height="1.2" fill="#8a5a3a"/>`; }
      return b; };
    const archWin = (x, y, wd, ht) => `<path d="M${f(x - 1.5)},${f(y + ht + 1.5)} v${f(-(ht - wd / 2) - 1.5)} a${f(wd / 2 + 1.5)},${f(wd / 2 + 1.5)} 0 0 1 ${f(wd + 3)},0 v${f(ht - wd / 2 + 1.5)} z" fill="#56657a"/>` +
      `<clipPath id="lbw${Math.round(x)}"><path d="M${f(x)},${f(y + ht)} v${f(-(ht - wd / 2))} a${f(wd / 2)},${f(wd / 2)} 0 0 1 ${f(wd)},0 v${f(ht - wd / 2)} z"/></clipPath>` +
      `<g clip-path="url(#lbw${Math.round(x)})"><rect x="${f(x)}" y="${f(y - 2)}" width="${f(wd)}" height="${f(ht + 4)}" fill="url(#twGlass)"/>${books(x, y + wd / 2, wd, ht - wd / 2)}</g>`;
    s += face('L', 0, 0, w, d, 3, beam(0, -H, LW, 3, '#7d8aa0') + beam(0, -4, LW, 4, '#9aa5b6') +
      archWin(4, -27, 11, 18) + door(LW / 2 - 6.5, 13, 20, '#4e6a9c', { frame: '#33476e', step: true }) + archWin(LW - 15, -27, 11, 18));
    s += face('R', 0, 0, w, d, 3, beam(0, -H, RW, 3, '#6d7a90') + beam(0, -4, RW, 4, '#8794a6') +
      `<g transform="translate(${f(RW / 2)},-21)"><circle r="8" fill="#56657a"/><circle r="6.5" fill="url(#twGlass)"/><path d="M0,-6.5 v13 M-6.5,0 h13" stroke="#56657a" stroke-width="1.2"/></g>`);
    const roof = gableRoof(0, 0, w, d, 3 + H, 20, .2, '#4e6a9c', '#e3e8ef', 'v');
    s += roof.s;
    // 박공벽: 펼친 책 문장 + 간판
    s += face('L', 0, 0, w, d, 3 + H, `<path d="M${f(LW / 2 - 7)},-15 q3.5,-2.6 7,0 q3.5,-2.6 7,0 v7 q-3.5,-2.2 -7,0 q-3.5,-2.2 -7,0z" fill="#fffaf0" stroke="#33476e" stroke-width="1"/><path d="M${f(LW / 2)},-15 v7" stroke="#33476e" stroke-width=".8"/>` +
      roofSign(LW / 2, '도서관', { w: 26, size: 5.8, bg: '#f4f7fb', line: '#33476e', ink: '#33476e' }));
    // 책 더미 (앞)
    s += box(-.55, 1.02, .3, .22, 0, 3, '#d98772') + box(-.55, 1.02, .28, .2, 3, 3, '#7aa4d6') + box(-.55, 1.02, .26, .19, 6, 2.6, '#e2b04a');
    s += box(.55, 1.02, .14, .14, 0, 3, '#56657a') + box(.55, 1.02, .07, .07, 3, 18, '#3d4250') + `<circle class="tw-glow" cx="${f(P(.55, 1.02)[0])}" cy="${f(P(.55, 1.02)[1] - 24)}" r="10" fill="url(#twGlow)"/>` + box(.55, 1.02, .2, .2, 20, 7, { l: '#fff1b8', r: '#f5d77a', t: '#fff6d0' });
    return { body: s, shadow: footShadow(2, 2, .2, 12, 5, .2), top: 3 + H + 20 + 14 };
  };

  /** 훈련장 3×2 : 나무 단 · 모래 바닥 · 허수아비 2 · 무기 거치대 · 작은 정자 · 깃발 · 간판 */
  ART.training_ground = () => {
    let s = box(0, 0, 2.95, 1.95, 0, 4, { l: '#c89a62', r: '#a87c48', t: '#e9d5a6' });
    // 바닥 줄 (모래 위 원)
    const c0 = P(-.2, .1, 4);
    s += `<ellipse cx="${f(c0[0])}" cy="${f(c0[1])}" rx="26" ry="13" fill="none" stroke="#fff6dc" stroke-width="1.6" stroke-dasharray="4 3" opacity=".8"/>`;
    // 정자 (뒤-오른쪽)
    const pc = [.85, -.45], pw = 1.0, pd = .75, ph = 22;
    for(const [du, dv] of [[-pw / 2, -pd / 2], [pw / 2, -pd / 2], [-pw / 2, pd / 2], [pw / 2, pd / 2]]) s += box(pc[0] + du * .9, pc[1] + dv * .9, .08, .08, 4, ph, '#7a5236');
    s += hipRoof(pc[0], pc[1], pw, pd, 4 + ph, 12, .12, { l: '#d9785a', r: '#b85c44', back: '#9a4a36' }).s;
    // 무기 거치대 (정자 아래)
    const rk = P(.85, -.3, 4);
    s += `<g transform="translate(${f(rk[0])},${f(rk[1])})"><rect x="-10" y="-13" width="20" height="2.4" fill="#8a5a3a"/><rect x="-10" y="-3" width="20" height="2.4" fill="#8a5a3a"/><rect x="-10" y="-14" width="2.2" height="14" fill="#6b452c"/><rect x="7.8" y="-14" width="2.2" height="14" fill="#6b452c"/>` +
      `<path d="M-5,-1 v-19" stroke="#cfd6de" stroke-width="2"/><path d="M-7,-15 h4" stroke="#8a5a3a" stroke-width="2"/><path d="M1,-1 v-22" stroke="#9a6a42" stroke-width="1.4"/><path d="M1,-23 l-2,-4 l4,0z" fill="#cfd6de"/><path d="M5,-1 v-17" stroke="#cfd6de" stroke-width="2"/><path d="M3,-13 h4" stroke="#8a5a3a" stroke-width="2"/></g>`;
    // 허수아비 2
    const dummy = (du, dv) => { const p = P(du, dv, 4); return `<g transform="translate(${f(p[0])},${f(p[1])})"><ellipse rx="6" ry="2.4" fill="#1e3a22" opacity=".2"/><rect x="-1.2" y="-26" width="2.4" height="26" fill="#7a5236"/>` +
      `<rect x="-10" y="-20" width="20" height="2.4" rx="1" fill="#8a5a3a"/><ellipse cy="-14" rx="6.5" ry="8" fill="#e2bd6a" stroke="#a8823a" stroke-width=".9"/>` +
      `<circle cy="-14" r="3.6" fill="#fffaf0"/><circle cy="-14" r="2.3" fill="#d98772"/><circle cy="-14" r="1" fill="#fffaf0"/><circle cy="-27" r="5" fill="#f0d394" stroke="#a8823a" stroke-width=".9"/>` +
      `<path d="M-6,-29 q6,-5 12,0" fill="#c4573f"/><path d="M-9,-20 l-3,3 M9,-20 l3,3" stroke="#e2bd6a" stroke-width="1.6"/></g>`; };
    s += dummy(-1.05, .2) + dummy(-.35, .5);
    // 깃발 (뒤-왼쪽)
    const fp = P(-1.25, -.75, 4);
    s += `<path d="M${f(fp[0])},${f(fp[1])} v-40" stroke="#6b452c" stroke-width="1.8"/><path class="tw-flag" d="M${f(fp[0])},${f(fp[1] - 40)} l16,4 l-16,6z" fill="#3f7f78"/>`;
    // 간판 (앞-왼쪽 모서리)
    const sp2 = P(-1.2, .85, 4);
    s += `<g transform="translate(${f(sp2[0])},${f(sp2[1])})"><rect x="-1" y="-16" width="2" height="16" fill="#6b452c"/><rect x="-15" y="-24" width="30" height="10" rx="2" fill="#fff3d6" stroke="#8a5a3a" stroke-width="1.2"/><text y="-16.7" font-size="6" font-weight="700" text-anchor="middle" fill="#6b3f22">훈련장</text></g>`;
    return { body: s, shadow: footShadow(3, 2, .1, 8, 3, .16), top: 4 + ph + 12 + 26 };
  };

  /** 모험가 길드 3×3 : 돌 기단 · 짙은 들보 · 진홍 모임지붕 · 큰 간판(검 문장) · 의뢰 게시판 · 깃발 현수막 · 굴뚝 */
  ART.adventure_guild = () => {
    const w = 2.5, d = 2.5, H = 36, LW = w * 32, RW = d * 32;
    let s = box(0, 0, 3.05, 3.05, 0, 3, { l: '#b9b2a4', r: '#9b9384', t: '#cfc8b8' });
    s += box(0, 0, 2.8, 2.8, 3, 3, { l: '#a9a295', r: '#8b8476', t: '#c2bbad' });
    s += box(0, 1.6, 1, .32, 0, 3, '#c9c1b2');
    s += box(0, 0, w, d, 6, H, { l: '#f1e2c4', r: '#d9c39c', t: '#eadbbd' });
    const sword = (x, y, r) => `<g transform="translate(${x},${y}) rotate(${r})"><path d="M0,-7 v11" stroke="#e6ebf0" stroke-width="1.6"/><path d="M-2.6,2 h5.2" stroke="#d7b779" stroke-width="1.4"/><path d="M0,2 v3" stroke="#6b452c" stroke-width="1.6"/></g>`;
    s += face('L', 0, 0, w, d, 6,
      beam(0, -H, LW, 4, '#5a3a24') + beam(0, -4, LW, 4, '#5a3a24') + beam(0, -H, 4, H, '#5a3a24') + beam(LW - 4, -H, 4, H, '#5a3a24') + beam(LW / 2 - 13, -H, 3, H - 22, '#5a3a24') + beam(LW / 2 + 10, -H, 3, H - 22, '#5a3a24') +
      // 큰 문 (양쪽 문)
      `<path d="M${f(LW / 2 - 10)},0 v-15 a10,10 0 0 1 20,0 v15z" fill="#4a2f1e"/><path d="M${f(LW / 2 - 8.5)},0 v-14.5 a8.5,8.5 0 0 1 17,0 v14.5z" fill="#8a3b32"/><path d="M${f(LW / 2)},-23 v23" stroke="#4a2f1e" stroke-width="1"/>` +
      `<circle cx="${f(LW / 2 - 2.5)}" cy="-9" r="1.2" fill="#d7b779"/><circle cx="${f(LW / 2 + 2.5)}" cy="-9" r="1.2" fill="#d7b779"/>` +
      // 의뢰 게시판 (왼쪽)
      `<rect x="7" y="-27" width="20" height="16" rx="1.5" fill="#9a6a42" stroke="#5a3a24" stroke-width="1"/><rect x="9" y="-25" width="6" height="7" fill="#fffaf0" transform="rotate(-5 12 -21)"/><rect x="16.5" y="-25.5" width="8" height="6" fill="#ffe9a8"/><rect x="10" y="-17" width="7" height="5" fill="#d6ecff"/><rect x="18" y="-18" width="6" height="6" fill="#ffd1dc" transform="rotate(4 21 -15)"/><circle cx="12" cy="-24.5" r=".9" fill="#c4573f"/><circle cx="20.5" cy="-25" r=".9" fill="#3f7f78"/>` +
      // 현수막 (오른쪽)
      `<path d="M${f(LW - 22)},-29 h12 v18 l-6,-4 l-6,4z" fill="#8a3b32"/>` + sword(LW - 16, -21, 35) + sword(LW - 16, -21, -35) +
      `<rect x="${f(LW / 2 - 11)}" y="-29" width="22" height="4" rx="1" fill="#5a3a24"/>`);
    s += face('R', 0, 0, w, d, 6, beam(0, -H, RW, 4, '#4a2f1e') + beam(0, -4, RW, 4, '#4a2f1e') + beam(RW - 4, -H, 4, H, '#4a2f1e') +
      win(9, -27, 11, 14, { sill: true, frame: '#4a2f1e' }) + win(RW / 2 - 5.5, -27, 11, 14, { sill: true, frame: '#4a2f1e' }) + win(RW - 21, -27, 11, 14, { sill: true, frame: '#4a2f1e' }));
    // 랜턴 2 (문 양옆)
    for(const k of [-1, 1]){ const lp = face('L', 0, 0, w, d, 6, `<g transform="translate(${f(LW / 2 + k * 15)},-24)"><circle class="tw-glow" r="9" fill="url(#twGlow)"/><rect x="-2.6" y="-3" width="5.2" height="6.5" rx="1" fill="#fff1b8" stroke="#3d4250" stroke-width="1"/><path d="M-3,-3 l3,-3 l3,3" fill="#3d4250"/></g>`); s += lp; }
    s += hipRoof(0, 0, w, d, 6 + H, 28, .22, { l: '#a5483d', r: '#7f3530', back: '#652a26' }).s;
    s += box(.75, -.6, .32, .32, 6 + H + 10, 22, '#8f8578');
    const sp3 = P(.75, -.6, 6 + H + 32); s += `<g transform="translate(${f(sp3[0])},${f(sp3[1])})"><g class="tw-smoke"><circle r="3.5" fill="#fff" opacity=".65"/><circle cx="3" cy="-7" r="4.5" fill="#fff" opacity=".5"/><circle cx="7" cy="-15" r="5.5" fill="#fff" opacity=".35"/></g></g>`;
    // 큰 간판 (처마 앞)
    s += face('L', 0, 0, w, d, 6 + H, `<rect x="${f(LW / 2 - 25)}" y="-6" width="50" height="13" rx="3" fill="#3b2c22" stroke="#d7b779" stroke-width="1.6"/>` +
      sword(LW / 2 - 18, 1, 40) + sword(LW / 2 - 18, 1, -40) +
      `<text x="${f(LW / 2 + 4)}" y="3.2" font-size="6.6" font-weight="700" text-anchor="middle" fill="#ffd77a">모험가 길드</text>`);
    // 깃발
    const fl = P(-1.3, -1.3, 6 + H + 2);
    s += `<path d="M${f(fl[0])},${f(fl[1])} v-34" stroke="#5a3a24" stroke-width="1.8"/><path class="tw-flag" d="M${f(fl[0])},${f(fl[1] - 34)} l18,4 l-18,7z" fill="#8a3b32"/>`;
    return { body: s, shadow: footShadow(3, 3, .22, 16, 6, .2), top: 6 + H + 28 + 40 };
  };

  /** 낚시터 오두막 2×2 : 판자 벽 · 청록 맞배지붕 · 물고기 간판 · 그물 · 낚싯대 · 통 · 물고기 양동이 */
  ART.fishing_hut = () => {
    const w = 1.5, d = 1.5, H = 22, LW = w * 32, RW = d * 32;
    let s = box(0, 0, 1.9, 1.9, 0, 3, { l: '#c9a777', r: '#ad8c5f', t: '#dcc196' });
    s += box(0, 0, w, d, 3, H, { l: '#c99a66', r: '#a97d4e', t: '#d8ad7a' });
    let pl = ''; for(let y = -H + 5; y < 0; y += 5) pl += `<path d="M0,${y} h${LW}" stroke="#9a6d42" stroke-width=".7" opacity=".7"/>`;
    s += face('L', 0, 0, w, d, 3, pl + beam(0, -H, 3, H, '#6b452c') + beam(LW - 3, -H, 3, H, '#6b452c') + door(LW / 2 - 6, 12, 16, '#3f8f9a', { frame: '#6b452c', step: true }) + win(4, -17, 7, 8, { frame: '#6b452c' }));
    let pr = ''; for(let y = -H + 5; y < 0; y += 5) pr += `<path d="M0,${y} h${RW}" stroke="#86603a" stroke-width=".7" opacity=".7"/>`;
    // 그물 (오른쪽 벽)
    let net = `<path d="M8,-19 q10,6 22,0 v12 q-11,5 -22,0z" fill="#e8dcc0" opacity=".85"/>`; for(let k = 0; k < 5; k++) net += `<path d="M${10 + k * 4},-18 l-2,12 M8,${-16 + k * 2.4} h22" stroke="#9a8a6a" stroke-width=".5"/>`;
    s += face('R', 0, 0, w, d, 3, pr + beam(RW - 3, -H, 3, H, '#5e3b26') + net + `<g transform="translate(19,-12)"><path d="M-4,0 q4,-3 8,0 q-4,3 -8,0z M4,0 l3,-2 v4z" fill="#ff9a52"/></g>`);
    s += gableRoof(0, 0, w, d, 3 + H, 17, .2, '#3f8f9a', '#c99a66', 'u').s;
    s += face('L', 0, 0, w, d, 3 + H, roofSign(LW / 2, '낚시터', { w: 30, size: 5.8, bg: '#eaf7f8', line: '#2c6b74', ink: '#2c6b74',
      icon: `<path d="M${f(LW / 2 - 11)},.5 q3,-2.6 6,0 q-3,2.6 -6,0z M${f(LW / 2 - 5)},.5 l2.4,-1.8 v3.6z" fill="#ff9a52"/>` }));
    // 낚싯대 · 통 · 양동이 (앞)
    const rp = P(.75, .95, 0);
    s += `<g transform="translate(${f(rp[0])},${f(rp[1])})"><path d="M-2,0 l14,-34" stroke="#8a5a3a" stroke-width="1.4"/><path d="M2,0 l18,-30" stroke="#6b452c" stroke-width="1.2"/><path d="M12,-34 q6,10 2,22" stroke="#e6ebf0" stroke-width=".5" fill="none"/></g>`;
    const bp = P(-.75, .95, 0);
    s += `<g transform="translate(${f(bp[0])},${f(bp[1])})"><path d="M-5,0 v-8 a5,2 0 0 1 10,0 v8 a5,2 0 0 1 -10,0z" fill="#8fa3b5"/><ellipse cy="-8" rx="5" ry="2" fill="#6fc3e3"/><path d="M-2,-9 q2,-2 4,0" stroke="#ff9a52" stroke-width="1.4" fill="none"/></g>`;
    s += `<g transform="translate(${f(P(1.05, -.2)[0])},${f(P(1.05, -.2)[1])})"><path d="M-5,0 v-11 a5,2.2 0 0 1 10,0 v11 a5,2.2 0 0 1 -10,0z" fill="#9a6a42"/><ellipse cy="-11" rx="5" ry="2.2" fill="#b7835a"/><path d="M-5,-4 a5,2.2 0 0 0 10,0" stroke="#5e3b26" fill="none"/></g>`;
    return { body: s, shadow: footShadow(2, 2, .2, 12, 5, .2), top: 3 + H + 17 + 20 };
  };

  /** 낚시 잔교 1×n (v 방향 · 연못 쪽으로 뻗음 · 바닥층) */
  ART.pier = (def) => {
    const n = def.d, hd = 4;
    let s = '';
    for(let i = 0; i < n * 2; i++){
      const v0 = -n / 2 + i / 2, v1 = v0 + .5, a = P(-.4, v0, hd), b = P(.4, v0, hd), c = P(.4, v1, hd), d = P(-.4, v1, hd);
      s += `<polygon points="${pts([d, c, [c[0], c[1] + 3], [d[0], d[1] + 3]])}" fill="#7a5236"/>`;
      s += `<polygon points="${pts([b, c, [c[0], c[1] + 3], [b[0], b[1] + 3]])}" fill="#6b452c"/>`;
      s += `<polygon points="${pts([a, b, c, d])}" fill="${i % 2 ? '#c99566' : '#d4a272'}" stroke="#7a5236" stroke-width=".6"/>`;
    }
    for(const v of [-n / 2 + .15, 0, n / 2 - .15]) for(const u of [-.42, .42]){ const q = P(u, v, 0); s += `<rect x="${f(q[0] - 1.6)}" y="${f(q[1] - hd - 7)}" width="3.2" height="${f(hd + 9)}" fill="#6b452c"/>`; }
    const e = P(0, -n / 2 + .2, hd); s += `<g transform="translate(${f(e[0])},${f(e[1])})"><path d="M2,-2 l12,-20" stroke="#8a5a3a" stroke-width="1.2"/><path d="M14,-22 q4,9 1,19" stroke="#e6ebf0" stroke-width=".5" fill="none"/><circle cx="15" cy="-2" r="1.6" fill="#ff5f7e"/></g>`;
    return { body: s, shadow: '', top: 30 };
  };

  /** 농장 3×3 : 밭 3줄(새싹 · 당근 · 호박) · 빨간 창고(오른쪽 면 문) · 건초 · 허수아비 · 울타리 · 간판 */
  ART.farm = () => {
    let s = '';
    // 밭 (앞-왼쪽 2×3)
    s += box(-.5, .05, 1.85, 2.75, 0, 3, { l: '#9b7047', r: '#83603b', t: '#a77a4c' });
    for(let r = 0; r < 3; r++){
      const cu = -1.05 + r * .55;
      const a = P(cu - .15, -1.25, 3), b = P(cu + .15, -1.25, 3), c = P(cu + .15, 1.35, 3), d = P(cu - .15, 1.35, 3);
      s += `<polygon points="${pts([a, b, c, d])}" fill="#8a6038"/>`;
      for(let k = 0; k < 5; k++){
        const p = P(cu, -1.05 + k * .58, 3);
        if(r === 0) s += `<g transform="translate(${f(p[0])},${f(p[1])})"><path d="M0,0 q-3,-5 -5,-6 M0,0 q2,-6 5,-7 M0,0 v-6" stroke="#5aa04a" stroke-width="1.5" fill="none"/></g>`;
        else if(r === 1) s += `<g transform="translate(${f(p[0])},${f(p[1])})"><path d="M-2,-1 l2,5 l2,-5z" fill="#ff9a52"/><path d="M0,-1 q-3,-5 -4,-7 M0,-1 q3,-5 4,-7 M0,-1 v-7" stroke="#4fa94a" stroke-width="1.3" fill="none"/></g>`;
        else s += `<g transform="translate(${f(p[0])},${f(p[1])})"><ellipse cy="-3.5" rx="5.5" ry="4" fill="#ff922e" stroke="#cc5a14" stroke-width=".8"/><path d="M-2,-6.8 q2,1 4,0 M0,-7 v-2" stroke="#5aa04a" stroke-width="1.2" fill="none"/></g>`;
      }
    }
    // 창고 (뒤-오른쪽)
    const bc = [.78, -.55], bw = 1.3, bd = 1.5, H = 22;
    s += box(bc[0], bc[1], bw + .12, bd + .12, 0, 2, '#b29873');
    s += box(bc[0], bc[1], bw, bd, 2, H, { l: '#d06a4f', r: '#ad503a', t: '#dd7e64' });
    s += face('L', bc[0], bc[1], bw, bd, 2, `<rect x="0" y="-${H}" width="${f(bw * 32)}" height="3" fill="#fffaf0"/>` + win(bw * 16 - 5, -16, 10, 9, { frame: '#fffaf0' }));
    const RW = bd * 32;
    s += face('R', bc[0], bc[1], bw, bd, 2, `<rect x="0" y="-${H}" width="${f(RW)}" height="3" fill="#f5ead8"/><rect x="${f(RW / 2 - 10)}" y="-17" width="20" height="17" fill="#8a3b32" stroke="#f5ead8" stroke-width="1.6"/>` +
      `<path d="M${f(RW / 2 - 10)},-17 l20,17 M${f(RW / 2 + 10)},-17 l-20,17 M${f(RW / 2)},-17 v17" stroke="#f5ead8" stroke-width="1.3"/>`);
    s += gableRoof(bc[0], bc[1], bw, bd, 2 + H, 16, .16, '#6b3a2e', '#d06a4f', 'v').s;
    s += face('L', bc[0], bc[1], bw, bd, 2 + H, `<circle cx="${f(bw * 16)}" cy="-6" r="3.2" fill="#fffaf0"/><circle cx="${f(bw * 16)}" cy="-6" r="2.2" fill="#5e3b26"/>`);
    // 건초 · 농기구 (창고 앞)
    const hp = P(1.25, .6, 0);
    s += `<g transform="translate(${f(hp[0])},${f(hp[1])})"><path d="M-8,0 v-8 a8,3 0 0 1 16,0 v8 a8,3 0 0 1 -16,0z" fill="#e2bd6a"/><ellipse cy="-8" rx="8" ry="3" fill="#f0d394"/><path d="M-8,-4 a8,3 0 0 0 16,0" stroke="#b8923e" fill="none"/></g>`;
    const tp = P(1.3, 1.15, 0);
    s += `<g transform="translate(${f(tp[0])},${f(tp[1])})"><path d="M0,0 l-4,-24" stroke="#8a5a3a" stroke-width="1.6"/><path d="M-6,-24 l-1,-6 M-4,-24 l-.5,-6 M-2,-24 l0,-6 M-6.5,-24 h5" stroke="#9aa5b6" stroke-width="1.1"/>` +
      `<path d="M6,0 v-6 h8 v6z" fill="#7aa4d6"/><path d="M14,-5 l5,-3" stroke="#7aa4d6" stroke-width="1.6"/><path d="M7,-6 q3,-5 6,0" stroke="#56657a" fill="none" stroke-width="1"/></g>`;
    // 허수아비 (밭 가운데)
    const sc = P(-.5, .1, 3);
    s += `<g transform="translate(${f(sc[0])},${f(sc[1])})"><rect x="-1" y="-30" width="2" height="30" fill="#7a5236"/><path d="M-11,-22 h22" stroke="#7a5236" stroke-width="2"/><path d="M-8,-24 h16 l-3,12 h-10z" fill="#5c8fd1"/><circle cy="-29" r="5" fill="#f0d394"/><path d="M-8,-31 h16 l-4,-5 h-8z" fill="#c4973a"/><path d="M-11,-22 l-2,3 M11,-22 l2,3" stroke="#e2bd6a" stroke-width="1.4"/></g>`;
    // 울타리 (밭 앞-왼쪽 가장자리)
    for(let k = 0; k < 6; k++){ const v = -1.3 + k * .53; s += box(-1.45, v, .07, .07, 0, 11, { l: '#f2d4a2', r: '#d4ab72', t: '#f7e2bd' }); }
    s += `<polyline points="${pts([P(-1.45, -1.35, 8), P(-1.45, 1.35, 8)])}" stroke="#e8c18a" stroke-width="2"/><polyline points="${pts([P(-1.45, -1.35, 4), P(-1.45, 1.35, 4)])}" stroke="#e8c18a" stroke-width="2"/>`;
    for(let k = 0; k < 5; k++){ const u = -1.4 + k * .5; if(u > -.3) break; s += box(u, 1.45, .07, .07, 0, 11, { l: '#f2d4a2', r: '#d4ab72', t: '#f7e2bd' }); }
    // 간판
    const sg = P(1.3, -1.35, 0);
    s += `<g transform="translate(${f(sg[0])},${f(sg[1])})"><rect x="-1" y="-15" width="2" height="15" fill="#6b452c"/><rect x="-13" y="-23" width="26" height="10" rx="2" fill="#fff3d6" stroke="#8a5a3a" stroke-width="1.2"/><text y="-15.7" font-size="6" font-weight="700" text-anchor="middle" fill="#6b3f22">농장</text></g>`;
    return { body: s, shadow: footShadow(1.4, 1.6, .1, 18, -2, .16), top: 2 + H + 16 + 18 };
  };

  /** 우체통 1×1 : 빨간 둥근 우체통 · 투입구 · 금색 문장 · 이정표 */
  ART.mailbox = () => {
    let s = '';
    s += `<path d="M-7,0 v-17 a7,4 0 0 1 14,0 v17 a7,3 0 0 1 -14,0z" fill="#d6453a" stroke="#7a2a24" stroke-width="1"/><path d="M-7,-17 a7,4 0 0 1 14,0 a7,3 0 0 1 -14,0z" fill="#e8655a"/>`;
    s += `<path d="M-7,-17 c0,-7 14,-7 14,0" fill="#c23a30" stroke="#7a2a24" stroke-width="1"/><rect x="-4" y="-12" width="6.5" height="1.6" rx=".8" fill="#4a1c18"/><circle cx="-1" cy="-6" r="2" fill="#ffd77a"/>`;
    s += `<path d="M-7,-1 a7,3 0 0 0 14,0" stroke="#7a2a24" stroke-width="1.4" fill="none"/><path d="M-4.5,-15 v12" stroke="#fff" stroke-width="1" opacity=".35"/>`;
    // 이정표
    s += `<g transform="translate(12,2)"><rect x="-1" y="-30" width="2" height="30" fill="#7a5236"/>` +
      `<path d="M0,-28 h15 l3,3 l-3,3 h-15z" fill="#fff3d6" stroke="#8a5a3a" stroke-width=".8"/><text x="7.5" y="-23.6" font-size="4.6" font-weight="700" text-anchor="middle" fill="#6b3f22">연못</text>` +
      `<path d="M0,-19 h-15 l-3,3 l3,3 h15z" fill="#fff3d6" stroke="#8a5a3a" stroke-width=".8"/><text x="-7.5" y="-14.6" font-size="4.6" font-weight="700" text-anchor="middle" fill="#6b3f22">광장</text></g>`;
    return { body: s, shadow: blobShadow(10, 4, 4, 1, .2), top: 36 };
  };

  /* ================== T7 소품 · 자연 장식 (그림 파일이 없거나 실패할 때 · ?gfx=svg 에서 쓰는 단순 SVG) ================== */
  const WD = { l: '#c9905a', r: '#a8743f', t: '#ddb07a' }, WD2 = { l: '#b07a48', r: '#8e5f35', t: '#c99563' }, INK = 'stroke="#5e3b26" stroke-width=".9"';
  const post = (x, h, w) => `<rect x="${f(x - (w || 3) / 2)}" y="${f(-h)}" width="${w || 3}" height="${f(h)}" fill="#9a6a42" ${INK}/>`;
  const tuft = (x, y, c) => `<path d="M${f(x - 4)},${f(y)} l1.5,-6 l1.5,5 l1.5,-7 l1.5,6 l1.5,-5 l1.5,7z" fill="${c || '#6cae4e'}"/>`;
  const bloom = (x, y, c) => `<g transform="translate(${f(x)},${f(y)})">${[0, 72, 144, 216, 288].map(t => `<ellipse cy="-1.8" rx="1.3" ry="2" fill="${c}" transform="rotate(${t})"/>`).join('')}<circle r="1" fill="#ffd34d"/></g>`;
  /** 표지판 4종 */
  ART.sign_direction = () => ({ body: post(0, 40, 4) + `<path d="M-12,-36 h22 l5,4 l-5,4 h-22z" fill="${WD.t}" ${INK}/><path d="M12,-24 h-22 l-5,4 l5,4 h22z" fill="${WD.l}" ${INK}/>`, shadow: blobShadow(8, 3, 3, 1, .2), top: 42 });
  ART.sign_round = () => ({ body: post(0, 34, 4) + `<ellipse cx="0" cy="-26" rx="11" ry="12" fill="${WD.t}" ${INK}/><path d="M-9,-29 h18 M-10,-23 h20" stroke="#a8743f" stroke-width=".8"/>`, shadow: blobShadow(8, 3, 3, 1, .2), top: 40 });
  ART.sign_hanging = () => ({ body: post(-14, 40) + post(14, 34) + `<path d="M-15,-36 L15,-30" stroke="#7a5236" stroke-width="3"/><path d="M-7,-34 v6 M7,-31 v6" stroke="#6e6e78" stroke-width="1.2"/>` +
    `<path d="M-11,-28 L11,-24 L11,-12 L-11,-16z" fill="${WD.l}" ${INK}/>`, shadow: '', top: 42 });
  ART.sign_entrance = () => ({ body: post(-8, 14) + post(9, 10) + `<path d="M-15,-30 q15,-8 30,4 v12 l-30,-6z" fill="${WD.t}" ${INK}/><path d="M-12,-26 q12,-5 24,3 v7 l-24,-4z" fill="#e9d2a4"/>`, shadow: '', top: 36 });
  /** 생활 소품 6종 */
  ART.crate_closed = () => ({ body: box(0, 0, .5, .5, 0, 16, WD) + `<path d="M-16,-8 L0,0 M16,-8 L0,0" stroke="#7a5236" stroke-width=".8" opacity=".6"/>`, shadow: blobShadow(13, 5, 3, 1, .2), top: 26 });
  ART.barrel_wood = () => ({ body: `<path d="M-9,0 q-3,-10 0,-20 h18 q3,10 0,20 a9,3 0 0 1 -18,0z" fill="#a8743f" ${INK}/><ellipse cx="0" cy="-20" rx="9" ry="3" fill="#ddb07a" ${INK}/>` +
    `<path d="M-10.5,-5 a10.5,3 0 0 0 21,0 M-10.5,-15 a10.5,3 0 0 0 21,0" stroke="#55555f" stroke-width="1.6" fill="none"/>`, shadow: blobShadow(10, 4, 3, 1, .2), top: 26 });
  ART.sack_vegetables = () => ({ body: `<path d="M-11,0 q-3,-12 4,-18 h14 q7,6 4,18 q-11,4 -22,0z" fill="#c9a77a" ${INK}/><circle cx="-4" cy="-19" r="3.5" fill="#e98a3a"/><circle cx="3" cy="-20" r="4" fill="#8cc06a"/><circle cx="7" cy="-18" r="3" fill="#e8c890"/>` +
    `<path d="M-5,-22 l-2,-6 M-4,-22 l1,-6" stroke="#5aa04a" stroke-width="1.4"/>`, shadow: blobShadow(12, 4, 3, 1, .2), top: 30 });
  ART.basket_vegetables = () => ({ body: `<path d="M-11,-12 h22 l-3,11 q-8,3 -16,0z" fill="#c99563" ${INK}/><path d="M-9,-12 q9,-14 18,0" fill="none" stroke="#a8743f" stroke-width="1.6"/>` +
    `<circle cx="-5" cy="-13" r="3" fill="#e98a3a"/><circle cx="1" cy="-14" r="3.4" fill="#8cc06a"/><circle cx="6" cy="-13" r="2.6" fill="#c2577a"/>`, shadow: blobShadow(11, 4, 3, 1, .2), top: 26 });
  ART.crate_vegetables = () => ({ body: box(0, 0, .62, .42, 0, 9, WD) + [[-8, -11, '#d9453a'], [-2, -12, '#d9453a'], [4, -11, '#8cc06a'], [9, -9, '#d9453a'], [1, -8, '#8cc06a']].map(([x, y, c]) => `<circle cx="${x}" cy="${y}" r="2.8" fill="${c}"/>`).join(''), shadow: blobShadow(14, 5, 3, 1, .2), top: 20 });
  ART.crates_stacked = () => ({ body: box(-.12, .05, .5, .5, 0, 14, WD) + box(.26, .2, .3, .3, 0, 10, WD2) + box(-.1, .03, .32, .32, 14, 11, WD), shadow: blobShadow(16, 6, 3, 1, .2), top: 34 });
  /** 자연 장식 6종 (지나갈 수 있음 · 그림자 없음) */
  const shroom = (x, y, s, cap, dot) => `<rect x="${f(x - 1.4 * s)}" y="${f(y - 7 * s)}" width="${f(2.8 * s)}" height="${f(7 * s)}" rx="1" fill="#efe3c8"/><path d="M${f(x - 6 * s)},${f(y - 6 * s)} q${f(6 * s)},${f(-9 * s)} ${f(12 * s)},0z" fill="${cap}" ${INK}/>` + (dot ? `<circle cx="${f(x - 2 * s)}" cy="${f(y - 8.5 * s)}" r="${f(.9 * s)}" fill="#fff"/><circle cx="${f(x + 2.2 * s)}" cy="${f(y - 9 * s)}" r="${f(.8 * s)}" fill="#fff"/>` : '');
  ART.mushrooms_red = () => ({ body: tuft(-6, 1) + shroom(0, 0, 1.3, '#d9453a', 1) + shroom(-7, 1, .9, '#d9453a', 1) + shroom(7, 1, .8, '#d9453a', 1), shadow: '', top: 22 });
  ART.mushrooms_brown = () => ({ body: tuft(6, 1) + shroom(0, 0, 1.3, '#9a6a42') + shroom(-7, 1, .9, '#8a5a3a') + shroom(6, 2, .7, '#7a4e30'), shadow: '', top: 22 });
  ART.wildflowers_yellow = () => ({ body: tuft(-5, 1) + tuft(5, 1) + [[-8, -9, '#ffd34d'], [-2, -13, '#ffffff'], [4, -10, '#ffd34d'], [9, -12, '#ffffff'], [1, -7, '#ffd34d']].map(([x, y, c]) => `<path d="M${x},${y} v${-y}" stroke="#5aa04a" stroke-width="1"/>` + bloom(x, y, c)).join(''), shadow: '', top: 20 });
  ART.wildflowers_pink = () => ({ body: tuft(-5, 1) + tuft(5, 1) + [[-9, -9], [-3, -13], [3, -10], [9, -12], [0, -6]].map(([x, y]) => `<path d="M${x},${y} v${-y}" stroke="#5aa04a" stroke-width="1"/>` + bloom(x, y, '#ff9cc2')).join(''), shadow: '', top: 20 });
  ART.grass_low = () => ({ body: tuft(-8, 2, '#5f9e45') + tuft(-1, 0, '#6cae4e') + tuft(6, 2, '#5f9e45') + tuft(2, 4, '#78bb58'), shadow: '', top: 12 });
  ART.plant_leafy = () => ({ body: `<path d="M0,0 v-18" stroke="#4f8a3a" stroke-width="1.6"/>` + [[-1, -6, -7], [1, -10, 7], [-1, -14, -6], [1, -17, 5]].map(([x, y, dx]) => `<ellipse cx="${x + dx / 2}" cy="${y}" rx="${Math.abs(dx) / 2 + 1.5}" ry="2.4" fill="#6cae4e" transform="rotate(${dx > 0 ? -25 : 25} ${x + dx / 2} ${y})"/>`).join(''), shadow: '', top: 22 });
  /** 정원 장식 4종 */
  ART.pot_terracotta = () => ({ body: `<path d="M-7,-14 h14 l-2,14 h-10z" fill="#c9774a" ${INK}/><rect x="-8" y="-16" width="16" height="3" rx="1" fill="#d98a5a" ${INK}/>` + [[-4, -22, -25], [0, -25, 0], [4, -22, 25]].map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="2.6" ry="6" fill="#6cae4e" transform="rotate(${r} ${x} ${y})"/>`).join(''), shadow: blobShadow(9, 3.5, 3, 1, .2), top: 32 });
  ART.planter_wood = () => ({ body: box(0, 0, .7, .35, 0, 9, WD) + `<g transform="translate(0,-12)"><circle cx="-8" cy="0" r="4" fill="#5aa04a"/><circle cx="0" cy="-2" r="5" fill="#6cae4e"/><circle cx="8" cy="0" r="4" fill="#5aa04a"/>` +
    bloom(-7, -4, '#ff9cc2') + bloom(0, -6, '#ffd34d') + bloom(7, -4, '#ffffff') + '</g>', shadow: blobShadow(15, 5, 3, 1, .2), top: 26 });
  ART.planter_stone = () => ({ body: `<ellipse cx="0" cy="0" rx="21" ry="10" fill="#9da1a7" ${INK}/><ellipse cx="0" cy="-1" rx="16" ry="7" fill="#6b4a32"/>` + [[-7, -2], [0, -4], [7, -2], [0, 1]].map(([x, y]) => `<path d="M${x},${y} q-3,-4 -4,-1 M${x},${y} q3,-4 4,-1" stroke="#7cc95e" stroke-width="1.6" fill="none"/>`).join(''), shadow: '', top: 12 });
  ART.planter_herb = () => ({ body: box(0, 0, .5, .3, 0, 9, WD2) + `<path d="M-6,-10 l-2,-12 M-3,-10 l1,-14 M2,-10 l-1,-10 M5,-10 l3,-12" stroke="#5aa04a" stroke-width="1.8" stroke-linecap="round"/><circle cx="6" cy="-15" r="4" fill="#78bb58"/>`, shadow: blobShadow(11, 4, 3, 1, .2), top: 28 });

  /** 그림 파일이 생기면 여기에 등록 (키 → { src, w, h, ax, ay }) — 지금은 비어 있음 */
  const IMAGES = {};

  /** 여러 물체 SVG 가 함께 쓰는 그라데이션 (문서에 한 번만 넣음) */
  const DEFS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
    <linearGradient id="twGlass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6c8"/><stop offset="1" stop-color="#ffd27a"/></linearGradient>
    <linearGradient id="twGlassDay" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e6f6ff"/><stop offset="1" stop-color="#9fd2ee"/></linearGradient>
    <linearGradient id="twWater" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9be0f5"/><stop offset="1" stop-color="#4fb0d8"/></linearGradient>
    <radialGradient id="twEgg" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="#fffdf5"/><stop offset=".6" stop-color="#f0e4ff"/><stop offset="1" stop-color="#c3a8ea"/></radialGradient>
    <radialGradient id="twGlow"><stop offset="0" stop-color="#fff3b0" stop-opacity=".85"/><stop offset="1" stop-color="#fff3b0" stop-opacity="0"/></radialGradient>
  </defs></svg>`;

  window.TaleliaTownArt = Object.freeze({ ART, IMAGES, DEFS, P, shade });
})();
