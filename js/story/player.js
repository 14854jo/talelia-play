/* =====================================================================
 * TALELIA · story/player.js — 대본 명령을 차례로 실행 · 입력(클릭 · 키) · 자동 진행 · 건너뛰기 · 시작
 *
 *  넘기기   출력 중 클릭 = 그 줄 바로 다 보임 · 다 나온 뒤 클릭 = 다음 줄 (Space · Enter · → 도 같음)
 *  자동     줄이 다 나오면 (기본 시간 + 글자 수 × 글자당 시간) 뒤 다음 줄 (A 키)
 *  건너뛰기 다음 멈춤 지점(전투 · 컷 · 장면 끝 · 장면 이동)까지 바로 감. 지나간 대사도 로그에 남음
 *  로그     지난 대사 (L 키 · Esc 로 닫기) · 열려 있는 동안 넘기기 · 자동 진행은 멈춤
 *  속도     느림 · 보통 · 빠름 (이 기기에 기억 · 없어도 동작)
 *
 *  주소 옵션: ?scene=장면 · ?tone=lab|base (대본의 @톤 무시하고 고정) · ?auto=1 · ?text=instant (글자 한 번에)
 *            ?motion=reduce|full · ?portraitbase=경로 (시험용) · ?battlemode=card (전투를 항상 자리표시 카드로)
 *
 *  전투 연결 (data/story/cast.js battles 표에 있는 @전투 만 · 표에 없으면 자리표시 카드)
 *   가는 길   ① 주소를 story.html?scene=장면&at=전투 로 바꿔 둠 (뒤로가기 대비) · 지난 대사 로그를 sessionStorage 에 잠깐 보관
 *             ② battle.html?encounter=구성&return=story.html%3Fscene%3D장면&seed=무작위 로 이동
 *   오는 길   story.html?scene=장면&battle=전투&result=win|lose → 그 장면 대본에서 @전투 줄을 찾아 승리→ / 패배→ 장면으로 이어 감
 *             (대상 장면은 주소가 아니라 대본에서 읽음 · 보관해 둔 로그가 있으면 복원) → 주소를 정리해 새로고침해도 다시 적용되지 않음
 *   뒤로가기  ?at=전투 로 열리면 전투 직전 상태(배경 · 등장인물)를 바로 복원하고 [전투 시작] / [이 장면 처음부터] 카드
 *             (자동으로 전투에 다시 보내지 않음 → 뒤로가기가 막히지 않음)
 *  전투 규칙 · 화면 코드는 이 페이지에서 부르지 않습니다 (battle.html 로 이동할 뿐).
 * ===================================================================== */
(function(){
  'use strict';
  const Parser = window.TaleliaStoryParser, CAST = window.TALELIA_STORY_CAST;
  const STORY = window.TALELIA_STORY = window.TALELIA_STORY || { scenes: {} };
  const q = new URLSearchParams(location.search);

  const SPEEDS = {
    slow:   { label: '느림', cps: 18, base: 1800, per: 60 },
    normal: { label: '보통', cps: 32, base: 1200, per: 50 },
    fast:   { label: '빠름', cps: 60, base: 700,  per: 30 }
  };
  const ORDER = ['slow', 'normal', 'fast'], KEY = 'talelia.story.settings';
  const loadSet = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch(e){ return {}; } };
  const saveSet = o => { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch(e){} };

  const root = document.getElementById('story');
  const reduced = q.get('motion') === 'reduce' ? true : q.get('motion') === 'full' ? false : !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  root.classList.toggle('is-reduced', reduced); root.classList.toggle('is-full-motion', q.get('motion') === 'full');
  const stage = window.TaleliaStoryStage.create(root, CAST, { base: q.get('portraitbase'), reduced });
  const dialog = window.TaleliaStoryDialog.create(root);
  const set0 = loadSet();

  const S = {
    gen: 0, scene: null, parsed: null, i: 0, state: 'idle',
    auto: q.get('auto') === '1', skipping: false,
    speed: SPEEDS[set0.speed] ? set0.speed : 'normal',
    instantText: q.get('text') === 'instant' || reduced,
    tone: q.get('tone') === 'lab' || q.get('tone') === 'base' ? q.get('tone') : null,   // 고정 톤 (null = 대본대로)
    waiting: null, autoMs: null, timer: 0, sleeper: null,
    history: [], warnings: [],
    ff: null,              // 빨리 감기: { id: 전투 이름, gate: true } 뒤로가기 복원 · { id, result } 전투 결과 적용 — 그 @전투 줄까지 화면 상태만 만들고 멈춤
    pendingBattle: null    // 전투로 떠난 뒤 이 페이지가 그대로 되살아날 때(뒤로가기 캐시)를 위한 표시
  };

  // ---------- 전투 연결: 보관 · 주소 ----------
  const SNAP = 'talelia.story.battle', enc = encodeURIComponent;
  const saveSnap = o => { try { sessionStorage.setItem(SNAP, JSON.stringify(o)); } catch(e){} };
  const readSnap = () => { try { return JSON.parse(sessionStorage.getItem(SNAP)); } catch(e){ return null; } };
  const clearSnap = () => { try { sessionStorage.removeItem(SNAP); } catch(e){} };
  /** 시험 · 설정용 주소 옵션은 전투를 다녀와도 유지 */
  const keepParams = () => ['text', 'motion', 'tone', 'auto', 'portraitbase', 'battlemode', 'savekey', 'stagemode'].filter(k => q.has(k)).map(k => '&' + k + '=' + enc(q.get(k))).join('');   // savekey = 스테이지 전투 · 화면이 읽을 시험용 저장 키 · stagemode=card = 스테이지 · 마을로 이동을 카드로(시험용)
  const setUrl = rest => { try { history.replaceState(null, '', 'story.html?' + rest + keepParams()); } catch(e){} };
  /** 스테이지 전투(1장 · S3): 전투 이름 → 스테이지 id (cast.js battles 의 stage) · 아니면 null */
  const stageOfBattle = c => (CAST.battles && CAST.battles[c.id] && CAST.battles[c.id].stage) || null;
  /** 이번 스테이지 판(runId · 결과)을 이야기 안에서 @스테이지 까지 들고 가기 (새로고침해도 남도록 sessionStorage 에 잠깐) */
  const STG = 'talelia.story.stage';
  const saveStg = o => { try { sessionStorage.setItem(STG, JSON.stringify(o)); } catch(e){} };
  const readStg = () => { try { return JSON.parse(sessionStorage.getItem(STG)); } catch(e){ return null; } };
  const clearStg = () => { try { sessionStorage.removeItem(STG); } catch(e){} };
  /** 실제 전투로 보낼 @전투 인지 → 전투 구성 이름 (아니면 null = 자리표시 카드) */
  const encounterOf = c => q.get('battlemode') !== 'card' && CAST.battles && CAST.battles[c.id] ? (CAST.battles[c.id].encounter || c.id) : null;

  /** 주인공 이름 (24호 → 엘피): 저장의 stage.cleared['1-1'] 로 판단 · 이 페이지는 저장을 읽기만 함 · 장면의 @이름 이 이름표 · {이름} 을 정함 */
  const HERO_ID = 's24';
  const heroNamed = () => { try { const N = window.TaleliaNames; return !!(N && N.isNamed(N.readSave(q.get('savekey') || undefined))); } catch(e){ return false; } };
  /** 프롤로그 중간 저장 (js/story/progress.js · 지금 장면 이름만 · 마을 구경을 끝낸 저장이면 쓰지 않음) */
  const PG = window.TaleliaProgress, SAVEKEY = q.get('savekey') || null;
  const introDone = () => { try { const N = window.TaleliaNames; return !!(PG && N && PG.started(N.readSave(SAVEKEY || undefined))); } catch(e){ return false; } };
  const noteProgress = id => { if(PG && PG.isPrologue(id) && !introDone()) PG.write(id, SAVEKEY); };
  /** ?scene 없이 열면: 기록된 프롤로그 장면부터 이어 하기 (없거나 대본에 없는 장면이면 null) */
  const resumeScene = () => { if(!PG || introDone()) return null; const id = PG.read(SAVEKEY); return id && STORY.scenes[id] != null ? id : null; };

  const plain = segs => segs.map(s => s.text != null ? s.text : s.br ? '\n' : '').join('');
  const autoDelay = text => SPEEDS[S.speed].base + Parser.chars(text).length * SPEEDS[S.speed].per;

  // ---------- 기다리기 (넘기기 · 자동 · 건너뛰기 · 다시 시작으로 깸) ----------
  function wake(){ clearTimeout(S.timer); const w = S.waiting; S.waiting = null; if(w) w(); }
  function waitAdvance(ms){
    return new Promise(res => {
      S.waiting = res; S.autoMs = ms;
      if(S.skipping) return wake();
      if(S.auto && !dialog.logIsOpen()) S.timer = setTimeout(wake, ms);
    });
  }
  function sleep(ms){ return new Promise(res => { const t = setTimeout(done, ms); function done(){ clearTimeout(t); S.sleeper = null; res(); } S.sleeper = done; }); }
  function wakeSleep(){ if(S.sleeper) S.sleeper(); }

  // ---------- 장면 실행 ----------
  async function play(id, keepLog, ff){   // keepLog = @이동 · 전투 결과로 이어진 장면 (지난 대사 로그 유지) · ff = 그 전투 줄까지 빨리 감기 (S.ff 설명)
    const g = ++S.gen;
    wake(); wakeSleep(); dialog.cardCancel(); dialog.logClose();
    S.skipping = false; S.scene = id; S.i = 0; S.state = 'loading'; S.ff = null;
    if(!keepLog){ S.history = []; dialog.logReset(); S.origin = id; }   // origin = 이어지는 장면들의 첫 장면 (끝 카드의 "처음부터")
    if(ff){   // 전투로 떠나기 전에 보관한 로그가 이 장면 · 이 전투 것이면 복원 (없으면 빨리 감으며 이 장면 대사만 다시 쌓음)
      const snap = readSnap();
      if(snap && snap.scene === id && snap.id === ff.id && Array.isArray(snap.history)){
        S.history = snap.history; for(const it of S.history) dialog.logAdd(it);
        if(snap.origin && STORY.scenes[snap.origin] != null) S.origin = snap.origin;
        ff = Object.assign({}, ff, { restored: true });
      }
      S.ff = ff;
    }
    const text = STORY.scenes[id];
    stage.instant = true; stage.reset(); dialog.clear(); stage.instant = false;
    if(S.tone) stage.setTone(S.tone);
    if(text == null){
      S.parsed = null; S.warnings = [{ line: 0, msg: '장면이 없음: ' + id }]; ui();
      S.state = 'end';
      // 이어지다가 없는 장면(아직 안 쓴 다음 장면)이면 끝 카드 + 처음부터 · 주소로 바로 연 장면이 없으면 버튼 없음
      const from = keepLog && S.origin && STORY.scenes[S.origin] != null ? S.origin : null;
      const v = await dialog.card({ kind: 'end', title: from ? '다음 장면 준비 중' : '장면을 찾지 못했어요', body: id,
        buttons: from ? [{ label: '처음부터', value: 'again', primary: true }] : [] });
      if(v === 'again' && from) play(from);
      return;
    }
    noteProgress(id);
    const P = S.parsed = Parser.parse(text, CAST, { named: heroNamed() });   // @이름 자동 = 저장에 이름이 지어졌나 (names.js · 읽기만)
    S.warnings = P.warnings; ui();
    // 표정 그림 미리 받기 (최대 3초 · 못 받아도 진행)
    await Promise.race([stage.preload(P.cast), new Promise(r => setTimeout(r, 3000))]);
    if(g !== S.gen) return;

    for(S.i = 0; S.i < P.cmds.length; S.i++){
      const r = await exec(P.cmds[S.i], g);
      if(g !== S.gen) return;
      if(r && r.goto){ S.skipping = false; return play(r.goto, true); }
    }
    if(S.ff){ S.ff = null; return play(id); }   // 빨리 감았는데 그 전투 줄이 없음 (대본이 바뀜 등) → 장면 처음부터
    S.skipping = false; stage.speak(undefined); dialog.clear(); S.state = 'end'; ui();
    const v = await dialog.card({ kind: 'end', title: '장면 끝', body: P.title || id, buttons: [{ label: '처음부터', value: 'again', primary: true }] });
    if(g === S.gen && v === 'again') play(id);
  }

  async function exec(c, g){
    stage.instant = S.skipping || !!S.ff;
    if(S.ff && (c.t === 'wait' || c.t === 'goto' || c.t === 'cut')) return;   // 빨리 감기: 화면 상태를 바꾸지 않는 줄은 건너뜀
    switch(c.t){
      case 'bg': stage.setBg(c.id); return;
      case 'tone': if(!S.tone) stage.setTone(c.v); return;
      case 'enter': stage.enter(c.who, c.pos, c.expr); return;
      case 'exit': stage.exit(c.who); return;
      case 'expr': stage.expr(c.who, c.expr); return;
      case 'move': stage.move(c.who, c.pos); return;
      case 'nameplate': stage.setLabel(c.who, c.label); return;
      case 'heroname': stage.setLabel(HERO_ID, c.label); return;   // @이름 · 주인공 이름표 (24호 → 엘피)
      case 'wait': if(!S.skipping) await sleep(c.s * 1000); return;
      case 'goto': return { goto: c.scene };
      case 'say': return say(c, g);
      case 'battle': {
        if(S.ff){
          if(c.id !== S.ff.id) return;                       // 다른 전투 줄: 지나감
          const ff = S.ff; S.ff = null; stage.instant = false;
          if(ff.gate) return battleGate(c, g);               // 뒤로가기로 돌아옴
          clearSnap();
          if(ff.result === 'win' || ff.result === 'lose'){   // 전투 결과 적용
            S.trace.push({ battle: c.id, result: ff.result, real: true });
            if(stageOfBattle(c)) saveStg({ stage: stageOfBattle(c), run: q.get('run') || null, result: ff.result });   // 스테이지 전투: 판 · 결과를 @스테이지 까지 보관
            const to = ff.result === 'win' ? c.win : c.lose;
            setUrl('scene=' + enc(to || S.scene));           // 주소 정리 (새로고침해도 결과가 다시 적용되지 않게)
            return to ? { goto: to } : undefined;
          }
          setUrl('scene=' + enc(S.scene));                   // result=error 등: 아래 자리표시 카드로
        } else if(encounterOf(c)) return goBattle(c);
        S.skipping = false; stage.speak(undefined); dialog.clear(); S.state = 'card'; ui();
        const v = await dialog.card({ kind: 'battle', title: '전투 · ' + c.id,
          body: '이 자리에 전투 화면이 들어갑니다 (1단계 자리표시). 결과를 골라 주세요.',
          buttons: [{ label: '승리', value: 'win', primary: true }, { label: '패배', value: 'lose' }] });
        if(g !== S.gen) return;
        S.trace.push({ battle: c.id, result: v });
        const to = v === 'win' ? c.win : v === 'lose' ? c.lose : null;
        return to ? { goto: to } : undefined;
      }
      case 'stage': {   // 스테이지 화면으로 (전투 결과 · runId 를 들고 감) · stagemode=card 이면 이동하지 않고 카드로
        const info = readStg(), has = info && info.stage === c.id && info.run && info.result;
        const url = 'stage.html?stage=' + enc(c.id) + (has ? '&run=' + enc(info.run) + '&result=' + enc(info.result) : '') + (q.get('savekey') ? '&savekey=' + enc(q.get('savekey')) : '');
        S.trace.push({ stage: c.id, url });
        if(q.get('stagemode') !== 'card'){ clearStg(); S.skipping = false; stage.speak(undefined); dialog.clear(); S.state = 'battle'; ui(); location.assign(url); return new Promise(() => {}); }
        S.skipping = false; stage.speak(undefined); dialog.clear(); S.state = 'end'; ui();
        const v = await dialog.card({ kind: 'end', title: '스테이지 화면으로', body: url, buttons: [{ label: '스테이지로', value: 'go', primary: true }, { label: '처음부터', value: 'again' }] });
        if(g !== S.gen) return; clearStg();
        if(v === 'again') play(S.origin || S.scene);
        return new Promise(() => {});
      }
      case 'town': {   // 마을로 가는 끝 카드 (마더의 마을 구경 끝) · 누르면 town.html 로 (마을이 마을 구경을 끝냈다고 기록 · 뽑기 안내 · S4)
        S.skipping = false; stage.speak(undefined); dialog.clear(); S.state = 'end'; ui();
        const url = 'town.html?from=' + enc(S.scene) + (q.get('savekey') ? '&savekey=' + enc(q.get('savekey')) : '');
        S.trace.push({ town: S.scene, url });
        const v = await dialog.card({ kind: 'end', title: '마을로', body: '마을을 둘러보러 가요', buttons: [{ label: '마을로', value: 'go', primary: true }, { label: '처음부터', value: 'again' }] });
        if(g !== S.gen) return;
        if(v === 'go') location.assign(url); else play(S.origin || S.scene);
        return new Promise(() => {});
      }
      case 'cut': {
        S.skipping = false; stage.speak(undefined); dialog.clear(); S.state = 'card'; ui();
        // 컷 표 값: '그림 경로' 또는 { image, caption, fx } · 그림이 없으면 자리표시 카드에 설명(caption)
        //  fx 가 있고 그림이 있으면: 버튼 없이 연출(js/story/fx.js) → 끝나면 저절로 다음 줄 (클릭 · Space · Enter = 건너뛰기)
        const v = CAST.cuts && CAST.cuts[c.id], img = typeof v === 'string' ? v : v && v.image, cap = v && typeof v === 'object' && v.caption;
        const fx = img && v && typeof v === 'object' && v.fx && window.TaleliaStoryFx ? v.fx : null;
        const r = await dialog.card({ kind: 'cut', image: img || null, fx, title: img ? '' : '일러스트 컷 · ' + c.id,
          body: img ? '' : (cap ? cap + ' — ' : '') + '이 자리에 일러스트 컷이 들어갑니다 (자리표시).', buttons: fx ? [] : [{ label: '계속', value: 'next', primary: true }] });
        if(fx) S.trace.push({ cut: c.id, fx: fx.type, result: r });
        return;
      }
    }
  }

  /** 실제 전투로 이동 (돌아오지 않는 약속을 돌려줌 = 이 장면 진행은 여기서 멈춤) */
  function goBattle(c){
    const name = encounterOf(c), stg = stageOfBattle(c);
    S.skipping = false; stage.speak(undefined); dialog.clear(); S.state = 'battle'; ui();
    saveSnap({ scene: S.scene, id: c.id, origin: S.origin, history: S.history });
    setUrl('scene=' + enc(S.scene) + '&at=' + enc(c.id));
    S.pendingBattle = c.id;
    const ret = 'story.html?scene=' + enc(S.scene) + keepParams();
    if(stg){   // 스테이지 전투: 같은 runId · 저장 키로 (시드 = runId · 뽑기 편성 · 장비 미적용) → 돌아올 때 battle · run · result 가 붙음
      location.assign('battle.html?stage=' + enc(stg) + (q.get('run') ? '&run=' + enc(q.get('run')) : '') + (q.get('savekey') ? '&savekey=' + enc(q.get('savekey')) : '') + '&return=' + enc(ret) + (q.has('motion') ? '&motion=' + enc(q.get('motion')) : ''));
      return new Promise(() => {});
    }
    location.assign('battle.html?encounter=' + enc(name) + '&return=' + enc(ret) + '&seed=' + (1 + Math.floor(Math.random() * 99998)) + (q.has('motion') ? '&motion=' + enc(q.get('motion')) : ''));
    return new Promise(() => {});
  }
  /** 뒤로가기로 전투 직전에 돌아옴: 자동으로 다시 보내지 않고 고르게 함 */
  async function battleGate(c, g){
    S.skipping = false; stage.speak(undefined); dialog.clear(); S.state = 'card'; ui();
    const v = await dialog.card({ kind: 'battle', title: '전투 · ' + c.id, body: '전투 직전으로 돌아왔어요.',
      buttons: [{ label: '전투 시작', value: 'go', primary: true }, { label: '이 장면 처음부터', value: 'again' }] });
    if(g !== S.gen) return;
    if(v === 'go'){ if(encounterOf(c)) return goBattle(c); setUrl('scene=' + enc(S.scene)); return exec(c, g); }   // 표에서 빠진 전투면 자리표시 카드로
    if(v === 'again'){ clearSnap(); setUrl('scene=' + enc(S.scene)); play(S.scene); }
    return new Promise(() => {});
  }
  // 전투로 떠났던 이 페이지가 뒤로가기 캐시에서 그대로 되살아난 경우 → 같은 카드
  addEventListener('pageshow', e => { if(e.persisted && S.pendingBattle){ const id = S.pendingBattle; S.pendingBattle = null; play(S.scene, false, { id, gate: true }); } });

  async function say(c, g){
    const ch = c.who && CAST.characters[c.who];
    if(c.who && c.expr) stage.expr(c.who, c.expr);
    const name = c.who ? stage.label(c.who) : c.name;
    if(S.ff){   // 빨리 감기: 표정만 반영 · 로그는 복원하지 못했을 때만 다시 쌓음
      if(!S.ff.restored){ const it = { name, color: ch ? ch.color : null, text: plain(c.segs), narr: !name, who: c.who, expr: c.who && stage.on[c.who] ? stage.on[c.who].expr : null, line: c.line }; dialog.logAdd(it); S.history.push(it); }
      return;
    }
    stage.speak(c.who ? c.who : (c.name ? '?' : null));   // 표에 없는 이름 = 아무도 강조 안 함 · 나머지 어둡게
    const item = { name, color: ch ? ch.color : null, text: plain(c.segs), narr: !name, who: c.who, expr: c.who && stage.on[c.who] ? stage.on[c.who].expr : null, line: c.line };
    dialog.logAdd(item); S.history.push(item);
    S.state = 'typing';
    await dialog.type({ name, color: item.color, segs: c.segs }, { cps: SPEEDS[S.speed].cps, instant: S.skipping || S.instantText });
    if(g !== S.gen) return;
    dialog.ready(true); S.state = 'wait';
    await waitAdvance(autoDelay(item.text));
    if(g !== S.gen) return;
    dialog.ready(false);
  }

  // ---------- 조작 ----------
  function advance(){
    if(dialog.cardOpen()){ dialog.cardSkip(); return; }   // 연출 중인 컷만 건너뜀 (다른 카드는 버튼으로)
    if(dialog.logIsOpen()) return;
    if(dialog.typing){ dialog.finish(); return; }
    if(S.waiting) wake();
  }
  function skip(){
    if(dialog.logIsOpen() || dialog.cardOpen() || S.state === 'end') return;
    S.skipping = true; ui();
    if(dialog.typing) dialog.finish();
    wake(); wakeSleep();
  }
  function setAuto(on){
    S.auto = on == null ? !S.auto : !!on;
    clearTimeout(S.timer);
    if(S.auto && S.waiting && !dialog.typing && !dialog.logIsOpen()) S.timer = setTimeout(wake, S.autoMs);
    ui();
  }
  function openLog(){ clearTimeout(S.timer); dialog.logOpen(); ui(); }
  function closeLog(){ dialog.logClose(); if(S.auto && S.waiting) S.timer = setTimeout(wake, S.autoMs); ui(); root.focus({ preventScroll: true }); }
  function setSpeed(k){ S.speed = SPEEDS[k] ? k : ORDER[(ORDER.indexOf(S.speed) + 1) % ORDER.length]; saveSet({ speed: S.speed }); ui(); }

  const $ = s => document.querySelector(s);
  root.addEventListener('click', e => {
    if(e.target.closest('button, a, select, input, .st-log, .st-card')) return;
    advance();
  });
  document.addEventListener('keydown', e => {
    if(e.target.closest && e.target.closest('select, input, textarea')) return;
    if(e.key === 'Escape' && dialog.logIsOpen()){ closeLog(); e.preventDefault(); return; }
    if(e.ctrlKey || e.metaKey || e.altKey) return;
    const onBtn = e.target.closest && e.target.closest('button');
    if((e.key === ' ' || e.key === 'Enter') && onBtn) return;   // 버튼 위에서는 그 버튼을 누름
    if(e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight'){ advance(); e.preventDefault(); }
    else if(e.key === 'a' || e.key === 'A') setAuto();
    else if(e.key === 'l' || e.key === 'L') dialog.logIsOpen() ? closeLog() : openLog();
  });
  $('#stAuto').addEventListener('click', () => setAuto());
  $('#stSkip').addEventListener('click', skip);
  $('#stLogBtn').addEventListener('click', openLog);
  $('#stSpeed').addEventListener('click', () => setSpeed());
  $('#stLogClose').addEventListener('click', closeLog);
  root.querySelector('.st-log').addEventListener('click', e => { if(e.target === e.currentTarget) closeLog(); });

  // ---------- 아래 도구 줄 (시험용) ----------
  const sel = $('#stScene'), toneSel = $('#stTone');
  function fillScenes(){ sel.textContent = ''; for(const k of Object.keys(STORY.scenes)){ const o = document.createElement('option'); o.value = o.textContent = k; sel.appendChild(o); } }
  fillScenes();
  sel.addEventListener('change', () => play(sel.value));
  toneSel.value = S.tone || '';
  toneSel.addEventListener('change', () => { S.tone = toneSel.value || null; if(S.tone) stage.setTone(S.tone); else play(S.scene); });
  $('#stRestart').addEventListener('click', () => play(S.scene));
  $('#stWarnBtn').addEventListener('click', () => { const p = $('#stWarnList'); p.hidden = !p.hidden; });

  function ui(){
    const a = $('#stAuto'); a.setAttribute('aria-pressed', S.auto); a.classList.toggle('is-on', S.auto);
    $('#stSkip').classList.toggle('is-on', S.skipping);
    $('#stSpeed').textContent = '속도 ' + SPEEDS[S.speed].label;
    $('#stLogBtn').setAttribute('aria-expanded', dialog.logIsOpen());
    if(S.scene && sel.value !== S.scene){ if(![...sel.options].some(o => o.value === S.scene)) fillScenes(); sel.value = S.scene; }
    const w = S.warnings, wb = $('#stWarnBtn');
    wb.textContent = '대본 경고 ' + w.length; wb.classList.toggle('is-bad', w.length > 0);
    $('#stWarnList').textContent = w.length ? w.map(x => (x.line ? x.line + '줄: ' : '') + x.msg).join('\n') : '경고 없음';
    root.dataset.state = S.state;
  }

  S.trace = [];
  window.TaleliaStory = { S, resumeScene, stage, dialog, play, advance, skip, setAuto, setSpeed, openLog, closeLog, SPEEDS, CAST, STORY };
  ui();
  // 시작: 전투 결과를 들고 옴 (?battle=&result=) · 뒤로가기로 전투 직전에 돌아옴 (?at=) · 그 밖에는 장면 처음부터
  //  ?scene 이 없으면 프롤로그 중간 저장(talelia.story.progress)이 있을 때 그 장면부터
  { const scene0 = q.get('scene') || resumeScene() || Object.keys(STORY.scenes)[0], bId = q.get('battle'), bRes = q.get('result'), at = q.get('at');
    if(q.get('scene') && bId && ['win', 'lose', 'error'].includes(bRes)) play(scene0, false, { id: bId, result: bRes });
    else if(q.get('scene') && at) play(scene0, false, { id: at, gate: true });
    else play(scene0); }
})();
