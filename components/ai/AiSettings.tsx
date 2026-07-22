import './ai-settings.css';
import { Key, Brain, BarChart3, DollarSign, Check, X, RefreshCw, TriangleAlert, CheckCircle } from 'lucide-react';
// Brain already imported above — used in sidebar for AI Control Center nav
import React, { useState, useCallback } from 'react';
import type { ProviderConfig, AiModel, UsageStats, SettingsTab } from '../../types/ai';
import { PRESET_PROVIDERS, DEFAULT_MODELS } from '../../types/ai';

interface AiSettingsProps {
  onClose: () => void;
  providers: ProviderConfig[];
  activeModelId: string;
  usageStats: UsageStats;
  onSaveProviders?: (providers: ProviderConfig[]) => void;
  onChangeModel?: (modelId: string) => void;
  onSaveBudget?: (budget: number) => void;
  /** 导航到 AI Control Center 页面 */
  onNavigateToControlCenter?: () => void;
}

const ICONS = { api: <Key size={16} />, models: <Brain size={16} />, usage: <BarChart3 size={16} />, cost: <DollarSign size={16} /> };

const TABS: Array<{ id: SettingsTab; label: string; icon: React.ReactNode }> = [
  { id: 'api-keys', label: 'API Keys', icon: ICONS.api },
  { id: 'models', label: '模型选择', icon: ICONS.models },
  { id: 'usage', label: '用量监控', icon: ICONS.usage },
  { id: 'cost', label: '费用', icon: ICONS.cost },
];

export default function AiSettings({ onClose, providers: initialProviders, activeModelId, usageStats, onSaveProviders, onChangeModel, onSaveBudget, onNavigateToControlCenter }: AiSettingsProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('api-keys');
  const [providers, setProviders] = useState<ProviderConfig[]>(initialProviders);
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { status: 'pending' | 'success' | 'fail'; message: string }>>({});
  const [selectedModel, setSelectedModel] = useState(activeModelId);
  const [budgetInput, setBudgetInput] = useState(String(usageStats.budgetLimit ?? 0));
  const handleToggleProvider = useCallback((id: string) => {
    setExpandedProvider(prev => prev === id ? null : id);
  }, []);

  const handleAddProvider = useCallback((presetId: string) => {
    const preset = PRESET_PROVIDERS.find(p => p.id === presetId);
    if (!preset) return;
    const exists = providers.find(p => p.id === presetId);
    if (exists) return;
    const newProvider: ProviderConfig = {
      id: preset.id, name: preset.name, icon: preset.icon,
      apiKey: '', endpoint: preset.defaultEndpoint, timeout: 30,
      models: preset.defaultModels, status: 'disconnected',
    };
    setProviders(prev => [...prev, newProvider]);
    setExpandedProvider(presetId);
  }, [providers]);

  const handleUpdateProvider = useCallback((id: string, updates: Partial<ProviderConfig>) => {
    setProviders(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  }, []);

  const handleRemoveProvider = useCallback((id: string) => {
    setProviders(prev => prev.filter(p => p.id !== id));
    if (expandedProvider === id) setExpandedProvider(null);
  }, [expandedProvider]);

  const handleTestConnection = useCallback(async (provider: ProviderConfig) => {
    setTestResults(prev => ({ ...prev, [provider.id]: { status: 'pending', message: '正在连接...' } }));
    const startTime = performance.now();

    try {
      const hasTauri = typeof window !== 'undefined' && !!(window as any).__TAURI_INTERNALS__;
      let success = false;
      let message = '';
      let models: string[] = [];

      // 直接 fetch 测试连接，不走 Tauri invoke
      if (hasTauri && provider.apiKey) {
        const url = provider.endpoint.replace(/\/+$/, '') + '/models';
        const response = await fetch(url, {
          headers: { 'Authorization': 'Bearer ' + provider.apiKey },
          signal: AbortSignal.timeout((provider.timeout || 30) * 1000),
        });
        const latency = Math.round(performance.now() - startTime);

        if (response.ok) {
          const data = await response.json();
          models = (data.data || data.models || []).map((m: any) => m.id || m.name || m);
          success = true;
          message = '连接成功 — 响应时间 ' + latency + 'ms' + (models.length > 0 ? ' · 模型列表已获取' : '');
        } else {
          message = '连接失败 — HTTP ' + response.status + ': ' + response.statusText;
        }
      }

      if (success) {
        setTestResults(prev => ({ ...prev, [provider.id]: { status: 'success', message } }));
        handleUpdateProvider(provider.id, { status: 'connected' as const });
      } else {
        setTestResults(prev => ({ ...prev, [provider.id]: { status: 'fail', message } }));
        handleUpdateProvider(provider.id, { status: 'error' as const });
      }
    } catch (err) {
      setTestResults(prev => ({ ...prev, [provider.id]: {
        status: 'fail',
        message: '连接失败 — ' + ((err as Error).message || '未知错误'),
      }}));
      handleUpdateProvider(provider.id, { status: 'error' as const });
    }
  }, [handleUpdateProvider]);
  const handleSaveSettings = useCallback(() => {
    if (onSaveProviders) onSaveProviders(providers);
    if (onChangeModel) onChangeModel(selectedModel);
    if (onSaveBudget) onSaveBudget(parseInt(budgetInput) || 0);
    // 通过 v2 save_provider_config 持久化 Provider 配置
    (async () => {
      try {
        const { saveProviderConfig } = await import('../../api/aiControlCenterApi');
        for (const p of providers) {
          if (p.apiKey) {
            await saveProviderConfig({
              providerId: p.id,
              providerName: p.name || p.id,
              apiKeyEncrypted: p.apiKey,
              endpoint: p.endpoint || '',
              models: typeof p.models === 'string' ? [p.models] : (p.models || []),
              timeoutMs: (p.timeout || 30) * 1000,
            });
          }
        }
      } catch { /* save best-effort */ }
    })();
    onClose();
  }, [providers, selectedModel, budgetInput, onSaveProviders, onChangeModel, onSaveBudget, onClose]);

  const s = {
    overlay: { position: 'fixed' as const, inset: 0, zIndex: 1000, display: 'flex', flexDirection: 'column' as const, background: 'rgba(0,0,0,0.75)' },
    nav: { display: 'flex', alignItems: 'center', height: 44, background: 'var(--bg-header, #0e0e0e)', borderBottom: '1px solid var(--border-default, #2a2a2a)', padding: '0 16px', gap: 12, flexShrink: 0 },
    layout: { display: 'flex', flex: 1, overflow: 'hidden', background: 'var(--bg-surface, #141414)', margin: '0 auto', width: '100%', maxWidth: 960 },
    sidebar: { width: 200, minWidth: 200, background: 'var(--bg-surface, #141414)', borderRight: '1px solid var(--border-default, #2a2a2a)', display: 'flex', flexDirection: 'column' as const, overflow: 'hidden' },
    content: { flex: 1, overflowY: 'auto' as const, padding: '24px 32px', background: 'var(--bg-surface, #141414)' },
    title: { fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary, #e0e0e0)', marginBottom: 4 },
    desc: { fontSize: '0.8125rem', color: 'var(--text-secondary, #a0a0a0)', marginBottom: 16 },
    sectionTitle: { fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted, #666)', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 12 },
    card: { background: 'var(--bg-surface, #141414)', border: '1px solid var(--border-default, #2a2a2a)', borderRadius: 'var(--radius-md, 8px)', overflow: 'hidden', marginBottom: 12 },
    cardHeader: { display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', cursor: 'pointer', userSelect: 'none' as const },
    formInput: { width: '100%', padding: '7px 10px', background: 'var(--bg-canvas, #0a0a0a)', border: '1px solid var(--border-default, #2a2a2a)', borderRadius: 'var(--radius-sm, 6px)', color: 'var(--text-primary, #e0e0e0)', fontSize: '0.8125rem', outline: 'none', boxSizing: 'border-box' as const, fontFamily: 'var(--font-mono, monospace)' },
    label: { fontSize: '0.75rem', color: 'var(--text-secondary, #a0a0a0)', fontWeight: 500, marginBottom: 4, display: 'block' },
    btn2: { padding: '5px 12px', borderRadius: 'var(--radius-sm, 6px)', fontSize: '0.75rem', border: '1px solid var(--border-default, #2a2a2a)', background: 'var(--bg-raised, #1e1e1e)', color: 'var(--text-secondary, #a0a0a0)', cursor: 'pointer' },
    btnP: { padding: '5px 12px', borderRadius: 'var(--radius-sm, 6px)', fontSize: '0.75rem', border: 'none', background: 'var(--accent, #B7FF00)', color: '#0a0a0a', cursor: 'pointer', fontWeight: 500 },
    btnD: { padding: '5px 12px', borderRadius: 'var(--radius-sm, 6px)', fontSize: '0.75rem', border: '1px solid rgba(244,67,54,0.2)', background: 'rgba(244,67,54,0.1)', color: 'var(--danger, #f44336)', cursor: 'pointer' },
  };
  const renderApiKeys = () => (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div className="ai-settings-title">API Key 管理</div>
        <div style={s.desc}>配置各 AI 提供商的密钥和端点。所有密钥在本地加密存储，不会发送到任何第三方服务器。</div>
      </div>
      <div style={{ marginBottom: 32 }}>
        <div style={s.sectionTitle}>已配置的提供商</div>
        {providers.length === 0 && (
          <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted, #666)' }}>
            <div style={{ fontSize: '2rem', marginBottom: 8, opacity: 0.4 }}>{ICONS.api}</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary, #a0a0a0)', marginBottom: 4 }}>暂无配置</div>
            <div style={{ fontSize: '0.75rem', marginBottom: 12 }}>从下方添加 AI 提供商</div>
          </div>
        )}
        {providers.map(p => (
          <div key={p.id} className={'ai-provider-card' + (expandedProvider === p.id ? ' expanded' : '')} style={s.card}>
            <div style={s.cardHeader} onClick={() => handleToggleProvider(p.id)}>
              <div style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0, background: 'rgba(183,255,0,0.08)' }}>{p.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary, #e0e0e0)' }}>{p.name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #a0a0a0)', marginTop: 2 }}>{p.models.join(' · ')}</div>
              </div>
              {(() => {
                const colors: Record<string, string> = { connected: 'var(--success, #4CAF50)', disconnected: 'var(--text-muted, #666)', error: 'var(--danger, #f44336)' };
                const labels: Record<string, string> = { connected: '已连接', disconnected: '未配置', error: '连接错误' };
                const c = p.status;
                return <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.75rem', padding: '2px 10px', borderRadius: 20, border: '1px solid', color: colors[c], borderColor: colors[c] + '40', background: colors[c] + '10', flexShrink: 0 }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: colors[c], flexShrink: 0 }} />
                  {labels[c]}
                </span>;
              })()}
              <span style={{ color: 'var(--text-muted, #666)', fontSize: '0.6rem', transition: 'transform 0.2s', transform: expandedProvider === p.id ? 'rotate(180deg)' : 'none', flexShrink: 0 }}>▼</span>
            </div>
            <div className="ai-provider-card-body">
              <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border-default, #2a2a2a)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={s.label}>API Key</label>
                  <input style={{ ...s.formInput, fontFamily: 'var(--font-mono, monospace)' }} type="password" value={p.apiKey} placeholder={p.id === 'local' ? '可选' : 'sk-...'}
                    onChange={e => handleUpdateProvider(p.id, { apiKey: e.target.value })} />
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                  <div style={{ flex: 1 }}>
                    <label style={s.label}>Endpoint URL（可选）</label>
                    <input style={s.formInput} type="text" value={p.endpoint} placeholder="https://api.openai.com/v1"
                      onChange={e => handleUpdateProvider(p.id, { endpoint: e.target.value })} />
                  </div>
                  <div style={{ maxWidth: 100 }}>
                    <label style={s.label}>超时（秒）</label>
                    <input style={s.formInput} type="number" value={p.timeout} onChange={e => handleUpdateProvider(p.id, { timeout: parseInt(e.target.value) || 30 })} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <button style={s.btnP} onClick={() => handleTestConnection(p)}>测试连接</button>
                  <button style={s.btn2}>保存</button>
                  <button style={{ ...s.btnD, marginLeft: 'auto' }} onClick={() => handleRemoveProvider(p.id)}>移除</button>
                </div>
                {testResults[p.id] && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', padding: '6px 10px', borderRadius: 'var(--radius-sm, 6px)', marginTop: 4,
                    background: testResults[p.id].status === 'success' ? 'rgba(76,175,80,0.08)' : testResults[p.id].status === 'fail' ? 'rgba(244,67,54,0.08)' : 'rgba(255,193,7,0.06)',
                    color: testResults[p.id].status === 'success' ? 'var(--success, #4CAF50)' : testResults[p.id].status === 'fail' ? 'var(--danger, #f44336)' : 'var(--warning, #FFC107)',
                    border: '1px solid ' + (testResults[p.id].status === 'success' ? 'rgba(76,175,80,0.15)' : testResults[p.id].status === 'fail' ? 'rgba(244,67,54,0.15)' : 'rgba(255,193,7,0.12)'),
                  }}>
                    {testResults[p.id].status === 'success' ? <Check size={14} /> : testResults[p.id].status === 'fail' ? <X size={14} /> : <RefreshCw size={14} />} {testResults[p.id].message}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div>
        <div style={s.sectionTitle}>添加提供商</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {PRESET_PROVIDERS.map(pp => (
            <button key={pp.id} style={{ ...s.btn2, display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', fontSize: '0.8125rem' }} onClick={() => handleAddProvider(pp.id)}>
              {pp.icon} {pp.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
  const renderModels = () => (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div className="ai-settings-title">选择 AI 模型</div>
        <div style={s.desc}>切换对话中使用的底层模型。切换不会丢失当前的对话上下文。</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {DEFAULT_MODELS.map(model => (
          <div key={model.id} className={'ai-model-item' + (selectedModel === model.id ? ' active' : '')}
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 'var(--radius-sm, 6px)', cursor: 'pointer', border: '1px solid ' + (selectedModel === model.id ? 'rgba(183,255,0,0.2)' : 'transparent'), background: selectedModel === model.id ? 'var(--accent-soft, rgba(183,255,0,0.1))' : 'transparent' }}
            onClick={() => setSelectedModel(model.id)}>
            <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid ' + (selectedModel === model.id ? 'var(--accent, #B7FF00)' : 'var(--border-light, #333)'), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: selectedModel === model.id ? 'var(--accent, #B7FF00)' : 'transparent' }}>
              {selectedModel === model.id && <Check size={10} color="#0a0a0a" />}
            </div>
            <div style={{ width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', flexShrink: 0, background: model.providerId === 'openai' ? 'rgba(66,165,245,0.12)' : model.providerId === 'anthropic' ? 'rgba(255,152,0,0.12)' : 'rgba(183,255,0,0.08)' }}>{model.icon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-primary, #e0e0e0)' }}>{model.name}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted, #666)', marginTop: 1 }}>{model.description}</div>
            </div>
            <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted, #666)', whiteSpace: 'nowrap' }}>{model.costPer1KTokens > 0 ? '$' + model.costPer1KTokens + '/1K tokens' : <span style={{ color: 'var(--success, #4CAF50)' }}>免费</span>}</span>
          </div>
        ))}
      </div>
    </div>
  );
  const renderUsage = () => {
    const pct = usageStats.maxTokens > 0 ? (usageStats.todayTokens / usageStats.maxTokens) * 100 : 0;
    const badgeStyle = pct >= 95 ? { background: 'rgba(244,67,54,0.08)', color: 'var(--danger, #f44336)', border: '1px solid rgba(244,67,54,0.15)' }
      : pct >= 80 ? { background: 'rgba(255,193,7,0.08)', color: 'var(--warning, #FFC107)', border: '1px solid rgba(255,193,7,0.15)' }
      : { background: 'rgba(76,175,80,0.08)', color: 'var(--success, #4CAF50)', border: '1px solid rgba(76,175,80,0.15)' };
    return (
      <div>
        <div style={{ marginBottom: 24 }}>
          <div className="ai-settings-title">用量监控</div>
          <div style={s.desc}>查看今日的 token 使用量和各模型分解。</div>
        </div>
        <div style={{ background: 'var(--bg-surface, #141414)', border: '1px solid var(--border-default, #2a2a2a)', borderRadius: 'var(--radius-lg, 12px)', overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-default, #2a2a2a)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary, #e0e0e0)', flex: 1 }}>今日用量</span>
          </div>
          <div style={{ padding: 18 }}>
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted, #666)', textTransform: 'uppercase', letterSpacing: 1 }}>Tokens 使用量</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary, #e0e0e0)' }}>{usageStats.todayTokens.toLocaleString()} <small style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-muted, #666)' }}>/ {usageStats.maxTokens.toLocaleString()}</small></span>
              </div>
              <div style={{ height: 8, background: 'var(--bg-raised, #1e1e1e)', borderRadius: 4, overflow: 'hidden' }}>
                <div className="ai-usage-bar-fill" style={{ width: Math.min(pct, 100) + '%', height: '100%', borderRadius: 4 }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: '0.625rem', color: 'var(--text-muted, #666)', padding: '0 2px' }}>
                <span>0</span>
                <span style={{ color: 'var(--warning, #FF9800)' }}>{(usageStats.maxTokens * 0.5).toLocaleString()}</span>
                <span style={{ color: 'var(--danger, #f44336)' }}>{(usageStats.maxTokens * 0.8).toLocaleString()}</span>
                <span>{usageStats.maxTokens.toLocaleString()}</span>
              </div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20, fontSize: '0.75rem', marginTop: 8, ...badgeStyle }}>
                {pct >= 95 ? <><TriangleAlert size={14} /> 严重超额</> : pct >= 80 ? <><TriangleAlert size={14} /> 接近限额</> : <><CheckCircle size={14} /> 用量正常</>} — 已使用 {pct.toFixed(1)}%
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted, #666)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>各模型分解</div>
              {usageStats.dailyHistory.length > 0 && usageStats.dailyHistory[usageStats.dailyHistory.length - 1]?.models.map((m, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < (usageStats.dailyHistory[usageStats.dailyHistory.length - 1]?.models.length || 0) - 1 ? '1px solid var(--border-default, #2a2a2a)' : 'none' }}>
                  <div style={{ width: 24, height: 24, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', flexShrink: 0, background: m.providerName === 'OpenAI' ? 'rgba(66,165,245,0.1)' : m.providerName === 'Anthropic' ? 'rgba(255,152,0,0.1)' : 'rgba(183,255,0,0.08)' }}>{m.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-primary, #e0e0e0)', fontWeight: 500 }}>{m.modelName}</div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted, #666)' }}>{m.providerName}</div>
                  </div>
                  <div style={{ width: 60, flexShrink: 0 }}>
                    <div style={{ height: 4, background: 'var(--bg-raised, #1e1e1e)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 2, background: m.providerName === 'OpenAI' ? 'var(--info, #42A5F5)' : m.providerName === 'Anthropic' ? 'var(--warning, #FF9800)' : 'var(--accent, #B7FF00)', width: Math.min((m.tokens / Math.max(usageStats.todayTokens, 1)) * 100, 100) + '%' }} />
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-primary, #e0e0e0)', fontWeight: 500 }}>{m.tokens.toLocaleString()}</div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted, #666)' }}></div>
                  </div>
                </div>
              ))}
              {(!usageStats.dailyHistory.length || !usageStats.dailyHistory[usageStats.dailyHistory.length - 1]?.models.length) && (
                <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted, #666)', fontSize: '0.8125rem' }}>暂无用量数据</div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };
  const renderCost = () => (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div className="ai-settings-title">费用估算</div>
        <div style={s.desc}>查看 AI 使用费用和设定月预算。</div>
      </div>
      <div style={{ background: 'var(--bg-surface, #141414)', border: '1px solid var(--border-default, #2a2a2a)', borderRadius: 'var(--radius-lg, 12px)', overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-default, #2a2a2a)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary, #e0e0e0)', flex: 1 }}>费用</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #666)' }}>本月至今</span>
        </div>
        <div style={{ padding: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ background: 'var(--bg-raised, #1e1e1e)', border: '1px solid var(--border-default, #2a2a2a)', borderRadius: 'var(--radius-md, 8px)', padding: 14, textAlign: 'center' }}>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary, #e0e0e0)' }}></div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted, #666)', marginTop: 4 }}>今日花费</div>
            </div>
            <div style={{ background: 'var(--bg-raised, #1e1e1e)', border: '1px solid var(--border-default, #2a2a2a)', borderRadius: 'var(--radius-md, 8px)', padding: 14, textAlign: 'center' }}>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary, #e0e0e0)' }}> <small style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-muted, #666)' }}>USD</small></div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted, #666)', marginTop: 4 }}>本月累计</div>
            </div>
          </div>
          <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--bg-raised, #1e1e1e)', border: '1px solid var(--border-default, #2a2a2a)', borderRadius: 'var(--radius-md, 8px)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary, #a0a0a0)', flex: 1 }}>设定月预算上限</span>
            <input type="number" value={budgetInput} onChange={e => setBudgetInput(e.target.value)}
              style={{ width: 60, padding: '4px 6px', background: 'var(--bg-canvas, #0a0a0a)', border: '1px solid var(--border-default, #2a2a2a)', borderRadius: 'var(--radius-sm, 6px)', color: 'var(--text-primary, #e0e0e0)', fontSize: '0.8125rem', textAlign: 'right', fontFamily: 'var(--font-mono, monospace)' }} />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #666)' }}>USD</span>
          </div>
        </div>
      </div>
    </div>
  );
  return (
    <div className="ai-settings-overlay">
      <div className="ai-settings-nav">
        <button onClick={onClose} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: 'var(--text-secondary, #a0a0a0)', cursor: 'pointer', fontSize: '0.8125rem', padding: '4px 8px', borderRadius: 'var(--radius-sm, 6px)' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>返回
        </button>
        <div style={{ width: 1, height: 20, background: 'var(--border-default, #2a2a2a)', flexShrink: 0 }} />
        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary, #e0e0e0)' }}>设置</span>
        <div style={{ flex: 1 }} />
        <button onClick={handleSaveSettings} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 'var(--radius-sm, 6px)', fontSize: '0.75rem', border: 'none', background: 'var(--accent, #B7FF00)', color: '#0a0a0a', cursor: 'pointer', fontWeight: 500 }}>保存设置</button>
      </div>
      <div className="ai-settings-layout">
        <div className="ai-settings-sidebar">
          <div style={{ padding: '14px 16px 10px', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted, #666)', textTransform: 'uppercase', letterSpacing: 1, borderBottom: '1px solid var(--border-default, #2a2a2a)' }}>设置</div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
            {TABS.map(tab => (
              <div key={tab.id} className={'ai-settings-nav-item' + (activeTab === tab.id ? ' active' : '')}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', cursor: 'pointer', borderLeft: '2px solid ' + (activeTab === tab.id ? 'var(--accent, #B7FF00)' : 'transparent'), fontSize: '0.8125rem', color: activeTab === tab.id ? 'var(--text-primary, #e0e0e0)' : 'var(--text-secondary, #a0a0a0)', background: activeTab === tab.id ? 'var(--accent-soft, rgba(183,255,0,0.1))' : 'transparent', userSelect: 'none' }}
                onClick={() => setActiveTab(tab.id)}>
                <span style={{ width: 20, textAlign: 'center', flexShrink: 0 }}>{tab.icon}</span>
                {tab.label}
              </div>
            ))}
            {/* AI Control Center 导航 */}
            {onNavigateToControlCenter && (
              <div style={{
                borderTop: '1px solid var(--border-default, #2a2a2a)',
                marginTop: 8, paddingTop: 8,
              }}>
                <div
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 16px', cursor: 'pointer',
                    borderLeft: '2px solid transparent',
                    fontSize: '0.8125rem',
                    color: 'var(--text-secondary, #a0a0a0)',
                    userSelect: 'none',
                    transition: 'background 0.15s',
                  }}
                  onClick={onNavigateToControlCenter}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(183,255,0,0.08)'; e.currentTarget.style.color = 'var(--accent, #B7FF00)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary, #a0a0a0)'; }}
                >
                  <Brain size={16} />
                  <span>AI Control Center</span>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="ai-settings-content">
          {activeTab === 'api-keys' && renderApiKeys()}
          {activeTab === 'models' && renderModels()}
          {activeTab === 'usage' && renderUsage()}
          {activeTab === 'cost' && renderCost()}
        </div>
      </div>
    </div>
  );
}
