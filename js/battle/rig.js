/* 파츠 리그 재생기 (실험체 24호 측면 전투 애니메이션)
 *
 * 리그 데이터(data/rigs/*.js)는 모든 조각을 "기준 전신(01_base.png) 좌표"로 적는다.
 *   at    : 기본 자세에서 조각 그림의 중심 위치
 *   rot   : 기본 자세에서 조각 그림의 회전(도, 시계 방향 +)
 *   pivot : 관절(회전 중심) 위치
 *   parent: 부모 조각. 부모가 움직이면 따라 움직인다(없으면 root)
 * 동작(clip)은 기본 자세에서 "얼마나 바뀌는지"만 적는다.
 *   r(회전 도) x·y(이동 px) sx·sy(배율) a(투명도)   - 적지 않은 값은 기본(0 / 배율 1 / 투명도 1)
 *   root 의 x·y·r 은 몸 전체, root.fl 은 피격 번쩍임(0~1)
 *   eyes: [{ t, eye: 'normal' | 'closed' | 'angry' | 'hurt' }]  (그 시각부터 바뀜)
 * 망토 · 귀 · 꼬리는 springs 로 몸의 움직임에 늦게 따라온다(관성).
 *
 * 범용 기능 2개 (뽑기 5단계 · 안 쓰는 리그 = 24호는 그림 · 동작이 한 칸도 안 바뀜 · tests/fixtures/rig-s24-golden.js)
 *  1) 코드로 그리는 층 def.paint = [{ z, fn(ctx, api) }]  조각 사이(z 순서)에 끼워 그림 (투석끈 · 원형 궤적 같은 것)
 *     ctx 는 기준 전신 좌표로 맞춰져 있음 · api = { rig, pose, t, pt(조각 id, x, y) }
 *     pt = 그 조각에 붙은 기준 좌표 점이 지금 자세에서 있는 기준 좌표 (예: 손 위치)
 *     그림 없는 조각(img · imgs 가 없음)은 "움직이는 값 묶음"으로만 씀 → 동작 키에 pose[id].r · x · y · sx · sy · a 를 적어 paint 가 읽음
 *  2) 잔상 clip.ghost = { n, gap, alpha: [...], filter? }  지난 자세 n 장(gap 초 간격)을 alpha 로 겹쳐 그림 (그 동작을 하는 동안만)
 */
(function () {
  'use strict';
  var D2R = Math.PI / 180;
  var EASE = {
    linear: function (t) { return t; },
    in: function (t) { return t * t * t; },
    out: function (t) { return 1 - Math.pow(1 - t, 3); },
    inout: function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
    outback: function (t) { var c = 1.6, u = t - 1; return 1 + (c + 1) * u * u * u + c * u * u; },
    hold: function () { return 0; }
  };
  var DEF = { r: 0, x: 0, y: 0, sx: 1, sy: 1, a: 1, fl: 0 };

  // 2D 행렬 [a b c d e f]
  function mul(m, n) {
    return [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
      m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
  }
  function tr(x, y) { return [1, 0, 0, 1, x, y]; }
  function rot(deg) { var c = Math.cos(deg * D2R), s = Math.sin(deg * D2R); return [c, s, -s, c, 0, 0]; }
  function scl(x, y) { return [x, 0, 0, y, 0, 0]; }
  // pivot 기준 회전 · 배율, 그다음 이동
  function local(ch, pv) {
    var m = tr(ch.x + pv[0], ch.y + pv[1]);
    if (ch.r) m = mul(m, rot(ch.r));
    if (ch.sx !== 1 || ch.sy !== 1) m = mul(m, scl(ch.sx, ch.sy));
    return mul(m, tr(-pv[0], -pv[1]));
  }

  // variant: 축소 사본(def.variants[이름] = { base, ext, scale, size: { 원본 파일: [폭, 높이] } }) - 없으면 원본
  function loadImages(def, base, variant) {
    var jobs = [], imgs = {}, v = variant && def.variants && def.variants[variant];
    def.parts.forEach(function (p) {
      var files = p.imgs ? p.imgs : (p.img ? { _: p.img } : {});   // 그림 없는 조각 = 값 묶음 (paint 가 읽음)
      Object.keys(files).forEach(function (k) {
        jobs.push(new Promise(function (ok, fail) {
          var im = new Image(), f = files[k], sz = v && v.size && v.size[f];
          im.onload = function () { if (sz) { im._w = sz[0]; im._h = sz[1]; } imgs[p.id + ':' + k] = im; ok(); }; // 사본은 원본 크기로 늘려 그림
          im.onerror = function () { fail(new Error('rig image ' + f)); };
          im.src = v ? v.base + f.replace(/\.[a-z0-9]+$/i, v.ext || '.webp') : base + f;
        }));
      });
    });
    return Promise.all(jobs).then(function () { return imgs; });
  }

  // 키 사이 보간. 키마다 적지 않은 채널은 기본값으로 본다.
  var PDEF = {}; // 조각별 기본값 (예: 평소엔 숨긴 망토 자락 def: { a: 0 })
  function chan(key, id, c) {
    var p = key.p && key.p[id];
    if (p && p[c] != null) return p[c];
    var d = PDEF[id]; return d && d[c] != null ? d[c] : DEF[c];
  }
  function sampleClip(clip, t, ids) {
    var keys = clip.keys, n = keys.length, out = {}, i, eye = null, ev = clip.eyes || [];
    for (i = 0; i < ev.length && ev[i].t <= t; i++) eye = ev[i].eye; // 눈은 따로 적은 시각에 바로 바뀜
    if (!eye && clip.loop && ev.length) eye = ev[ev.length - 1].eye;
    var j = 0; while (j < n - 1 && keys[j + 1].t <= t) j++;
    var a = keys[j], b = keys[Math.min(j + 1, n - 1)];
    var span = b.t - a.t, u = span > 0 ? Math.min(1, Math.max(0, (t - a.t) / span)) : 0;
    var ez = b.ease || clip.ease || 'inout';
    var smooth = ez === 'smooth', k = smooth ? u : (EASE[ez] || EASE.inout)(u);
    var a0 = keys[Math.max(0, j - 1)], b1 = keys[Math.min(n - 1, j + 2)];
    if (clip.loop) { if (j === 0) a0 = keys[n - 2] || a; if (j + 2 > n - 1) b1 = keys[1] || b; }
    ids.forEach(function (id) {
      var o = {};
      for (var c in DEF) {
        var va = chan(a, id, c), vb = chan(b, id, c);
        if (smooth) { // Catmull-Rom: 키를 지나며 멈추지 않고 흐르게
          var p0 = chan(a0, id, c), p3 = chan(b1, id, c), u2 = u * u, u3 = u2 * u;
          o[c] = 0.5 * (2 * va + (-p0 + vb) * u + (2 * p0 - 5 * va + 4 * vb - p3) * u2 + (-p0 + 3 * va - 3 * vb + p3) * u3);
        } else o[c] = va + (vb - va) * k;
        if (c === 'a' && va !== vb) o[c] = u < 0.5 ? va : vb; // 보였다/숨었다는 반투명 없이 한 번에
      }
      out[id] = o;
    });
    out._eye = eye;
    return out;
  }

  function Rig(def, imgs) {
    this.def = def; this.imgs = imgs;
    this.ids = ['root'].concat(def.parts.map(function (p) { return p.id; }));
    this.byId = {}; var self = this;
    def.parts.forEach(function (p) { self.byId[p.id] = p; if (p.def) PDEF[p.id] = p.def; });
    this.order = def.parts.concat((def.paint || []).map(function (L) { return { _paint: L, z: L.z }; })).sort(function (a, b) { return a.z - b.z; });
    this.hist = []; this.hclock = 0;   // 잔상 기록
    this.springs = (def.springs || []).map(function (s) { return { s: s, v: 0, vel: 0 }; });
    this.clipName = null; this.clip = null; this.t = 0; this.speed = 1;
    this.pose = sampleClip({ keys: [{ t: 0 }] }, 0, this.ids);
    this.from = null; this.blend = 0; this.blendT = 0;
    this.prevRoot = null; this.vx = 0; this.vy = 0; this.extVx = 0;
    this.eye = def.eyeDefault || 'normal';
    this.firedUpTo = -1;
  }
  Rig.prototype.has = function (name) { return !!this.def.clips[name]; };
  Rig.prototype.duration = function (name) { var c = this.def.clips[name]; return c ? c.dur : 0; };
  // name 동작 시작. opt: { speed, blend(초), onEvent(name), onEnd() }
  Rig.prototype.play = function (name, opt) {
    var clip = this.def.clips[name]; if (!clip) return;
    opt = opt || {};
    this.from = this.pose; this.blend = opt.blend != null ? opt.blend : (clip.blend != null ? clip.blend : 0.08); this.blendT = 0;
    this.clipName = name; this.clip = clip; this.t = 0; this.speed = opt.speed || 1;
    this.onEvent = opt.onEvent || null; this.onEnd = opt.onEnd || null; this.firedUpTo = -1;
  };
  Rig.prototype.update = function (dt) {
    var clip = this.clip; if (!clip) return;
    dt = Math.min(dt, 0.05);
    var t0 = this.t; this.t += dt * this.speed;
    var ended = false;
    if (clip.loop) { if (this.t >= clip.dur) this.t %= clip.dur; }
    else if (this.t >= clip.dur) { this.t = clip.dur; ended = true; }
    // 이벤트(이번 프레임에 지난 것)
    if (clip.events && this.onEvent) {
      var self = this;
      clip.events.forEach(function (e, i) {
        var passed = clip.loop ? (t0 <= e.t && e.t < self.t) || (self.t < t0 && (e.t >= t0 || e.t < self.t)) : (i > self.firedUpTo && e.t <= self.t);
        if (passed) { if (!clip.loop) self.firedUpTo = i; self.onEvent(e.name); }
      });
    }
    var p = sampleClip(clip, this.t, this.ids);
    if (this.from && this.blendT < this.blend) { // 앞 동작에서 부드럽게 넘어가기
      this.blendT += dt * this.speed;
      var w = EASE.inout(Math.min(1, this.blendT / this.blend)), f = this.from;
      this.ids.forEach(function (id) { for (var c in DEF) p[id][c] = c === 'a' ? (w < 0.5 ? f[id][c] : p[id][c]) : f[id][c] + (p[id][c] - f[id][c]) * w; });
    }
    this.eye = p._eye || this.def.eyeDefault || 'normal';
    // 관성(망토 · 귀 · 꼬리): 몸의 가로 속도 · 세로 속도에 늦게 반응
    var rx = p.root.x + this.extX(), ry = p.root.y;
    if (this.prevRoot) {
      var ivx = (rx - this.prevRoot[0]) / Math.max(dt, 1e-3), ivy = (ry - this.prevRoot[1]) / Math.max(dt, 1e-3);
      this.vx += (ivx - this.vx) * Math.min(1, dt * 18); this.vy += (ivy - this.vy) * Math.min(1, dt * 18);
    }
    this.prevRoot = [rx, ry];
    var vx = this.vx, vy = this.vy;
    this.springs.forEach(function (sp) {
      var s = sp.s, target = Math.max(-s.max, Math.min(s.max, vx * (s.gx || 0) + vy * (s.gy || 0)));
      var acc = s.k * (target - sp.v) - s.d * sp.vel;
      sp.vel += acc * dt; sp.v += sp.vel * dt;
      p[s.part][s.ch || 'r'] += sp.v;
    });
    this.pose = p;
    if (clip.ghost) {   // 잔상: 지난 자세를 gap 초 간격으로 모아 둠
      this.hclock += dt * this.speed;
      var g = clip.ghost, last = this.hist[this.hist.length - 1];
      if (!last || this.hclock - last.t >= g.gap) this.hist.push({ t: this.hclock, pose: JSON.parse(JSON.stringify(p)), eye: this.eye });
      while (this.hist.length > g.n + 1) this.hist.shift();
    } else if (this.hist.length) this.hist = [];
    if (ended) { var cb = this.onEnd; this.onEnd = null; if (cb) cb(); }
  };
  // 화면에서 캐릭터 자체가 움직이는 속도(px/s, 기준 전신 단위) - 돌진 중 망토가 날리게
  Rig.prototype.extX = function () { return this._ext || 0; };
  Rig.prototype.setExternalX = function (x) { this._ext = x; };

  Rig.prototype.world = function () { return this.worldOf(this.pose); };
  // 조각에 붙은 기준 좌표 점 (x, y) 이 지금 자세에서 있는 기준 좌표
  Rig.prototype.pt = function (id, x, y, W) {
    var m = (W || this.world())[id]; if (!m) return [x, y];
    return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  };
  Rig.prototype.worldOf = function (pose) {
    var def = this.def, W = {};
    var r = pose.root;
    W.root = local(r, def.rootPivot);
    var self = this;
    function get(id) {
      if (W[id]) return W[id];
      var p = self.byId[id], par = p.parent ? get(p.parent) : W.root;
      return (W[id] = mul(par, local(pose[id], p.pivot)));
    }
    def.parts.forEach(function (p) { get(p.id); });
    return W;
  };
  // ctx 에 그리기. x,y = 발 밑 기준점의 화면 위치(CSS px), h = 화면 키(px), facing 1 = 오른쪽, dpr = 기기 배율
  Rig.prototype.draw = function (ctx, x, y, h, facing, dpr) {
    var def = this.def, W = this.world(), d = dpr || 1, s = h / def.height * d, pose = this.pose;
    var view = [s * (facing || 1), 0, 0, s, x * d, y * d];
    view = mul(view, tr(-def.anchor[0], -def.anchor[1]));
    var fl = Math.max(0, Math.min(1, pose.root.fl || 0));
    // 잔상 (그 동작에 clip.ghost 가 있을 때만): 지난 자세를 먼저 옅게 깔아 둠
    var gh = this.clip && this.clip.ghost;
    if (gh && this.hist.length > 1) {
      var self = this, hs = this.hist.slice(0, -1), al = gh.alpha || [0.3, 0.15];
      hs.forEach(function (e, k) {
        var a = al[hs.length - 1 - k]; if (!a) return;
        self.drawParts(ctx, e.pose, self.worldOf(e.pose), view, e.eye, a, gh.filter, false);
      });
    }
    // 피격 번쩍임: 캐릭터를 따로 그린 뒤 그 모양 위에만 붉은빛을 씌움(흰 털 · 붉은 망토 모두 같은 색으로 번쩍)
    var out = ctx, cv = ctx.canvas;
    if (fl > 0.01 && cv) {
      var off = this._off || (this._off = document.createElement('canvas'));
      if (off.width !== cv.width || off.height !== cv.height) { off.width = cv.width; off.height = cv.height; }
      ctx = off.getContext('2d'); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, off.width, off.height);
    }
    this.drawParts(ctx, pose, W, view, this.eye, 1, null, true);
    if (ctx !== out) {
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.filter = 'none';
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = 'rgba(255, 72, 52, ' + (0.55 * fl).toFixed(3) + ')';
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.restore();
      out.save(); out.setTransform(1, 0, 0, 1, 0, 0); out.globalAlpha = 1; out.filter = 'none';
      out.drawImage(ctx.canvas, 0, 0); out.restore();
    }
  };
  // 조각 · 코드로 그리는 층을 z 순서로 그림 (alphaMul < 1 = 잔상 · withPaint = 코드로 그리는 층 포함)
  Rig.prototype.drawParts = function (ctx, pose, W, view, eye, alphaMul, ghostFilter, withPaint) {
    var imgs = this.imgs, self = this;
    ctx.save();
    this.order.forEach(function (p) {
      if (p._paint) {
        if (!withPaint) return;
        ctx.save(); ctx.setTransform(view[0], view[1], view[2], view[3], view[4], view[5]); ctx.globalAlpha = 1; ctx.filter = 'none';
        try { p._paint.fn(ctx, { rig: self, pose: pose, W: W, t: self.t, pt: function (id, x, y) { return self.pt(id, x, y, W); } }); } catch (e) { if (window.console) console.warn('rig paint', e); }
        ctx.restore(); return;
      }
      var ch = pose[p.id]; if (ch.a <= 0.001) return;
      var im = p.imgs ? imgs[p.id + ':' + eye] || imgs[p.id + ':normal'] : imgs[p.id + ':_'];
      if (!im) return;
      var m0 = mul(view, W[p.id]), m = mul(m0, mul(tr(p.at[0], p.at[1]), rot(p.rot || 0)));
      if (p.clip) { // 기준 전신 좌표의 사각형 안만 그림 (조각과 함께 움직임)
        ctx.save(); ctx.setTransform(m0[0], m0[1], m0[2], m0[3], m0[4], m0[5]);
        ctx.beginPath();
        if (Array.isArray(p.clip[0])) { p.clip.forEach(function (q, i) { if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); }); ctx.closePath(); }
        else ctx.rect(p.clip[0], p.clip[1], p.clip[2], p.clip[3]);
        ctx.clip();
      }
      ctx.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);
      ctx.globalAlpha = ch.a * alphaMul;
      ctx.filter = ghostFilter && alphaMul < 1 ? ghostFilter : (p.shade ? 'brightness(' + p.shade + ')' : 'none'); // 먼 쪽 조각은 어둡게
      var iw = im._w || im.width, ih = im._h || im.height; // 축소 사본은 원본 크기(기준 전신 px)로 늘려 그림
      ctx.drawImage(im, -iw / 2, -ih / 2, iw, ih);
      if (p.clip) ctx.restore();
    });
    ctx.restore();
  };

  window.TaleliaRig = {
    load: function (def, base, variant) { return loadImages(def, base, variant).then(function (imgs) { return new Rig(def, imgs); }); },
    EASE: EASE
  };
})();
