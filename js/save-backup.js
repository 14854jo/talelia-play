/* =====================================================================
 * TALELIA · save-backup.js — 저장 백업 · 불러오기 · 초기화 (지인 배포 3단계 · 화면 없음 · 서버 없음)
 *  저장 형식은 그대로 (뽑기 저장 v4 · localStorage 글 그대로가 백업 파일) → 나중에 계정 저장을 붙여도 같은 글을 씀
 *
 *  const B = TaleliaSaveBackup
 *   B.fileName(date)                   'talelia-save-2026-11-26-1430.json'
 *   B.read(storage, key)               지금 저장 글 (없으면 null) · 쓰지 않음
 *   B.inspect(deps, text)              deps = { G, D, Q?, E? } → { ok, save, summary } | { ok: false, reason }   (아무것도 쓰지 않음)
 *     migrate 는 빠진 칸을 채우고 버전을 덮어쓰므로, 그 전에 원본의 버전 · 필수 칸부터 봄 (빈 파일 · 새 버전이 새 저장처럼 통과하지 않게)
 *   B.restore(storage, key, save)      덮어쓰기 직전 저장을 key + '.before-import' 에 한 번 보관한 뒤 씀 · 보관이나 쓰기에 실패하면 기존 저장 그대로 → { ok, kept, reason }
 *   B.reset(storage, key)              저장을 지움 (다음에 열면 새 저장) → { ok, reason }
 * ===================================================================== */
(function(root){
  'use strict';
  const KEEP_SUFFIX = '.before-import';
  const MAX_CHARS = 2 * 1000 * 1000;
  const bad = reason => ({ ok: false, reason });
  const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
  const count = n => Number.isInteger(n) && n >= 0;

  function fileName(date){
    const d = date || new Date(), p = n => String(n).padStart(2, '0');
    return 'talelia-save-' + d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()) + '.json';
  }
  function read(storage, key){ try{ return storage.getItem(key); }catch(e){ return null; } }

  function inspect(deps, text){
    const { G, D, Q, E } = deps;
    if(typeof text !== 'string' || !text.trim()) return bad('빈 파일이에요.');
    if(text.length > MAX_CHARS) return bad('파일이 너무 커요.');
    let raw; try{ raw = JSON.parse(text.replace(/^﻿/, '')); }catch(e){ return bad('테일리아 백업 파일이 아니에요. (읽을 수 없는 형식)'); }
    if(!isObj(raw) || !Number.isInteger(raw.v) || raw.v < 1) return bad('테일리아 백업 파일이 아니에요.');
    if(raw.v > G.SAVE_VERSION) return bad('더 새로운 버전의 저장이라 불러올 수 없어요. (파일 ' + raw.v + ' · 지금 게임 ' + G.SAVE_VERSION + ')');
    if(!Array.isArray(raw.units) || !raw.units.length || !Array.isArray(raw.party) || !count(raw.stones)) return bad('백업 파일에 필요한 내용이 빠져 있어요.');
    if(raw.v === G.SAVE_VERSION && !(isObj(raw.stage) && isObj(raw.stats))) return bad('백업 파일에 필요한 내용이 빠져 있어요.');
    let save, problems;
    try{
      save = G.migrate(D, raw);
      problems = G.checkSave(D, save).concat(Q && E ? Q.checkSave(E, D, save) : []);
      if(!isObj(save.seen) || !Array.isArray(save.history)) problems.push('기록 모양이 틀림');
    }catch(e){ problems = [e.message]; }
    if(problems.length) return bad('백업 파일의 내용이 망가져 있어요. (' + problems[0] + ')');
    return { ok: true, save, summary: { cleared: Object.keys(save.stage.cleared).sort(), units: save.units.length, stones: save.stones } };
  }

  function restore(storage, key, save){
    const old = read(storage, key);
    if(old != null){
      try{ storage.setItem(key + KEEP_SUFFIX, old); }catch(e){ return bad('지금 저장을 보관하지 못해서 불러오기를 멈췄어요.'); }
    }
    try{ storage.setItem(key, JSON.stringify(save)); }catch(e){ return bad('저장 공간에 쓰지 못했어요.'); }
    return { ok: true, kept: old != null };
  }
  function reset(storage, key){
    try{ storage.removeItem(key); }catch(e){ return bad('저장을 지우지 못했어요.'); }
    return { ok: true };
  }

  const api = Object.freeze({ KEEP_SUFFIX, MAX_CHARS, fileName, read, inspect, restore, reset });
  if(typeof module !== 'undefined' && module.exports) module.exports = api; else root.TaleliaSaveBackup = api;
})(typeof window !== 'undefined' ? window : globalThis);
