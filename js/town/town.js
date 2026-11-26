/* =====================================================================
 * TALELIA · town/town.js — 2.5D 마을 프로토타입 진입점 (1단계: 땅 + 카메라 · 2단계: 건물 · 장식 · 3단계: 동물)
 *
 *  - 로그인하지 않습니다. 서버를 부르지 않습니다. (supabase · fit-village-api 를 불러오지 않음)
 *  - 데이터: world-data.js 의 고정 지도 + SAMPLE_GARDEN (예제 정원)
 *  - 주소 옵션: ?debug=1  구역 이름 · 좌표 · 누른 칸 표시
 *  - 테스트용으로 window.TaleliaTown 에 지도 · 카메라 · 땅 정보를 노출합니다.
 * ===================================================================== */
(function(){
  const $ = s => document.querySelector(s);
  const DEBUG = new URLSearchParams(location.search).get('debug') === '1';
  const DEV = !!window.TaleliaDev;   // ?dev=1: 칸 수 · 연결 예정 · 예제 값까지 보여 줌
  const num = v => Math.floor(Number(v) || 0).toLocaleString('ko-KR');

  function start(){
    const viewport = $('#townViewport'), layer = $('#townCamera'), hud = $('#townHud'), nav = $('#townNav'), dbg = $('#townDebug');
    const sample = window.TaleliaTownWorld.SAMPLE_GARDEN;

    // ① 땅 (한 번만)
    const world = window.TaleliaTownWorld.build(sample);
    const ground = window.TaleliaTownGround.render(world, { debug: DEBUG });
    layer.appendChild(ground.svg);
    // ② 장면: 그림자 층 + 건물 · 장식 (한 번만)
    const scene = window.TaleliaTownScene.build(world, layer);
    if(scene.problems.length) console.warn('[TALELIA 마을] 배치 문제', scene.problems);

    // 건물 누르기 → 이름 · 설명 시트 (서버 호출 없음)
    const ZONE_NAME = {}; world.zones.forEach(z => { ZONE_NAME[z.key] = z.name; });
    const U = window.TaleliaUI;
    function openInfo(o){
      scene.select(o.id);
      const t = o.def, c = world.at(o.x, o.y), where = (c && c.zone && ZONE_NAME[c.zone]) || '마을';
      U.sheet(t.name,
        `<p class="town-info__desc">${U.esc(t.desc || '')}</p>
         <dl class="tl-dl"><dt>위치</dt><dd>${U.esc(where)}</dd>${DEV ? `<dt>크기</dt><dd>${t.w} × ${t.d} 칸</dd>
         ${t.feature ? `<dt>연결 예정</dt><dd>${U.esc(t.feature)}</dd>` : ''}` : ''}${DEBUG ? `<dt>좌표 · 깊이</dt><dd>${o.x},${o.y} · z ${o.z}</dd>` : ''}</dl>
         ${DEV ? '<p class="tl-muted">프로토타입에서는 정보만 보여 줘요. 서버에 연결하지 않습니다.</p>' : ''}`);
    }
    // ③ 동물 (화면 전용 · 서버 저장 없음) — 카메라는 아래에서 만든 뒤 연결
    let actors = null, heldActor = null;
    const STATE_NAME = { walk: '걷는 중', rest: '쉬는 중' }, GOAL_NAME = { plaza: '광장', homes: '동물의 집', path: '길', pond: '연못', hill: '훈련장 언덕' };
    function openActor(a){
      scene.select(null);
      if(heldActor && heldActor !== a) actors.hold(heldActor, false);
      heldActor = a; actors.hold(a, true);
      const B = a.brain.B, i = a.info;
      U.sheet(i.name,
        `<p class="town-info__desc">${U.esc(i.desc || '')}</p>
         <dl class="tl-dl">${DEV ? `<dt>등급</dt><dd>${U.esc(i.grade)}</dd><dt>속성</dt><dd>${U.esc(i.elem)}</dd>` : ''}
         <dt>지금</dt><dd>${B.state === 'walk' ? '산책 중 (' + U.esc(GOAL_NAME[B.last] || '마을') + ' 쪽으로)' : '쉬는 중'}</dd>
         ${DEV ? `<dt>위치</dt><dd>${Math.floor(a.u)}, ${Math.floor(a.v)}</dd>` : ''}</dl>
         ${DEV ? '<p class="tl-muted">마을 안에서만 움직여요. 위치는 저장되지 않습니다.</p>' : ''}`);
    }
    // 시트가 닫히면 선택 해제 (건물 · 동물)
    new MutationObserver(() => {
      if(document.querySelector('.tl-sheet-backdrop')) return;
      if(scene.selected) scene.select(null);
      if(heldActor){ actors.hold(heldActor, false); heldActor = null; }
    }).observe(document.body, { childList: true });

    // HUD (예제 값 · 표시만)
    const v = sample.village;
    $('[data-hud="level"]').textContent = 'Lv.' + v.land_level;
    // 정령석 · 골드 = js/town/hub.js 가 저장에서 읽기만 해 채움

    // 카메라: 위 HUD 와 아래 메뉴를 뺀 영역에 마을 전체가 들어가게
    const insets = () => {
      const r = viewport.getBoundingClientRect(), h = hud.getBoundingClientRect(), n = nav.getBoundingClientRect();
      return { top: Math.max(0, h.bottom - r.top), bottom: Math.max(0, r.bottom - n.top), left: 0, right: 0 };
    };
    let tapInfo = '';
    const showDebug = st => { if(!DEBUG) return; dbg.textContent = `배율 ${Math.round(st.s * 100)}% (전체 ${Math.round(st.fit * 100)}%) · 카메라 갱신 ${st.changes}회${tapInfo}`; };
    const camera = window.TaleliaTownCamera.create(viewport, layer, ground.bounds, {
      insets, maxScale: 2.2,
      onChange: showDebug,
      onTap: (cx, cy) => {
        const a = actors && actors.pick(cx, cy);
        let o = a ? null : scene.pick(cx, cy);
        // 그림 파일 건물은 화면 판정(elementsFromPoint)에 잡히지 않으므로, 동물 위에 그려진 그림 건물이면 건물 우선 (SVG 와 같은 결과)
        if(a){ const ob = scene.pick(cx, cy); if(ob && ob.gfx && ob.z > a.z) o = ob; }
        if(o) openInfo(o); else if(a) openActor(a);
        const [wx, wy] = camera.clientToWorld(cx, cy), [tx, ty] = window.TaleliaIso.toTile(wx, wy), c = (tx >= 0 && ty >= 0 && tx < world.W && ty < world.H) ? world.at(tx, ty) : null;
        if(!DEBUG) return;
        tapInfo = c ? ` · 누른 칸 ${tx},${ty} (${c.t}${c.h ? ' 높이 ' + c.h : ''}${c.zone ? ' · ' + c.zone : ''}${c.garden ? ' · 정원 ' + (tx - world.garden.x0) + ',' + (ty - world.garden.y0) : ''})` : ' · 마을 밖';
        showDebug(camera.state());
      }
    });
    if(DEBUG){ dbg.hidden = false; showDebug(camera.state()); }

    // 처음 시점: 가로 화면은 마을 전체, 세로 화면(휴대폰)은 광장과 내 정원이 보이게 확대
    //  (마름모 섬이 가로로 넓어 세로 화면에서 전체를 보이면 섬이 너무 작아짐. 전체 보기는 ⌖ 버튼 · 최소 배율로 항상 가능)
    function home(){
      const a = camera.area(), st = camera.state();
      if(a.w / a.h >= 1){ camera.fit(); return 'fit'; }
      // 섬 높이가 마을 영역 높이를 거의 채우는 배율. 가로 위치는 광장 아래쪽 ~ 내 정원 위쪽 사이
      const s = Math.min(st.max, Math.max(st.fit * 2, a.h * .96 / ground.bounds.h));
      const [px, py] = window.TaleliaIso.center(20, 19);
      camera.centerOn(px, py, s);
      return 'portrait';
    }
    const homeMode = home();

    // 그래픽 교체 (T1): 매니페스트에 그림이 있는 것만 그림 파일로 · 없거나 실패하면 SVG 그대로 · ?gfx=svg 면 매니페스트 무시
    const gfx = window.TaleliaTownGfx.create({ world, ground, scene, layer, camera });
    scene.setImagePicker(gfx.pick);
    const gfxReady = gfx.apply(window.TALELIA_ASSET_MANIFEST).then(r => { document.documentElement.dataset.gfx = r.mode; return r; });

    // ③ 동물: 말랑이 한 마리 (광장 서쪽에서 시작)
    actors = window.TaleliaTownActors.create(world, scene, camera, {});
    actors.add('pebble_golem', 20, 15, 20261111);
    // 초기 캐릭터 3종 (광장 안 걸을 수 있는 칸에서 시작 · 말랑이 뒤에 추가해 기존 순서 유지)
    actors.add('subject_24', 21, 17, 20261112);
    actors.add('hamster_explorer', 24, 16, 20261113);
    actors.add('hamster_hammer', 23, 18, 20261114);
    actors.start();

    // 확대 버튼
    $('#townZoomIn').addEventListener('click', () => camera.zoomBy(1.3));
    $('#townZoomOut').addEventListener('click', () => camera.zoomBy(1 / 1.3));
    $('#townZoomFit').addEventListener('click', () => camera.fit());

    // 하단 메뉴: data-go 칸은 js/town/hub.js 가 처리 (H3) · 그 밖의 칸은 안내만
    nav.addEventListener('click', e => { const b = e.target.closest('button'); if(!b) return;
      if(b.dataset.go) return;
      const t = $('#townToast'); t.textContent = '아직 열 수 없어요.'; t.hidden = false; clearTimeout(t._h); t._h = setTimeout(() => { t.hidden = true; }, 1800); });

    viewport.focus({ preventScroll: true });
    // 'ready' = 그림 교체(gfx)까지 끝난 뒤. 그림을 늦게 끼우면 ready 직후 장면 요소가 한 번 바뀌므로 (실패해도 SVG 로 남고 ready)
    gfxReady.catch(() => null).then(() => { document.documentElement.dataset.town = 'ready'; });
    window.TaleliaTown = Object.freeze({ world, ground, scene, camera, actors, gfx, gfxReady, home, homeMode, openInfo, openActor, debug: DEBUG, stage: 4 });
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
