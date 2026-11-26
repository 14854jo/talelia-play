/* =====================================================================
 * TALELIA · town/buildings.js — 건물 · 장식 데이터 (그림과 분리)
 *
 *  TYPES      : 종류별 정의 — 이름 · 설명 · 바닥 크기(w×d 칸) · 걷기 규칙 · 그림 키 · 연결 예정 기능
 *  PLACEMENTS : 마을 중심부 고정 배치 — 세계 칸 (x, y) = 바닥 발자국의 뒤쪽 모서리(가장 작은 x, y)
 *
 *  걷기 규칙 walk
 *    'block' : 동물이 들어갈 수 없음 (건물 · 나무 · 바위 · 울타리 · 가로등 · 벤치 · 화분)
 *    'pass'  : 지나갈 수 있음 (꽃밭)
 *    'floor' : 위로 걸어 다님 (계단 · 다리) → 바닥층에 그림 (iso.js 깊이 규칙)
 *  막는 물체는 가로·세로 칸 차이가 1 이하여야 합니다. (iso.js 깊이 규칙 · tests 에서 검사)
 *
 *  feature 는 "연결 예정 기능" 안내입니다. 이번 단계에서 어떤 API 도 부르지 않습니다.
 *  내 정원(세계 x 6~23, y 22~39) 안에는 아무것도 놓지 않습니다. (기존 배치 데이터 자리)
 * ===================================================================== */
(function(){
  /*  door : 정문 위치 — side 'L' = 왼쪽 앞 벽(v 쪽) · 'R' = 오른쪽 앞 벽(u 쪽), at = 벽을 따라 몇 번째 칸
   *         문 앞 칸 = 'L' → (x + at, y + d) · 'R' → (x + w, y + at). 이 칸은 항상 걸을 수 있어야 합니다. (tests 에서 검사)
   *  stay : 동물이 머물기 좋아하는 곳(문 앞 · 둘레) — behavior.js 목적지 고르기에 씀 */
  const TYPES = Object.freeze({
    town_hall:    { kind: 'building', name: '마을회관', w: 3, d: 3, walk: 'block', art: 'town_hall', pick: true, door: { side: 'L', at: 1 }, stay: 'plaza',
                    desc: '마을의 한가운데 있는 회관이에요. 시계탑이 마을의 시간을 알려 줘요.',
                    feature: '마을 정보 · 코인 수확 · 땅 확장 (다음 단계에서 연결)' },
    fountain:     { kind: 'building', name: '광장 분수', w: 2, d: 2, walk: 'block', art: 'fountain', pick: true, stay: 'fountain',
                    desc: '동물들이 가장 많이 모이는 광장의 분수예요.',
                    feature: '미니게임 · 이벤트 장소 (다음 단계에서 연결)' },
    notice_board: { kind: 'building', name: '게시판', w: 1, d: 1, walk: 'block', art: 'notice_board', pick: true,
                    desc: '마을 소식과 오늘의 할 일이 붙는 게시판이에요.',
                    feature: '공지 · 퀘스트 (기존 기능 없음 · 나중에 추가)' },
    shop:         { kind: 'building', name: '상점', w: 3, d: 2, walk: 'block', art: 'shop', pick: true, door: { side: 'L', at: 2 }, stay: 'facility',
                    desc: '동물 친구와 마을 장식을 살 수 있는 가게예요.',
                    feature: '동물 · 장식 구매와 판매 (다음 단계에서 연결)' },
    animal_house: { kind: 'building', name: '동물의 집', w: 2, d: 2, walk: 'block', art: 'animal_house', pick: true, door: { side: 'L', at: 1 }, stay: 'homes',
                    desc: '마을 동물들이 쉬고 잠드는 아늑한 집이에요.',
                    feature: '펫 하우스 · 보관함 (다음 단계에서 연결)' },
    stairs:       { kind: 'terrain', name: '언덕 계단', w: 2, d: 1, walk: 'floor', art: 'stairs', pick: true,
                    desc: '훈련장 언덕으로 올라가는 돌계단이에요.', feature: '' },
    bridge:       { kind: 'terrain', name: '연못 다리', w: 9, d: 1, walk: 'floor', art: 'bridge', pick: true, stay: 'pond',
                    desc: '연못을 가로지르는 나무 다리예요. 다리 위에서 물고기가 보여요.', feature: '낚시터 가는 길 (낚시는 다음 단계에서 연결)' },
    // ── 4단계: 중심부 시설 7종 (feature = 연결 예정 기존 기능 · 지금은 어떤 API 도 부르지 않음)
    hatchery:     { kind: 'building', name: '알 부화소', w: 2, d: 2, walk: 'block', art: 'hatchery', pick: true, door: { side: 'L', at: 1 }, stay: 'facility',
                    desc: '따뜻한 불빛 아래에서 신비한 알을 돌보는 곳이에요. 지붕 위 커다란 알이 마을을 지켜요.',
                    feature: '알 부화 · 10연 부화 · 보스 알 (다음 단계에서 기존 기능과 연결)' },
    library:      { kind: 'building', name: '도서관', w: 2, d: 2, walk: 'block', art: 'library', pick: true, door: { side: 'L', at: 1 }, stay: 'facility',
                    desc: '마을 동물들의 이야기와 도감이 모여 있는 조용한 도서관이에요.',
                    feature: '동물 도감 · 요리/물고기 도감 · 도감 보상 (다음 단계에서 연결)' },
    training_ground: { kind: 'building', name: '훈련장', w: 3, d: 2, walk: 'block', art: 'training_ground', pick: true, door: { side: 'L', at: 1 }, stay: 'facility',
                    desc: '언덕 위 연습장이에요. 허수아비와 무기 거치대에서 힘을 기를 수 있어요.',
                    feature: '조합 · 초월 · 한계돌파 · 각성 · 장비 강화 (다음 단계에서 연결)' },
    adventure_guild: { kind: 'building', name: '모험가 길드', w: 3, d: 3, walk: 'block', art: 'adventure_guild', pick: true, door: { side: 'L', at: 1 }, stay: 'facility',
                    desc: '모험의 의뢰가 붙는 길드예요. 동굴과 탑, 보스에 도전하는 동물들이 모여요.',
                    feature: '동굴 던전 · 심연의 탑 · 월드 보스 · PvP · 파티 편성 (다음 단계에서 연결)' },
    fishing_hut:  { kind: 'building', name: '낚시터', w: 2, d: 2, walk: 'block', art: 'fishing_hut', pick: true, door: { side: 'L', at: 1 }, stay: 'pond',
                    desc: '연못가의 작은 낚시 오두막이에요. 잔교 끝에서 물고기를 낚을 수 있어요.',
                    feature: '낚시 · 미끼 · 물고기 도감 (다음 단계에서 연결)' },
    pier:         { kind: 'terrain', name: '낚시 잔교', w: 1, d: 3, walk: 'floor', art: 'pier', pick: true, stay: 'pond',
                    desc: '연못 위로 뻗은 나무 잔교예요. 끝에 낚싯대가 걸려 있어요.', feature: '낚시 자리 (다음 단계에서 연결)' },
    farm:         { kind: 'building', name: '농장', w: 3, d: 3, walk: 'block', art: 'farm', pick: true, door: { side: 'R', at: 1 }, stay: 'facility',
                    desc: '새싹과 당근, 호박이 자라는 밭과 빨간 창고가 있는 농장이에요.',
                    feature: '밭 · 수확 · 가공 · 요리 · 주문 (다음 단계에서 연결)' },
    mailbox:      { kind: 'building', name: '우체통', w: 1, d: 1, walk: 'block', art: 'mailbox', pick: true, stay: 'facility',
                    desc: '마을 길목의 빨간 우체통이에요. 친구에게 받은 선물과 편지가 이곳에 도착해요.',
                    feature: '코인 선물 · 선물함 · 친구 마을 방문 · 좋아요 (다음 단계에서 연결)' },
    tree_round:   { kind: 'prop', name: '둥근 나무', w: 1, d: 1, walk: 'block', art: 'tree_round' },
    tree_pine:    { kind: 'prop', name: '침엽수', w: 1, d: 1, walk: 'block', art: 'tree_pine' },
    bush:         { kind: 'prop', name: '덤불', w: 1, d: 1, walk: 'block', art: 'bush' },
    flowers:      { kind: 'prop', name: '꽃밭', w: 1, d: 1, walk: 'pass', art: 'flowers', stay: 'flowers' },   // 지나갈 수는 있지만 동물은 돌아감 (pathfind 비용)
    rock:         { kind: 'prop', name: '바위', w: 1, d: 1, walk: 'block', art: 'rock' },
    fence:        { kind: 'prop', name: '울타리', w: 1, d: 1, walk: 'block', art: 'fence' },
    lamp:         { kind: 'prop', name: '가로등', w: 1, d: 1, walk: 'block', art: 'lamp' },
    bench:        { kind: 'prop', name: '벤치', w: 1, d: 1, walk: 'block', art: 'bench' },
    planter:      { kind: 'prop', name: '화분', w: 1, d: 1, walk: 'block', art: 'planter' },
    // ── T7: 소품 · 자연 장식 20종 (누르기 없음 · 머무는 곳(stay) 없음 → 동물 생활 패턴 그대로). 자연 장식 6종은 꽃밭처럼 지나갈 수 있음
    sign_direction:     { kind: 'prop', name: '화살표 표지판', w: 1, d: 1, walk: 'block', art: 'sign_direction' },
    sign_round:         { kind: 'prop', name: '둥근 안내판', w: 1, d: 1, walk: 'block', art: 'sign_round' },
    sign_hanging:       { kind: 'prop', name: '매달린 간판', w: 1, d: 1, walk: 'block', art: 'sign_hanging' },
    sign_entrance:      { kind: 'prop', name: '틀 표지판', w: 1, d: 1, walk: 'block', art: 'sign_entrance' },
    crate_closed:       { kind: 'prop', name: '나무 상자', w: 1, d: 1, walk: 'block', art: 'crate_closed' },
    barrel_wood:        { kind: 'prop', name: '나무 통', w: 1, d: 1, walk: 'block', art: 'barrel_wood' },
    sack_vegetables:    { kind: 'prop', name: '농작물 자루', w: 1, d: 1, walk: 'block', art: 'sack_vegetables' },
    basket_vegetables:  { kind: 'prop', name: '채소 바구니', w: 1, d: 1, walk: 'block', art: 'basket_vegetables' },
    crate_vegetables:   { kind: 'prop', name: '사과 · 채소 상자', w: 1, d: 1, walk: 'block', art: 'crate_vegetables' },
    crates_stacked:     { kind: 'prop', name: '상자 더미', w: 1, d: 1, walk: 'block', art: 'crates_stacked' },
    mushrooms_red:      { kind: 'prop', name: '빨간 버섯', w: 1, d: 1, walk: 'pass', art: 'mushrooms_red' },
    mushrooms_brown:    { kind: 'prop', name: '갈색 버섯', w: 1, d: 1, walk: 'pass', art: 'mushrooms_brown' },
    wildflowers_yellow: { kind: 'prop', name: '노랑 들꽃', w: 1, d: 1, walk: 'pass', art: 'wildflowers_yellow' },
    wildflowers_pink:   { kind: 'prop', name: '분홍 들꽃', w: 1, d: 1, walk: 'pass', art: 'wildflowers_pink' },
    grass_low:          { kind: 'prop', name: '낮은 풀', w: 1, d: 1, walk: 'pass', art: 'grass_low' },
    plant_leafy:        { kind: 'prop', name: '작은 식물', w: 1, d: 1, walk: 'pass', art: 'plant_leafy' },
    pot_terracotta:     { kind: 'prop', name: '토분', w: 1, d: 1, walk: 'block', art: 'pot_terracotta' },
    planter_wood:       { kind: 'prop', name: '나무 화분 상자', w: 1, d: 1, walk: 'block', art: 'planter_wood' },
    planter_stone:      { kind: 'prop', name: '돌 테두리 꽃밭', w: 1, d: 1, walk: 'block', art: 'planter_stone' },
    planter_herb:       { kind: 'prop', name: '허브 화분', w: 1, d: 1, walk: 'block', art: 'planter_herb' }
  });

  // 손으로 놓은 배치 (구역 · 길 · 입구를 피함)
  const HAND = [
    // 마을 광장 (x 19~25, y 12~18) — 입구: 서 x18·y15~16 / 북 x22~23·y12 / 동 x25·y15~16 / 남 x22~23·y18
    { type: 'town_hall', x: 19, y: 12 },
    { type: 'fountain', x: 22, y: 15 },
    { type: 'notice_board', x: 20, y: 17 },
    { type: 'lamp', x: 25, y: 12 }, { type: 'lamp', x: 25, y: 18 }, { type: 'lamp', x: 19, y: 18 }, { type: 'lamp', x: 24, y: 14 },
    // 3.1: 벤치 (21,16) → (20,16) — (21,15) 막다른 칸 해소 · 마을회관 문 앞(20,15) · 분수 둘레는 그대로 열림
    { type: 'bench', x: 24, y: 17, axis: 'u' }, { type: 'bench', x: 20, y: 16, axis: 'u' },
    // 4단계 검사에서 발견: 화분 (25,13) 이 (24,13) 을 막다른 칸으로 만듦 → 광장 바깥 (26,14) 로
    { type: 'planter', x: 24, y: 12 }, { type: 'planter', x: 26, y: 14 }, { type: 'planter', x: 19, y: 16 + 1 },
    { type: 'flowers', x: 18, y: 12 }, { type: 'flowers', x: 18, y: 13 }, { type: 'flowers', x: 26, y: 12 }, { type: 'flowers', x: 20, y: 19 },
    { type: 'flowers', x: 24, y: 19 }, { type: 'flowers', x: 26, y: 13 },
    // 상업 구역 (x 9~15, y 12~19)
    { type: 'shop', x: 12, y: 13 },
    { type: 'lamp', x: 14, y: 12 }, { type: 'flowers', x: 11, y: 15 }, { type: 'flowers', x: 14, y: 16 }, { type: 'bush', x: 11, y: 12 },
    { type: 'tree_round', x: 9, y: 18 }, { type: 'tree_round', x: 10, y: 17 }, { type: 'bench', x: 13, y: 16, axis: 'u' },   // 나무 (10,14) → (9,18): 알 부화소 문 앞
    { type: 'hatchery', x: 9, y: 12 },
    { type: 'library', x: 12, y: 17 },
    // 주거 구역 (x 9~16, y 3~9) — 동물의 집 3채
    { type: 'animal_house', x: 9, y: 7, variant: 0 },
    { type: 'animal_house', x: 12, y: 7, variant: 1 },
    { type: 'animal_house', x: 14, y: 4, variant: 2 },
    // 3.1: 정문 확보 — 문 앞 칸 (10,9) · (13,9) 의 울타리를 열어 둠 (양옆 울타리 · 꽃밭은 그대로)
    { type: 'fence', x: 9, y: 9, axis: 'u' },
    { type: 'fence', x: 12, y: 9, axis: 'u' },
    { type: 'flowers', x: 11, y: 9 }, { type: 'flowers', x: 14, y: 9 }, { type: 'flowers', x: 16, y: 6 }, { type: 'flowers', x: 13, y: 6 },
    { type: 'tree_round', x: 11, y: 4 }, { type: 'tree_round', x: 8, y: 5 }, { type: 'tree_pine', x: 16, y: 8 }, { type: 'lamp', x: 11, y: 6 },
    { type: 'bush', x: 9, y: 4 }, { type: 'rock', x: 13, y: 3 },
    // 훈련장 언덕 (x 20~27, y 3~8 · 높이 1) — 앞 가장자리 울타리 · 계단
    { type: 'stairs', x: 22, y: 9 },
    { type: 'fence', x: 20, y: 8, axis: 'u' }, { type: 'fence', x: 21, y: 8, axis: 'u' }, { type: 'fence', x: 24, y: 8, axis: 'u' },
    { type: 'fence', x: 25, y: 8, axis: 'u' }, { type: 'fence', x: 26, y: 8, axis: 'u' }, { type: 'fence', x: 27, y: 8, axis: 'u' },
    { type: 'fence', x: 27, y: 7, axis: 'v' }, { type: 'fence', x: 27, y: 6, axis: 'v' }, { type: 'fence', x: 27, y: 5, axis: 'v' }, { type: 'fence', x: 27, y: 4, axis: 'v' },
    { type: 'rock', x: 20, y: 4 }, { type: 'rock', x: 26, y: 3 }, { type: 'flowers', x: 21, y: 5 }, { type: 'tree_pine', x: 20, y: 3 },
    { type: 'lamp', x: 24, y: 9 }, { type: 'flowers', x: 21, y: 9 },
    { type: 'training_ground', x: 23, y: 4 },
    // 모험가 길드 언덕 (x 29~33, y 3~7 · 높이 1) — 숲길에서 올라가는 계단 추가
    { type: 'adventure_guild', x: 30, y: 3 },
    { type: 'stairs', x: 32, y: 8 },
    { type: 'lamp', x: 34, y: 7 }, { type: 'flowers', x: 29, y: 6 },
    // 연못 (물 x 30~36, y 17~23) — 다리 · 바위 · 나무
    { type: 'bridge', x: 29, y: 18 },
    { type: 'rock', x: 29, y: 22 }, { type: 'rock', x: 37, y: 23 }, { type: 'rock', x: 35, y: 26 },   // 바위 (33,24) → (35,26): 낚시터 자리
    { type: 'fishing_hut', x: 32, y: 24 },
    { type: 'pier', x: 31, y: 21 },
    { type: 'tree_round', x: 28, y: 21 }, { type: 'tree_round', x: 38, y: 19 }, { type: 'tree_pine', x: 38, y: 22 },
    { type: 'flowers', x: 28, y: 18 }, { type: 'flowers', x: 31, y: 25 }, { type: 'lamp', x: 28, y: 17 }, { type: 'bush', x: 35, y: 25 },
    // 숲길 · 길가
    { type: 'lamp', x: 17, y: 10 }, { type: 'lamp', x: 25, y: 26 }, { type: 'lamp', x: 36, y: 13 }, { type: 'lamp', x: 36, y: 29 },   // 가로등 (33,29) → (36,29): 농장 자리
    { type: 'tree_pine', x: 36, y: 9 }, { type: 'tree_pine', x: 39, y: 12 }, { type: 'tree_round', x: 35, y: 14 },
    { type: 'flowers', x: 25, y: 22 }, { type: 'flowers', x: 28, y: 26 }, { type: 'rock', x: 30, y: 32 },   // 바위 (31,30) → (30,32)
    // 농장 (문은 오른쪽 면 → 농장 길 끝 (34,30)) · 우체통 (광장 남쪽 길목)
    { type: 'farm', x: 31, y: 29 },
    { type: 'mailbox', x: 24, y: 20 },
    // ── T7 (반드시 맨 끝에 추가 → 기존 물체 id · 무늬값 그대로). 모두 지금 빈 잔디 칸 · 문 앞 · 길 · 정원 둘레 · 동물 목적지 칸이 아님
    //    (사전 설계 시뮬레이션: 문 11곳 · 주요 길 10곳 경로 길이 그대로 · 새 막다른 칸 0 · 광장 입구 열림)
    // 동쪽 들판 · 숲길 입구 · 농장 길
    { type: 'sign_direction', x: 30, y: 14 }, { type: 'sign_entrance', x: 32, y: 14 }, { type: 'sign_round', x: 34, y: 12 }, { type: 'sign_hanging', x: 28, y: 29 },
    // 농장 길 옆 빈 터 · 연못 길 · 농장 앞
    { type: 'barrel_wood', x: 25, y: 24 }, { type: 'crate_closed', x: 25, y: 25 }, { type: 'crates_stacked', x: 28, y: 24 },
    { type: 'sack_vegetables', x: 31, y: 32 }, { type: 'crate_vegetables', x: 32, y: 32 }, { type: 'basket_vegetables', x: 33, y: 32 },
    // 자연 장식 (지나갈 수 있음)
    { type: 'mushrooms_red', x: 5, y: 8 }, { type: 'mushrooms_brown', x: 31, y: 34 }, { type: 'wildflowers_yellow', x: 5, y: 16 },
    { type: 'wildflowers_pink', x: 30, y: 12 }, { type: 'grass_low', x: 32, y: 13 }, { type: 'plant_leafy', x: 17, y: 19 },
    // 정원 장식: 도서관 앞 · 서쪽 들판
    { type: 'pot_terracotta', x: 12, y: 19 }, { type: 'planter_herb', x: 16, y: 20 }, { type: 'planter_wood', x: 5, y: 12 }, { type: 'planter_stone', x: 7, y: 15 }
  ];

  // 숲 테두리 안쪽 · 빈 들판에 나무 · 덤불 · 바위 · 꽃을 흩뿌림 (고정 무늬값 · 매번 같은 결과)
  function scatter(world, occupied){
    const out = [], g = world.garden, gx1 = g.x0 + g.max - 1, gy1 = g.y0 + g.max - 1;
    for(let y = 2; y < world.H - 2; y++) for(let x = 2; x < world.W - 2; x++){
      const c = world.at(x, y);
      if(c.t !== 'grass' && c.t !== 'meadow') continue;
      if(c.zone && c.zone !== 'pond' && c.zone !== 'farm') continue;              // 구역 안은 손 배치만
      if(x >= g.x0 - 1 && x <= gx1 + 1 && y >= g.y0 - 1 && y <= gy1 + 1) continue;  // 내 정원 · 그 둘레 1칸
      if(occupied.has(x + ',' + y)) continue;
      // 길 옆 1칸은 비워 둠
      let nearPath = false;
      for(let dy = -1; dy <= 1 && !nearPath; dy++) for(let dx = -1; dx <= 1; dx++){ const n = (x + dx >= 0 && y + dy >= 0 && x + dx < world.W && y + dy < world.H) ? world.at(x + dx, y + dy) : null; if(n && (n.t === 'path' || n.t === 'plaza' || n.t === 'sand')){ nearPath = true; break; } }
      if(nearPath) continue;
      const edge = Math.min(x, y, world.W - 1 - x, world.H - 1 - y), r = world.hash(x * 5 + 11, y * 3 + 7);
      let type = null;
      if(edge <= 4){ if(r < .42) type = r < .2 ? 'tree_pine' : r < .34 ? 'tree_round' : 'bush'; }
      else if(r < .045) type = 'tree_round';
      else if(r < .06) type = 'bush';
      else if(r < .07) type = 'rock';
      else if(r < .1) type = 'flowers';
      if(type){ out.push({ type, x, y, scatter: true }); occupied.add(x + ',' + y); }
    }
    return out;
  }

  /** 배치 목록 만들기 (손 배치 + 흩뿌리기). 각 항목에 id 와 차지한 칸 목록을 붙여 돌려줍니다. */
  function build(world){
    const occupied = new Set(), list = [];
    HAND.forEach((p, i) => {
      const t = TYPES[p.type]; if(!t) return;
      const cells = []; for(let dy = 0; dy < t.d; dy++) for(let dx = 0; dx < t.w; dx++) cells.push([p.x + dx, p.y + dy]);
      cells.forEach(([x, y]) => occupied.add(x + ',' + y));
      list.push(Object.assign({ id: 'o' + i }, p, { cells }));
    });
    scatter(world, occupied).forEach((p, i) => list.push(Object.assign({ id: 's' + i }, p, { cells: [[p.x, p.y]] })));
    return list;
  }

  /** 정문 앞 칸 (없으면 null) */
  function doorTile(t, x, y){
    if(!t.door) return null;
    return t.door.side === 'R' ? [x + t.w, y + t.door.at] : [x + t.door.at, y + t.d];
  }

  window.TaleliaTownBuildings = Object.freeze({ TYPES, HAND, build, doorTile });
})();
