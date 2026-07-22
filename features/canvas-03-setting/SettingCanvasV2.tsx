/**
 * SettingCanvasV2 — 画板③ 设定画板 (织梦机 v2)
 *
 * Three-tab container for World Rules / Characters / Factions.
 * Each tab manages its own CRUD via the corresponding Panel component.
 * Bottom "确认设定" button advances the pipeline state.
 */

import { useState, useCallback } from 'react';
import { useProjectStore } from '../../stores/projectStore';
import { confirmSetting } from '../../stores/pipeline-helper';
import { Tabs, Button } from '../../components/ui';
import { useToast } from '../../components/Toast';
import type { Tab } from '../../components/ui';
import WorldRulePanel from './WorldRulePanel';
import CharacterPanel from './CharacterPanel';
import FactionPanel from './FactionPanel';
import SparrowStepList from './SparrowStepList';
import './setting-canvas.css';

type SettingTab = 'world-rules' | 'characters' | 'factions' | 'sparrow';

const TABS: Tab[] = [
  { id: 'world-rules', label: '世界观' },
  { id: 'characters', label: '角色' },
  { id: 'factions', label: '势力' },
  { id: 'sparrow', label: 'Sparrow 模式' },
];

export default function SettingCanvasV2() {
  const projectId = useProjectStore(s => s.currentProjectId);
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<SettingTab>('world-rules');

  const handleConfirm = useCallback(async () => {
    if (!projectId) return;
    try {
      await confirmSetting(projectId);
      showToast('设定已确认，细纲画板已解锁', 'success');
    } catch (e) {
      console.error('Failed to confirm setting', e);
      showToast('确认设定失败', 'error');
    }
  }, [projectId, showToast]);

  return (
    <div className="setting-canvas-wrapper">
      {/* Tab Bar — using Tabs primitive */}
      <Tabs tabs={TABS} activeTab={activeTab} onChange={(id) => setActiveTab(id as SettingTab)} />

      {/* Content */}
      <div className="setting-canvas-content">
        {activeTab === 'world-rules' && <WorldRulePanel />}
        {activeTab === 'characters' && <CharacterPanel />}
        {activeTab === 'factions' && <FactionPanel />}
        {activeTab === 'sparrow' && <SparrowStepList />}
      </div>

      {/* Footer with Confirm Button */}
      <div className="setting-canvas-footer">
        <Button variant="primary" onClick={handleConfirm}>
          确认设定 ✓
        </Button>
      </div>
    </div>
  );
}
