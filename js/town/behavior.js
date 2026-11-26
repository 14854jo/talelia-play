/* =====================================================================
 * TALELIA · town/behavior.js — 동물 생활 패턴 (쉬기 → 목적지 고르기 → 걷기 → 도착 → 머무르기)
 *
 *  - 화면 전용입니다. 위치를 서버에 저장하지 않고, 어떤 API 도 부르지 않습니다.
 *  - 길은 출발할 때 한 번만 계산합니다 (A*). 지도가 바뀌지 않으므로 걷는 도중 다시 계산하지 않습니다.
 *  - 3.1 생활 패턴
 *      · 머무는 곳: 분수 둘레 · 동물의 집 문 앞/마당 · 꽃밭 옆 · 연못(다리 · 잔교 · 물가) · 시설 문 앞 · 광장 · 언덕 · 길
 *      · 가까운 곳일수록 자주 고름 (거리 가중치) · 최근에 간 곳 근처와 같은 종류 연속은 피함
 *      · 쉬는 시간 4~8초 (분수 · 집 · 연못에서는 가끔 10~15초 길게) · 매번 조금씩 다른 걸음 속도
 *      · 쉬는 동안 가끔 고개를 돌리거나(face) 1~2칸 기웃거림(dawdle) → 이동 · 휴식이 기계적으로 반복되지 않게
 *  - 이동 가능 구역은 역할별 마스크(pathfind.js MASKS) — 마을 동물(npc)은 내 정원 안으로 들어가지 않음
 * ===================================================================== */
(function(){
  /** 고정 씨앗 난수 (검사에서 같은 결과를 재현할 수 있게) */
  function rng(seed){ let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  // 종류별 가중치 · 쉬는 시간(초) · 길게 머무를 확률
  const KINDS = {
    fountain: { w: 18, rest: [5, 8], long: .3 },
    homes:    { w: 18, rest: [5, 8], long: .3 },
    pond:     { w: 14, rest: [5, 8], long: .3 },
    flowers:  { w: 14, rest: [4, 7], long: .1 },
    facility: { w: 16, rest: [4, 7], long: .1 },
    plaza:    { w: 8,  rest: [4, 8], long: .1 },
    hill:     { w: 6,  rest: [4, 6], long: 0 },
    path:     { w: 6,  rest: [4, 6], long: 0 }
  };
  const LONG = [10, 15];

  /** 머무를 칸 목록 (처음에 한 번) */
  function targets(world, scene, mask){
    const ok = c => c && c.walk && !c.soft && !c.ramp && (!mask || mask(c));
    const at = (x, y) => (x >= 0 && y >= 0 && x < world.W && y < world.H) ? world.at(x, y) : null;
    const sets = {}; Object.keys(KINDS).forEach(k => { sets[k] = new Map(); });
    const add = (k, x, y) => { const c = at(x, y); if(ok(c)) sets[k].set(x + ',' + y, [x, y]); };
    const ring = (o, r, k) => { for(let y = o.y - r; y < o.y + o.d + r; y++) for(let x = o.x - r; x < o.x + o.w + r; x++){ if(x >= o.x && x < o.x + o.w && y >= o.y && y < o.y + o.d) continue; add(k, x, y); } };
    scene.list.forEach(o => {
      const k = o.def.stay; if(!k || !sets[k]) return;
      if(o.door) add(k, o.door[0], o.door[1]);
      if(k === 'fountain') ring(o, 1, k);
      else if(k === 'homes') ring(o, 1, k);
      else if(k === 'flowers') ring(o, 1, k);
      else if(k === 'pond'){ if(o.type === 'bridge') for(let u = 3; u < o.w - 3; u++) add(k, o.x + u, o.y); else if(o.type === 'pier') o.cells.forEach(([x, y]) => add(k, x, y)); }
      else if(o.type === 'mailbox') ring(o, 1, k);
    });
    world.tiles.forEach(c => {
      if(c.zone === 'plaza') add('plaza', c.x, c.y);
      if(c.t === 'path') add('path', c.x, c.y);
      if(c.h === 1 && (c.zone === 'training' || c.zone === 'guild')) add('hill', c.x, c.y);
      if(c.t === 'sand' && c.zone === 'pond' && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const n = at(c.x + dx, c.y + dy); return n && n.t === 'water' && !n.bridge && !n.pier; })) add('pond', c.x, c.y);
    });
    return Object.keys(KINDS).map(k => ({ key: k, w: KINDS[k].w, cells: [...sets[k].values()] })).filter(t => t.cells.length);
  }

  /** 칸 위의 실수 위치 (u, v) 에서 몸의 높이(px) */
  function heightAt(world, scene, u, v){
    const I = window.TaleliaIso, c = world.at(Math.floor(u), Math.floor(v));
    if(!c) return 0;
    if(c.ramp){ const ty = Math.floor(v); return Math.max(0, Math.min(1, ty + 1 - v)) * I.HU; }   // 계단: 앞(v 큼) 0 → 뒤 1단
    if(c.bridge){
      const o = scene.objects.get(c.obj); if(!o) return 0;
      const n = o.w, lu = u - o.x, deck = 5 + 9 * Math.sin(Math.PI * lu / n);   // art.js 다리 모양과 같은 식
      return deck * Math.min(1, lu / .6) * Math.min(1, (n - lu) / .6);
    }
    if(c.pier){
      const o = scene.objects.get(c.obj); if(!o) return 0;
      return 4 * Math.min(1, (o.y + o.d - v) / .5);   // 물가(앞쪽 끝)에서 잔교 높이 4px 로 부드럽게
    }
    return c.h * I.HU;
  }

  /**
   * @param actor { u, v } 를 가진 동물 (actors.js)
   * @param ctx { world, scene, seed, speed, reduced, role }
   */
  function create(actor, ctx){
    const R = rng(ctx.seed || 1), P = window.TaleliaTownPath;
    const mask = P.MASKS[ctx.role || 'npc'] || P.MASKS.npc;
    const T = targets(ctx.world, ctx.scene, mask);
    const B = { state: 'rest', timer: 1 + R() * 2, path: null, i: 0, t: 0, plans: 0, trips: 0, arrived: 0, held: false, last: null, onArrive: null,
                recent: [], history: [], dawdle: false, face: 0, faceTimer: 2 + R() * 3, speedK: 1, role: ctx.role || 'npc' };
    const baseSpeed = ctx.speed || 1.3;   // 초당 칸

    const restFor = (kind) => { const K = KINDS[kind] || KINDS.path; if(R() < K.long) return LONG[0] + R() * (LONG[1] - LONG[0]); return K.rest[0] + R() * (K.rest[1] - K.rest[0]); };
    const near = (a, b, r) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) <= r;

    /** 목적지 고르기: 종류마다 후보 몇 개를 뽑아 거리 · 최근 기록으로 점수를 매김 */
    function pick(){
      const sx = Math.floor(actor.u), sy = Math.floor(actor.v), here = [sx, sy];
      const lastKinds = B.history.slice(-2).map(h => h.kind);
      const cands = [];
      for(const t of T){
        let kw = t.w;
        if(lastKinds.length === 2 && lastKinds[0] === t.key && lastKinds[1] === t.key) kw *= .1;   // 같은 종류 3번 연속 거의 안 함
        else if(lastKinds[1] === t.key) kw *= .5;
        // 후보: 이 종류에서 가장 가까운 칸 6개 + 무작위 먼 칸 2개 (가까운 곳 위주 · 가끔 먼 곳도)
        const ok = cell => !near(cell, here, 1) && !B.recent.some(r => near(r, cell, 2));   // 지금 자리 · 최근에 간 곳 근처 제외
        const byDist = t.cells.filter(ok).map(cell => ({ cell, dist: Math.abs(cell[0] - sx) + Math.abs(cell[1] - sy) })).sort((p, q) => p.dist - q.dist);
        const pickSet = byDist.slice(0, 6);
        for(let k = 0; k < 2 && byDist.length > 6; k++) pickSet.push(byDist[6 + Math.floor(R() * (byDist.length - 6))]);
        for(const { cell, dist } of pickSet){
          const dw = 1 / (1 + Math.pow(dist / 4, 2));                     // 가까울수록 자주 (4칸이면 절반 · 8칸이면 1/5)
          cands.push({ kind: t.key, cell, score: kw * dw / pickSet.length * (1 + R() * .5) });
        }
      }
      for(let tries = 0; tries < 4 && cands.length; tries++){
        const total = cands.reduce((s, c) => s + c.score, 0);
        let r = R() * total, pickC = cands[0];
        for(const c of cands){ if((r -= c.score) <= 0){ pickC = c; break; } }
        if(plan(pickC.cell[0], pickC.cell[1])){ B.last = pickC.kind; B.dawdle = false; return true; }
        cands.splice(cands.indexOf(pickC), 1);
      }
      return false;
    }
    /** 머무는 곳 둘레 1~2칸 기웃거리기 */
    function dawdle(){
      const sx = Math.floor(actor.u), sy = Math.floor(actor.v);
      for(let k = 0; k < 6; k++){
        const x = sx + Math.round((R() - .5) * 4), y = sy + Math.round((R() - .5) * 4);
        if(x === sx && y === sy) continue;
        const c = (x >= 0 && y >= 0 && x < ctx.world.W && y < ctx.world.H) ? ctx.world.at(x, y) : null;
        if(!c || !c.walk || c.soft || c.ramp || !mask(c)) continue;
        const p = plan(x, y); if(p && p.length <= 5){ B.dawdle = true; return true; }
        if(p){ B.state = 'rest'; B.path = null; B.trips--; }
      }
      return false;
    }
    function plan(x, y){
      const sx = Math.floor(actor.u), sy = Math.floor(actor.v);
      B.plans++;
      const p = P.find(ctx.world, sx, sy, x, y, { mask });
      if(!p || p.length < 2) return null;
      // 지금 위치(칸 가운데가 아닐 수 있음)에서 첫 칸 가운데로 이어지게 시작점을 현재 위치로
      B.path = p.map(([cx, cy]) => [cx + .5, cy + .5]); B.path[0] = [actor.u, actor.v];
      B.i = 0; B.t = 0; B.state = 'walk'; B.trips++; B.speedK = .85 + R() * .25; B.face = 0;
      return p;
    }
    /** 검사 · 연출용: 특정 칸으로 걷게 하기 */
    function goTo(x, y){ const ok = !!plan(x, y); if(ok){ B.last = 'goto'; B.dawdle = false; } return ok; }

    function update(dt){
      if(B.held) return;
      if(B.state === 'rest'){
        if(ctx.reduced) return;   // 움직임 줄이기: 제자리에서 쉬기만
        B.timer -= dt;
        B.faceTimer -= dt;
        if(B.faceTimer <= 0){ B.faceTimer = 1.8 + R() * 3; B.face = R() < .5 ? -1 : 1; }   // 고개 돌리기
        if(B.timer <= 0){
          const wasDawdle = B.dawdle;
          if(!wasDawdle && R() < .3 && dawdle()) return;     // 가끔 근처를 기웃거린 뒤
          if(!pick()) B.timer = 2;                            // 다음 목적지로
        }
        return;
      }
      // 걷기: 구간 [i → i+1] 을 일정한 속도로
      let move = baseSpeed * B.speedK * dt;
      while(move > 0 && B.state === 'walk'){
        const a = B.path[B.i], b = B.path[B.i + 1];
        const seg = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1e-6, left = seg * (1 - B.t);
        if(move < left){ B.t += move / seg; move = 0; }
        else { move -= left; B.i++; B.t = 0; if(B.i >= B.path.length - 1){ arrive(); break; } }
      }
      if(B.state === 'walk'){ const a = B.path[B.i], b = B.path[B.i + 1]; actor.u = a[0] + (b[0] - a[0]) * B.t; actor.v = a[1] + (b[1] - a[1]) * B.t; actor.du = b[0] - a[0]; actor.dv = b[1] - a[1]; }
    }
    function arrive(){
      const end = B.path[B.path.length - 1]; actor.u = end[0]; actor.v = end[1];
      const cell = [Math.floor(end[0]), Math.floor(end[1])];
      B.state = 'rest'; B.path = null; B.arrived++;
      const kind = B.dawdle ? (B.history.length ? B.history[B.history.length - 1].kind : 'path') : (B.last || 'path');
      B.timer = B.dawdle ? 2.5 + R() * 2 : restFor(kind);    // 기웃거린 뒤에는 조금만 쉬고 다음 목적지로
      B.faceTimer = 1 + R() * 2;
      if(!B.dawdle){ B.recent.push(cell); if(B.recent.length > 5) B.recent.shift(); }
      B.history.push({ kind, cell, rest: B.timer, dawdle: B.dawdle });
      if(B.history.length > 200) B.history.shift();
      if(B.onArrive && !B.dawdle) B.onArrive(kind, R());
    }
    return { B, update, goTo, plan, pick, mask, targets: T, get state(){ return B.state; } };
  }

  window.TaleliaTownBehavior = Object.freeze({ create, targets, heightAt, rng, KINDS, LONG });
})();
