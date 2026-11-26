/* =====================================================================
 * TALELIA · 마을 그래픽 에셋 매니페스트 (그림 정보만)
 *
 *  - 설계: docs/graphics/03_ASSET_MANIFEST_DESIGN.md · 규격: docs/graphics/01_GRAPHIC_ASSET_SPEC.md
 *  - <script> 로 읽습니다 (fetch · XHR 를 쓰지 않음 · file:// 에서도 동작).
 *  - 위치 · 바닥 크기 · 걷기 · 정문 · 이름은 js/town/buildings.js 가 정합니다. 여기는 그림만.
 *  - 그림이 없는 키는 지금 SVG 그림(js/town/art.js · ground.js)을 그대로 씁니다.
 *
 *  T1 (2026-11-11): 엔진 준비 단계 — 그림 파일 없이 비어 있었음.
 *  T2 (2026-11-11): 동물의 집 산호(animal_house_0) 1장 등록. 320×320 · 기준점 (160,240) 확정
 *                   (지붕이 높아 규격서 계산식대로 위쪽 여백을 늘림 · 문 위치는 이 그림 그대로 유지).
 *  T3 (2026-11-11): 잔디 타일 8장 등록 (grass · meadow). 128×64 · 무손실 WebP · 마름모 밖 투명.
 *                   원본(Gemini 아이소 잔디 3장)의 한 칸을 정사각 텍스처로 펼쳐 조명 평탄화 · 이음매 없는 반복으로 만들고
 *                   Basic 4장은 가장자리가 같아 서로 이어짐 · Flower/Detail 은 Basic 바탕에 꽃 · 돌만 얹음.
 *                   변형은 칸마다 world.hash 로 고정 선택 (gfx.js 그대로) → 같은 그림을 여러 번 넣어 비율을 정함.
 *  T4 (2026-11-11): 둥근 나무 4장 등록 (tree_round). 192×192 · 기준점 (96,144) = 줄기 밑동 땅 접점 · 투명 손실 WebP.
 *                   원본(Gemini 나무 A 연두 · B 진초록, 흰 배경)에서 배경 제거 · 비율 유지 축소. 기본 100px · 소형 85px (@2x 높이).
 *                   변형은 나무마다 무늬값(rnd)으로 고정 선택 (assets.js 그대로) → 4장 약 25% 씩.
 *                   그림자는 항목당 하나라 기본 · 소형 평균 크기에 맞춤.
 *  T5 (2026-11-11): 침엽수 4장 (tree_pine) · 덤불 2장 (bush) 등록. 투명 손실 WebP · 원본(Gemini, 흰 배경)에서 배경 제거.
 *                   침엽수 192×208 · 기준점 (96,160) = 줄기 밑동 · 높이 112 / 소형 95px. B(전나무형)는 가로 폭 90%.
 *                   덤불 192×112 · 기준점 (96,64) = 바닥 가운데 · 높이 50px. 덤불 A 는 잎 명도 0.86배(열매 색 그대로).
 *                   덤불 비율: 열매 A 3 : 일반 B 1 (지금 SVG 의 열매 74% 와 같음 · 무늬값 고정 선택).
 *  T6 (2026-11-11): 장식 7항목 · 그림 13장 등록 (rock · flowers · planter · fence_u · fence_v · lamp · bench_u). 투명 손실 WebP 0.9.
 *                   원본(Gemini 모음 시트 2장, 흰 배경)에서 낱개로 잘라 배경 제거 · 비율 유지 축소 (회전 · 왜곡 없음 · 벤치만 좌우 반전).
 *                   캔버스 · 기준점은 규격서 3.3 그대로. 변형 비율은 같은 그림을 목록에 여러 번 넣어 정함 (잔디 · 덤불과 같은 방식).
 *  T7 (2026-11-12): 소품 · 자연 장식 20종 등록 (buildings.js 에 종류 20 · 배치 20 추가). 그림마다 딱 맞는 캔버스 · 기준점 = 바닥 접점.
 * ===================================================================== */
window.TALELIA_ASSET_MANIFEST = {
  version: 1,
  scale: 2,                     // 그림 픽셀 ÷ 화면 px (@2x)
  base: 'images/talelia/',      // town.html 기준
  tiles: {
    // 잔디: Basic 4장 × 3회 + Flower 2장 + Detail 2장 = 16칸 목록 → Basic 75% · Flower 12.5% · Detail 12.5%
    //  detail: false → SVG 풀 포기 무늬는 숨김 (그림에 들어 있음)
    grass: { size: [128, 64], anchor: [64, 0], detail: false, variants: [
      'tiles/grass_basic_0.webp', 'tiles/grass_basic_1.webp', 'tiles/grass_basic_2.webp', 'tiles/grass_basic_3.webp',
      'tiles/grass_basic_0.webp', 'tiles/grass_basic_1.webp', 'tiles/grass_basic_2.webp', 'tiles/grass_basic_3.webp',
      'tiles/grass_basic_0.webp', 'tiles/grass_basic_1.webp', 'tiles/grass_basic_2.webp', 'tiles/grass_basic_3.webp',
      'tiles/grass_flower_0.webp', 'tiles/grass_flower_1.webp', 'tiles/grass_detail_0.webp', 'tiles/grass_detail_1.webp'
    ] },
    // 꽃잔디: Flower 2장 (지금 SVG 꽃 점이 찍히는 칸과 같은 자리)
    meadow: { size: [128, 64], anchor: [64, 0], detail: false, variants: ['tiles/grass_flower_0.webp', 'tiles/grass_flower_1.webp'] }
  },
  objects: {
    // 동물의 집 · 산호 지붕 (variant 0). 원본: Gemini 생성 그림 → 배경 · 워터마크 제거 · 2×2 바닥에 맞춰 축소 · WebP 0.9 (24.8 KB)
    //  연기 at = 그림 픽셀 좌표 (굴뚝 입구)
    animal_house_0: { src: 'buildings/animal_house_0.webp', size: [320, 320], anchor: [160, 240],
                      footprint: [2, 2], shadow: 'footprint', fx: [{ type: 'smoke', at: [235, 72] }] },
    // 둥근 나무 · A(연두) / B(진초록) × 기본(높이 100px) / 소형(85px). 기준점 = 줄기 밑동
    tree_round: { footprint: [1, 1], shadow: { rx: 16.4, ry: 6.3, dx: 3, dy: 1.1, opacity: .22 }, variants: [
      { src: 'props/tree_round_a.webp',       size: [192, 192], anchor: [96, 144] },
      { src: 'props/tree_round_a_small.webp', size: [192, 192], anchor: [96, 144] },
      { src: 'props/tree_round_b.webp',       size: [192, 192], anchor: [96, 144] },
      { src: 'props/tree_round_b_small.webp', size: [192, 192], anchor: [96, 144] }
    ] },
    // 침엽수 · A(가문비나무형 청록) / B(전나무형 녹색 · 폭 90%) × 기본(높이 112px) / 소형(95px). 기준점 = 줄기 밑동
    tree_pine: { footprint: [1, 1], shadow: { rx: 12, ry: 4.6, dx: 2.5, dy: 1, opacity: .22 }, variants: [
      { src: 'props/tree_pine_a.webp',       size: [192, 208], anchor: [96, 160] },
      { src: 'props/tree_pine_a_small.webp', size: [192, 208], anchor: [96, 160] },
      { src: 'props/tree_pine_b.webp',       size: [192, 208], anchor: [96, 160] },
      { src: 'props/tree_pine_b_small.webp', size: [192, 208], anchor: [96, 160] }
    ] },
    // 덤불 · A(빨간 열매) ×3 · B(잎만) ×1 → 약 75 : 25. 높이 50px · 기준점 = 바닥 가운데
    bush: { footprint: [1, 1], shadow: { rx: 17, ry: 6.3, dx: 2, dy: 1, opacity: .2 }, variants: [
      { src: 'props/bush_a.webp', size: [192, 112], anchor: [96, 64] },
      { src: 'props/bush_a.webp', size: [192, 112], anchor: [96, 64] },
      { src: 'props/bush_a.webp', size: [192, 112], anchor: [96, 64] },
      { src: 'props/bush_b.webp', size: [192, 112], anchor: [96, 64] }
    ] },
    // ── T6 장식 (바위 · 꽃밭 · 화분 · 울타리 · 가로등 · 벤치)
    // 바위 · 11칸 목록 = 무늬값(rnd) × 11 의 정수 부분으로 고름 → 지금 배치 10개가 a 3(작은 변형 1 포함) · b 3 · c 2 · d 2 로 나뉨
    //  a 작은 둥근 바위 · b 이끼 바위 · c 큰 각진 바위 · d 바위 무더기. 그림자는 기존 SVG 그림자(무늬값에 따라 크기가 달라짐)를 그대로 씀
    //  8번째 칸(a_small)은 (13,3) 바위 자리: 보라 지붕 집 바로 뒤라 보통 크기는 용마루 위로 나오므로 그 칸만 0.85배 그림
    rock: { footprint: [1, 1], shadow: 'blob', variants: [
      { src: 'props/rock_a.webp', size: [192, 112], anchor: [96, 64] },
      { src: 'props/rock_a.webp', size: [192, 112], anchor: [96, 64] },
      { src: 'props/rock_a.webp', size: [192, 112], anchor: [96, 64] },
      { src: 'props/rock_b.webp', size: [192, 112], anchor: [96, 64] },
      { src: 'props/rock_c.webp', size: [192, 112], anchor: [96, 64] },
      { src: 'props/rock_b.webp', size: [192, 112], anchor: [96, 64] },
      { src: 'props/rock_b.webp', size: [192, 112], anchor: [96, 64] },
      { src: 'props/rock_a_small.webp', size: [192, 112], anchor: [96, 64] },
      { src: 'props/rock_c.webp', size: [192, 112], anchor: [96, 64] },
      { src: 'props/rock_d.webp', size: [192, 112], anchor: [96, 64] },
      { src: 'props/rock_d.webp', size: [192, 112], anchor: [96, 64] }
    ] },
    // 꽃밭 (지나갈 수 있음 · 그림자 없음) · a 분홍 꽃 무더기 / b 노랑 · 흰 들꽃 → 4칸 목록 [a, b, b, a] 로 12 : 12
    flowers: { footprint: [1, 1], shadow: 'none', variants: [
      { src: 'props/flowers_a.webp', size: [192, 96], anchor: [96, 48] },
      { src: 'props/flowers_b.webp', size: [192, 96], anchor: [96, 48] },
      { src: 'props/flowers_b.webp', size: [192, 96], anchor: [96, 48] },
      { src: 'props/flowers_a.webp', size: [192, 96], anchor: [96, 48] }
    ] },
    // 화분 · a 테두리 화단 / b 토분. 화분 3개의 무늬값이 0.81~0.87 에 몰려 있어 6칸 목록 [a ×5, b] 로 화단 2 : 토분 1
    planter: { footprint: [1, 1], shadow: 'footprint', variants: [
      { src: 'props/planter_a.webp', size: [192, 112], anchor: [96, 64] },
      { src: 'props/planter_a.webp', size: [192, 112], anchor: [96, 64] },
      { src: 'props/planter_a.webp', size: [192, 112], anchor: [96, 64] },
      { src: 'props/planter_a.webp', size: [192, 112], anchor: [96, 64] },
      { src: 'props/planter_a.webp', size: [192, 112], anchor: [96, 64] },
      { src: 'props/planter_b.webp', size: [192, 112], anchor: [96, 64] }
    ] },
    // 울타리 · u = 칸의 왼쪽 앞 가장자리(오른쪽으로 내려감) / v = 오른쪽 앞 가장자리(오른쪽으로 올라감). 기준점은 칸 가운데, 그림은 가장자리 쪽으로 치우쳐 있음
    fence_u: { src: 'props/fence_u.webp', size: [192, 96], anchor: [96, 48], footprint: [1, 1], shadow: 'none' },
    fence_v: { src: 'props/fence_v.webp', size: [192, 96], anchor: [96, 48], footprint: [1, 1], shadow: 'none' },
    // 가로등 · 기준점 = 기둥 밑동. 그림에 빛 번짐이 들어 있고, 엔진 불빛(glow)은 기존처럼 등불 위치에 덧그림 (at = 그림 픽셀)
    lamp: { src: 'props/lamp.webp', size: [192, 176], anchor: [96, 128], footprint: [1, 1], shadow: 'blob', fx: [{ type: 'glow', at: [124, 73] }] },
    // 벤치 (u 방향) · 원본은 v 방향 그림이라 좌우 반전해서 사용 · 기준점 = 다리 네 개의 가운데
    bench_u: { src: 'props/bench_u.webp', size: [192, 128], anchor: [96, 80], footprint: [1, 1], shadow: 'footprint' },
    // ── T7 소품 · 자연 장식 20종 · 캔버스는 그림마다 다름 (8의 배수) · 기준점 = 바닥 접점(가로 가운데) · 원본·가공은 docs/graphics/05_T7_PROPS.md
    //  표지판
    sign_direction: { src: 'props/sign_direction.webp', size: [80, 104], anchor: [40, 96], footprint: [1, 1], shadow: 'blob' },
    sign_round: { src: 'props/sign_round.webp', size: [64, 96], anchor: [32, 88], footprint: [1, 1], shadow: 'blob' },
    sign_hanging: { src: 'props/sign_hanging.webp', size: [80, 112], anchor: [40, 88], footprint: [1, 1], shadow: 'none' },
    sign_entrance: { src: 'props/sign_entrance.webp', size: [80, 88], anchor: [40, 72], footprint: [1, 1], shadow: 'none' },
    //  생활 소품
    crate_closed: { src: 'props/crate_closed.webp', size: [64, 72], anchor: [32, 48], footprint: [1, 1], shadow: 'blob' },
    barrel_wood: { src: 'props/barrel_wood.webp', size: [64, 72], anchor: [32, 56], footprint: [1, 1], shadow: 'blob' },
    sack_vegetables: { src: 'props/sack_vegetables.webp', size: [80, 72], anchor: [40, 56], footprint: [1, 1], shadow: 'blob' },
    basket_vegetables: { src: 'props/basket_vegetables.webp', size: [64, 64], anchor: [32, 48], footprint: [1, 1], shadow: 'blob' },
    crate_vegetables: { src: 'props/crate_vegetables.webp', size: [64, 64], anchor: [32, 40], footprint: [1, 1], shadow: 'blob' },
    crates_stacked: { src: 'props/crates_stacked.webp', size: [80, 80], anchor: [40, 56], footprint: [1, 1], shadow: 'blob' },
    //  자연 장식 (지나갈 수 있음)
    mushrooms_red: { src: 'props/mushrooms_red.webp', size: [64, 56], anchor: [32, 40], footprint: [1, 1], shadow: 'none' },
    mushrooms_brown: { src: 'props/mushrooms_brown.webp', size: [48, 56], anchor: [24, 40], footprint: [1, 1], shadow: 'none' },
    wildflowers_yellow: { src: 'props/wildflowers_yellow.webp', size: [80, 72], anchor: [40, 56], footprint: [1, 1], shadow: 'none' },
    wildflowers_pink: { src: 'props/wildflowers_pink.webp', size: [96, 72], anchor: [48, 56], footprint: [1, 1], shadow: 'none' },
    grass_low: { src: 'props/grass_low.webp', size: [64, 48], anchor: [32, 32], footprint: [1, 1], shadow: 'none' },
    plant_leafy: { src: 'props/plant_leafy.webp', size: [64, 56], anchor: [32, 48], footprint: [1, 1], shadow: 'none' },
    //  정원 장식
    pot_terracotta: { src: 'props/pot_terracotta.webp', size: [64, 80], anchor: [32, 64], footprint: [1, 1], shadow: 'blob' },
    planter_wood: { src: 'props/planter_wood.webp', size: [96, 88], anchor: [48, 64], footprint: [1, 1], shadow: 'blob' },
    planter_stone: { src: 'props/planter_stone.webp', size: [96, 72], anchor: [48, 40], footprint: [1, 1], shadow: 'none' },
    planter_herb: { src: 'props/planter_herb.webp', size: [64, 80], anchor: [32, 56], footprint: [1, 1], shadow: 'blob' }
  },
  actors: {}
};
