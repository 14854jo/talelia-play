/* =====================================================================
 * TALELIA · town/pathfind.js — A* 길 찾기 (4방향 · 높이 · 계단 · 다리)
 *
 *  - 지도 칸의 walk 값(world-data.js 의 바닥 + scene.js 가 반영한 건물 · 장식)을 그대로 씁니다.
 *  - 한 칸 이동 규칙 canStep(a, b)
 *      b 가 걸을 수 있어야 함 (숲 · 물 · 건물 · 막는 장식 칸은 불가 · 다리 칸은 가능)
 *      높이가 같으면 이동 가능 · 높이 차이 1 은 둘 중 하나가 계단(ramp) 칸일 때만 · 2 이상은 불가
 *      계단 칸은 앞뒤(v 방향)로만 드나듦 (옆으로 들어가면 계단 중간 높이로 튐)
 *  - 꺾일 때 비용을 조금 더해(TURN) 직선 위주의 자연스러운 경로를 고릅니다. (방향이 덜 흔들림)
 *  - 결과: [[x, y], …] (출발 · 도착 포함) · 갈 수 없으면 null
 *  - 서버를 부르지 않습니다.
 * ===================================================================== */
(function(){
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const TURN = .2;

  /** dx, dy: 이동 방향. 계단(ramp)은 v 방향(앞뒤)으로만 드나듦 — 옆에서 들어가면 계단 중간 높이로 튀므로 */
  function canStep(a, b, dx, dy){
    if(!a || !b || !b.walk) return false;
    if(a.ramp !== b.ramp && dx) return false;   // 계단 ↔ 계단 아닌 칸: 옆(u 방향)으로는 불가
    const dh = Math.abs(a.h - b.h);
    if(dh === 0) return true;
    return dh === 1 && !!(a.ramp || b.ramp);
  }

  /** 아주 작은 최소 힙 */
  function Heap(){ const a = []; return {
    push(n){ a.push(n); let i = a.length - 1; while(i > 0){ const p = (i - 1) >> 1; if(a[p].f <= a[i].f) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } },
    pop(){ const top = a[0], last = a.pop(); if(a.length){ a[0] = last; let i = 0; for(;;){ const l = i * 2 + 1, r = l + 1; let m = i; if(l < a.length && a[l].f < a[m].f) m = l; if(r < a.length && a[r].f < a[m].f) m = r; if(m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } } return top; },
    get size(){ return a.length; } }; }

  const SOFT = 3;   // 꽃밭(soft) 칸에 들어가는 추가 비용 — 지나갈 수는 있지만 보통은 돌아감

  /** 동물 역할별 이동 가능 구역 (3.1)
   *   npc    : 마을 동물 — 내 정원(플레이어 데이터 자리) 안으로 들어가지 않음
   *   garden : (나중) 플레이어가 정원에 배치한 동물 — 정원 안에서만 움직임
   *   any    : 제한 없음 (검사용) */
  const MASKS = Object.freeze({
    npc: c => !c.garden,
    garden: c => !!c.garden,
    any: () => true
  });

  /** A*: (sx, sy) → (tx, ty) · opts.mask(칸) 이 false 인 칸은 지나가지 않음 */
  function find(world, sx, sy, tx, ty, opts){
    const W = world.W, H = world.H, at = (x, y) => (x >= 0 && y >= 0 && x < W && y < H) ? world.at(x, y) : null;
    const mask = (opts && opts.mask) || null;
    const goal = at(tx, ty), start = at(sx, sy);
    if(!goal || !goal.walk || !start) return null;
    if(mask && !mask(goal)) return null;
    if(sx === tx && sy === ty) return [[sx, sy]];
    // 상태 = 칸 × 들어온 방향(0~3, 4 = 출발)
    const key = (x, y, d) => ((y * W + x) * 5 + d);
    const g = new Map(), from = new Map(), closed = new Set();
    const h = (x, y) => Math.abs(x - tx) + Math.abs(y - ty);
    const open = Heap();
    const k0 = key(sx, sy, 4); g.set(k0, 0); open.push({ x: sx, y: sy, d: 4, f: h(sx, sy), k: k0 });
    let expanded = 0;
    while(open.size){
      const n = open.pop();
      if(closed.has(n.k)) continue;
      closed.add(n.k); expanded++;
      if(n.x === tx && n.y === ty){
        const out = []; let k = n.k;
        while(k != null){ const cell = Math.floor(k / 5); out.push([cell % W, Math.floor(cell / W)]); k = from.get(k); }
        out.reverse();
        find.last = { expanded, length: out.length };
        return out;
      }
      const a = at(n.x, n.y);
      for(let d = 0; d < 4; d++){
        const nx = n.x + DIRS[d][0], ny = n.y + DIRS[d][1], b = at(nx, ny);
        if(!canStep(a, b, DIRS[d][0], DIRS[d][1])) continue;
        if(mask && !mask(b)) continue;
        const nk = key(nx, ny, d);
        if(closed.has(nk)) continue;
        const cost = g.get(n.k) + 1 + (n.d !== 4 && n.d !== d ? TURN : 0) + (b.soft ? SOFT : 0);
        if(cost < (g.has(nk) ? g.get(nk) : Infinity)){ g.set(nk, cost); from.set(nk, n.k); open.push({ x: nx, y: ny, d, f: cost + h(nx, ny), k: nk }); }
      }
    }
    find.last = { expanded, length: 0 };
    return null;
  }

  window.TaleliaTownPath = Object.freeze({ find, canStep, TURN, SOFT, MASKS });
})();
