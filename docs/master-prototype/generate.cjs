const fs = require('fs');
const path = require('path');
const BASE = __dirname;
const COMPONENTS_DIR = path.join(BASE, 'components');
const CSS_PATH = path.join(BASE, 'prototype.css');
const OUTPUT_DIR = path.join(BASE, 'output');
function loadCSS() { return fs.readFileSync(CSS_PATH, 'utf-8'); }
const TEMPLATE_FILES = {
  nav:'nav.html',statusbar:'statusbar.html',filterbar:'filterbar.html',
  'card-grid':'card-grid.html',modal:'modal.html','form-group':'form-group.html',
  'template-grid':'template-grid.html','guide-overlay':'guide-overlay.html',
  'canon-popup':'canon-popup.html','canon-handbook':'canon-handbook.html'
};
function loadTemplates() {
  const templates = {};
  for (const [key, file] of Object.entries(TEMPLATE_FILES)) {
    const p = path.join(COMPONENTS_DIR, file);
    if (fs.existsSync(p)) templates[key] = fs.readFileSync(p, 'utf-8');
    else templates[key] = '<!-- ' + key + ' missing -->';
  }
  return templates;
}
function substitute(template, data) {
  let result = template;
  for (const [key, value] of Object.entries(data))
    result = result.replace(new RegExp('{{' + key + '}}', 'g'), String(value));
  return result;
}
function escapeHtml(s) {
  if (typeof s !== 'string') return String(s);
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function generateCard(project) {
  const genre = project.genre || '科幻';
  const gradMap = { '科幻':'grad-sci-fi','奇幻':'grad-fantasy','武侠':'grad-wuxia','悬疑':'grad-mystery' };
  const grad = gradMap[genre] || 'grad-sci-fi';
  const sd = { '构思中':'idea','草稿中':'draft','修改中':'revise','已完成':'done' }[project.status] || 'draft';
  let dots = '';
  const cd = project.canonDots;
  if (cd && cd.length) {
    dots = '<div class="canon-dots">' + cd.map(c => '<span class="canon-dot ' + c + '"></span>').join('') + '</div>';
  } else if (project.canonLevel) {
    const levels = ['core','project','draft','none'];
    for (let i = 0; i < Math.min(project.canonLevel,5); i++) dots += '<span class="canon-dot ' + levels[i%4] + '"></span>';
    dots = '<div class="canon-dots">' + dots + '</div>';
  }
  return '<div class="card" data-title="' + escapeHtml(project.title) + '" data-genre="' + escapeHtml(genre) + '" data-status="' + escapeHtml(project.status) + '" data-words="' + (project.words||0) + '">'
    + '<div class="card-gradient ' + grad + '"></div>'
    + '<button class="cover-edit-btn" aria-label="换封面色"><i data-lucide="pencil" size="16"></i></button>'
    + '<button class="menu-toggle" aria-label="更多操作"><i data-lucide="more-vertical" size="16"></i></button>'
    + '<div class="card-menu">'
    + '<button class="card-menu-item" data-action="rename"><i data-lucide="pen" size="16"></i> 编辑作品名</button>'
    + '<button class="card-menu-item" data-action="genre"><i data-lucide="scissors" size="16"></i> 更改体裁</button>'
    + '<button class="card-menu-item" data-action="cover"><i data-lucide="palette" size="16"></i> 换封面色</button>'
    + '<button class="card-menu-item danger" data-action="delete"><i data-lucide="trash-2" size="16"></i> 删除作品</button>'
    + '<button class="card-menu-item" data-action="export"><i data-lucide="download" size="16"></i> 导出</button></div>'
    + dots
    + '<div class="card-content"><div class="card-title">' + escapeHtml(project.title) + '</div>'
    + '<div class="card-meta"><span class="genre-badge">' + escapeHtml(genre) + '</span><span class="status-indicator"><span class="status-dot ' + sd + '"></span> ' + escapeHtml(project.status) + '</span></div>'
    + '<div class="card-wordcount"><strong>' + (project.words||0).toLocaleString() + '</strong> 字</div></div></div>';
}
function generateNavTabs(tabs, active) {
  return tabs.map(t => '<button class="topnav-tab' + (t===active?' active':'') + '">' + escapeHtml(t) + '</button>').join('');
}
function generateFilterSelects(filters) {
  return (filters||[]).map(f => {
    const opts = (f.options||[]).map(o => '<option value="' + o.value + '">' + escapeHtml(o.label) + '</option>').join('');
    return '<div class="select-wrap"><select id="' + f.id + '">' + opts + '</select></div>';
  }).join('');
}
function getDefaultData(screenId) {
  const d = {
    shelf: {
      navTabs:['第一批','文档','画板','设定集','AI'],activeTab:'第一批',
      searchPlaceholder:'搜索作品...',stats:{count:4,words:53917,canon:5},
      projects:[{title:'觉醒纪元',genre:'科幻',status:'草稿中',words:12430,canonDots:['core','project','draft','none','core']},{title:'星空彼岸',genre:'奇幻',status:'构思中',words:3800,canonDots:['project','draft','none']},{title:'江湖行',genre:'武侠',status:'修改中',words:28987,canonDots:['core','core','project','draft']},{title:'迷雾之城',genre:'悬疑',status:'草稿中',words:8700,canonDots:['project','draft']}],
      filters:[{id:'genreFilter',options:[{value:'all',label:'全部体裁'},{value:'科幻',label:'科幻'},{value:'奇幻',label:'奇幻'},{value:'武侠',label:'武侠'},{value:'悬疑',label:'悬疑'}]},{id:'statusFilter',options:[{value:'all',label:'全部状态'},{value:'构思中',label:'构思中'},{value:'草稿中',label:'草稿中'},{value:'修改中',label:'修改中'}]}]
    },
    'shelf-search':{navTabs:['第一批','文档','画板','设定集','AI'],activeTab:'第一批',searchPlaceholder:'搜索作品...',stats:{count:4,words:53917,canon:5},projects:[{title:'觉醒纪元',genre:'科幻',status:'草稿中',words:12430},{title:'星空彼岸',genre:'奇幻',status:'构思中',words:3800},{title:'江湖行',genre:'武侠',status:'修改中',words:28987},{title:'迷雾之城',genre:'悬疑',status:'草稿中',words:8700}]},
    'shelf-card-menu':{navTabs:['第一批','文档','画板','设定集','AI'],activeTab:'第一批',stats:{count:4,words:53917,canon:5},projects:[{title:'觉醒纪元',genre:'科幻',status:'草稿中',words:12430},{title:'星空彼岸',genre:'奇幻',status:'构思中',words:3800},{title:'江湖行',genre:'武侠',status:'修改中',words:28987},{title:'迷雾之城',genre:'悬疑',status:'草稿中',words:8700}]},
    'shelf-cover-edit':{navTabs:['第一批','文档','画板','设定集','AI'],activeTab:'第一批',stats:{count:4,words:53917,canon:5},projects:[{title:'觉醒纪元',genre:'科幻',status:'草稿中',words:12430},{title:'星空彼岸',genre:'奇幻',status:'构思中',words:3800},{title:'江湖行',genre:'武侠',status:'修改中',words:28987},{title:'迷雾之城',genre:'悬疑',status:'草稿中',words:8700}]},
    'shelf-empty':{navTabs:['第一批','文档','画板','设定集','AI'],activeTab:'第一批',stats:{count:0,words:0,canon:0},emptyTitle:'开始你的创作之旅',emptySub:'创建你的第一个作品',emptyBtnText:'+ 创建第一个作品'},
    wizard:{navTabs:['第一批','文档','画板','设定集','AI'],activeTab:'第一批',stats:{count:4,words:53917,canon:5},projects:[{title:'觉醒纪元',genre:'科幻',status:'草稿中',words:12430}]},
    'wizard-template-preview':{navTabs:['第一批','文档','画板','设定集','AI'],activeTab:'第一批',stats:{count:4,words:53917,canon:5},projects:[{title:'觉醒纪元',genre:'科幻',status:'草稿中',words:12430}]},
    'first-launch-guide':{navTabs:['第一批','文档','画板','设定集','AI'],activeTab:'第一批'},
    'canon-guide':{navTabs:['第一批','文档','画板','设定集','AI'],activeTab:'第一批'},
    'workspace-shell':{navTabs:['文档','画板','设定集','AI'],activeTab:'文档'},
    'nav-bar':{navTabs:['文档','画板','设定集','AI'],activeTab:'文档'},
    'status-bar-screen':{navTabs:['文档','画板','设定集','AI'],activeTab:'文档'},
    'offline-banner':{navTabs:['文档','画板','设定集','AI'],activeTab:'文档'},
    'loading-screen':{navTabs:['文档','画板','设定集','AI'],activeTab:'文档'}
  };
  return d[screenId] || {navTabs:['第一批','文档','画板','设定集','AI'],activeTab:'第一批',stats:{count:3,words:0,canon:0}};
}
function assemblePage(screen, css, templates) {
  const data = (screen.data && Object.keys(screen.data).length) ? screen.data : getDefaultData(screen.id);
  let html = '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>' + escapeHtml(screen.title) + ' — 织梦机 v2.0</title>';
  html += '<style>' + css + '</style>';
  html += '<script src="https://unpkg.com/lucide@latest"></script></head><body>';
  html += '<div class="app" id="app">';
  for (const section of (screen.sections||[])) {
    if (section === 'nav') {
      const tabs = data.navTabs || ['第一批','文档','画板','设定集','AI'];
      const active = data.activeTab || tabs[0];
      html += '<nav class="topnav"><div class="topnav-logo">织梦机 Zhimengji</div><div class="topnav-tabs">' + generateNavTabs(tabs, active) + '</div><div class="topnav-right"><button class="topnav-icon-btn" aria-label="搜索" title="搜索"><i data-lucide="search" size="16"></i></button><button class="topnav-icon-btn" aria-label="设置" title="设置"><i data-lucide="settings" size="16"></i></button></div></nav>';
    } else if (section === 'page-header') {
      html += '<div class="page-header"><h1 class="page-title">' + escapeHtml(screen.title) + '</h1><div class="page-actions"><button class="btn btn-primary" id="newBtn"><span>+</span> 新建</button></div></div>';
    } else if (section === 'filterbar') {
      const filters = data.filters || [{id:'genreFilter',options:[{value:'all',label:'全部'},{value:'科幻',label:'科幻'}]},{id:'statusFilter',options:[{value:'all',label:'全部'},{value:'草稿中',label:'草稿中'}]}];
      html += '<div class="filterbar"><div class="search-wrap"><span class="search-icon"><i data-lucide="search" size="16"></i></span><input type="text" id="searchInput" placeholder="' + escapeHtml(data.searchPlaceholder||'搜索...') + '" autocomplete="off"></div>' + generateFilterSelects(filters) + '</div>';
    } else if (section === 'statsbar') {
      const s = data.stats || {count:0,words:0,canon:0};
      html += '<div class="statsbar"><span>共 <span class="num">' + (s.count||0) + '</span> 部作品</span><span>|</span><span>总字数 <span class="num">' + (s.words||0).toLocaleString() + '</span> 字</span><span>|</span><span>最高正典对象 <span class="num highlight">' + (s.canon||0) + '</span> 个</span></div>';
    } else if (section === 'card-grid') {
      const projects = data.projects || [];
      html += '<div class="card-grid" id="cardGrid">' + projects.map(p => generateCard(p)).join('\n    ') + '</div>';
      html += '<div class="empty-state' + (projects.length===0?' visible':'') + '" id="emptyState"><div class="empty-title">' + escapeHtml(data.emptyTitle||'没有匹配结果') + '</div><div class="empty-sub">' + escapeHtml(data.emptySub||'试试其他条件') + '</div><div class="empty-actions"><button class="btn btn-primary" id="emptyCreateBtn">' + escapeHtml(data.emptyBtnText||'+ 创建第一个作品') + '</button></div></div>';
    } else if (section === 'statusbar') {
      html += '<div class="statusbar"><div class="status-left"><span><span class="conn-dot" id="connDot"></span> <span id="connLabel">已连接</span></span></div><div class="status-right"><span>织梦机 v2.0</span><span>|</span><span>' + escapeHtml(screen.title) + '</span></div></div>';
    } else if (section === 'empty-state') {
      html += '<div class="empty-state visible" id="emptyState"><div class="empty-title">' + escapeHtml(data.emptyTitle||'暂无内容') + '</div><div class="empty-sub">' + escapeHtml(data.emptySub||'开始创建') + '</div><div class="empty-actions"><button class="btn btn-primary">+ 创建第一个</button></div></div>';
    } else if (section === 'info-panel') {
      const panelTitle = data.infoTitle||screen.title;
      const fields = data.infoFields||[];
      html += '<div class="rich-panel"><div class="rich-panel-title">' + escapeHtml(panelTitle) + '</div><div class="rich-panel-grid">';
      for (const f of fields) {
        html += '<div class="rich-field"><span class="rich-field-label">' + escapeHtml(f.label) + '</span><span class="rich-field-value">' + escapeHtml(String(f.value)) + '</span></div>';
      }
      html += '</div></div>';
    } else if (section === 'item-list') {
      const listItems = data.listItems||[];
      html += '<div class="rich-panel"><div class="rich-panel-title">' + escapeHtml(data.listTitle||'') + '<span class="rich-panel-count">' + listItems.length + '</span></div><div class="rich-list">';
      for (const item of listItems) {
        html += '<div class="rich-list-item">';
        if (item.dot) html += '<span class="rich-dot ' + escapeHtml(item.dot) + '"></span>';
        html += '<span class="rich-list-name">' + escapeHtml(item.name||'') + '</span>';
        if (item.meta) html += '<span class="rich-list-meta">' + escapeHtml(item.meta) + '</span>';
        html += '</div>';
      }
      html += '</div></div>';
    } else if (section === 'conversation') {
      const msgs = data.conversations||[];
      html += '<div class="rich-panel"><div class="rich-panel-title">对话 <span class="rich-panel-count">' + msgs.length + '</span></div><div class="rich-conversation">';
      for (const m of msgs) {
        const isUser = m.role === 'user';
        html += '<div class="rich-msg ' + (isUser?'rich-msg-user':'rich-msg-ai') + '"><div class="rich-msg-role">' + (isUser?'你':'AI') + '</div><div class="rich-msg-text">' + escapeHtml((m.message||'').substring(0,200)) + '</div></div>';
      }
      html += '</div></div>';
    } else if (section === 'breakdown-chart') {
      const bd = data.breakdown||[];
      html += '<div class="rich-panel"><div class="rich-panel-title">用量分解</div><div class="rich-breakdown">';
      for (const b of bd) {
        const pct = b.pct||0;
        html += '<div class="rich-bar-row"><span class="rich-bar-label">' + escapeHtml(b.model||'') + '</span><div class="rich-bar-track"><div class="rich-bar-fill" style="width:' + pct + '%"></div></div><span class="rich-bar-pct">' + pct + '%</span></div>';
      }
      html += '</div></div>';
    } else if (section === 'data-display') {
      // Render all data keys that have values as a comprehensive display
      const excludeKeys = ['navTabs','activeTab','searchPlaceholder','filters','stats','projects','emptyTitle','emptySub','emptyBtnText','infoTitle','infoFields','listTitle','listItems','conversations','breakdown','dailyCost','testResults','providers','models','availableModels','commands','groups','allItems','smartGroups','recentItems','references','referrers','timeline','levels','boards','unsortedEvents','recentChanges','records','sections','poolItems','eras','zones','tools','recentSearches','lastError','cardData','originalData','originalData','availableModes','conversations'];
      const renderKeys = Object.keys(data).filter(k => !excludeKeys.includes(k) && data[k] !== null && data[k] !== undefined && data[k] !== '');
      if (renderKeys.length > 0) {
        html += '<div class="rich-panel"><div class="rich-panel-title">屏幕数据 <span class="rich-panel-count">' + renderKeys.length + '</span></div><div class="rich-panel-grid">';
        for (const k of renderKeys) {
          let v = data[k];
          if (typeof v === 'object') v = JSON.stringify(v).substring(0,60);
          html += '<div class="rich-field"><span class="rich-field-label">' + escapeHtml(k) + '</span><span class="rich-field-value">' + escapeHtml(String(v)) + '</span></div>';
        }
        html += '</div></div>';
      }
    }
  }
  html += '</div>';
  // Add modals
  for (const modal of (screen.modals||[])) {
    if (modal === 'wizard') {
      html += '<div class="modal-overlay" id="wizardOverlay"><div class="modal-card"><div class="modal-header"><h2>新建作品</h2><button class="modal-close" id="wizardClose" aria-label="关闭"><i data-lucide="x" size="16"></i></button></div><div class="modal-body"><div class="form-group"><label for="projectName">作品名</label><input type="text" class="input-field" id="projectName" placeholder="输入作品名称..." autofocus maxlength="40"><div class="validation-hint" id="nameHint">至少 1 个字符</div></div><div class="form-group"><label for="genreSelect">体裁</label><div class="select-wrapper"><select class="select-field" id="genreSelect"><option>科幻</option><option>奇幻</option><option>武侠</option><option>悬疑</option><option selected>其他</option></select></div></div><div class="template-divider">或选择初始模板</div><div class="template-grid"><div class="template-card" data-template="blank"><span class="check-mark"><i data-lucide="check" size="12"></i></span><div class="icon"><i data-lucide="sprout" size="16"></i></div><div class="tname">从零开始</div><div class="tdesc">一步步搭建你的世界</div></div><div class="template-card" data-template="quick"><span class="check-mark"><i data-lucide="check" size="12"></i></span><div class="icon"><i data-lucide="pencil" size="16"></i></div><div class="tname">快速起稿</div><div class="tdesc">预设分类和标签</div></div><div class="template-card" data-template="empty"><span class="check-mark"><i data-lucide="check" size="12"></i></span><div class="icon"><i data-lucide="square" size="16"></i></div><div class="tname">空白画布</div><div class="tdesc">完全自由创作</div></div></div><div class="hint-area"><kbd>Ctrl</kbd> + click 跳过向导</div><div class="modal-footer"><button class="btn btn-secondary" id="wizardCancel">取消</button><button class="btn btn-primary" id="createBtn" disabled>开始创作</button></div></div></div></div>';
    }
    if (modal === 'delete') {
      html += '<div class="modal-overlay delete-modal" id="deleteOverlay"><div class="modal-card"><div class="modal-body" style="padding:2rem"><div class="delete-icon"><i data-lucide="alert-triangle" size="16"></i></div><div class="delete-title">确认删除作品</div><div class="delete-desc">删除 <strong id="deleteTarget">"未命名"</strong> 将移除所有内容。此操作不可撤销。</div><div class="delete-actions"><button class="btn btn-secondary" id="deleteCancel">取消</button><button class="btn btn-danger" id="deleteConfirm">删除</button></div></div></div></div>';
    }
  }
  // Overlays
  for (const overlay of (screen.overlays||[])) {
    if (overlay === 'guide') {
      html += '<div class="guide-overlay" id="guideOverlay"><div class="guide-card"><button class="guide-skip btn btn-ghost" id="guideSkip" style="padding:.3rem .6rem;font-size:.75rem">跳过 <i data-lucide="arrow-right" size="12"></i></button><div class="guide-step-indicator" id="guideStepLabel">第 1 / 3 步</div><div class="guide-icon" id="guideIcon"><i data-lucide="user" size="16"></i></div><h2 id="guideTitle">欢迎来到织梦机</h2><p id="guideDesc">这里有 8 种对象类型——人物、地点、组织...试着创建一个角色</p><div class="guide-dots" id="guideDots"><span class="guide-dot active" data-step="0"></span><span class="guide-dot" data-step="1"></span><span class="guide-dot" data-step="2"></span></div><div class="guide-actions"><button class="btn btn-secondary" id="guidePrev" style="display:none">上一步</button><button class="btn btn-primary" id="guideNext">下一步</button><button class="btn btn-primary" id="guideStart" style="display:none">开始使用</button></div></div></div>';
    }
    if (overlay === 'canon') {
      html += '<div class="canon-backdrop" id="canonBackdrop"><div class="canon-popup"><h2><span><i data-lucide="globe" size="16"></i></span> 世界构建入门</h2><p class="canon-intro">织梦机用「正典」来管理你的设定稳定性。</p><div class="canon-level-row tint-none"><div class="dot none"></div><div class="info"><div class="name">未收录</div><div class="desc">灵感笔记，尚未确认</div></div></div><div class="canon-level-row tint-draft"><div class="dot draft"></div><div class="info"><div class="name">草案正典</div><div class="desc">初步认定，还在打磨</div></div></div><div class="canon-level-row tint-project"><div class="dot project"></div><div class="info"><div class="name">项目正典</div><div class="desc">团队认可，纳入正典</div></div></div><div class="canon-level-row tint-core"><div class="dot core"></div><div class="info"><div class="name">核心正典</div><div class="desc">不可更改的基石设定</div></div></div><div class="canon-actions"><button class="btn btn-secondary" style="padding-left:.6rem"><span class="check-box"><i data-lucide="check" size="12"></i></span> 不再显示</button><button class="btn btn-primary">开始使用</button></div></div></div>';
    }
  }
  html += '<div class="toast" id="toast"></div><script>lucide.createIcons();</script></body></html>';
  return html;
}
function main() {
  const configPath = process.argv[2];
  if (!configPath) { console.error('Usage: node generate.cjs <config.json>'); process.exit(1); }
  const config = JSON.parse(fs.readFileSync(path.resolve(configPath), 'utf-8'));
  const css = loadCSS();
  const templates = loadTemplates();
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  // CSS inlined into each HTML file
  const screens = config.screens || [];
  const generated = [];
  for (const screen of screens) {
    const html = assemblePage(screen, css, templates);
    const filename = screen.id + '.html';
    fs.writeFileSync(path.join(OUTPUT_DIR, filename), html, 'utf-8');
    generated.push({ id: screen.id, title: screen.title, file: filename });
    console.log('Generated: ' + filename + ' — ' + screen.title);
  }
  // Build index
  const phases = {};
  for (const s of screens) {
    const p = s.phase || '0';
    if (!phases[p]) phases[p] = [];
    phases[p].push(s);
  }
  let idx = '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>织梦机 Master Prototype Index</title>';
  idx += '<link rel="stylesheet" href="prototype.css">';
  idx += '<style>.phase{margin-bottom:2rem}.phase-title{font-size:1rem;font-weight:700;color:var(--accent);margin-bottom:.75rem;padding-bottom:.5rem;border-bottom:1px solid var(--border-default)}.screen-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:.75rem}.screen-card{background:var(--bg-surface);border:1px solid var(--border-default);border-radius:var(--radius-md);padding:.85rem 1rem;transition:all .15s;cursor:pointer;text-decoration:none;display:block}.screen-card:hover{border-color:var(--accent);transform:translateY(-2px)}.screen-num{font-size:.65rem;color:var(--text-muted);font-family:var(--font-mono)}.screen-name{font-size:.875rem;font-weight:600;color:var(--text-primary);margin:2px 0}.screen-desc{font-size:.75rem;color:var(--text-secondary)}</style></head><body><div class="app">';
  idx += '<div class="page-header"><h1 class="page-title">织梦机 Master Prototype</h1><div class="page-actions"><span style="font-size:.8125rem;color:var(--text-muted)">' + generated.length + ' screens</span></div></div>';
  const sortedPhases = Object.keys(phases).sort((a,b) => parseInt(a)-parseInt(b));
  for (const ph of sortedPhases) {
    const items = phases[ph];
    idx += '<div class="phase"><div class="phase-title">Phase ' + ph + ' (' + items.length + ' screens)</div><div class="screen-list">';
    for (const s of items)
      idx += '<a class="screen-card" href="' + s.id + '.html"><div class="screen-num">#' + (s.num||s.id) + '</div><div class="screen-name">' + s.title + '</div><div class="screen-desc">' + (s.description||'') + '</div></a>';
    idx += '</div></div>';
  }
  idx += '</div></body></html>';
  fs.writeFileSync(path.join(OUTPUT_DIR, 'index.html'), idx, 'utf-8');
  console.log('\nGenerated index.html with ' + generated.length + ' screens across ' + sortedPhases.length + ' phases.');
}
main();