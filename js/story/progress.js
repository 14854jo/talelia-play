/* =====================================================================
 * TALELIA · story/progress.js — 프롤로그 진행 규칙 (지인 배포 5단계)
 *
 *  P.started(save)       마을 구경을 끝낸 저장인가 = stage.intro 가 참 · 또는 클리어 기록 · 또는 뽑기 기록이 있음
 *                        (저장이 없거나 모양이 다르면 false) — 마을 [스토리] 칸 · 배포 입구(index.html)가 씀
 *  P.isPrologue(id)      프롤로그 장면인가 (prologue_* · ch1_01 마을 구경)
 *  중간 저장 = 지금 보는 프롤로그 장면 이름만 따로 기록 (뽑기 저장 talelia.gacha.v1 은 건드리지 않음)
 *   P.key(savekey)       기록 칸 이름: talelia.story.progress (시험용 ?savekey=X 이면 talelia.story.progress:X)
 *   P.write(id, savekey, storage?)   프롤로그 장면이면 기록 · 아니면 아무것도 안 함
 *   P.read(savekey, storage?)        기록된 장면 이름 (없거나 망가지면 null)
 *   P.clear(savekey, storage?)       지움 ([처음부터 다시] · 마을 구경을 끝냈을 때)
 *  모두 저장 공간을 못 써도 오류 없이 넘어감.
 * ===================================================================== */
(function(root){
  'use strict';
  const BASE = 'talelia.story.progress';
  const key = savekey => savekey ? BASE + ':' + savekey : BASE;
  const isPrologue = id => typeof id === 'string' && (/^prologue_[0-9a-z]+$/.test(id) || id === 'ch1_01');
  const store = s => { if(s) return s; try{ return root.localStorage; }catch(e){ return null; } };

  function started(save){
    if(!save || typeof save !== 'object') return false;
    const t = save.stage && typeof save.stage === 'object' ? save.stage : null;
    if(t && t.intro === true) return true;
    if(t && t.cleared && typeof t.cleared === 'object' && Object.keys(t.cleared).length > 0) return true;
    return !!(save.stats && typeof save.stats === 'object' && Number(save.stats.pulls) > 0);
  }
  function write(id, savekey, storage){
    if(!isPrologue(id)) return false;
    try{ const s = store(storage); if(!s) return false; s.setItem(key(savekey), JSON.stringify({ v: 1, scene: id })); return true; }catch(e){ return false; }
  }
  function read(savekey, storage){
    try{
      const s = store(storage), raw = s && s.getItem(key(savekey)); if(raw == null) return null;
      const o = JSON.parse(raw); return o && isPrologue(o.scene) ? o.scene : null;
    }catch(e){ return null; }
  }
  function clear(savekey, storage){ try{ const s = store(storage); if(s) s.removeItem(key(savekey)); }catch(e){} }

  root.TaleliaProgress = Object.freeze({ BASE, key, isPrologue, started, write, read, clear });
})(typeof window !== 'undefined' ? window : globalThis);
