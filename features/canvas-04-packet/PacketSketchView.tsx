/**
 * PacketSketchView — 快速草图模式
 * 显示 L1-L3 摘要卡片
 */
import { useState, useEffect } from 'react';
import type { WritingContract, ActiveContext, NarrativeCompression, ChapterPacket } from '../../contracts/chapter-packet.contract';
import { Badge, LoadingState } from '../../components/ui';

interface PacketSketchViewProps {
  packetId?: string;
  title?: string;
  chapterFunction?: string;
  position?: string;
  layer1?: WritingContract;
  layer2?: ActiveContext;
  layer3?: NarrativeCompression;
}


export default function PacketSketchView({ packetId }: PacketSketchViewProps) {
  const [loading, setLoading] = useState(true);
  const [packet, setPacket] = useState<ChapterPacket | null>(null);

  useEffect(() => {
    if (!packetId) { setLoading(false); return; }
    // Load packet data from API
    import('../../api/chapterPacketApi').then(api => {
      api.getChapterPacket(packetId).then(data => {
        setPacket(data);
        setLoading(false);
      }).catch(() => setLoading(false));
    });
  }, [packetId]);

  if (loading) return <LoadingState variant="skeleton" />;
  if (!packet) return <div style={{ padding: 24, color: 'var(--text-secondary)', textAlign: 'center' }}>选择细纲包查看草图</div>;

  let l1: any = {};
  let l2: any = {};
  let l3: any = {};
  try { l1 = JSON.parse(packet.layer1) || {}; } catch {}
  try { l2 = JSON.parse(packet.layer2) || {}; } catch {}
  try { l3 = JSON.parse(packet.layer3) || {}; } catch {}

  return (
    <div className="packet-sketch-view" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ background: 'var(--bg-raised)', borderRadius: 'var(--radius-md)', padding: 16, border: '1px solid var(--border-default)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Badge variant="default">L1</Badge>
          <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 'var(--text-sm)' }}>写作契约</span>
        </div>
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <span>距离: {l1.narrativeDistance === 'close' ? '近距' : l1.narrativeDistance === 'medium' ? '中距' : '远距'}</span>
          <span>禁忌: {(l1.taboos || []).length}条</span>
        </div>
      </div>
      <div style={{ background: 'var(--bg-raised)', borderRadius: 'var(--radius-md)', padding: 16, border: '1px solid var(--border-default)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Badge variant="default">L2</Badge>
          <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 'var(--text-sm)' }}>活跃设定</span>
        </div>
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <span>角色: {(l2.characters || []).length}</span><span>场景: {(l2.scenes || []).length}</span>
          <span>回顾: {(l2.recap || '').slice(0, 40) || '无'}</span>
        </div>
      </div>
      <div style={{ background: 'var(--bg-raised)', borderRadius: 'var(--radius-md)', padding: 16, border: '1px solid var(--border-default)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Badge variant="default">L3</Badge>
          <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 'var(--text-sm)' }}>剧情压缩</span>
        </div>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{(l3.narrative || '').slice(0, 200) || '空'}</p>
      </div>
    </div>
  );
}
