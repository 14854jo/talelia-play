/* =====================================================================
 * TALELIA · story/parser.js — 대본 글 → 명령 목록 (화면 코드 없음 · 검사 페이지에서 단독으로 시험)
 *
 *  parse(text, cast) → { title, cmds: [...], warnings: [{ line, msg }], cast: [쓰인 캐릭터 id] }
 *
 *  대본 한 줄 = 명령 하나 (빈 줄 · // 로 시작하는 줄은 건너뜀)
 *    # 제목                         장면 제목 (처음 한 번)
 *    이름(표정): 대사               표정을 바꾸고 말함 (표정은 그 뒤에도 유지)
 *    이름: 대사                     지금 표정 그대로 말함
 *    : 나레이션                     이름 없음 = 나레이션 (모두 어둡게)
 *    대사 안: {쉼} 0.4초 멈춤 · {쉼 1.2} 1.2초 · {줄} 줄 바꿈  ({쉼} 은 띄어쓰기를 넣지 않음 → "낮춰. {쉼}경비가") · {이름} 지금 주인공 이름 (24호 · 엘피 모두 받침이 없어 가 · 는 · 를 가 그대로 맞음)
 *    @배경 이름 | 없음              @톤 기본 | 연구소
 *    @등장 이름 위치 [표정]         위치 = 왼쪽 · 가운데 · 오른쪽
 *    @퇴장 이름 | 모두              @표정 이름 표정        @위치 이름 위치
 *    @이름표 이름 표시글 | (비우면 원래대로)                 예) @이름표 24호 ???
 *    @이름 24호 | 엘피 | 자동        주인공 이름 (이 줄부터 · 이름표 + 대사 속 {이름}) · 자동 = 저장에 이름이 지어졌으면 엘피 아니면 24호
 *                                   (이 줄이 없으면 24호 고정 → 프롤로그 · 데모는 그대로 · docs/design/chapter1-script-wiring.md)
 *    @대기 초                       @컷 이름               @이동 장면
 *    @전투 이름 [승리→장면] [패배→장면]   (1단계: 자리표시 카드 · 승리/패배를 눌러 고름)
 *    @스테이지 1-1                  장면을 끝내고 스테이지 화면(stage.html)으로 (전투 결과 · runId 를 들고 감 · S3)
 *    @마을                          장면을 끝내고 마을로 가는 카드 (마더의 마을 구경 끝 · S3)
 *    @선택                          (예약 · 아직 지원하지 않음)
 *
 *  이름 · 표정은 data/story/cast.js 표에서 찾음. 표에 없는 이름 = 이름표만 (경고), 없는 표정 = 기본 표정 (경고).
 *  "???" 처럼 물음표 · 점만으로 된 이름은 경고 없이 이름표만.
 *  그림 없는 캐릭터(cast.js portrait: null)는 대사 · @등장 · @퇴장을 그대로 받고, 무대에는 그리지 않음 (stage.js).
 *  처음 나오는 # 줄 = 장면 제목 → 장면마다 "# 장면id · 제목" 한 줄만 두고 구분선 · 메모는 파일 맨 위 설명으로.
 * ===================================================================== */
(function(){
  'use strict';
  const POS = { '왼쪽': 'left', '가운데': 'center', '오른쪽': 'right' };
  const TONE = { '기본': 'base', '연구소': 'lab' };

  // 이름 → 캐릭터 id (별칭 포함)
  function indexCast(cast){
    const by = {};
    const chars = (cast && cast.characters) || {};
    for(const id in chars){ by[id] = id; for(const n of chars[id].names || []) by[n] = id; }
    return by;
  }

  // 대사 글 → 조각 [{ text } | { pause: 초 } | { br: true }]
  function segments(text, warn, hero){
    const out = [], re = /\{([^{}]*)\}/g; let last = 0, m;
    const push = s => { if(s) out.push({ text: s }); };
    while((m = re.exec(text))){
      push(text.slice(last, m.index)); last = re.lastIndex;
      const tag = m[1].trim().split(/\s+/);
      if(tag[0] === '쉼'){ const s = tag[1] == null ? 0.4 : parseFloat(tag[1]); if(isFinite(s) && s >= 0) out.push({ pause: s }); else warn('{쉼} 뒤 숫자를 읽지 못함: ' + m[0]); }
      else if(tag[0] === '줄') out.push({ br: true });
      else if(tag[0] === '이름' && hero != null) push(hero);
      else { warn('알 수 없는 꾸밈 ' + m[0] + ' (글자 그대로 표시)'); push(m[0]); }
    }
    push(text.slice(last));
    return out;
  }

  // opts = { named: 저장에 이름이 지어졌나 (@이름 자동 에 씀), heroNames: { before, after } }
  function parse(text, cast, opts){
    opts = opts || {};
    const HERO = Object.assign({ before: '24호', after: '엘피' }, opts.heroNames || {});
    let hero = HERO.before;   // 지금 주인공 이름 ({이름}) · @이름 으로 바뀜
    const by = indexCast(cast), chars = (cast && cast.characters) || {}, bgs = (cast && cast.backgrounds) || {};
    const res = { title: '', cmds: [], warnings: [], cast: [] };
    const used = new Set();
    const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');

    lines.forEach((raw, i) => {
      const n = i + 1, line = raw.trim();
      const warn = msg => res.warnings.push({ line: n, msg });
      const push = c => { c.line = n; res.cmds.push(c); return c; };
      if(!line || line.startsWith('//')) return;

      // 캐릭터 찾기 (없으면 경고 후 null)
      const who = (name, need) => {
        const id = by[name];
        if(id){ used.add(id); return id; }
        if(need) warn('등장인물 표에 없는 이름: ' + name);
        return null;
      };
      const expr = (id, e) => {
        if(!e) return null;
        const ex = chars[id] && chars[id].expressions || {};
        if(ex[e]) return e;
        if(chars[id] && chars[id].fixed) return e;   // 표정 없는 캐릭터(fixed): 어떤 표정이든 같은 그림 · 경고 없음
        if(chars[id] && chars[id].portrait === null){ warn(chars[id].label + ' 은 그림 없는 캐릭터라 표정을 쓸 수 없음: ' + e + ' (무시)'); return null; }
        warn((chars[id] ? chars[id].label : id) + ' 에게 없는 표정: ' + e + ' (기본 표정 사용 · 있는 표정: ' + Object.keys(ex).join(' · ') + ')');
        return null;
      };
      const pos = (p, dflt) => { if(p == null) return dflt; if(POS[p]) return POS[p]; warn('알 수 없는 위치: ' + p + ' (왼쪽 · 가운데 · 오른쪽)'); return dflt; };

      if(line.startsWith('#')){ if(!res.title) res.title = line.replace(/^#+\s*/, ''); return; }

      if(line.startsWith('@')){
        const parts = line.slice(1).trim().split(/\s+/), op = parts[0], a = parts.slice(1);
        switch(op){
          case '배경':
            if(!a[0]) return warn('@배경 뒤에 이름이 없음');
            if(a[0] === '없음') return void push({ t: 'bg', id: null });
            if(!bgs[a[0]]) warn('배경 표에 없는 이름: ' + a[0] + ' (단색 바탕)');
            return void push({ t: 'bg', id: a[0] });
          case '톤':
            if(!TONE[a[0]]) return warn('알 수 없는 톤: ' + (a[0] || '(없음)') + ' (기본 · 연구소)');
            return void push({ t: 'tone', v: TONE[a[0]] });
          case '등장': {
            const id = who(a[0], true); if(!id) return;
            return void push({ t: 'enter', who: id, pos: pos(a[1], 'center'), expr: expr(id, a[2]) });
          }
          case '퇴장':
            if(a[0] === '모두') return void push({ t: 'exit', who: '*' });
            { const id = who(a[0], true); if(id) push({ t: 'exit', who: id }); } return;
          case '표정': {
            const id = who(a[0], true); if(!id) return;
            if(!a[1]) return warn('@표정 뒤에 표정 이름이 없음');
            const e = expr(id, a[1]); if(e) push({ t: 'expr', who: id, expr: e }); return;
          }
          case '위치': {
            const id = who(a[0], true); if(!id) return;
            const p = pos(a[1], null); if(p) push({ t: 'move', who: id, pos: p }); return;
          }
          case '이름': {
            const v = a[0] === '자동' ? (opts.named ? HERO.after : HERO.before) : a[0] === '엘피' ? HERO.after : a[0] === '24호' ? HERO.before : null;
            if(v == null) return warn('@이름 뒤에는 24호 · 엘피 · 자동 중 하나: ' + (a[0] || '(없음)'));
            hero = v; return void push({ t: 'heroname', label: v });
          }
          case '이름표': {
            const id = who(a[0], true); if(!id) return;
            return void push({ t: 'nameplate', who: id, label: a.slice(1).join(' ') || null });
          }
          case '대기': {
            const s = parseFloat(a[0]);
            if(!(s >= 0)) return warn('@대기 뒤 숫자를 읽지 못함: ' + (a[0] || '(없음)'));
            return void push({ t: 'wait', s });
          }
          case '컷':
            if(!a[0]) return warn('@컷 뒤에 이름이 없음');
            return void push({ t: 'cut', id: a[0] });
          case '이동':
            if(!a[0]) return warn('@이동 뒤에 장면 이름이 없음');
            return void push({ t: 'goto', scene: a[0] });
          case '전투': {
            if(!a[0]) return warn('@전투 뒤에 이름이 없음');
            const c = { t: 'battle', id: a[0], win: null, lose: null };
            for(const p of a.slice(1)){
              const m = /^(승리|패배)(?:→|->)(.+)$/.exec(p);
              if(!m) { warn('@전투 뒤 읽지 못한 부분: ' + p + ' (예: 승리→ch1_02)'); continue; }
              c[m[1] === '승리' ? 'win' : 'lose'] = m[2];
            }
            return void push(c);
          }
          case '스테이지':
            if(!/^\d{1,2}-\d{1,2}$/.test(a[0] || '')) return warn('@스테이지 뒤에 스테이지 번호가 없음 (예: @스테이지 1-1)');
            return void push({ t: 'stage', id: a[0] });
          case '마을': return void push({ t: 'town' });
          case '선택': return warn('@선택 은 아직 지원하지 않음 (건너뜀)');
          default: return warn('알 수 없는 명령: @' + op);
        }
      }

      // 대사: 이름(표정): 대사 · 이름: 대사 · : 나레이션 (괄호 · 쌍점은 전각도 받음)
      const m = /^([^:：(（]*?)\s*(?:[(（]([^)）]*)[)）])?\s*[:：]\s?(.*)$/.exec(line);
      if(!m){ warn('형식을 알 수 없는 줄 → 나레이션으로 표시 (대사는 "이름: 대사")'); push({ t: 'say', who: null, name: '', expr: null, segs: segments(line, warn, hero), text: line }); return; }
      const name = m[1].trim(), body = m[3].trim();
      if(!body) warn('대사가 비어 있음');
      if(!name){
        if(m[2]) warn('나레이션에는 표정을 쓸 수 없음: (' + m[2] + ')');
        push({ t: 'say', who: null, name: '', expr: null, segs: segments(body, warn, hero), text: body });
        return;
      }
      const anon = /^[?？.…·\s]+$/.test(name);
      const id = anon ? null : who(name, true);
      push({ t: 'say', who: id, name, expr: id ? expr(id, m[2] && m[2].trim()) : (m[2] && warn('표에 없는 이름이라 표정을 쓸 수 없음: (' + m[2] + ')'), null),
             segs: segments(body, warn, hero), text: body });
    });

    res.cast = [...used];
    return res;
  }

  // 대사 글자 수 (자동 진행 시간 · 한 글자씩 출력에 씀) — 한글 완성형은 한 글자, 그림 문자 · 조합 문자도 한 덩어리
  function chars(s){
    if(typeof Intl !== 'undefined' && Intl.Segmenter){ return [...new Intl.Segmenter('ko', { granularity: 'grapheme' }).segment(s)].map(x => x.segment); }
    return Array.from(s);
  }

  window.TaleliaStoryParser = { parse, segments, chars, POS, TONE };
})();
