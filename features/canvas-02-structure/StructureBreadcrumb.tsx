/**
 * StructureBreadcrumb — 层级导航面包屑 (织梦机 v2.1.0)
 *
 * Displays current navigation path: Book > Shiwei > Hou > Zhang
 * Click any segment to jump to that layer.
 */
import type { LayerType } from '../../contracts/structure.contract';

export interface BreadcrumbSegment {
  type: LayerType;
  nodeId: string | null;
  label: string;
}

interface StructureBreadcrumbProps {
  segments: BreadcrumbSegment[];
  onNavigate: (segment: BreadcrumbSegment) => void;
}

const LAYER_LABELS: Record<LayerType, string> = {
  book: '作品',
  shiwei: '始位',
  hou: '后',
  zhang: '章',
};

export default function StructureBreadcrumb({ segments, onNavigate }: StructureBreadcrumbProps) {
  if (segments.length === 0) return null;

  return (
    <nav className="c2-breadcrumb" aria-label="层级导航">
      {segments.map((seg, i) => (
        <span key={`${seg.type}-${seg.nodeId || 'root'}`} className="c2-breadcrumb-row">
          {i > 0 && <span className="c2-breadcrumb-sep">›</span>}
          <button
            className={`c2-breadcrumb-btn ${i === segments.length - 1 ? 'c2-breadcrumb-current' : ''}`}
            onClick={() => onNavigate(seg)}
            disabled={i === segments.length - 1}
            title={`跳转到${LAYER_LABELS[seg.type]}`}
          >
            <span className="c2-breadcrumb-dot" data-layer={seg.type} />
            <span className="c2-breadcrumb-label">{seg.label || LAYER_LABELS[seg.type]}</span>
          </button>
        </span>
      ))}
    </nav>
  );
}
