/* 뽑기 캐릭터 리그 공용 틀 (간이 리그 동작 · 캐릭터마다 숫자만 바꿈)
 *
 * 간이 리그 = 측면 기준 전신 1장만으로 만드는 리그 (다람쥐 · 두더지 · 오리)
 *   조각 id (모두 기준 전신 좌표):
 *     body    몸 한 덩어리 (무기 묶음을 오려 낸 나머지 · 다리 · 귀 포함) · 부모 없음 · 회전 중심 = 엉덩이
 *     weapon  무기 든 팔 + 무기 · 부모 body · 회전 중심 = 어깨
 *     eye     눈 4종 (normal = 기준 전신 그대로 · closed · angry · hurt = tools/rig_parts.py 의 eye 로 그림) · 부모 body
 *     (선택) tail · ear 등 출렁이는 부속 · 부모 body · springs 로 움직임
 *   동작: 다리가 따로 없으므로 걷기 대신 통통 뛰기 · 몸 늘었다 줄기 · 기울이기 · 점프
 *
 * window.TALELIA_RIG_KIT.simpleClips(opt)
 *   opt.wUp     무기를 든(준비) 각도 (도 · 시계 방향 +)      opt.wDown  내려친(맞는 순간) 각도
 *   opt.attack  'swing' (근접: 앞으로 내디디며 휘두름) | 'throw' (원거리: 제자리에서 던짐 · shoot → hit)
 *   opt.skill   'slam' (점프해 내려찍기) | 'combo' (두 번 연타) | 'whirl' (돌리다 던짐) | 'heal' (지팡이를 들어 치유)
 *   opt.jump    필살기 점프 높이 (기준 전신 px · 기본 키의 10%)
 *   opt.height  키 (기준 전신 px · 움직임 크기를 키에 맞춤)
 *   opt.extra   { 부속 id: 출렁임 크기(도) } 대기 · 돌진 때 같이 흔들 부속
 *   이벤트: hit (맞는 순간) · shake (화면 흔들림) · shoot (던짐 · 투사체 시작) · heal (치유 빛)
 */
(function () {
  'use strict';
  function K(t, p, ease) { return { t: t, p: p, ease: ease }; }
  function mix(a, b) { var o = {}, k; for (k in a) o[k] = a[k]; for (k in b) o[k] = Object.assign({}, o[k] || {}, b[k]); return o; }

  function simpleClips(opt) {
    var H = opt.height || 1100, u = H / 1129;               // 농부 토끼 키 기준 비율
    var up = opt.wUp != null ? opt.wUp : -15, down = opt.wDown != null ? opt.wDown : 15;
    var jump = opt.jump != null ? opt.jump : H * 0.1, extra = opt.extra || {};
    var px = function (v) { return v * u; };
    function ex(scale) { var o = {}; for (var id in extra) o[id] = { r: extra[id] * scale }; return o; }

    // 대기: 1.6초 · 몸이 위로 늘었다 줄고 무기 · 부속이 반 박자 늦게
    var idleA = mix({ root: {}, body: {}, weapon: { r: 0 } }, ex(0));
    var idleB = mix({ root: {}, body: { sy: 1.03, sx: 0.985 }, weapon: { r: (up < 0 ? -1 : 1) * 2.5, y: px(-3) } }, ex(1));
    var idle = { dur: 1.6, loop: true, ease: 'smooth', blend: 0.25, keys: [K(0, idleA), K(0.8, idleB), K(1.6, idleA)],
      eyes: [{ t: 0, eye: 'normal' }, { t: 1.25, eye: 'closed' }, { t: 1.36, eye: 'normal' }] };

    // 돌진: 0.45초에 통통 두 번 (공중에서 늘고 땅에서 납작)
    function hopPose(y, sq) { return mix({ root: { r: 8, y: px(y) }, body: { sx: 2 - sq, sy: sq }, weapon: { r: up * 0.35 } }, ex(-0.8)); }
    var dash = { dur: 0.45, loop: true, ease: 'smooth', blend: 0.1,
      keys: [K(0, hopPose(0, 0.94)), K(0.1125, hopPose(-40, 1.05)), K(0.225, hopPose(0, 0.94)), K(0.3375, hopPose(-40, 1.05)), K(0.45, hopPose(0, 0.94))],
      eyes: [{ t: 0, eye: 'normal' }] };

    // 기본 공격
    var ready = { root: { r: 2 }, weapon: { r: up * 0.2 } };
    var attack;
    if (opt.attack === 'throw') {   // 원거리: 제자리에서 뒤로 젖혔다 던짐 (0.3 = 던짐 · 0.55 = 맞음)
      var back = mix({ root: { x: px(-10), r: -7 }, body: { sx: 0.97, sy: 1.03 }, weapon: { r: up } }, ex(0.8));
      var rel = mix({ root: { x: px(10), r: 8 }, body: { sx: 1.03, sy: 0.97 }, weapon: { r: down } }, ex(-1));
      attack = { dur: 0.7, loop: false, blend: 0.06,
        keys: [K(0, ready), K(0.2, back, 'out'), K(0.26, back, 'inout'), K(0.3, rel, 'in'), K(0.45, rel, 'out'), K(0.7, { root: { r: 2 }, weapon: { r: down * 0.3 } }, 'inout')],
        eyes: [{ t: 0, eye: 'normal' }, { t: 0.14, eye: 'angry' }, { t: 0.5, eye: 'normal' }],
        events: [{ t: 0.3, name: 'shoot' }, { t: 0.55, name: 'hit' }] };
    } else {                        // 근접: 들었다가 앞으로 내디디며 내려침 (0.28 = 맞음)
      var wind = mix({ root: { x: px(-12), r: -6 }, body: { sx: 0.97, sy: 1.03 }, weapon: { r: up, y: px(-8) } }, ex(0.8));
      var strike = mix({ root: { x: px(42), r: 11 }, body: { sx: 1.04, sy: 0.96 }, weapon: { r: down, x: px(10), y: px(6) } }, ex(-1));
      var follow = { root: { x: px(46), r: 9 }, weapon: { r: down * 0.85 } };
      attack = { dur: 0.7, loop: false, blend: 0.06,
        keys: [K(0, ready), K(0.16, wind, 'out'), K(0.2, wind, 'inout'), K(0.28, strike, 'in'), K(0.4, follow, 'out'), K(0.52, follow, 'inout'),
          K(0.7, { root: { x: px(20), r: 4 }, weapon: { r: down * 0.25 } }, 'inout')],
        eyes: [{ t: 0, eye: 'normal' }, { t: 0.14, eye: 'angry' }, { t: 0.5, eye: 'normal' }],
        events: [{ t: 0.28, name: 'hit' }] };
    }

    // 필살기
    var skill, crouch = mix({ root: { r: -3, y: px(6) }, body: { sx: 1.06, sy: 0.93 }, weapon: { r: up } }, ex(0.6));
    if (opt.skill === 'combo') {    // 두 번 연타 (0.3 · 0.62 = 맞음)
      var hitA = mix({ root: { x: px(46), r: 11 }, body: { sx: 1.04, sy: 0.96 }, weapon: { r: down } }, ex(-1));
      var reA = { root: { x: px(40), r: 2 }, body: { sx: 0.98, sy: 1.02 }, weapon: { r: up } };
      skill = { dur: 1.0, loop: false, blend: 0.06,
        keys: [K(0, ready), K(0.18, crouch, 'out'), K(0.3, hitA, 'in'), K(0.36, hitA, 'out'), K(0.5, reA, 'inout'), K(0.62, hitA, 'in'), K(0.75, hitA, 'out'),
          K(1.0, { root: { x: px(20), r: 3 }, weapon: { r: down * 0.25 } }, 'inout')],
        eyes: [{ t: 0, eye: 'normal' }, { t: 0.12, eye: 'angry' }, { t: 0.88, eye: 'normal' }],
        events: [{ t: 0.3, name: 'hit' }, { t: 0.62, name: 'hit' }, { t: 0.62, name: 'shake' }] };
    } else if (opt.skill === 'whirl') {   // 제자리에서 두 바퀴 돌리다 던짐 (0.7 = 던짐 · 0.95 = 맞음)
      var a = mix({ root: { r: -4 }, weapon: { r: up } }, ex(0.5)), b = mix({ root: { r: 2 }, weapon: { r: down } }, ex(-0.5));
      var throwP = mix({ root: { x: px(12), r: 10 }, body: { sx: 1.04, sy: 0.96 }, weapon: { r: down } }, ex(-1));
      skill = { dur: 1.2, loop: false, blend: 0.06,
        keys: [K(0, ready), K(0.15, a, 'out'), K(0.3, b, 'inout'), K(0.45, a, 'inout'), K(0.58, b, 'inout'), K(0.64, a, 'inout'), K(0.7, throwP, 'in'),
          K(0.9, throwP, 'out'), K(1.2, { root: { r: 2 } }, 'inout')],
        eyes: [{ t: 0, eye: 'normal' }, { t: 0.1, eye: 'angry' }, { t: 1.05, eye: 'normal' }],
        events: [{ t: 0.7, name: 'shoot' }, { t: 0.95, name: 'hit' }, { t: 0.95, name: 'shake' }] };
    } else if (opt.skill === 'heal') {    // 지팡이를 높이 들고 몸을 쭉 폄 (0.5 = 치유 빛)
      var lift = mix({ root: { y: px(-14), r: -3 }, body: { sx: 0.96, sy: 1.06 }, weapon: { r: up, y: px(-12) } }, ex(0.8));
      skill = { dur: 1.0, loop: false, blend: 0.08,
        keys: [K(0, ready), K(0.2, crouch, 'out'), K(0.45, lift, 'out'), K(0.7, lift, 'inout'), K(1.0, {}, 'inout')],
        eyes: [{ t: 0, eye: 'normal' }, { t: 0.3, eye: 'closed' }, { t: 0.8, eye: 'normal' }],
        events: [{ t: 0.5, name: 'heal' }] };
    } else {                        // slam: 점프해 내려찍기 (0.62 = 맞음 · 흔들림)
      var jumpP = mix({ root: { x: px(40), y: -jump, r: -7 }, body: { sx: 0.96, sy: 1.05 }, weapon: { r: up, y: px(-12) } }, ex(1.2));
      var slam = mix({ root: { x: px(80), r: 14 }, body: { sx: 1.07, sy: 0.93 }, weapon: { r: down, x: px(12), y: px(10) } }, ex(-1.2));
      skill = { dur: 1.1, loop: false, blend: 0.08,
        keys: [K(0, ready), K(0.2, crouch, 'out'), K(0.42, jumpP, 'out'), K(0.62, slam, 'in'), K(0.66, slam, 'out'),
          K(0.86, { root: { x: px(80), r: 12 }, weapon: { r: down * 0.9 } }, 'inout'), K(1.1, { root: { x: px(30), r: 3 }, weapon: { r: down * 0.25 } }, 'inout')],
        eyes: [{ t: 0, eye: 'normal' }, { t: 0.16, eye: 'angry' }, { t: 0.95, eye: 'normal' }],
        events: [{ t: 0.62, name: 'hit' }, { t: 0.62, name: 'shake' }] };
    }

    // 피격 · 복귀 · 기본 자세
    var hitP = mix({ root: { x: px(-44), r: -11, fl: 1 }, body: { sx: 1.04, sy: 0.95 }, weapon: { r: -up * 0.4 } }, ex(1.4));
    var hit = { dur: 0.55, loop: false, blend: 0.03,
      keys: [K(0, {}), K(0.06, hitP, 'out'), K(0.22, { root: { x: px(-50), r: -7, fl: 0.15 }, weapon: { r: -up * 0.2 } }, 'inout'), K(0.55, {}, 'inout')],
      eyes: [{ t: 0, eye: 'hurt' }, { t: 0.42, eye: 'normal' }] };
    var hop = { dur: 0.42, loop: false, blend: 0.08,
      keys: [K(0, { root: { r: 4 } }), K(0.08, { root: { r: -4 }, body: { sx: 1.05, sy: 0.94 } }, 'out'),
        K(0.22, mix({ root: { y: px(-70), r: -8 }, body: { sx: 0.97, sy: 1.04 }, weapon: { r: up * 0.5 } }, ex(1)), 'out'),
        K(0.34, { root: { y: 0, r: 0 }, body: { sx: 1.05, sy: 0.94 } }, 'in'), K(0.42, {}, 'out')],
      eyes: [{ t: 0, eye: 'normal' }] };
    return { bind: { dur: 1, loop: true, keys: [K(0, {}), K(1, {})] }, idle: idle, dash: dash, attack: attack, skill: skill, hit: hit, hop: hop };
  }

  // 출렁이는 부속의 기본 관성 값 (귀 · 꼬리 · 깃털)
  function springsFor(ids) {
    return ids.map(function (id) { return { part: id, k: 110, d: 8, gx: /tail/.test(id) ? 0.005 : -0.008, max: /tail/.test(id) ? 16 : 22 }; });
  }

  window.TALELIA_RIG_KIT = { simpleClips: simpleClips, springsFor: springsFor, K: K, mix: mix };
})();
