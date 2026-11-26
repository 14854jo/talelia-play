/* =====================================================================
 * TALELIA · town/assets.js — 그래픽 매니페스트 검사 · 키 찾기 · 그림 불러오기 · 투명도 마스크
 *
 *  - 화면(DOM)을 바꾸지 않는 순수 모듈입니다. 실제 교체는 gfx.js 가 합니다.
 *  - 서버를 부르지 않습니다. 그림은 <img> 로만 불러오며 fetch · XHR 를 쓰지 않습니다.
 *  - 경로는 매니페스트 base 아래 상대 경로만 허용 (외부 주소 · '..' · '/' 시작 금지).
 *    검사 페이지에서만 allowInline 옵션으로 blob: · data: 주소를 허용합니다 (메모리 안 시험 그림).
 *  - 설계: docs/graphics/02_RENDERING_SWAP_DESIGN.md · 03_ASSET_MANIFEST_DESIGN.md
 * ===================================================================== */
(function(){
  const MAX_UNIQUE = 80;
  const MAX_AREA = 448 * 384 * 1.25;   // 규격서 가장 큰 캔버스의 1.25배 넘으면 경고

  /** 매니페스트 검사 → { ok, scale, base, tiles: {키: 항목}, objects: {키: 항목}, errors, warnings } */
  function validate(man, ctx, opts){
    const o = opts || {}, errors = [], warnings = [], out = { ok: false, scale: 2, base: '', tiles: {}, objects: {}, errors, warnings };
    if(!man || typeof man !== 'object'){ errors.push('매니페스트 없음'); return out; }
    if(man.version !== 1){ errors.push('version 이 1 이 아님 (' + man.version + ') → 매니페스트 전체 무시'); return out; }
    out.scale = Number(man.scale) > 0 ? Number(man.scale) : 2;
    out.base = typeof man.base === 'string' ? man.base : '';
    if(!pathOk(out.base, false, true)){ errors.push('base 경로가 허용되지 않음: ' + out.base + ' → 매니페스트 전체 무시'); return out; }

    const norm = (key, e, isTile) => {
      const list = Array.isArray(e.variants) ? e.variants : (e.src ? [e.src] : []);
      if(!list.length){ errors.push(key + ': src 또는 variants 가 없음'); return null; }
      const vs = [];
      for(const v of list){
        const it = typeof v === 'string' ? { src: v } : Object.assign({}, v);
        it.size = it.size || e.size; it.anchor = it.anchor || e.anchor;
        if(!pathOk(it.src, o.allowInline)){ errors.push(key + ': 허용되지 않는 경로 ' + String(it.src)); return null; }
        if(!pair(it.size) || it.size[0] <= 0 || it.size[1] <= 0){ errors.push(key + ': size 가 올바르지 않음'); return null; }
        if(!pair(it.anchor)){ errors.push(key + ': anchor 가 올바르지 않음'); return null; }
        if(it.anchor[0] < 0 || it.anchor[1] < 0 || it.anchor[0] > it.size[0] || it.anchor[1] > it.size[1]){ errors.push(key + ': anchor 가 그림 밖'); return null; }
        if(!isTile && Math.abs(it.anchor[0] - it.size[0] / 2) > 2 * out.scale) warnings.push(key + ': anchor 가 가로 가운데가 아님 (' + it.anchor[0] + ' / ' + it.size[0] + ')');
        if(isTile && (it.size[0] !== 128 || it.size[1] !== 64)) warnings.push(key + ': 타일 크기가 규격(128×64)과 다름');
        if(it.size[0] * it.size[1] > MAX_AREA) warnings.push(key + ': 그림이 규격 상한보다 큼 (' + it.size.join('×') + ')');
        it.url = isInline(it.src) ? it.src : out.base + it.src;
        vs.push(it);
      }
      return Object.assign({}, e, { key, variants: vs });
    };

    const tileKeys = new Set(ctx.tileKeys || []);
    Object.keys(man.tiles || {}).forEach(k => {
      if(!tileKeys.has(k)){ errors.push('tiles.' + k + ': 알 수 없는 바닥 종류 → 무시'); return; }
      const e = norm('tiles.' + k, man.tiles[k], true); if(e) out.tiles[k] = e;
    });
    const objKeys = ctx.objectKeys || {};   // 키 → { art, w, d }
    Object.keys(man.objects || {}).forEach(k => {
      const info = objKeys[k];
      if(!info){ errors.push('objects.' + k + ': 알 수 없는 키 → 무시'); return; }
      const e = man.objects[k];
      if(!pair(e.footprint) || e.footprint[0] !== info.w || e.footprint[1] !== info.d){ errors.push('objects.' + k + ': footprint ' + JSON.stringify(e.footprint) + ' ≠ 배치 데이터 ' + info.w + '×' + info.d + ' → 무시 (바닥 크기는 buildings.js 가 정함)'); return; }
      if(e.shadow != null && !(['footprint', 'blob', 'none'].includes(e.shadow) || typeof e.shadow === 'object')) warnings.push('objects.' + k + ': shadow 값을 모름 → 기본값');
      if(e.fx && !Array.isArray(e.fx)) warnings.push('objects.' + k + ': fx 는 배열이어야 함');
      const n = norm('objects.' + k, e, false); if(n) out.objects[k] = n;
    });
    const uniq = new Set(); [out.tiles, out.objects].forEach(g => Object.values(g).forEach(e => e.variants.forEach(v => uniq.add(v.url))));
    if(uniq.size > MAX_UNIQUE) warnings.push('고유 그림 ' + uniq.size + '장 > 상한 ' + MAX_UNIQUE);
    out.unique = uniq.size;
    out.ok = !errors.length;
    return out;
  }
  const pair = a => Array.isArray(a) && a.length === 2 && a.every(n => typeof n === 'number' && isFinite(n));
  const isInline = s => /^(blob|data):/i.test(String(s));
  function pathOk(s, allowInline, isBase){
    s = String(s == null ? '' : s);
    if(isInline(s)) return !!allowInline && !isBase;
    if(isBase && s === '') return true;
    if(!s || /^[a-z][a-z0-9+.-]*:/i.test(s) || s.startsWith('/') || s.startsWith('\\') || /(^|[\\/])\.\.([\\/]|$)/.test(s)) return false;
    return true;
  }

  /** 배치 하나의 매니페스트 키 후보 (렌더링 설계서 4장 순서) */
  function objectKeys(art, variant, axis){
    const out = [];
    if(variant != null && axis) out.push(art + '_' + variant + '_' + axis);
    if(variant != null) out.push(art + '_' + variant);
    if(axis) out.push(art + '_' + axis);
    out.push(art);
    return out;
  }
  /** 키 찾기 → { key, entry, variant } 또는 null. rnd(0~1)로 변형을 고정 선택 */
  function resolveObject(checked, art, variant, axis, rnd){
    for(const k of objectKeys(art, variant, axis)){
      const e = checked.objects[k];
      if(e) return { key: k, entry: e, variant: e.variants[Math.min(e.variants.length - 1, Math.floor((rnd || 0) * e.variants.length))] };
    }
    return null;
  }

  /* ---------- 그림 불러오기 (한 번만 · 실패도 기억) ---------- */
  const cache = new Map(), miss = new Set();
  const stats = { requested: 0, loaded: 0, failed: 0, masks: 0, maskFailed: 0 };
  function load(url, expect){
    if(miss.has(url)) return Promise.reject(new Error('이전에 실패한 그림'));
    if(cache.has(url)) return cache.get(url);
    stats.requested++;
    const p = new Promise((ok, no) => {
      const img = new Image();
      img.decoding = 'async';
      img.onerror = () => no(new Error('불러오기 실패'));
      img.onload = () => {
        const dec = img.decode ? img.decode() : Promise.resolve();
        dec.then(() => {
          if(expect && (img.naturalWidth !== expect[0] || img.naturalHeight !== expect[1])) throw new Error('그림 크기 ' + img.naturalWidth + '×' + img.naturalHeight + ' ≠ size ' + expect.join('×'));
          ok({ img, w: img.naturalWidth, h: img.naturalHeight });
        }).catch(no);
      };
      img.src = url;
    }).then(r => { stats.loaded++; return r; }, e => { stats.failed++; miss.add(url); cache.delete(url); throw e; });
    cache.set(url, p);
    return p;
  }

  /** 투명도 마스크 (화면 px 크기 · 1바이트). 같은 서버 그림만 가능 — file:// 등에서 막히면 null */
  const masks = new Map();
  function mask(url, img, cssW, cssH){
    if(masks.has(url)) return masks.get(url);
    let m = null;
    try{
      const w = Math.max(1, Math.round(cssW)), h = Math.max(1, Math.round(cssH));
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const g = cv.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, w, h);
      const d = g.getImageData(0, 0, w, h).data, a = new Uint8Array(w * h);
      for(let i = 0; i < a.length; i++) a[i] = d[i * 4 + 3];
      m = { w, h, a }; stats.masks++;
    }catch(e){ m = null; stats.maskFailed++; }
    masks.set(url, m);
    return m;
  }

  window.TaleliaTownAssets = Object.freeze({ validate, objectKeys, resolveObject, load, mask, pathOk, stats, miss });
})();
