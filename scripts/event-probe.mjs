/**
 * Event Probe — 前端事件排查工具
 *
 * 用法（浏览器 DevTools Console 中粘贴）：
 *
 *   // 探测拖拽事件在 .doc-outline 内的流向
 *   probe('.doc-outline', 'dragstart drag dragenter dragover dragleave drop dragend')
 *
 *   // 探测点击事件穿透
 *   probe('.outline-item', 'click mousedown mouseup')
 *
 *   // 探测 focus/blur
 *   probe('.ProseMirror', 'focus blur')
 *
 *   // 指定阶段（默认 bubble，加 true 切到 capture）
 *   probe('.doc-outline', 'dragover', true)
 *
 * 输出格式：
 *   📍 [捕获|冒泡] .target-class#target-id
 *   🎯 event.type @ element.tagName.className
 *   ⏱ 时间戳 + 距上次事件 ms
 */

(function (global) {
  const probes = new Map();
  let lastTime = 0;

  global.probe = function (selector, eventTypes, useCapture = false) {
    const el = document.querySelector(selector);
    if (!el) { console.warn(`⚠ probe: 未找到 "${selector}"`); return; }

    const types = eventTypes.split(/\s+/).filter(Boolean);
    const phase = useCapture ? '🔼捕获' : '🔽冒泡';

    const handlers = types.map(type => {
      const handler = (e) => {
        const now = performance.now();
        const dt = lastTime ? (now - lastTime).toFixed(1) : '—';
        lastTime = now;

        const target = e.target;
        const tCls = target?.className?.slice(0, 60) || '(no class)';
        const tId = target?.id || '(no id)';
        const tTag = target?.tagName?.toLowerCase() || '?';

        // 事件路径：从 target 到 selector 的路径
        let path = '';
        let node = target;
        while (node && node !== document.body) {
          const c = node.className?.slice?.(0, 20) || '';
          path += ` ← ${node.tagName?.toLowerCase() || '?'}${c ? '.' + c : ''}`;
          if (node === el) break;
          node = node.parentElement;
        }

        // 关键状态
        const extra = [];
        if (e.defaultPrevented) extra.push('preventDefaulted');
        if (e.type === 'dragover' || e.type === 'drop') {
          extra.push(`dropEffect=${e.dataTransfer?.dropEffect || 'none'}`);
          extra.push(`effectAllowed=${e.dataTransfer?.effectAllowed || 'none'}`);
          extra.push(`types=[${Array.from(e.dataTransfer?.types || []).join(',')}]`);
        }
        if (e.type === 'dragstart') {
          extra.push(`effectAllowed=${e.dataTransfer?.effectAllowed || 'none'}`);
        }

        console.log(
          `%c📍 ${phase} ${type}`,
          'color:#B7FF00;font-weight:bold',
          `\n  🎯 target: <${tTag}${tId ? '#'+tId : ''} class="${tCls}">`,
          `\n  🛤 ${path}`,
          `\n  ⏱ +${dt}ms ${extra.length ? '| ' + extra.join(' | ') : ''}`
        );

        if (e.type === 'drop' || e.type === 'dragend') {
          console.log('%c━━━ 拖拽结束 ━━━', 'color:#888');
        }
      };
      el.addEventListener(type, handler, useCapture);
      return { type, handler, phase };
    });

    probes.set(selector + ':' + eventTypes, { el, handlers });
    console.log(`%c🔍 probe 已启动: "${selector}" → [${types.join(', ')}] (${phase})`, 'color:#B7FF00');
    console.log(`   元素: <${el.tagName.toLowerCase()}${el.id ? '#'+el.id : ''} class="${el.className.slice(0,60)}">`);

    // 返回卸载函数
    return () => stopProbe(selector, eventTypes);
  };

  global.stopProbe = function (selector, eventTypes) {
    const key = selector + ':' + eventTypes;
    const p = probes.get(key);
    if (!p) { console.warn(`⚠ probe: 未找到 "${key}"`); return; }
    p.handlers.forEach(({ type, handler }) => {
      p.el.removeEventListener(type, handler);
    });
    probes.delete(key);
    console.log(`🔌 probe 已停止: "${key}"`);
  };

  global.stopAllProbes = function () {
    probes.forEach((p, key) => {
      p.handlers.forEach(({ type, handler }) => p.el.removeEventListener(type, handler));
      console.log(`🔌 probe 已停止: "${key}"`);
    });
    probes.clear();
  };

  console.log('%c🕵️ Event Probe 已加载', 'color:#B7FF00;font-size:14px');
  console.log('  用法: probe(selector, eventTypes)');
  console.log('  示例: probe(".doc-outline", "dragstart dragenter dragover drop")');
  console.log('        probe(".ProseMirror", "focus blur click")');
  console.log('  停止: stopProbe(selector, eventTypes) 或 stopAllProbes()');
})(window);
