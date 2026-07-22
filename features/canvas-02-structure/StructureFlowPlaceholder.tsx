/**
 * StructureFlowPlaceholder — 画板② 大纲占位壳 (织梦机 v2)
 *
 * Displays a placeholder indicating the structure flow view is coming soon.
 * Does NOT import CanvasView.
 */

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    padding: 40,
    textAlign: 'center',
  },
  icon: {
    fontSize: '3rem',
    marginBottom: 20,
    opacity: 0.5,
  },
  title: {
    fontSize: '1.2rem',
    fontWeight: 700,
    color: '#e0e0e0',
    marginBottom: 12,
  },
  desc: {
    fontSize: '0.85rem',
    color: '#888',
    maxWidth: 400,
    lineHeight: 1.7,
    marginBottom: 20,
  },
  hint: {
    fontSize: '0.78rem',
    color: '#555',
    padding: '10px 16px',
    border: '1px dashed #333',
    borderRadius: 8,
    maxWidth: 360,
    lineHeight: 1.6,
  },
};

export default function StructureFlowPlaceholder() {
  return (
    <div style={styles.container}>
      <div style={styles.icon}>🏗️</div>
      <div style={styles.title}>新的结构图即将到来</div>
      <div style={styles.desc}>
        我们正在重新设计故事结构视图。你将能在此处通过可视化方式，
        构建三幕式结构、情节点映射和章节流程。
      </div>
      <div style={styles.hint}>
        当前版本的结构功能在"文档"和"画板"标签页中可用。
        请先在前提画板中完成前提定义。
      </div>
    </div>
  );
}
