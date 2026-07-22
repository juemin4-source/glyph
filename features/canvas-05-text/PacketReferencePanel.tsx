/**
 * PacketReferencePanel — 画板⑤ 右侧细纲参考面板。
 *
 * 从 ChapterPacket 的四层 JSON 中提取摘要数据并展示。
 * JSON 解析失败时降级显示错误信息，不阻塞 Editor。
 */
import { useMemo } from 'react';
import type { ChapterPacket, ActiveContext, NarrativeCompression, ExecutionLayer } from '../../contracts/chapter-packet.contract';
import './packet-reference.css';

interface PacketReferencePanelProps {
  packet: ChapterPacket | null;
}

/**
 * 安全解析 JSON 字符串，失败时返回 null
 */
function safeJsonParse<T>(json: string | T | null | undefined): T | null {
  if (json == null) return null;
  if (typeof json !== 'string') return json as unknown as T;
  try {
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

/**
 * 将 N 个元素的高风险假设映射为风险等级标签
 */
function riskLabel(level: string): { text: string; className: string } {
  switch (level) {
    case 'high': return { text: '高', className: 'packet-ref-release-tag--pressure' };
    case 'medium': return { text: '中', className: 'packet-ref-release-tag--foreshadow' };
    case 'low': return { text: '低', className: 'packet-ref-release-tag--release' };
    default: return { text: level, className: '' };
  }
}

/**
 * 将 establishing 类型映射为 CSS class
 */
function establishTypeClass(type: string): string {
  switch (type) {
    case 'establish': return 'packet-ref-release-tag--establish';
    case 'foreshadow': return 'packet-ref-release-tag--foreshadow';
    case 'pressure': return 'packet-ref-release-tag--pressure';
    default: return '';
  }
}

function establishTypeLabel(type: string): string {
  switch (type) {
    case 'establish': return '建立';
    case 'foreshadow': return '伏笔';
    case 'pressure': return '章尾压力';
    default: return type;
  }
}

function chapterFunctionLabel(fn: string): string {
  const labels: Record<string, string> = {
    opening: '开场',
    setup: '铺陈',
    escalation: '升温',
    reversal: '反转',
    reveal: '揭示',
    relationship_shift: '关系变化',
    decision: '决策',
    aftermath: '余波',
    transition: '过渡',
    climax: '高潮',
    closure: '收束',
  };
  return labels[fn] || fn;
}

export default function PacketReferencePanel({ packet }: PacketReferencePanelProps) {
  // 安全解析四层 JSON
  const layer2 = useMemo(() => safeJsonParse<ActiveContext>(packet?.layer2 ?? null), [packet?.layer2]);
  const layer3 = useMemo(() => safeJsonParse<NarrativeCompression>(packet?.layer3 ?? null), [packet?.layer3]);
  const layer4 = useMemo(() => safeJsonParse<ExecutionLayer>(packet?.layer4 ?? null), [packet?.layer4]);

  // Layer ② 数据
  const characters = layer2?.characters ?? [];
  const rules = layer2?.rules ?? [];
  const knowledge = layer2?.knowledgeSnapshot;

  // Layer ③ 数据
  const narrative = layer3?.narrative;
  const releases = layer3?.releases ?? [];
  const establishes = layer3?.establishes ?? [];
  const assumptions = layer3?.assumptions ?? [];

  // Layer ④ 数据
  const scenes = layer4?.scenes ?? [];

  if (!packet) {
    return (
      <div className="packet-ref">
        <div className="packet-ref-empty">
          暂无细纲数据。请先在画板④确认一个 ChapterPacket。
        </div>
      </div>
    );
  }

  return (
    <div className="packet-ref">
      {/* ── 头部：章节信息 ── */}
      <div className="packet-ref-header">
        <div className="packet-ref-header-title">
          {packet.chapterNumber ? `第${packet.chapterNumber}章` : ''} {packet.title}
        </div>
        <div className="packet-ref-header-line">
          {packet.position && (
            <span className="packet-ref-header-tag">{packet.position}</span>
          )}
          {packet.chapterFunction && (
            <span className="packet-ref-header-tag">
              {chapterFunctionLabel(packet.chapterFunction)}
            </span>
          )}
        </div>
      </div>

      {/* ── 正文区 ── */}
      <div className="packet-ref-body">
        {/* 压缩叙事 */}
        {narrative && (
          <div className="packet-ref-section">
            <div className="packet-ref-section-title">压缩叙事</div>
            <div className="packet-ref-narrative-box">
              <div className="packet-ref-narrative-text">{narrative}</div>
            </div>
          </div>
        )}

        {/* 释放 / 建立 / 伏笔 / 章尾压力 */}
        {(releases.length > 0 || establishes.length > 0) && (
          <div className="packet-ref-section">
            <div className="packet-ref-section-title">标注</div>
            <div className="packet-ref-section-content">
              {releases.map((r, i) => (
                <span key={`rel-${i}`} className="packet-ref-release-tag packet-ref-release-tag--release">
                  📤 {r}
                </span>
              ))}
              {establishes.map((e, i) => (
                <span
                  key={`est-${i}`}
                  className={`packet-ref-release-tag ${establishTypeClass(e.type)}`}
                >
                  {e.type === 'establish' ? '🤝' : e.type === 'foreshadow' ? '🔮' : '⚡'}
                  {establishTypeLabel(e.type)}: {e.subject}
                  {e.change ? ` (${e.change})` : ''}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 活跃角色 */}
        {characters.length > 0 && (
          <div className="packet-ref-section">
            <div className="packet-ref-section-title">
              角色 ({characters.length})
            </div>
            {characters.map((ch) => (
              <div key={ch.characterId} className="packet-ref-character">
                <div className="packet-ref-character-name">{ch.name}</div>
                <div className="packet-ref-character-info">
                  {ch.hook && <div>{ch.hook}</div>}
                  {ch.currentState && (
                    <span className="packet-ref-character-state">{ch.currentState}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 活跃规则 */}
        {rules.length > 0 && (
          <div className="packet-ref-section">
            <div className="packet-ref-section-title">
              规则 ({rules.length})
            </div>
            {rules.map((rule) => (
              <div key={rule.ruleId} className="packet-ref-rule">
                <span className="packet-ref-rule-title">{rule.title}</span>
                {rule.description && <span>: {rule.description}</span>}
              </div>
            ))}
          </div>
        )}

        {/* 场景列表 */}
        {scenes.length > 0 && (
          <div className="packet-ref-section">
            <div className="packet-ref-section-title">
              场景 ({scenes.length})
            </div>
            {scenes.map((scene, i) => (
              <div key={`scene-${i}`} className="packet-ref-scene">
                <div className="packet-ref-scene-label">{scene.label}</div>
                <div className="packet-ref-scene-meta">
                  {scene.location && <span>📍 {scene.location}</span>}
                  {scene.pov && <span>👁 {scene.pov}</span>}
                  {scene.rhythm && (
                    <span>
                      {scene.rhythm === 'slow' ? '🐢' : scene.rhythm === 'medium' ? '🚶' : '🏃'} {scene.rhythm}
                    </span>
                  )}
                </div>
                {scene.summary && (
                  <div className="packet-ref-scene-summary">{scene.summary}</div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 知识边界 */}
        {knowledge && (
          <div className="packet-ref-section">
            <div className="packet-ref-section-title">知识边界</div>
            {knowledge.readerKnows.length > 0 && (
              <div className="packet-ref-knowledge">
                <span className="packet-ref-knowledge-label">读者已知:</span>
                <span className="packet-ref-knowledge-value">
                  {knowledge.readerKnows.join('、')}
                </span>
              </div>
            )}
            {knowledge.hiddenFromReader.length > 0 && (
              <div className="packet-ref-knowledge">
                <span className="packet-ref-knowledge-label">隐藏信息:</span>
                <span className="packet-ref-knowledge-value">
                  {knowledge.hiddenFromReader.join('、')}
                </span>
              </div>
            )}
          </div>
        )}

        {/* 临时假设 */}
        {assumptions.length > 0 && (
          <div className="packet-ref-section">
            <div className="packet-ref-section-title">
              临时假设 ({assumptions.length})
            </div>
            {assumptions.map((a) => {
              const risk = riskLabel(a.riskLevel);
              return (
                <div key={a.id} className="packet-ref-knowledge" style={{ marginBottom: 6 }}>
                  <span className={`packet-ref-release-tag ${risk.className}`}>
                    {risk.text}
                  </span>
                  <span className="packet-ref-knowledge-value">{a.content}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* 空面板回溯 */}
        {!narrative && characters.length === 0 && scenes.length === 0 && (
          <div className="packet-ref-empty">
            此包尚未包含四层数据。请在画板④中生成或编辑章节细纲。
          </div>
        )}
      </div>
    </div>
  );
}
