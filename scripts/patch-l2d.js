const fs = require('fs');
const path = require('path');

const targetPath = path.resolve(__dirname, '../node_modules/l2d/dist/index.js');
if (!fs.existsSync(targetPath)) {
  process.exit(0);
}

let code = fs.readFileSync(targetPath, 'utf8');
let modified = false;

// 1. Fix Cubism 6 renderer shaderSets undefined error
if (!code.includes('Dt.getInstance().setGlContext(this.gl)')) {
  const target = 'this.getShader(this.gl);';
  if (code.includes(target)) {
    code = code.replace(target, 'Dt.getInstance().setGlContext(this.gl); this.getShader(this.gl);');
    modified = true;
  }
}

// 2. Fix Live2DCubismCore undefined in strict ESM / Turbopack production chunks
if (!code.includes('var Live2DCubismCore = i;')) {
  code = code.replace(
    'window.Live2DCubismCore = i, console.log = r;',
    'window.Live2DCubismCore = i, globalThis.Live2DCubismCore = i, console.log = r; var Live2DCubismCore = i;'
  );
  modified = true;
}

// 3. Cap DPR for performance
if (!code.includes('window.__L2D_MAX_DPR || 1.25')) {
  code = code.replace(
    /this\.canvas\.width = this\.canvas\.clientWidth \* window\.devicePixelRatio, this\.canvas\.height = this\.canvas\.clientHeight \* window\.devicePixelRatio;/,
    'let dpr = Math.min(window.devicePixelRatio || 1, window.__L2D_MAX_DPR || 1.25);\n\t\tthis.canvas.width = Math.round(this.canvas.clientWidth * dpr);\n\t\tthis.canvas.height = Math.round(this.canvas.clientHeight * dpr);'
  );
  code = code.replace(
    /this\._canvas\.width = this\._canvas\.clientWidth \* window\.devicePixelRatio, this\._canvas\.height = this\._canvas\.clientHeight \* window\.devicePixelRatio;/,
    'let dpr = Math.min(window.devicePixelRatio || 1, window.__L2D_MAX_DPR || 1.25);\n\t\tthis._canvas.width = Math.round(this._canvas.clientWidth * dpr);\n\t\tthis._canvas.height = Math.round(this._canvas.clientHeight * dpr);'
  );
  modified = true;
}

// 4. Frame rate throttle to 60fps on high-refresh displays
if (!code.includes('t - lastTime < 15.5')) {
  code = code.replace(
    /run\(\)\s*\{\s*let e = \(t\) => \{/,
    'run() {\n\t\tthis.stop();\n\t\tlet lastTime = 0;\n\t\tlet e = (t) => {\n\t\t\tif (t && t - lastTime < 15.5) {\n\t\t\t\tthis._drawFrameId = window.requestAnimationFrame(e);\n\t\t\t\treturn;\n\t\t\t}\n\t\t\tlastTime = t || 0;'
  );
  modified = true;
}

// 5. Expose stop/start methods on wrapper
if (!code.includes('this._state.l2d6Model?.stop()')) {
  code = code.replace(
    /destroy\(\)\s*\{\s*this\._state\.l2d2Model/,
    'stop() {\n\t\tthis._state.l2d6Model?.stop();\n\t}\n\tstart() {\n\t\tthis._state.l2d6Model?.run();\n\t}\n\tdestroy() {\n\t\tthis._state.l2d2Model'
  );
  modified = true;
}

if (modified) {
  fs.writeFileSync(targetPath, code, 'utf8');
  console.log('[patch-l2d] Applied l2d runtime patches successfully.');
} else {
  console.log('[patch-l2d] l2d runtime already up to date.');
}
