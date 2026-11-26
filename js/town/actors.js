/* =====================================================================
 * TALELIA · town/actors.js — ③ 동물 계층 (표시 · 애니메이션 · 갱신 루프)
 *
 *  동물 요소는 건물과 같은 장면 컨테이너(.town-scene) 안 .town-actors 에 들어갑니다.
 *  .town-actors 는 위치 지정 없는 묶음이라 쌓임 맥락을 만들지 않습니다 → 동물과 건물이 z-index 하나로 함께 정렬됨.
 *
 *  요소 구조 (발 위치가 원점)
 *    .actor [transform: translate3d(발 위치) · z-index = iso.zActor(u, v)]
 *      .actor__shadow                 발밑 그림자 (함께 움직임)
 *      .actor__body  [좌우 반전]
 *        .actor__sprite [data-state 에 따라 CSS 통통 · 숨쉬기]
 *          <img> (정지 그림) 또는 <div> (스프라이트 시트)
 *
 *  애니메이션은 "그리는 방법(Animator)"과 "행동(behavior.js)"을 분리했습니다.
 *    SPRITES[키] = { kind: 'static', src, h, ay, facesRight }           ← 지금 (말랑이 정지 그림)
 *    SPRITES[키] = { kind: 'sheet',  src, fw, fh, fps, rows: { idle_front, idle_back, walk_front, walk_back } , ay }  ← 나중에 시트로 교체
 *  Animator 는 setState('idle'|'walk') · setFacing(오른쪽?, 뒤?) · update(dt) 세 가지만 압니다.
 *
 *  갱신 루프 (requestAnimationFrame 하나)
 *    - 위치 · 깊이 · 방향이 바뀐 경우에만 DOM 에 씀 (0.1px · 정수 z 단위로 비교)
 *    - 화면 밖 동물은 DOM 쓰기를 건너뛰고 행동만 진행
 *    - 탭이 숨겨지면 루프를 멈추고, 돌아오면 큰 시간 차이를 0.1초로 잘라 이어감
 *    - 움직임 줄이기 설정: 걷지 않고 제자리에서 쉼
 *  서버를 부르지 않습니다.
 * ===================================================================== */
(function(){
  const REDUCED = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 말랑이 (pebble_golem) — 이름 · 등급 · 속성은 기존 카탈로그 값 (renewal/tests/fixtures/catalog-seed.js 와 같음 · 표시만)
  const SPRITES = {
    pebble_golem: { kind: 'static', src: 'images/chars/pebble_golem.webp', h: 40, ay: .97, facesRight: false },
    // 초기 캐릭터 3종 (2026-11-12) — 공식 턴어라운드에서 잘라 만든 마을용 그림 · @2x 그림 높이 ÷ 2 = 화면 높이 · 발 = 그림 아래 가운데
    //  24호 = 스프라이트 시트 (@6x · 칸 312×336 = 화면 52×56 · 발 = 칸 (156, 333) · 6열 × 3줄: idle_front / walk_front / walk_back)
    //  idle_back 은 1차 제외 → 뒤를 보고 쉴 때는 idle_front 사용. 시트를 못 불러오면 still(정지 그림)로 대체
    subject_24:       { kind: 'sheet', src: 'images/talelia/actors/subject_24_sheet.webp', scale: 6, fw: 312, fh: 336, cols: 6, nrows: 3,
                        rows: { idle_front: { y: 0, n: 6, fps: 6 }, walk_front: { y: 1, n: 6, fps: 10 }, walk_back: { y: 2, n: 6, fps: 10 } },
                        facesRight: false, emoteY: 54,
                        still: { kind: 'static', src: 'images/talelia/actors/subject_24.webp', h: 47.5, ay: .99, facesRight: false } },
    //  탐험가 햄스터 = 시트 (@6x · 칸 312×288 = 화면 52×48 · 발 = 칸 (156, 285))
    hamster_explorer: { kind: 'sheet', src: 'images/talelia/actors/hamster_explorer_sheet.webp', scale: 6, fw: 312, fh: 288, cols: 6, nrows: 3,
                        rows: { idle_front: { y: 0, n: 6, fps: 6 }, walk_front: { y: 1, n: 6, fps: 10 }, walk_back: { y: 2, n: 6, fps: 10 } },
                        facesRight: false, emoteY: 46,
                        still: { kind: 'static', src: 'images/talelia/actors/hamster_explorer.webp', h: 39.5, ay: .99, facesRight: false } },
    //  망치 햄스터 = 시트 (@6x · 칸 360×336 = 화면 60×56 · 발 = 칸 (180, 333))
    hamster_hammer:   { kind: 'sheet', src: 'images/talelia/actors/hamster_hammer_sheet.webp', scale: 6, fw: 360, fh: 336, cols: 6, nrows: 3,
                        rows: { idle_front: { y: 0, n: 6, fps: 6 }, walk_front: { y: 1, n: 6, fps: 10 }, walk_back: { y: 2, n: 6, fps: 10 } },
                        facesRight: false, emoteY: 53,
                        still: { kind: 'static', src: 'images/talelia/actors/hamster_hammer.webp', h: 46.5, ay: .99, facesRight: false } }
  };
  const INFO = { pebble_golem: { name: '말랑이', grade: '일반', elem: '땅', desc: '말랑말랑한 돌멩이 친구예요. 광장과 집 사이를 느긋하게 산책해요.' },
    // 등급 · 속성은 아직 정해지지 않아 '미정'으로 표시 (카탈로그 값이 생기면 교체)
    subject_24:       { name: '실험체 24호', grade: '미정', elem: '미정', desc: '붉은 망토를 두른 하얀 토끼 모험가예요. 당근을 들고 마을을 둘러봐요.' },
    hamster_explorer: { name: '탐험가 햄스터', grade: '미정', elem: '미정', desc: '호기심 많은 탐험가 햄스터예요. 가방에 이것저것 챙겨 다녀요.' },
    hamster_hammer:   { name: '망치 햄스터', grade: '미정', elem: '미정', desc: '힘이 장사인 호탕한 햄스터예요. 커다란 망치를 번쩍 들고 다녀요.' } };

  /* ---------- 그리는 방법 ---------- */
  function StaticAnimator(sprite, cfg){
    const img = document.createElement('img');
    img.className = 'actor__img'; img.alt = ''; img.draggable = false; img.decoding = 'async';
    img.style.height = cfg.h + 'px';
    img.src = cfg.src;
    sprite.appendChild(img);
    let st = '', fr = null;
    return {
      el: img,
      setState(s){ if(s !== st){ st = s; sprite.dataset.state = s; } },
      setFacing(right){ const flip = right !== cfg.facesRight; if(flip !== fr){ fr = flip; sprite.parentNode.style.transform = flip ? 'scaleX(-1)' : ''; } },
      update(){}   // 정지 그림은 CSS 가 통통 움직임을 맡음
    };
  }
  function SheetAnimator(sprite, cfg, seed){
    // scale = 시트 픽셀 ÷ 화면 px (4 = @4x). 칸 · 시트 전체를 같은 비율로 줄여 표시 → 고해상도 화면에서도 선명
    const k = cfg.scale || 1, w = cfg.fw / k, h = cfg.fh / k, reduced = REDUCED();
    const el = document.createElement('div');
    el.className = 'actor__sheet';
    el.style.cssText = `width:${w}px;height:${h}px;background-image:url("${cfg.src}");background-repeat:no-repeat;background-size:${(cfg.cols || 1) * w}px ${(cfg.nrows || 1) * h}px`;
    sprite.appendChild(el);
    sprite.style.animation = 'none';   // 움직임은 시트가 그림 → CSS 통통 · 숨쉬기는 이 캐릭터만 끔 (CSS 파일은 그대로)
    const phase = Math.abs(seed | 0);    // 캐릭터마다 시작 프레임을 다르게 (여러 마리가 똑같이 움직이지 않게)
    let st = 'idle', back = false, right = false, frame = 0, acc = 0, rowKey = '';
    const rowOf = () => cfg.rows[st + (back ? '_back' : '_front')] || cfg.rows[st + '_front'];   // 뒷모습 줄이 없으면 앞모습
    const apply = () => { const key = st + (back ? '_back' : '_front'), row = rowOf(); if(!row) return;
      if(key !== rowKey){ rowKey = key; frame = phase % row.n; acc = 0; }
      el.style.backgroundPosition = `${-frame * w}px ${-row.y * h}px`; };
    apply();
    return {
      el,
      setState(s){ if(s !== st){ st = s; sprite.dataset.state = s; apply(); } },
      setFacing(r, b){ if(b !== back){ back = b; apply(); } if(r !== right){ right = r; sprite.parentNode.style.transform = (r !== !!cfg.facesRight) ? 'scaleX(-1)' : ''; } },
      // 움직임 줄이기 설정이면 프레임을 넘기지 않음 · 줄마다 속도(row.fps) 지정 가능
      update(dt){ const row = rowOf(); if(!row || reduced) return; acc += dt; const step = 1 / (row.fps || cfg.fps || 8); if(acc >= step){ acc %= step; frame = (frame + 1) % row.n; apply(); } },
      destroy(){ el.remove(); sprite.style.animation = ''; }
    };
  }

  /* ---------- 동물 관리 ---------- */
  function create(world, scene, camera, opts){
    const I = window.TaleliaIso, BH = window.TaleliaTownBehavior, o = opts || {};
    const holder = document.createElement('div');
    holder.className = 'town-actors';
    scene.scene.appendChild(holder);
    const list = [];
    const stats = { frames: 0, writes: 0, skipped: 0, running: false };
    let raf = 0, last = 0, paused = false;

    function add(key, x, y, seed){
      const cfg = SPRITES[key], info = INFO[key] || { name: key };
      const el = document.createElement('div'); el.className = 'actor'; el.dataset.actor = key;
      el.innerHTML = '<div class="actor__shadow"></div><div class="actor__body"><div class="actor__sprite" data-state="idle"></div></div>';
      holder.appendChild(el);
      const sprite = el.querySelector('.actor__sprite');
      const anim = cfg.kind === 'sheet' ? SheetAnimator(sprite, cfg, seed) : StaticAnimator(sprite, cfg);
      // 시트를 못 불러오면 정지 그림(cfg.still)으로 바꿈 → 캐릭터가 사라지지 않음
      if(cfg.kind === 'sheet' && cfg.still){
        const probe = new Image();
        probe.onerror = () => { if(a.anim !== anim) return; anim.destroy(); a.anim = StaticAnimator(sprite, cfg.still); a.sheetFailed = true; render(a, true); };
        probe.src = cfg.src;
      }
      const a = { id: 'a' + list.length, key, info, el, anim, u: x + .5, v: y + .5, du: 0, dv: 0, right: false, back: false, h: 0,
                  last: { x: NaN, y: NaN, z: NaN }, visible: true };
      // role: 'npc' = 마을 동물 (내 정원 출입 금지) · 'garden' = (나중) 플레이어가 정원에 배치한 동물
      a.brain = BH.create(a, { world, scene, seed: seed || 7, speed: o.speed, reduced: REDUCED(), role: o.role || 'npc' });
      a.brain.B.onArrive = (cat, r) => { if(r < .45) emote(a, cat === 'pond' ? '💧' : cat === 'homes' ? '🏡' : cat === 'hill' ? '💪' : cat === 'fountain' ? '⛲' : cat === 'flowers' ? '🌼' : cat === 'facility' ? '👀' : r < .2 ? '♪' : '✨'); };
      a.placeAt = (u, v) => { a.u = u; a.v = v; a.brain.B.state = 'rest'; a.brain.B.path = null; render(a, true); };
      list.push(a);
      render(a, true);
      return a;
    }

    function emote(a, ch){
      const e = document.createElement('div'); e.className = 'actor__emote'; e.textContent = ch;
      const ey = (SPRITES[a.key] || {}).emoteY; if(ey) e.style.bottom = ey + 'px';   // 캐릭터별 말풍선 높이 (없으면 CSS 기본 46px)
      a.el.appendChild(e); setTimeout(() => e.remove(), 1400);
    }

    /** 화면 좌표 · 깊이 계산 후 바뀐 값만 씀 */
    function render(a, force){
      const h = BH.heightAt(world, scene, a.u, a.v);
      const [px, py] = I.toScreen(a.u, a.v); const y = py - h;
      const rx = Math.round(px * 10) / 10, ry = Math.round(y * 10) / 10, z = I.zActor(a.u, a.v);
      a.h = h; a.px = rx; a.py = ry; a.z = z;
      // 화면 밖이면 DOM 쓰기 생략 (강제 갱신 제외)
      if(!force && camera){
        const s = camera.state(), cx = s.x + rx * s.s, cy = s.y + ry * s.s, m = 120;
        a.visible = cx > -m && cy > -m && cx < window.innerWidth + m && cy < window.innerHeight + m;
        if(!a.visible){ stats.skipped++; return; }
      }
      if(rx !== a.last.x || ry !== a.last.y){ a.el.style.transform = `translate3d(${rx}px,${ry}px,0)`; a.last.x = rx; a.last.y = ry; stats.writes++; }
      if(z !== a.last.z){ a.el.style.zIndex = z; a.last.z = z; stats.writes++; }
      const walking = a.brain.state === 'walk' && !a.brain.B.held;
      a.anim.setState(walking ? 'walk' : 'idle');
      if(walking){
        const sx = a.du - a.dv;   // 화면 가로 방향
        if(Math.abs(sx) > .01) a.right = sx > 0;
        a.back = (a.du + a.dv) < 0;
      } else if(a.brain.B.held){ a.back = false; }
      else if(a.brain.B.face){ a.right = a.brain.B.face > 0; a.back = false; }   // 쉬는 동안 고개 돌리기
      a.anim.setFacing(a.right, a.back);
    }

    function step(dt){
      for(const a of list){ if(!paused) a.brain.update(dt); a.anim.update(dt); render(a, false); }
    }
    function frame(t){
      raf = 0;
      const dt = last ? Math.min(.1, (t - last) / 1000) : 0; last = t;
      stats.frames++;
      step(dt);
      if(stats.running) raf = requestAnimationFrame(frame);
    }
    function start(){ if(stats.running) return; stats.running = true; last = 0; raf = requestAnimationFrame(frame); }
    function stop(){ stats.running = false; if(raf) cancelAnimationFrame(raf); raf = 0; }
    document.addEventListener('visibilitychange', () => { if(document.hidden) stop(); else start(); });

    /** 누른 위치의 동물 */
    function pick(cx, cy){
      for(const e of document.elementsFromPoint(cx, cy)){
        const el = e.closest && e.closest('.actor'); if(el) return list.find(a => a.el === el) || null;
        if(e.closest && (e.closest('.tobj') || e.classList.contains('town-viewport'))) return null;   // 건물이 위에 있으면 건물 우선
      }
      return null;
    }
    function hold(a, on){ a.brain.B.held = !!on; a.el.classList.toggle('is-selected', !!on); render(a, true); }

    return {
      list, stats, add, start, stop, pick, hold, emote,
      pause(){ paused = true; }, resume(){ paused = false; },
      /** 검사용: 시간을 직접 진행 (화면 갱신 포함) */
      advance(sec, fps){ const dt = 1 / (fps || 30); for(let t = 0; t < sec; t += dt) step(dt); },
      get paused(){ return paused; }
    };
  }

  window.TaleliaTownActors = Object.freeze({ create, SPRITES, INFO, StaticAnimator, SheetAnimator });
})();
