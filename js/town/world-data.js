/* =====================================================================
 * TALELIA · town/world-data.js — 마을 지도 (고정 데이터 · 화면 전용)
 *
 *  1단계: 땅만 정의합니다. 건물·장식(2단계)과 동물(3단계)은 아직 없습니다.
 *  - 세계 42×42칸. 바깥 2칸은 숲 테두리(걸을 수 없음).
 *  - 구역 사각형(zones)은 2단계에서 건물을 놓을 자리입니다. 지금은 바닥 종류만 다르게 칠합니다.
 *  - "내 정원"은 기존 fit_village 배치(x, y)를 그대로 옮겨 보여 줄 자리입니다.
 *      정원 칸 (x, y) = 세계 칸 (GARDEN.x0 + x, GARDEN.y0 + y)
 *      최대 땅 크기 18×18(land_level 6)을 미리 확보하고, 현재 크기만 정원으로 칠합니다.
 *  - SAMPLE_GARDEN 은 1~3단계용 예제 데이터입니다. 모양은 villageOf() 의 terrain({x,y,h,t}) 과 같습니다.
 *    실제 계정 데이터가 아니며 서버에서 받지 않습니다.
 *
 *  바닥 종류 t: grass 잔디 · meadow 꽃잔디 · forest 숲 테두리 · path 흙길 · plaza 광장 돌바닥
 *              water 물 · sand 모래 · dirt 흙 · stone 돌 · flower 꽃밭 · snow 눈   (뒤 6개는 기존 지형 종류와 같은 이름)
 * ===================================================================== */
(function(){
  const W = 42, H = 42, EDGE = 2;
  const GARDEN = { x0: 6, y0: 22, max: 18 };

  /** 1~3단계 예제 정원 (land_level 2 → 10×10칸). 기존 villageOf() 결과와 같은 모양 */
  const SAMPLE_GARDEN = Object.freeze({
    village: { land_level: 2, coins: 12345, pending: 124, awaken_stones: 3, likes_received: 7, bg: 'sky' },
    terrain: [
      { x: 0, y: 0, h: 1, t: 'grass' }, { x: 1, y: 0, h: 1, t: 'grass' }, { x: 0, y: 1, h: 1, t: 'grass' }, { x: 1, y: 1, h: 1, t: 'flower' },
      { x: 2, y: 0, h: 1, t: 'grass' }, { x: 0, y: 2, h: 1, t: 'grass' },
      { x: 7, y: 7, h: 0, t: 'water' }, { x: 8, y: 7, h: 0, t: 'water' }, { x: 7, y: 8, h: 0, t: 'water' }, { x: 8, y: 8, h: 0, t: 'water' },
      { x: 6, y: 7, h: 0, t: 'sand' }, { x: 6, y: 8, h: 0, t: 'sand' }, { x: 7, y: 6, h: 0, t: 'sand' }, { x: 8, y: 6, h: 0, t: 'sand' },
      { x: 4, y: 3, h: 0, t: 'dirt' }, { x: 4, y: 4, h: 0, t: 'dirt' }, { x: 4, y: 5, h: 0, t: 'dirt' }, { x: 5, y: 5, h: 0, t: 'dirt' },
      { x: 2, y: 7, h: 0, t: 'stone' }, { x: 9, y: 1, h: 0, t: 'snow' }
    ],
    items: []   // 2단계부터 사용 (배치된 동물·장식)
  });

  /** 2단계에서 건물을 놓을 구역 (세계 칸 · 양 끝 포함) */
  const ZONES = Object.freeze([
    { key: 'plaza',       name: '마을 광장',   x: [19, 25], y: [12, 18] },
    { key: 'commerce',    name: '상업 구역',   x: [9, 15],  y: [12, 19] },
    { key: 'residential', name: '주거 구역',   x: [9, 16],  y: [3, 9] },
    { key: 'training',    name: '훈련 구역',   x: [20, 27], y: [3, 8] },
    { key: 'guild',       name: '모험가 길드', x: [29, 33], y: [3, 7] },
    { key: 'pond',        name: '연못',       x: [30, 36], y: [17, 23] },
    { key: 'farm',        name: '농장 입구',   x: [33, 37], y: [30, 34] },
    { key: 'garden',      name: '내 정원',     x: [GARDEN.x0, GARDEN.x0 + GARDEN.max - 1], y: [GARDEN.y0, GARDEN.y0 + GARDEN.max - 1] }
  ]);

  function hash(x, y){ let n = (x * 374761393 + y * 668265263) | 0; n = (n ^ (n >>> 13)) * 1274126177; return ((n ^ (n >>> 16)) >>> 0) / 4294967296; }

  /** 지도 만들기. garden 은 villageOf() 모양({ village, terrain }) — 1단계는 SAMPLE_GARDEN */
  function build(garden){
    const tiles = new Array(W * H);
    const at = (x, y) => tiles[y * W + x];
    const set = (x, y, t, h) => { if(x < 0 || y < 0 || x >= W || y >= H) return; const c = at(x, y); c.t = t; if(h != null) c.h = h; };
    const rect = (x0, x1, y0, y1, t, h) => { for(let y = y0; y <= y1; y++) for(let x = x0; x <= x1; x++) set(x, y, t, h); };

    // 1) 기본: 잔디 · 숲 테두리 (안쪽 가장자리는 조금 들쭉날쭉하게)
    for(let y = 0; y < H; y++) for(let x = 0; x < W; x++){
      const d = Math.min(x, y, W - 1 - x, H - 1 - y);
      const forest = d < EDGE || (d === EDGE && hash(x, y) < .35);
      tiles[y * W + x] = { x, y, t: forest ? 'forest' : 'grass', h: 0, zone: null };
    }
    // 2) 꽃잔디 무늬
    for(let y = EDGE; y < H - EDGE; y++) for(let x = EDGE; x < W - EDGE; x++) if(at(x, y).t === 'grass' && hash(x * 3, y * 7) < .07) set(x, y, 'meadow');
    // 3) 언덕 (높이 1): 훈련장 · 모험가 길드 터
    rect(20, 27, 3, 8, 'grass', 1);
    rect(29, 33, 3, 7, 'grass', 1);
    // 4) 연못: 모래 테두리 → 물
    rect(29, 37, 16, 24, 'sand', 0);
    rect(30, 36, 17, 23, 'water', 0);
    set(30, 17, 'sand'); set(36, 23, 'sand'); set(36, 17, 'sand'); set(30, 23, 'sand');
    // 5) 광장
    rect(19, 25, 12, 18, 'plaza', 0);
    // 6) 길 (너비 2, 꺾인 선). 물·언덕 위로는 깔지 않음 (다리·계단은 2단계 장식)
    const path = pts => {
      for(let i = 1; i < pts.length; i++){
        let [x, y] = pts[i - 1]; const [x1, y1] = pts[i];
        const sx = Math.sign(x1 - x), sy = Math.sign(y1 - y);
        for(;;){
          for(const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]){ const c = tiles[(y + dy) * W + (x + dx)]; if(c && c.t !== 'water' && c.t !== 'plaza' && c.h === 0) c.t = 'path'; }
          if(x === x1 && y === y1) break;
          if(x !== x1) x += sx; else y += sy;
        }
      }
    };
    path([[18, 15], [15, 15]]);                    // 광장 → 상업 구역
    path([[15, 15], [15, 10], [12, 10]]);          // → 주거 구역
    path([[22, 11], [22, 9]]);                     // 광장 → 훈련장 언덕 아래 (계단 자리)
    path([[26, 15], [28, 15]]);                    // 광장 → 연못
    path([[22, 19], [22, 21]]);                    // 광장 → 내 정원
    path([[26, 18], [26, 27], [34, 27], [34, 29]]); // → 농장 입구
    path([[37, 15], [37, 10], [34, 10], [34, 8]]); // 숲길: 연못 → 모험가 길드
    // 7) 내 정원 (현재 땅 크기만). 나머지 확보 칸은 잔디로 둠
    const lv = Number(garden && garden.village && garden.village.land_level) || 1;
    const n = Math.min(GARDEN.max, 6 + 2 * lv);
    for(let y = 0; y < n; y++) for(let x = 0; x < n; x++){ const c = at(GARDEN.x0 + x, GARDEN.y0 + y); if(c){ c.t = 'grass'; c.h = 0; c.garden = true; } }
    ((garden && garden.terrain) || []).forEach(tr => {
      if(tr.x < 0 || tr.y < 0 || tr.x >= n || tr.y >= n) return;   // 기존 엔진처럼 현재 땅 밖은 무시
      const c = at(GARDEN.x0 + tr.x, GARDEN.y0 + tr.y);
      if(c){ c.t = tr.t || 'grass'; c.h = Math.max(0, Number(tr.h) || 0); c.garden = true; }
    });
    // 8) 구역 표시
    ZONES.forEach(z => { for(let y = z.y[0]; y <= z.y[1]; y++) for(let x = z.x[0]; x <= z.x[1]; x++){ const c = at(x, y); if(c && !c.zone) c.zone = z.key; } });
    // 9) 걸을 수 있는 칸 (3단계에서 사용) — 숲 · 물은 불가
    tiles.forEach(c => { c.walk = c.t !== 'forest' && c.t !== 'water'; });

    const maxH = tiles.reduce((m, c) => Math.max(m, c.h), 0);
    return { W, H, EDGE, tiles, at, maxH, garden: { x0: GARDEN.x0, y0: GARDEN.y0, max: GARDEN.max, size: n, level: lv }, zones: ZONES, hash };
  }

  window.TaleliaTownWorld = Object.freeze({ W, H, GARDEN, ZONES, SAMPLE_GARDEN, build, hash });
})();
