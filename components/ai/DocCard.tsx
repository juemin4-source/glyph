import { useState, useCallback } from "react";
import type { DocCardData, DocCardSection } from "../../types/ai";
import { SaveIndicator } from "../ui";
import type { IndicatorStatus } from "../ui/SaveIndicator";

interface DocCardProps {
  card: DocCardData;
  highlighted?: boolean;
  onSave?: (id: string, updates: { title?: string; bodyHTML?: string; sections?: DocCardSection[] }) => Promise<void>;
  onCollect?: (id: string) => void;
  onExpand?: (id: string) => void;
}
export default function DocCard({ card, highlighted, onSave, onCollect, onExpand }: DocCardProps) {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(card.title);
  const [editBody, setEditBody] = useState(card.bodyHTML);
  const [editSections, setEditSections] = useState<DocCardSection[]>(card.sections || []);
  const [saveStatus, setSaveStatus] = useState<IndicatorStatus>("saved");

  const handleEdit = useCallback(() => {
    setEditTitle(card.title);
    setEditBody(card.bodyHTML);
    setEditSections(card.sections || []);
    setEditing(true);
    setSaveStatus("saved");
  }, [card]);

  const handleCancel = useCallback(() => {
    setEditTitle(card.title);
    setEditBody(card.bodyHTML);
    setEditSections(card.sections || []);
    setEditing(false);
    setSaveStatus("saved");
  }, [card]);

  const handleSave = useCallback(async () => {
    setSaveStatus("saving");
    try {
      if (onSave) {
        await onSave(card.id, { title: editTitle, bodyHTML: editBody, sections: editSections });
      }
      setSaveStatus("saved");
      setEditing(false);
    } catch {
      setSaveStatus("failed");
    }
  }, [card.id, editTitle, editBody, editSections, onSave]);
  const typeColors: Record<string, { bg: string; color: string; border: string }> = {
    world: { bg: "rgba(183,255,0,0.08)", color: "var(--accent, #B7FF00)", border: "rgba(183,255,0,0.12)" },
    org: { bg: "rgba(144,202,249,0.08)", color: "var(--info, #42A5F5)", border: "rgba(144,202,249,0.12)" },
    character: { bg: "rgba(255,183,77,0.08)", color: "var(--canon-core, #FFB74D)", border: "rgba(255,183,77,0.12)" },
    location: { bg: "rgba(206,147,216,0.08)", color: "var(--canon-draft, #CE93D8)", border: "rgba(206,147,216,0.12)" },
  };
  const tc = typeColors[card.type] || typeColors.world;

  const containerStyle: React.CSSProperties = {
    background: "#1a1a1a",
    border: "1px solid " + (highlighted ? "var(--accent, #B7FF00)" : "var(--border-default, #2a2a2a)"),
    borderRadius: "var(--radius-lg, 12px)",
    borderLeft: "3px solid " + tc.color,
    overflow: "hidden",
    boxShadow: highlighted ? "0 0 20px rgba(183, 255, 0, 0.15), 0 4px 20px rgba(0, 0, 0, 0.4)" : "none",
    margin: "12px 0 8px",
  };

  const headerStyle: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 10, padding: "14px 16px 8px",
  };

  const typeBadgeStyle: React.CSSProperties = {
    fontSize: "0.625rem", fontWeight: 600, padding: "2px 8px", borderRadius: 3,
    background: tc.bg, color: tc.color,
    border: "1px solid " + tc.border,
    letterSpacing: "0.5px", flexShrink: 0,
  };

  const titleStyle: React.CSSProperties = {
    fontSize: "0.9375rem", fontWeight: 600, color: "var(--text-primary, #e0e0e0)", flex: 1,
    minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
  };

  const bodyStyle: React.CSSProperties = {
    padding: "0 16px 10px", fontSize: "0.8125rem", lineHeight: 1.65,
    color: "var(--text-secondary, #a0a0a0)",
  };

  const actionsStyle: React.CSSProperties = {
    display: "flex", gap: 6, padding: "8px 16px 12px",
    borderTop: "1px solid var(--border-default, #2a2a2a)",
  };
  const actionBtnStyle: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 12px",
    borderRadius: "var(--radius-sm, 6px)", fontSize: "0.75rem",
    border: "none", background: "transparent", color: "var(--text-secondary, #a0a0a0)",
    cursor: "pointer", transition: "all 0.12s",
  };

  const primaryBtnStyle: React.CSSProperties = {
    ...actionBtnStyle,
    background: "rgba(183,255,0,0.1)", color: "var(--accent, #B7FF00)",
    border: "1px solid rgba(183,255,0,0.15)",
  };

  const sectionStyle: React.CSSProperties = {
    borderTop: "1px solid var(--border-default, #2a2a2a)", padding: "10px 16px",
  };

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: "0.6875rem", fontWeight: 600, color: "var(--text-muted, #666)",
    textTransform: "uppercase", letterSpacing: "1px", marginBottom: 6,
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "6px 10px", background: "var(--bg-canvas, #0a0a0a)",
    border: "1px solid var(--border-default, #2a2a2a)",
    borderRadius: "var(--radius-sm, 6px)", color: "var(--text-primary, #e0e0e0)",
    fontSize: "0.8125rem", fontFamily: "var(--font-sans, sans-serif)",
    outline: "none", boxSizing: "border-box", transition: "border-color 0.12s", resize: "vertical",
  };

  const sectionInputStyle: React.CSSProperties = { ...inputStyle, marginBottom: 8, fontWeight: 600, fontSize: "0.75rem" };

  const richContentStyle: React.CSSProperties = {
    fontSize: "0.8125rem", lineHeight: 1.65, color: "var(--text-secondary, #a0a0a0)",
    fontFamily: "var(--font-sans, sans-serif)",
  };

  const f = (e: React.FocusEvent) => { const t = e.currentTarget as HTMLElement; t.style.borderColor = "var(--accent, #B7FF00)"; t.style.boxShadow = "0 0 0 1px rgba(183,255,0,0.1)"; };
  const b = (e: React.FocusEvent) => { const t = e.currentTarget as HTMLElement; t.style.borderColor = "var(--border-default, #2a2a2a)"; t.style.boxShadow = "none"; };

  return (
    <div className={"ai-doc-card" + (highlighted ? " highlighted" : "")} style={containerStyle}>
      <div style={headerStyle}>
        <span style={typeBadgeStyle}>{card.typeLabel}</span>
        {editing ? (
          <input style={{ ...inputStyle, fontSize: "0.9375rem", fontWeight: 600, flex: 1 }}
            value={editTitle} onChange={e => setEditTitle(e.target.value)}
            onFocus={f} onBlur={b} />
        ) : (
          <span style={titleStyle}>{card.title}</span>
        )}
        {card.status && !editing && (
          <span style={{ fontSize: "0.625rem", color: "var(--text-muted, #666)", flexShrink: 0 }}>{card.status}</span>
        )}
        {editing && <SaveIndicator status={saveStatus} onRetry={handleSave} />}
      </div>

      {editing ? (
        <div style={{ padding: "0 16px 10px" }}>
          <textarea style={{ ...inputStyle, minHeight: 80, fontFamily: "var(--font-sans, sans-serif)", lineHeight: 1.65 }}
            value={editBody} onChange={e => setEditBody(e.target.value)} placeholder="内容..." />
        </div>
      ) : (
        <div style={bodyStyle}>
          <div style={richContentStyle} dangerouslySetInnerHTML={{ __html: card.bodyHTML }} />
        </div>
      )}

      {(card.sections || editing) && (
        <div style={{ padding: 0 }}>
          {(editing ? editSections : card.sections || []).map((section, i) => (
            <div key={i} style={sectionStyle}>
              {editing ? (
                <div>
                  <input style={sectionInputStyle} value={section.title}
                    onChange={e => { const n = [...editSections]; n[i] = { ...n[i], title: e.target.value }; setEditSections(n); }}
                    placeholder="章节标题" />
                  <textarea style={{ ...inputStyle, minHeight: 60 }} value={section.content}
                    onChange={e => { const n = [...editSections]; n[i] = { ...n[i], content: e.target.value }; setEditSections(n); }}
                    placeholder="章节内容..." />
                </div>
              ) : (
                <><div style={sectionTitleStyle}>{section.title}</div><div style={richContentStyle}>{section.content}</div></>
              )}
            </div>
          ))}
          {editing && (
            <div style={{ ...sectionStyle, display: "flex", gap: 6 }}>
              <button style={{ ...actionBtnStyle, fontSize: "0.6875rem", border: "1px dashed var(--border-default, #2a2a2a)" }}
                onClick={() => setEditSections([...editSections, { title: "", content: "" }])}>+ 添加章节</button>
            </div>
          )}
        </div>
      )}
      <div style={actionsStyle}>
        {editing ? (
          <><button style={primaryBtnStyle} onClick={handleSave}>保存</button>
          <button style={actionBtnStyle} onClick={handleCancel}>取消</button></>
        ) : (
          <><button style={primaryBtnStyle} onClick={handleEdit}>编辑</button>
          {onCollect && <button style={actionBtnStyle} onClick={() => onCollect(card.id)}>收录为设定</button>}
          {onExpand && <button style={actionBtnStyle} onClick={() => onExpand(card.id)}>继续展开</button>}</>
        )}
      </div>
    </div>
  );
}

