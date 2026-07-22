/**
 * CreationWizard — Single-step new project creation modal for 织梦机 v1.2.
 *
 * Full-screen modal with backdrop blur, name + genre + template selection.
 * Ctrl+click close button skips wizard.
 */

import { useState, useRef, useEffect } from 'react';
import { Sprout, Pencil, X, ArrowRight, Check } from 'lucide-react';

interface CreationWizardProps {
  onConfirm: (title: string, genre: string, templateId: string | null) => void;
  onCancel: () => void;
  lastGenre?: string;
}

const FONT = "-apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif";

const genreGradients: Record<string, string> = {
  '科幻': 'linear-gradient(90deg, #6366f1, #8b5cf6)',
  '奇幻': 'linear-gradient(90deg, #B7FF00, #4CAF50)',
  '武侠': 'linear-gradient(90deg, #D4A574, #8B4513)',
  '悬疑': 'linear-gradient(90deg, #4a148c, #311b92)',
  '言情': 'linear-gradient(90deg, #f48fb1, #ec407a)',
  '历史': 'linear-gradient(90deg, #8d6e63, #5d4037)',
  '都市': 'linear-gradient(90deg, #4fc3f7, #0288d1)',
  '末世': 'linear-gradient(90deg, #757575, #424242)',
  '恐怖': 'linear-gradient(90deg, #b71c1c, #880e4f)',
  '其他': 'linear-gradient(90deg, #B7FF00, #7fba00)',
};

const GENRES = [
  '科幻', '奇幻', '武侠', '悬疑', '言情',
  '历史', '都市', '末世', '恐怖', '其他',
];

const templatePresets: Record<string, { name: string; items: string[]; desc: string; icon: React.ReactNode }> = {
  blank: {
    name: '从零开始',
    icon: <Sprout size={16} />,
    desc: '一步步搭建你的世界，适合第一次使用',
    items: ['世界观核心', '主角', '关键地点'],
  },
  quick: {
    name: '快速起稿',
    icon: <Pencil size={16} />,
    desc: '预设分类和标签框架，内容你自己填',
    items: ['默认分类体系', '标签集', '正典等级'],
  },
  empty: {
    name: '空白画布',
    icon: '⬜',
    desc: '没有任何预设，完全自由创作',
    items: [],
  },
};

const s: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 1000,
    background: 'rgba(0, 0, 0, 0.7)',
    backdropFilter: 'blur(5px)',
    WebkitBackdropFilter: 'blur(5px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    background: '#141414',
    border: '1px solid #2a2a2a',
    borderRadius: 12,
    boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
    width: '100%',
    maxWidth: 560,
    maxHeight: '90vh',
    overflowY: 'auto',
    position: 'relative',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 24px 0',
    position: 'sticky',
    top: 0,
    background: '#141414',
    zIndex: 2,
  },
  headerTitle: {
    fontSize: '1.1rem',
    fontWeight: 600,
    letterSpacing: '0.02em',
    color: '#e0e0e0',
    margin: 0,
    fontFamily: FONT,
  },
  closeBtn: {
    width: 32,
    height: 32,
    border: '1px solid #2a2a2a',
    borderRadius: 6,
    background: 'transparent',
    color: '#a0a0a0',
    fontSize: '1.1rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    fontFamily: FONT,
    transition: 'background 0.18s ease, color 0.18s ease, border-color 0.18s ease',
  },
  tooltip: {
    position: 'absolute',
    top: 'calc(100% + 6px)',
    right: 0,
    background: '#222',
    color: '#a0a0a0',
    fontSize: '0.7rem',
    padding: '4px 10px',
    borderRadius: 4,
    whiteSpace: 'nowrap',
    border: '1px solid #2a2a2a',
    pointerEvents: 'none',
    zIndex: 10,
    fontFamily: FONT,
  },
  body: {
    padding: '20px 24px 24px',
  },
  formGroup: {
    marginBottom: 18,
  },
  label: {
    display: 'block',
    fontSize: '0.8rem',
    fontWeight: 500,
    color: '#a0a0a0',
    marginBottom: 6,
    fontFamily: FONT,
  },
  input: {
    width: '100%',
    padding: '10px 14px',
    fontFamily: FONT,
    fontSize: '0.9rem',
    background: '#0a0a0a',
    border: '1px solid #2a2a2a',
    borderRadius: 6,
    color: '#e0e0e0',
    outline: 'none',
    transition: 'border-color 0.18s ease, box-shadow 0.18s ease',
    boxSizing: 'border-box',
  },
  validationHint: {
    fontSize: '0.7rem',
    color: '#666',
    marginTop: 4,
    transition: 'color 0.18s ease',
    fontFamily: FONT,
  },
  validationError: {
    color: '#ff6b6b',
  },
  selectWrapper: {
    position: 'relative',
  },
  select: {
    width: '100%',
    padding: '10px 36px 10px 14px',
    fontFamily: FONT,
    fontSize: '0.9rem',
    background: '#0a0a0a',
    border: '1px solid #2a2a2a',
    borderRadius: 6,
    color: '#e0e0e0',
    outline: 'none',
    cursor: 'pointer',
    appearance: 'none',
    WebkitAppearance: 'none',
    transition: 'border-color 0.18s ease, box-shadow 0.18s ease',
    boxSizing: 'border-box',
  },
  selectArrow: {
    position: 'absolute',
    right: 12,
    top: '50%',
    transform: 'translateY(-50%)',
    color: '#a0a0a0',
    fontSize: '0.75rem',
    pointerEvents: 'none',
  },
  genrePreview: {
    height: 3,
    borderRadius: 2,
    marginTop: 8,
    background: '#2a2a2a',
    transition: 'background 0.4s ease',
  },
  divider: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    margin: '22px 0 14px',
    fontSize: '0.75rem',
    color: '#a0a0a0',
    letterSpacing: '0.04em',
    fontFamily: FONT,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    background: '#2a2a2a',
  },
  templateGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: 10,
    marginBottom: 14,
  },
  templateCard: {
    background: '#1e1e1e',
    border: '1.5px solid #2a2a2a',
    borderRadius: 10,
    padding: '14px 12px',
    cursor: 'pointer',
    textAlign: 'center',
    position: 'relative',
    overflow: 'hidden',
    transition: 'border-color 0.18s ease, background 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease',
  },
  templateCardSelected: {
    borderColor: '#B7FF00',
    background: 'rgba(183,255,0,0.1)',
    boxShadow: '0 0 0 1.5px #B7FF00, 0 0 24px rgba(183,255,0,0.18)',
    transform: 'translateY(-1px)',
  },
  checkMark: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 16,
    height: 16,
    borderRadius: '50%',
    background: '#B7FF00',
    color: '#0a0a0a',
    fontSize: '0.55rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
  },
  icon: {
    fontSize: '1.6rem',
    marginBottom: 6,
    lineHeight: 1.2,
  },
  tname: {
    fontSize: '0.78rem',
    fontWeight: 600,
    marginBottom: 2,
    color: '#e0e0e0',
    fontFamily: FONT,
  },
  tdesc: {
    fontSize: '0.65rem',
    color: '#a0a0a0',
    lineHeight: 1.4,
    fontFamily: FONT,
  },
  previewPanel: {
    background: '#1e1e1e',
    border: '1px solid #2a2a2a',
    borderRadius: 10,
    padding: '14px 16px',
    marginBottom: 18,
    minHeight: 60,
    transition: 'border-color 0.18s ease',
  },
  previewPanelActive: {
    borderColor: '#B7FF00',
    boxShadow: 'inset 0 0 0 1px rgba(183,255,0,0.1)',
  },
  previewTitle: {
    fontSize: '0.75rem',
    fontWeight: 500,
    color: '#a0a0a0',
    marginBottom: 8,
    letterSpacing: '0.03em',
    fontFamily: FONT,
  },
  previewList: {
    listStyle: 'none',
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    margin: 0,
    padding: 0,
  },
  previewItem: {
    fontSize: '0.75rem',
    padding: '4px 10px',
    background: 'rgba(183,255,0,0.07)',
    border: '1px solid rgba(183,255,0,0.15)',
    borderRadius: 4,
    color: '#a0a0a0',
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    fontFamily: FONT,
  },
  previewEmpty: {
    fontSize: '0.75rem',
    color: '#555',
    fontStyle: 'italic',
    fontFamily: FONT,
  },
  hintArea: {
    textAlign: 'center',
    fontSize: '0.7rem',
    color: '#444',
    marginBottom: 16,
    letterSpacing: '0.02em',
    fontFamily: FONT,
  },
  kbd: {
    display: 'inline-block',
    padding: '1px 6px',
    fontFamily: FONT,
    fontSize: '0.65rem',
    background: '#1e1e1e',
    border: '1px solid #2a2a2a',
    borderRadius: 3,
    color: '#a0a0a0',
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 4,
  },
  btnSecondary: {
    padding: '9px 22px',
    fontFamily: FONT,
    fontSize: '0.82rem',
    fontWeight: 500,
    borderRadius: 6,
    border: '1px solid #2a2a2a',
    background: 'transparent',
    color: '#a0a0a0',
    cursor: 'pointer',
    letterSpacing: '0.02em',
    transition: 'all 0.18s ease',
  },
  btnPrimary: {
    padding: '9px 22px',
    fontFamily: FONT,
    fontSize: '0.82rem',
    fontWeight: 600,
    borderRadius: 6,
    border: '1px solid transparent',
    cursor: 'pointer',
    letterSpacing: '0.02em',
    transition: 'all 0.18s ease',
  },
  btnPrimaryActive: {
    background: '#B7FF00',
    borderColor: '#B7FF00',
    color: '#0a0a0a',
  },
  btnPrimaryDisabled: {
    opacity: 0.35,
    cursor: 'not-allowed',
    background: '#333',
    borderColor: '#333',
    color: '#666',
  },
};

export default function CreationWizard({ onConfirm, onCancel, lastGenre }: CreationWizardProps) {
  const [title, setTitle] = useState('');
  const [genre, setGenre] = useState(lastGenre && GENRES.includes(lastGenre) ? lastGenre : '其他');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [showTooltip, setShowTooltip] = useState(false);
  const [dirty, setDirty] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const isValid = title.trim().length > 0;

  const handleNext = () => {
    if (!isValid) return;
    setStep(2);
  };

  const handleSkip = () => {
    onConfirm(title.trim(), genre, null);
  };
  const currentGradient = genreGradients[genre] || genreGradients['其他'];
  const selectedPreset = selectedTemplate
    ? templatePresets[selectedTemplate as keyof typeof templatePresets]
    : null;

  const handleCreate = () => {
    if (!isValid) return;
    onConfirm(title.trim(), genre, selectedTemplate);
  };

  const handleClose = (e: React.MouseEvent) => {
    if (e.ctrlKey) {
      onConfirm('', '其他', null);
      return;
    }
    onCancel();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && isValid) {
      handleCreate();
    }
    if (e.key === 'Escape') {
      onCancel();
    }
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val.length <= 40) {
      setTitle(val);
    }
    setDirty(true);
  };

  let hintText: string;
  let hintStyle: React.CSSProperties = { ...s.validationHint };
  if (!isValid && dirty) {
    hintText = '请输入作品名称';
    hintStyle = { ...hintStyle, ...s.validationError };
  } else if (isValid) {
    hintText = '名称有效';
  } else {
    hintText = '至少 1 个字符';
  }

  return (
    <div style={s.overlay} onClick={onCancel}>
      <div style={s.card} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={s.header}>
          <h2 style={s.headerTitle}>{'新建作品'}</h2>
          <button
            style={s.closeBtn}
            onClick={handleClose}
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            aria-label={'关闭'}
          >
            <X size={16} />
            {showTooltip && (
              <span style={s.tooltip}>{'Ctrl+click 跳过向导'}</span>
            )}
          </button>
        </div>

        {/* Body */}
        <div style={s.body}>
          {/* Project Name */}
          <div style={s.formGroup}>
            <label style={s.label}>{'作品名'}</label>
            <input
              ref={inputRef}
              type="text"
              style={s.input}
              placeholder={'输入作品名称...'}
              maxLength={40}
              value={title}
              onChange={handleTitleChange}
              onKeyDown={handleKeyDown}
            />
            <div style={hintStyle}>{hintText}</div>
          </div>

          {/* Genre */}
          <div style={s.formGroup}>
            <label style={s.label}>{'体裁'}</label>
            <div style={s.selectWrapper}>
              <select
                style={s.select}
                value={genre}
                onChange={e => setGenre(e.target.value)}
              >
                {GENRES.map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
              <span style={s.selectArrow}>{'▾'}</span>
            </div>
            <div style={{ ...s.genrePreview, background: currentGradient }} />
          </div>

          {/* Divider */}
          <div style={s.divider}>
            <span style={s.dividerLine} />
            {'或选择初始模板'}
            <span style={s.dividerLine} />
          </div>

          {/* Template Cards */}
          <div style={s.templateGrid}>
            {Object.entries(templatePresets).map(([id, preset]) => {
              const isSelected = selectedTemplate === id;
              return (
                <div
                  key={id}
                  style={{
                    ...s.templateCard,
                    ...(isSelected ? s.templateCardSelected : {}),
                  }}
                  onClick={() => setSelectedTemplate(id)}
                >
                  {isSelected && <span style={s.checkMark}><Check size={12} /></span>}
                  <div style={s.icon}>{preset.icon}</div>
                  <div style={s.tname}>{preset.name}</div>
                  <div style={s.tdesc}>{preset.desc}</div>
                </div>
              );
            })}
          </div>

          {/* Preview Panel */}
          <div style={{
            ...s.previewPanel,
            ...(selectedPreset ? s.previewPanelActive : {}),
          }}>
            <div style={s.previewTitle}>
              {'模板预览'}
              {selectedPreset && (
                <span style={{ color: '#B7FF00' }}>
                  {' · '}{selectedPreset.name}
                </span>
              )}
            </div>
            {selectedPreset ? (
              selectedPreset.items.length > 0 ? (
                <ul style={s.previewList}>
                  {selectedPreset.items.map((item, i) => (
                    <li key={i} style={s.previewItem}>
                      {'✦'} {item}
                    </li>
                  ))}
                </ul>
              ) : (
                <div style={s.previewEmpty}>
                  {'无预设内容'}
                </div>
              )
            ) : (
              <div style={s.previewEmpty}>
                {'未选择模板'}
              </div>
            )}
          </div>

          {/* Hint */}
          <div style={s.hintArea}>
            <kbd style={s.kbd}>{'Ctrl'}</kbd>
            {' + click「新建作品」跳过向导'}
          </div>

          {/* Footer */}
          <div style={s.footer}>
            {step === 1 ? (
              <><button style={s.btnSecondary} onClick={onCancel}>{'取消'}</button>
              <button
                style={{
                  ...s.btnPrimary,
                  ...(isValid ? s.btnPrimaryActive : s.btnPrimaryDisabled),
                }}
                disabled={!isValid}
                onClick={handleNext}
              >
                {<>下一步 <ArrowRight size={16} /></>}
              </button></>
            ) : (
              <><button style={s.btnSecondary} onClick={handleSkip}>{'跳过'}</button>
              <button
                style={{
                  ...s.btnPrimary,
                  ...(isValid ? s.btnPrimaryActive : s.btnPrimaryDisabled),
                }}
                disabled={!isValid}
                onClick={handleCreate}
              >
                {'开始创作'}
              </button></>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
