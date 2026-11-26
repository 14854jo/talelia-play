/* =====================================================================
 * TALELIA · gacha/store.js — 뽑기 · 수집 저장 (이 브라우저의 localStorage 만 · 서버 · Supabase 연결 없음)
 *
 *  const st = TaleliaGachaStore.create(data, { storage, key })   storage 를 안 주면 window.localStorage (시험용으로 가짜를 넘길 수 있음) · key 기본 talelia.gacha.v1
 *   st.load()            → { save, status }  status = new(처음) · loaded · migrated(빠진 필드 채움) · corrupt(망가짐 → 따로 보관 후 새로) · memory(저장 막힘)
 *   st.save(save)        → true | false (false = 이 기기에 저장되지 않음 · 메모리에서만 유지)
 *   st.reset()           → 새 저장으로 (기존 저장은 백업 키로 옮김)
 *   st.exportText(save)  → JSON 글 (백업)
 *   st.importText(text)  → { ok, save, reason }  모양 검사를 통과해야 받아들임 (받아들이면 저장까지)
 *   st.onChange(fn)      다른 탭에서 바뀌면 fn(새 저장)
 *   st.available         저장 가능 여부 · st.KEY
 *  망가진 저장은 지우지 않고 KEY + '.broken.' + 시각 으로 옮겨 둠 (최근 3개만)
 * ===================================================================== */
(function(root){
  'use strict';
  const DEFAULT_KEY = 'talelia.gacha.v1';

  function create(D, opts){
    opts = opts || {};
    const KEY = opts.key || DEFAULT_KEY;   // 시험용으로 다른 키를 쓸 수 있음 (실제 저장을 건드리지 않게)
    const G = root.TaleliaGacha;
    let storage = opts.storage, available = true;
    try{ if(!storage) storage = root.localStorage; const t = KEY + '.__probe'; storage.setItem(t, '1'); storage.removeItem(t); }catch(e){ available = false; }
    const get = k => { try { return storage.getItem(k); } catch(e){ return null; } };
    const set = (k, v) => { try { storage.setItem(k, v); return true; } catch(e){ return false; } };
    const del = k => { try { storage.removeItem(k); } catch(e){} };
    const now = () => (opts.now ? opts.now() : Date.now());

    function keepBroken(raw){
      if(raw == null) return null;
      const k = KEY + '.broken.' + now(); set(k, raw);
      // 오래된 백업은 3개만 남김
      try{ const ks = []; for(let i = 0; i < storage.length; i++){ const n = storage.key(i); if(n && n.indexOf(KEY + '.broken.') === 0) ks.push(n); }
        ks.sort().slice(0, Math.max(0, ks.length - 3)).forEach(del); }catch(e){}
      return k;
    }
    function load(){
      if(!available) return { save: G.newSave(D), status: 'memory' };
      const raw = get(KEY);
      if(raw == null){ const s = G.newSave(D); set(KEY, JSON.stringify(s)); return { save: s, status: 'new' }; }
      let s = null; try { s = JSON.parse(raw); } catch(e){}
      if(s && typeof s === 'object'){
        let m = null, problems; const before = JSON.stringify(s);
        try { m = G.migrate(D, s); problems = G.checkSave(D, m); } catch(e){ problems = ['읽는 중 오류: ' + e.message]; }
        if(!problems.length){ const changed = JSON.stringify(m) !== before; if(changed) set(KEY, JSON.stringify(m)); return { save: m, status: changed ? 'migrated' : 'loaded' }; }
        const backup = keepBroken(raw), fresh = G.newSave(D); set(KEY, JSON.stringify(fresh));
        return { save: fresh, status: 'corrupt', backup, problems };
      }
      const backup = keepBroken(raw), fresh = G.newSave(D); set(KEY, JSON.stringify(fresh));
      return { save: fresh, status: 'corrupt', backup, problems: ['JSON 이 아님'] };
    }
    function save(s){ return available && set(KEY, JSON.stringify(s)); }
    function reset(){ keepBroken(get(KEY)); const s = G.newSave(D); save(s); return s; }
    function exportText(s){ return JSON.stringify(s, null, 1); }
    function importText(text){
      let s = null; try { s = JSON.parse(text); } catch(e){ return { ok: false, reason: 'JSON 이 아님' }; }
      if(!s || typeof s !== 'object') return { ok: false, reason: '저장 모양이 아님' };
      let m = null, P; try { m = G.migrate(D, s); P = G.checkSave(D, m); } catch(e){ P = ['읽는 중 오류: ' + e.message]; }
      if(P.length) return { ok: false, reason: P.join(' · ') };
      save(m); return { ok: true, save: m };
    }
    function onChange(fn){
      if(!root.addEventListener) return () => {};
      const h = e => { if(e.key !== KEY || e.newValue == null) return; try { const s = G.migrate(D, JSON.parse(e.newValue)); if(!G.checkSave(D, s).length) fn(s); } catch(err){} };
      root.addEventListener('storage', h); return () => root.removeEventListener('storage', h);
    }
    return { KEY, get available(){ return available; }, load, save, reset, exportText, importText, onChange };
  }

  root.TaleliaGachaStore = Object.freeze({ KEY: DEFAULT_KEY, create });
})(typeof window !== 'undefined' ? window : globalThis);
