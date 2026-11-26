/* =====================================================================
 * TALELIA · town/iso.js — 아이소메트릭 좌표 계산 (2.5D 마을 프로토타입)
 *
 *  세계 칸 (tx, ty) : 정수 칸. 실수 좌표 (u, v) 는 칸 안의 위치 (걷는 동물용 · 3단계)
 *  화면 좌표 (px, py): 카메라 확대 1배 기준의 픽셀. 칸 (tx,ty) 마름모의 "위 꼭짓점"이 iso(tx,ty)
 *
 *      px = (u − v) × TW/2
 *      py = (u + v) × TH/2 − h × HU
 *
 *  TW·TH 비율 2:1 은 기존 엔진(72×36)·새 화면 village.js(반폭 36·반높이 18)와 같습니다.
 *  서버를 부르지 않습니다. 순수 계산만 합니다.
 * ===================================================================== */
(function(){
  const TW = 64, TH = 32, HU = 12;          // 타일 폭 · 높이 · 높이 1칸당 올라가는 픽셀
  const HW = TW / 2, HH = TH / 2;

  /** 실수 칸 좌표 → 화면 좌표 (마름모 위 꼭짓점 기준) */
  function toScreen(u, v, h){ return [(u - v) * HW, (u + v) * HH - (h || 0) * HU]; }

  /** 칸 중앙의 화면 좌표 */
  function center(tx, ty, h){ return toScreen(tx + .5, ty + .5, h); }

  /** 화면 좌표 → 실수 칸 좌표 (높이 0 평면 기준) */
  function toWorld(px, py){ const a = px / HW, b = py / HH; return [(a + b) / 2, (b - a) / 2]; }

  /** 화면 좌표 → 칸 번호 (높이 0 평면 기준) */
  function toTile(px, py){ const w = toWorld(px, py); return [Math.floor(w[0]), Math.floor(w[1])]; }

  /** 칸 마름모의 네 꼭짓점 [위, 오른쪽, 아래, 왼쪽] */
  function diamond(tx, ty, h){
    const [x, y] = toScreen(tx, ty, h);
    return [[x, y], [x + HW, y + HH], [x, y + TH], [x - HW, y + HH]];
  }

  /** 앞뒤 순서 값: 화면 아래(앞)일수록 큼. 2단계 건물·3단계 동물이 같은 규칙을 씀 */
  function depth(u, v){ return Math.round((u + v) * 100); }

  /* ---------- 장면 깊이 규칙 (건물 · 장식 · 동물이 같은 z-index 체계를 씀) ----------
   *  장면 요소의 z-index = Z_BASE + 깊이
   *   - 동물(3단계): 서 있는 실수 좌표 (u, v) → depth(u, v)
   *   - 바닥 칸 x0..x0+w-1, y0..y0+d-1 을 차지하는 물체 → depthFootprint(x0, y0, w, d) = (x0 + y0 + (w + d) / 2) × 100
   *  왜 이 값인가: 동물은 막힌 칸에 들어갈 수 없으므로 물체 둘레에만 섭니다.
   *   - 물체 "앞"(u ≥ x0+w 또는 v ≥ y0+d)에 선 동물의 칸 중심 합 ≥ x0 + y0 + min(w, d) + 1
   *   - 물체 "뒤"(u < x0 또는 v < y0)에 선 동물의 칸 중심 합 ≤ x0 + y0 + max(w, d) − 1
   *   - 위 값이 그 사이에 오려면 |w − d| ≤ 1 이어야 합니다 → 막는 물체는 가로·세로 칸 차이 1 이하로 만듭니다.
   *  다리 · 계단처럼 동물이 "위로" 걷는 물체는 바닥층(Z_FLOOR)에 둡니다. 동물은 항상 그 위에 그려집니다. */
  const Z_FLOOR = 10, Z_BASE = 1000;
  function depthFootprint(x0, y0, w, d){ return Math.round((x0 + y0 + (w + d) / 2) * 100); }
  function zActor(u, v){ return Z_BASE + depth(u, v); }
  function zObject(x0, y0, w, d, floor){ return floor ? Z_FLOOR : Z_BASE + depthFootprint(x0, y0, w, d); }

  /** W×H 세계(최대 높이 maxH, 섬 절벽 깊이 cliff px)의 화면 경계 상자 */
  function bounds(W, H, maxH, cliff){
    const minX = -H * HW, maxX = W * HW;
    const minY = -(maxH || 0) * HU, maxY = (W + H) * HH + (cliff || 0);
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }

  /** 내 정원 좌표(기존 DB x,y) → 세계 칸. DB 값은 바꾸지 않고 표시할 때만 옮깁니다. */
  function gardenToWorld(garden, x, y){ return [garden.x0 + x, garden.y0 + y]; }

  window.TaleliaIso = Object.freeze({ TW, TH, HU, HW, HH, toScreen, center, toWorld, toTile, diamond, depth, bounds, gardenToWorld,
    Z_FLOOR, Z_BASE, depthFootprint, zActor, zObject });
})();
