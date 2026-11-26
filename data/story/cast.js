/* =====================================================================
 * TALELIA · 대화 장면 등장인물 · 배경 표 (그림 정보만 · 대본은 data/story/scenes/)
 *
 *  표정 그림: images/story/portraits/<dir>/<파일>.webp
 *    원본 시트 · 자르기 목록: docs/graphics/expressions/ (python tools/sprite_prep.py expressions)
 *    캐릭터마다 모든 표정이 같은 크기 바탕(size)에 바닥 가운데를 맞춰 놓여 있어 바꿔 끼워도 위치가 그대로.
 *    아래쪽은 원본에서 잘린 상반신이라 무대에서 대화창 뒤로 들어감.
 *  names    대본에 쓰는 이름 (별칭 여러 개 가능) · label 이름표에 보이는 글
 *  color    이름표 바탕 (흰 글자 대비 4.5:1 이상) · 연구소 톤에서는 자동으로 채도를 낮춤
 *  scale    무대 크기 배율 (1 = 원본 시트 그림 크기 비율 그대로 · 캐릭터끼리 그림 배율이 같음)
 *  default  @등장 에서 표정을 안 쓰면 이 표정
 *  sink     그림 키의 이 비율만큼 바닥선 아래로 내림 (0 = 그대로) · 전신 그림을 상반신 초상화와 눈높이를 맞출 때 아랫몸을 대화창 뒤로
 *  fixed    표정 없는 캐릭터: 어떤 표정을 적어도 이 그림 하나 (images/story/portraits/<dir>/<fixed>.webp)
 *  portrait null = 그림 없는 캐릭터: 이름표만 나오고 무대에는 아무것도 그리지 않음 (@등장 · @퇴장 · @위치는 경고 없이 무시)
 *           말할 때는 다른 캐릭터가 어두워짐. 디자인이 정해지면 dir · size · expressions 를 넣고 portrait 줄을 지우면 됨
 * ===================================================================== */
window.TALELIA_STORY_CAST = {
  base: 'images/story/portraits/',
  characters: {
    s24: {
      names: ['24호', '실험체 24호', '엘피', '엘피스'], label: '24호', color: '#9C3F2C', dir: 's24', size: [308.5, 382.6], scale: 1, default: '미소',
      expressions: { '미소': 'smile', '결의': 'resolve', '분노': 'angry', '슬픔': 'sad', '놀람': 'surprised', '아픔': 'hurt' }
    },
    explorer: {
      names: ['탐험가', '탐험가 햄스터'], label: '탐험가', color: '#7A5E1E', dir: 'explorer', size: [376, 336], scale: 1, default: '미소',
      expressions: { '미소': 'smile', '신남': 'excited', '놀람': 'surprised', '갸우뚱': 'puzzled', '당황': 'flustered', '아픔': 'hurt' }
    },
    hammer: {
      names: ['망치', '망치 햄스터'], label: '망치', color: '#A84B2A', dir: 'hammer', size: [288, 332], scale: 1, default: '자신만만',
      expressions: { '자신만만': 'confident', '웃음': 'laugh', '툴툴': 'grumpy', '츤데레': 'tsundere', '화남': 'angry', '아픔': 'hurt' }
    },
    // 14호: 실루엣 한 장 (디자인 · 표정 미정). 원본 docs/graphics/characters/ (python tools/sprite_prep.py characters)
    //  전신 그림이라 상반신인 24호와 맞추려고 크게(scale 2.2 · 머리 폭이 24호의 약 87%) 키우고, 그림 키의 42% 를 바닥선 아래로 내려(sink) 아랫몸을 대화창 뒤로 → 머리가 24호 눈높이 근처
    s14:   { names: ['14호', '실험체 14호'], label: '14호', color: '#2F6B66', dir: 's14', size: [130, 340], scale: 2.2, sink: 0.42, fixed: 'silhouette', default: '기본', expressions: {} },
    // 그림 없는 캐릭터
    mother: { names: ['마더'], label: '마더', color: '#7A4A2E', portrait: null, expressions: {} },                    // 1장 · 마을 안내 · 숲에서 쓰러진 아이들을 거둔 인물 · 모습(디자인) 미정 → 이름표만
    voice: { names: ['목소리'], label: '목소리', color: '#4A5560', portrait: null, expressions: {} },             // 연구소 쪽 인물 · 모습 없음
    // 1장 대본(N3): 모습(디자인) 미정 → 이름표만
    farmer:   { names: ['농부 토끼'], label: '농부 토끼', color: '#6E5A36', portrait: null, expressions: {} },
    child:    { names: ['아이 토끼'], label: '아이 토끼', color: '#7A4A5E', portrait: null, expressions: {} },
    neighbor: { names: ['이웃 토끼'], label: '이웃 토끼', color: '#4F6272', portrait: null, expressions: {} },
    letter:   { names: ['편지'], label: '편지', color: '#6A5A3A', portrait: null, expressions: {} }                 // 마더가 토토에게 쓰는 편지 (1-2 밤)
  },
  // 배경: '그림 경로' 또는 { fill: CSS 배경값 } (단색 · 그라데이션). 표에 없는 이름 · 없음 = 톤 기본 바탕
  //  대본에는 장소 id 를 그대로 쓰고, 그림이 생기면 여기 경로만 바꿈
  backgrounds: {
    lab_corridor: 'images/battle/bg/lab_corridor.webp',
    black:        { fill: '#000' },                                            // 검은 화면 (시작 · 암전)
    // 대화 장면 배경 (원본: docs/graphics/backgrounds/*.png · python tools/sprite_prep.py backgrounds)
    lab_cell:     'images/story/bg/lab_cell.webp',                             // 갇힌 방
    lab_room:     'images/story/bg/lab_room.webp',                             // 실험실
    lab_gate:     'images/story/bg/lab_gate.webp',                             // 출구
    forest_edge:  'images/story/bg/forest_edge.webp',                          // 숲 가장자리
    // 1장 (스테이지 · S3): 그림이 생기면 경로만 바꿈 · 지금은 색 바탕 자리
    village:      { fill: 'linear-gradient(180deg, #f1e9c9 0%, #cfe0a6 100%)' },   // 마을 (마더의 마을 구경)
    farm_field:   { fill: 'linear-gradient(180deg, #efe3b5 0%, #b9d08a 100%)' },   // 마을 밭 (1-1 · 1-2)
    meadow:       { fill: 'linear-gradient(180deg, #dcecc0 0%, #9ccb7e 100%)' },   // 들판 (1-3)
    warehouse:    { fill: 'linear-gradient(180deg, #8c8a86 0%, #4e4a47 100%)' },   // 버려진 창고 (예전 1-6 · 지금 대본은 안 씀)
    // 1장 대본(N3): 집 안 배경 2장은 그림 (원본 docs/graphics/backgrounds/house_*.png · python tools/sprite_prep.py backgrounds) · 나머지는 색 바탕 자리 (그림이 생기면 경로만 바꿈)
    house_dinner: 'images/story/bg/house_dinner.webp',                             // 마더의 집 저녁 식탁 (1-1 이름 짓기)
    house_night:  'images/story/bg/house_night.webp',                              // 마더의 집 부엌 밤 (1-2 편지)
    village_dusk: { fill: 'linear-gradient(180deg, #f2c48a 0%, #b98a6a 100%)' },   // 마을 어귀 저녁 (1-5)
    village_fire: { fill: 'linear-gradient(180deg, #3a1f1a 0%, #c4542a 100%)' }    // 불타는 마을 광장 (1-6)
  },
  // 실제 전투로 이어지는 @전투 (여기 없는 이름은 자리표시 카드) · encounter = data/battle-proto.js encounters 의 이름
  battles: {
    lab_guard_tutorial: { encounter: 'lab_guard_tutorial' },   // 프롤로그 03 · 경비 1 (튜토리얼)
    lab_guard_sniper:   { encounter: 'lab_guard_sniper' },     // 프롤로그 03b · 경비 2 + 저격
    // 1장 스테이지 전투 (S3): stage = data/stage/chapter1.js 의 스테이지 id → battle.html?stage=…&run=…&savekey=… (뽑기 편성으로 싸움 · 결과는 story.html 로 돌아와 @스테이지 에서 stage.html 로 넘김)
    st1_1: { stage: '1-1' }, st1_2: { stage: '1-2' }, st1_3: { stage: '1-3' }, st1_4: { stage: '1-4' }, st1_5: { stage: '1-5' }, st1_6: { stage: '1-6' }
  },
  // 일러스트 컷: '그림 경로' 또는 { image, caption }. 그림이 없으면 자리표시 카드에 caption 을 보여 줌
  cuts: {
    // 원본 docs/graphics/cuts/cut_leak_light.png → WebP (python tools/sprite_prep.py cuts cut_leak_light)
    //  fx = 코드 연출 (js/story/fx.js): at = 빛이 모이는 점(그림 원본 비율 · 24호 이마 위 · 바늘 끝) · 끝나면 저절로 다음 대사
    cut_leak_light: { image: 'images/story/cuts/cut_leak_light.webp', caption: '청록빛이 터지는 순간',
                      fx: { type: 'leak_burst', at: [0.532, 0.568], color: '#5fe8d6' } },
    // 원본 docs/graphics/cuts/cut_left_hand.png → 흰 바탕 제거 + lab_gate 배경 합성 (python tools/sprite_prep.py cuts → python tools/cut_compose.py)
    cut_left_hand:  { image: 'images/story/cuts/cut_left_hand.webp', caption: '닿지 못한 손' }
  }
};
