/* =====================================================================
 * TALELIA · names.js — 주인공 표시 이름 (24호 → 엘피) · 순수 규칙 + 화면 데이터 덮어쓰기 (서버 · 전투 규칙을 부르지 않음)
 *  설계: docs/design/chapter1-script-wiring.md · 데이터: data/names.js (window.TALELIA_NAMES)
 *
 *  const N = TaleliaNames
 *   N.isNamed(save)              이름이 지어진 뒤인가 (stage.cleared['1-1'] · 저장이 없거나 모양이 달라도 false)
 *   N.nameOf(id, save, kind)     kind = 'game'(기본) | 'call' | 'full' · 이름 규칙에 없는 캐릭터는 null
 *   N.nameOfNamed(id, named, kind)  named(true/false)로 바로
 *   N.readSave(key, storage?)    localStorage 의 뽑기 저장을 읽기만 함 (없거나 망가지면 null · 쓰지 않음)
 *   N.apply(save)                화면 데이터의 표시 이름을 저장에 맞춤 (몇 번 불러도 같음 · 되돌리기도 가능)
 *                                뽑기 도감(species.name) · 전투 데이터(allies.name) · 마을(INFO.name)
 *                                대화 이름표는 바꾸지 않음 (장면마다 @이름 이 정함 · 프롤로그 다시 보기는 늘 24호)
 *   N.applyFromStorage(key)      readSave → apply (페이지가 시작할 때 한 번)
 *  캐릭터 id · 저장 내용은 바꾸지 않음. 불러오지 않는 곳(시험의 순수 규칙 경로)은 옛 이름 그대로.
 * ===================================================================== */
(function(root){
  'use strict';
  const D = () => root.TALELIA_NAMES;
  const DEFAULT_KEY = 'talelia.gacha.v1';

  function isNamed(save){
    const d = D(); if(!d) return false;
    const c = save && save.stage && typeof save.stage === 'object' ? save.stage.cleared : null;
    return !!(c && typeof c === 'object' && c[d.namedAt]);
  }
  function nameOfNamed(id, named, kind){
    const d = D(), e = d && d.chars[id]; if(!e) return null;
    return (named ? e.after : e.before)[kind || 'game'] || null;
  }
  const nameOf = (id, save, kind) => nameOfNamed(id, isNamed(save), kind);

  function readSave(key, storage){
    try{
      const st = storage || root.localStorage, raw = st.getItem(key || DEFAULT_KEY);
      if(raw == null) return null;
      const s = JSON.parse(raw); return s && typeof s === 'object' ? s : null;
    }catch(e){ return null; }
  }

  function apply(save){
    const d = D(); if(!d) return false;
    const named = isNamed(save);
    for(const id in d.chars){
      const e = d.chars[id], game = nameOfNamed(id, named, 'game');
      const sp = root.TALELIA_GACHA && root.TALELIA_GACHA.species && root.TALELIA_GACHA.species[id]; if(sp) sp.name = game;
      const bp = root.TALELIA_BATTLE_PROTO && root.TALELIA_BATTLE_PROTO.allies; if(bp) for(const a of bp) if(a.id === e.battleId) a.name = game;
      const info = root.TaleliaTownActors && root.TaleliaTownActors.INFO && root.TaleliaTownActors.INFO[e.battleId]; if(info) info.name = game;
    }
    return named;
  }
  const applyFromStorage = key => apply(readSave(key));

  root.TaleliaNames = Object.freeze({ isNamed, nameOf, nameOfNamed, readSave, apply, applyFromStorage });
})(typeof window !== 'undefined' ? window : globalThis);
