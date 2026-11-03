// WebGL background: sky colour plus the NASA Milky Way photo map, drawn behind the 2D sky canvas.
// Each screen pixel is turned back into a direction on the sky (undoing the VR lens correction first)
// and looked up in the equirectangular map (equatorial J2000, 0h at the centre, RA increasing to the left).
var SkyGL = function (canvas, url) {
  'use strict';
  var gl = null;
  try { gl = canvas.getContext('webgl', { alpha: false, antialias: false, premultipliedAlpha: false }); } catch (e) {}
  if (!gl) return null;

  var VS = 'attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }';
  var FS = [
    'precision highp float;',
    'uniform sampler2D tex; uniform float ready;',
    'uniform vec2 size; uniform float dpr;',
    'uniform vec2 c; uniform float f; uniform float R; uniform float k;',
    'uniform mat3 T; uniform vec3 up; uniform vec3 east; uniform vec3 north;',
    'uniform vec3 glow; uniform vec3 dome; uniform float cut; uniform float curve;',
    'uniform vec3 sky; uniform float gain;',
    'void main(){',
    '  vec2 px = vec2(gl_FragCoord.x, size.y - gl_FragCoord.y) / dpr;',
    '  vec2 d = px - c;',
    '  if (k > 0.0) { float q = 1.0 - k * dot(d, d) / (R * R); if (q <= 0.02) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; } d /= sqrt(q); }',
    '  vec3 cam = normalize(vec3(d.x / f, -d.y / f, 1.0));',
    '  vec3 v = T * cam;', // the uniform holds the transpose of J2000 -> camera, which takes the ray back to J2000
    '  float alt = dot(up, v);',
    '  vec3 col = sky;',
    // air glow and town light: a smooth falloff from the horizon, stronger toward Cheongju / Osong (east, north-east)
    '  float a = max(alt, 0.0);',
    '  col += glow * exp(-a / 0.16);',
    '  float az = atan(dot(east, v), dot(north, v));',
    '  float w = exp(-pow((az - 1.25) / 0.75, 2.0));',
    '  col += dome * w * exp(-a / 0.11);',
    '  if (ready > 0.5 && gain > 0.0 && alt > 0.0) {',
    '    float ra = atan(v.y, v.x), dec = asin(clamp(v.z, -1.0, 1.0));',
    '    vec2 uv = vec2(0.5 - ra / 6.2831853, 0.5 - dec / 3.1415927);',
    '    vec3 mw = texture2D(tex, uv).rgb;',
    // cut away the faint haze around the band so only the Milky Way itself remains
    '    mw = pow(max(mw - cut, 0.0) / (1.0 - cut), vec3(curve));',
    '    float ext = smoothstep(0.0, 0.42, alt);', // thicker air near the horizon hides the faint band
    '    col += mw * mw * gain * ext + mw * gain * 0.35 * ext;',
    '  }',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  function shader(type, src) {
    var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  var prog;
  try {
    prog = gl.createProgram();
    gl.attachShader(prog, shader(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  } catch (e) { console.warn('SkyGL disabled:', e); return null; }
  gl.useProgram(prog);
  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  var loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  var U = {};
  ['tex', 'ready', 'size', 'dpr', 'c', 'f', 'R', 'k', 'T', 'up', 'east', 'north', 'glow', 'dome', 'cut', 'curve', 'sky', 'gain'].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });

  // ---- illustrations: textured meshes; the art's alpha is its brightness, so nothing but the drawing shows ----
  var AVS = 'attribute vec4 pv; uniform vec2 css; varying vec2 uv; void main(){ uv = pv.zw; gl_Position = vec4(pv.x / css.x * 2.0 - 1.0, 1.0 - pv.y / css.y * 2.0, 0.0, 1.0); }';
  var AFS = 'precision mediump float; uniform sampler2D art; uniform float alpha; varying vec2 uv; void main(){ gl_FragColor = min(texture2D(art, uv) * alpha, vec4(1.0)); }';
  var aprog;
  try {
    aprog = gl.createProgram();
    gl.attachShader(aprog, shader(gl.VERTEX_SHADER, AVS)); gl.attachShader(aprog, shader(gl.FRAGMENT_SHADER, AFS));
    gl.linkProgram(aprog);
    if (!gl.getProgramParameter(aprog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(aprog));
  } catch (e) { console.warn('SkyGL art disabled:', e); aprog = null; }
  var AU = aprog ? { pv: gl.getAttribLocation(aprog, 'pv'), css: gl.getUniformLocation(aprog, 'css'), art: gl.getUniformLocation(aprog, 'art'), alpha: gl.getUniformLocation(aprog, 'alpha') } : null;
  var abuf = gl.createBuffer(), artTex = {};
  function artTexture(key, img) {
    if (artTex[key]) return artTex[key];
    var t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    var pot = (img.width & (img.width - 1)) === 0 && (img.height & (img.height - 1)) === 0;
    if (pot) gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, pot ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return (artTex[key] = t);
  }

  var ready = false;
  var tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 1, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0]));
  var img = new Image();
  img.onload = function () {
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    // no mipmaps: they would draw a seam where RA wraps from 360 to 0
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    ready = true;
  };
  img.src = url;

  var W = 0, H = 0, DPR = 1;
  return {
    hasArt: !!aprog,
    // items: [{ key, img, tris: Float32Array of x,y,u,v (CSS px) per vertex, alpha, clip }]
    drawArt: function (items) {
      if (!aprog || !items.length) return;
      gl.useProgram(aprog);
      gl.bindBuffer(gl.ARRAY_BUFFER, abuf);
      gl.enableVertexAttribArray(AU.pv); gl.vertexAttribPointer(AU.pv, 4, gl.FLOAT, false, 0, 0);
      gl.uniform2f(AU.css, W, H); gl.uniform1i(AU.art, 1);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); // premultiplied over
      gl.enable(gl.SCISSOR_TEST);
      gl.activeTexture(gl.TEXTURE1);
      for (var i = 0; i < items.length; i++) {
        var it = items[i], cl = it.clip;
        gl.scissor(Math.round(cl[0] * DPR), Math.round((H - cl[1] - cl[3]) * DPR), Math.round(cl[2] * DPR), Math.round(cl[3] * DPR));
        gl.bindTexture(gl.TEXTURE_2D, artTexture(it.key, it.img));
        gl.uniform1f(AU.alpha, it.alpha);
        gl.bufferData(gl.ARRAY_BUFFER, it.tris, gl.STREAM_DRAW);
        gl.drawArrays(gl.TRIANGLES, 0, it.tris.length / 4);
      }
      gl.activeTexture(gl.TEXTURE0);
      gl.disable(gl.SCISSOR_TEST); gl.disable(gl.BLEND);
      gl.useProgram(prog);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    },
    resize: function (w, h, dpr) {
      W = w; H = h; DPR = dpr;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    },
    // views: [{cx, cy, f, R, k, clip:[x,y,w,h]}]; T: J2000 -> camera rows; M: J2000 -> East/North/Up rows; sky: rgb 0..1
    // o: { glow, dome (rgb 0..1 added near the horizon), cut, curve (Milky Way clean-up) }
    draw: function (views, T, M, sky, gain, o) {
      var up = M[2];
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(prog);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i(U.tex, 0); gl.uniform1f(U.ready, ready ? 1 : 0);
      gl.uniform2f(U.size, canvas.width, canvas.height); gl.uniform1f(U.dpr, DPR);
      // GLSL mat3 is column-major: uploading T's rows as columns gives the transpose (camera -> J2000)
      gl.uniformMatrix3fv(U.T, false, new Float32Array([T[0][0], T[0][1], T[0][2], T[1][0], T[1][1], T[1][2], T[2][0], T[2][1], T[2][2]]));
      gl.uniform3f(U.up, up[0], up[1], up[2]);
      gl.uniform3f(U.sky, sky[0], sky[1], sky[2]);
      gl.uniform1f(U.gain, gain);
      gl.uniform3f(U.east, M[0][0], M[0][1], M[0][2]); gl.uniform3f(U.north, M[1][0], M[1][1], M[1][2]);
      gl.uniform3f(U.glow, o.glow[0], o.glow[1], o.glow[2]); gl.uniform3f(U.dome, o.dome[0], o.dome[1], o.dome[2]);
      gl.uniform1f(U.cut, o.cut); gl.uniform1f(U.curve, o.curve);
      gl.enable(gl.SCISSOR_TEST);
      for (var i = 0; i < views.length; i++) {
        var v = views[i], cl = v.clip;
        gl.scissor(Math.round(cl[0] * DPR), Math.round((H - cl[1] - cl[3]) * DPR), Math.round(cl[2] * DPR), Math.round(cl[3] * DPR));
        gl.uniform2f(U.c, v.cx, v.cy); gl.uniform1f(U.f, v.f); gl.uniform1f(U.R, v.R); gl.uniform1f(U.k, v.k);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
      gl.disable(gl.SCISSOR_TEST);
    }
  };
};
