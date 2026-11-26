/* =====================================================================
 * TALELIA · 이름 규칙 데이터 (docs/design/chapter1-script-wiring.md 2장)
 *  주인공(s24 · 전투 id subject_24)은 1-1 저녁 식탁의 이름 짓기 뒤 "엘피"(정식 이름 엘피스)로 불린다.
 *  캐릭터 id · 저장 구조는 그대로 두고 화면에 보이는 이름만 바꾼다. 판단 = 저장의 stage.cleared[namedAt]
 *  game = 게임 화면(전투 · 편성 · 도감 · 마을) · call = 대화 · 안내 문장 속 이름 · full = 정식 이름
 * ===================================================================== */
window.TALELIA_NAMES = {
  version: 1,
  namedAt: '1-1',
  chars: {
    s24: {
      battleId: 'subject_24',
      before: { game: '실험체 24호', call: '24호', full: '실험체 24호' },
      after:  { game: '엘피',        call: '엘피',  full: '엘피스' }
    }
  }
};
