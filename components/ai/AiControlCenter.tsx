/**
 * AiControlCenter.tsx — AI Control Center v2
 *
 * A full settings page for Provider/Model/API Key management with
 * connection testing, model role assignment, and capability status.
 *
 * This is a standalone page (not a modal). It does NOT replace AiSettings.tsx.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Key,
  Brain,
  Check,
  X,
  RefreshCw,
  Plus,
  Trash2,
  Wifi,
  WifiOff,
  AlertTriangle,
} from 'lucide-react';
import {
  listProviderConfigs,
  saveProviderConfig,
  deleteProviderConfig,
  resolveProviderCredential,
  testProviderConnection,
  listSkills,
} from '../../api/aiControlCenterApi';
import type { AiProviderConfigV2, SaveProviderConfigInput } from '../../types/ai';
import type { ConnectionTestResult } from '../../contracts/ai-registry.contract';
import type { SkillRecord } from '../../contracts/ai-registry.contract';
import './ai-control-center.css';

// ===== Preset provider definitions (same as AiSettings) =====
const PRESETS: Array<{ id: string; name: string; icon: string; defaultEndpoint: string; defaultModels: string[] }> = [
  { id: 'openai', name: 'OpenAI', icon: '\u{1F7E2}', defaultEndpoint: 'https://api.openai.com/v1', defaultModels: ['gpt-4o', 'gpt-4', 'gpt-3.5-turbo'] },
  { id: 'deepseek', name: 'DeepSeek', icon: '\u{1F7E4}', defaultEndpoint: 'https://api.deepseek.com/v1', defaultModels: ['deepseek-chat', 'deepseek-reasoner'] },
  { id: 'google', name: 'Google AI', icon: '\u{1F535}', defaultEndpoint: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', defaultModels: ['gemini-2.0-flash', 'gemini-2.0-pro'] },
  { id: 'anthropic', name: 'Anthropic', icon: '\u{1F7E0}', defaultEndpoint: 'https://api.anthropic.com/v1', defaultModels: ['claude-sonnet-4-20250514', 'claude-haiku-3-20240307'] },
  { id: 'custom', name: 'Custom', icon: '⚙️', defaultEndpoint: '', defaultModels: ['custom-model'] },
];

const ROLE_LABELS: Record<string, { label: string; description: string }> = {
  chat: { label: 'Chat', description: 'General conversation' },
  structured: { label: 'Structured', description: 'Structured output generation' },
  generation: { label: 'Generation', description: 'Packet/draft generation' },
  detection: { label: 'Detection', description: 'Intent recognition' },
};

// ===== Component =====

export default function AiControlCenter() {
  const [providers, setProviders] = useState<AiProviderConfigV2[]>([]);
  const [skills, setSkills] = useState<SkillRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add/edit state
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingProvider, setEditingProvider] = useState<string | null>(null);

  // Form state
  const [formPreset, setFormPreset] = useState('');
  const [formName, setFormName] = useState('');
  const [formEndpoint, setFormEndpoint] = useState('');
  const [formApiKey, setFormApiKey] = useState('');
  const [formTimeout, setFormTimeout] = useState(30);
  const [formModels, setFormModels] = useState('');

  // Role assignments per provider
  const [roleAssignments, setRoleAssignments] = useState<Record<string, Record<string, string>>>({});

  // Connection test results
  const [testResults, setTestResults] = useState<Record<string, ConnectionTestResult>>({});
  const [testingProvider, setTestingProvider] = useState<string | null>(null);

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  // [v2.1.1-AI] Clear API Key confirmation
  const [clearKeyConfirm, setClearKeyConfirm] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [prov, sk] = await Promise.all([
        listProviderConfigs(),
        listSkills().catch(() => [] as SkillRecord[]),
      ]);
      setProviders(prov);
      setSkills(sk);

      // Initialize role assignments: for each provider, default first model to each role
      const assignments: Record<string, Record<string, string>> = {};
      for (const p of prov) {
        const models = parseModels(p.models);
        assignments[p.id] = {
          chat: models[0] || '',
          structured: models.length > 1 ? models[1] : models[0] || '',
          generation: models.length > 2 ? models[2] : models[0] || '',
          detection: models.length > 3 ? models[3] : models[0] || '',
        };
      }
      setRoleAssignments(assignments);
    } catch (err: any) {
      setError(err?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ===== Helper =====

  function parseModels(modelsJson: string): string[] {
    try {
      return JSON.parse(modelsJson) as string[];
    } catch {
      return [];
    }
  }

  function getProviderDisplayName(p: AiProviderConfigV2): string {
    const preset = PRESETS.find((pr) => pr.id === p.providerId);
    return preset ? `${preset.icon} ${p.providerName}` : p.providerName;
  }

  function getProviderIcon(p: AiProviderConfigV2): string {
    const preset = PRESETS.find((pr) => pr.id === p.providerId);
    return preset ? preset.icon : '⚙️';
  }

  // ===== Form handlers =====

  function handlePresetSelect(presetId: string) {
    setFormPreset(presetId);
    const preset = PRESETS.find((p) => p.id === presetId);
    if (preset) {
      setFormName(preset.name);
      setFormEndpoint(preset.defaultEndpoint);
      setFormModels(preset.defaultModels.join(', '));
    }
  }

  function resetForm() {
    setShowAddForm(false);
    setEditingProvider(null);
    setFormPreset('');
    setFormName('');
    setFormEndpoint('');
    setFormApiKey('');
    setFormTimeout(30);
    setFormModels('');
    setClearKeyConfirm(false);
  }

  function startEdit(p: AiProviderConfigV2) {
    setEditingProvider(p.id);
    setFormPreset(p.providerId);
    setFormName(p.providerName);
    setFormEndpoint(p.endpoint);
    setFormApiKey(''); // [v2.1.1-AI] Intentional: empty = keep existing key on save
    setFormTimeout(p.timeoutMs / 1000);
    setFormModels(parseModels(p.models).join(', '));
    setClearKeyConfirm(false);
  }

  async function handleSave() {
    if (!formName || !formEndpoint) return;
    const models = formModels.split(',').map((m) => m.trim()).filter(Boolean);

    // [v2.1.1-AI] Key preservation: if editing & formApiKey is empty & no explicit clear,
    // send clearApiKey: false which tells backend to keep existing key.
    // If clearKeyConfirm is true, send clearApiKey: true to wipe the key.
    const isEditing = !!editingProvider;
    const shouldClearKey = isEditing && clearKeyConfirm;
    const apiKeyValue = shouldClearKey ? '' : formApiKey;

    const input: SaveProviderConfigInput = {
      providerId: editingProvider
        ? (providers.find((p) => p.id === editingProvider)?.providerId ?? formPreset)
        : formPreset,
      providerName: formName,
      apiKeyEncrypted: apiKeyValue,
      endpoint: formEndpoint,
      models,
      timeoutMs: formTimeout * 1000,
      clearApiKey: shouldClearKey,
    };

    try {
      await saveProviderConfig(input);
      await loadData();
      resetForm();
    } catch (err: any) {
      setError(err?.message || 'Failed to save provider');
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteProviderConfig(id);
      setDeleteConfirm(null);
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete provider');
    }
  }

  async function handleTestConnection(p: AiProviderConfigV2) {
    setTestingProvider(p.id);
    try {
      // [v2.1.1-AI] Use resolveProviderCredential instead of reading apiKeyEncrypted directly
      let key: string;
      if (editingProvider === p.id && formApiKey) {
        key = formApiKey; // Unsaved key from form
      } else {
        key = await resolveProviderCredential(p.providerId);
      }
      const result = await testProviderConnection(p.providerId, p.endpoint, key, parseModels(p.models)[0] || '');
      setTestResults((prev) => ({ ...prev, [p.id]: result }));
    } catch (err: any) {
      setTestResults((prev) => ({
        ...prev,
        [p.id]: { success: false, message: err?.message || 'Test failed', latencyMs: 0, models: [] },
      }));
    } finally {
      setTestingProvider(null);
    }
  }

  function handleRoleChange(providerId: string, role: string, modelId: string) {
    setRoleAssignments((prev) => ({
      ...prev,
      [providerId]: {
        ...(prev[providerId] || {}),
        [role]: modelId,
      },
    }));
  }

  // ===== Capability Status =====

  function computeCapabilityStatus() {
    const roles = ['chat', 'structured', 'generation', 'detection'];
    const status: Array<{ providerId: string; providerName: string; roles: Record<string, 'available' | 'unconfigured'> }> = [];

    for (const p of providers) {
      const models = parseModels(p.models);
      const roleStatus: Record<string, 'available' | 'unconfigured'> = {};
      for (const role of roles) {
        roleStatus[role] = models.length > 0 && roleAssignments[p.id]?.[role] ? 'available' : 'unconfigured';
      }
      status.push({
        providerId: p.id,
        providerName: p.providerName,
        roles: roleStatus,
      });
    }

    return status;
  }

  // ===== Render helpers =====

  const s = {
    page: {
      maxWidth: 960,
      margin: '0 auto',
      padding: '24px 32px',
    },
    header: {
      marginBottom: 32,
    },
    title: {
      fontSize: '1.3rem',
      fontWeight: 700,
      color: 'var(--text-primary, #e0e0e0)' as const,
      marginBottom: 4,
    },
    subtitle: {
      fontSize: '0.8125rem',
      color: 'var(--text-secondary, #a0a0a0)' as const,
    },
    sectionTitle: {
      fontSize: '0.75rem',
      fontWeight: 600,
      color: 'var(--text-muted, #666)' as const,
      textTransform: 'uppercase' as const,
      letterSpacing: 1,
      marginBottom: 12,
    },
    card: {
      background: 'var(--bg-surface, #141414)',
      border: '1px solid var(--border-default, #2a2a2a)',
      borderRadius: 'var(--radius-md, 8px)',
      overflow: 'hidden' as const,
      marginBottom: 12,
    },
    cardBody: {
      padding: 16,
    },
    emptyState: {
      textAlign: 'center' as const,
      padding: '32px 16px',
      color: 'var(--text-muted, #666)' as const,
    },
    btn2: {
      padding: '5px 12px',
      borderRadius: 'var(--radius-sm, 6px)',
      fontSize: '0.75rem',
      border: '1px solid var(--border-default, #2a2a2a)',
      background: 'var(--bg-raised, #1e1e1e)',
      color: 'var(--text-secondary, #a0a0a0)',
      cursor: 'pointer' as const,
    },
    btnP: {
      padding: '5px 12px',
      borderRadius: 'var(--radius-sm, 6px)',
      fontSize: '0.75rem',
      border: 'none',
      background: 'var(--accent, #B7FF00)',
      color: '#0a0a0a',
      cursor: 'pointer' as const,
      fontWeight: 500 as const,
    },
    btnD: {
      padding: '5px 12px',
      borderRadius: 'var(--radius-sm, 6px)',
      fontSize: '0.75rem',
      border: '1px solid rgba(244,67,54,0.2)',
      background: 'rgba(244,67,54,0.1)',
      color: 'var(--danger, #f44336)',
      cursor: 'pointer' as const,
    },
    formInput: {
      width: '100%',
      padding: '7px 10px',
      background: 'var(--bg-canvas, #0a0a0a)',
      border: '1px solid var(--border-default, #2a2a2a)',
      borderRadius: 'var(--radius-sm, 6px)',
      color: 'var(--text-primary, #e0e0e0)',
      fontSize: '0.8125rem',
      outline: 'none',
      boxSizing: 'border-box' as const,
    },
    label: {
      fontSize: '0.75rem',
      color: 'var(--text-secondary, #a0a0a0)',
      fontWeight: 500 as const,
      marginBottom: 4,
      display: 'block' as const,
    },
  };

  // ===== Main render =====

  if (loading) {
    return (
      <div className="ai-control-center">
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted, #666)' }}>
          <RefreshCw size={24} className="ai-control-center-spin" />
          <div style={{ marginTop: 12, fontSize: '0.875rem' }}>Loading Control Center...</div>
        </div>
      </div>
    );
  }

  const capabilityStatus = computeCapabilityStatus();
  const roles = ['chat', 'structured', 'generation', 'detection'];

  return (
    <div className="ai-control-center">
      <div style={s.page}>
        {/* Header */}
        <div style={s.header}>
          <div style={s.title}>AI Control Center</div>
          <div style={s.subtitle}>
            Manage AI provider connections, model role assignments, and view system capability status.
          </div>
        </div>

        {error && (
          <div className="ai-control-center-error">
            <AlertTriangle size={14} />
            <span>{error}</span>
            <button onClick={() => setError(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}>
              <X size={14} />
            </button>
          </div>
        )}

        {/* ===== Provider Management ===== */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={s.sectionTitle}>Configured Providers</div>
            <button
              style={{ ...s.btnP, display: 'flex', alignItems: 'center', gap: 4 }}
              onClick={() => { resetForm(); setShowAddForm(true); }}
            >
              <Plus size={14} /> Add Provider
            </button>
          </div>

          {providers.length === 0 && !showAddForm && (
            <div style={s.card}>
              <div style={s.emptyState}>
                <WifiOff size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
                <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary, #a0a0a0)', marginBottom: 4 }}>No providers configured</div>
                <div style={{ fontSize: '0.75rem', marginBottom: 12 }}>
                  Add an AI provider to start using AI features.
                </div>
                <button style={s.btnP} onClick={() => { resetForm(); setShowAddForm(true); }}>
                  <Plus size={14} /> Add Your First Provider
                </button>
              </div>
            </div>
          )}

          {/* Add/Edit form */}
          {(showAddForm || editingProvider) && (
            <div style={s.card}>
              <div style={s.cardBody}>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary, #e0e0e0)', marginBottom: 16 }}>
                  {editingProvider ? 'Edit Provider' : 'Add Provider'}
                </div>

                {!editingProvider && (
                  <div style={{ marginBottom: 12 }}>
                    <label style={s.label}>Provider Type</label>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {PRESETS.map((pr) => (
                        <button
                          key={pr.id}
                          onClick={() => handlePresetSelect(pr.id)}
                          style={{
                            ...s.btn2,
                            background: formPreset === pr.id ? 'var(--accent-soft, rgba(183,255,0,0.15))' : 'var(--bg-raised, #1e1e1e)',
                            borderColor: formPreset === pr.id ? 'var(--accent, #B7FF00)' : 'var(--border-default, #2a2a2a)',
                            color: formPreset === pr.id ? 'var(--accent, #B7FF00)' : 'var(--text-secondary, #a0a0a0)',
                          }}
                        >
                          {pr.icon} {pr.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <label style={s.label}>Display Name</label>
                    <input
                      style={s.formInput}
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="My Provider"
                    />
                  </div>
                  <div>
                    <label style={s.label}>Endpoint URL</label>
                    <input
                      style={{ ...s.formInput, fontFamily: 'var(--font-mono, monospace)' }}
                      value={formEndpoint}
                      onChange={(e) => setFormEndpoint(e.target.value)}
                      placeholder="https://api.openai.com/v1"
                    />
                  </div>
                  <div>
                    <label style={s.label}>API Key</label>
                    <input
                      style={{ ...s.formInput, fontFamily: 'var(--font-mono, monospace)' }}
                      type="password"
                      value={formApiKey}
                      onChange={(e) => { setFormApiKey(e.target.value); setClearKeyConfirm(false); }}
                      placeholder={editingProvider ? '(leave empty to keep existing)' : 'sk-...'}
                    />
                    {editingProvider && !formApiKey && !clearKeyConfirm && (
                      <div style={{ marginTop: 6, display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted, #666)' }}>
                          Leave empty to keep existing key
                        </span>
                        <button
                          style={{ ...s.btnD, padding: '2px 8px', fontSize: '0.7rem' }}
                          onClick={() => setClearKeyConfirm(true)}
                        >
                          Clear API Key
                        </button>
                      </div>
                    )}
                    {clearKeyConfirm && (
                      <div style={{ marginTop: 6, display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--danger, #f44336)' }}>
                          API key will be cleared on save. Confirm?
                        </span>
                        <button
                          style={{ ...s.btnD, padding: '2px 8px', fontSize: '0.7rem' }}
                          onClick={() => setClearKeyConfirm(false)}
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <label style={s.label}>Models (comma separated)</label>
                      <input
                        style={s.formInput}
                        value={formModels}
                        onChange={(e) => setFormModels(e.target.value)}
                        placeholder="gpt-4o, gpt-4"
                      />
                    </div>
                    <div style={{ maxWidth: 100 }}>
                      <label style={s.label}>Timeout (s)</label>
                      <input
                        style={s.formInput}
                        type="number"
                        value={formTimeout}
                        onChange={(e) => setFormTimeout(parseInt(e.target.value) || 30)}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <button style={s.btnP} onClick={handleSave}>Save</button>
                    <button style={s.btn2} onClick={resetForm}>Cancel</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Provider list */}
          {providers.map((p) => {
            const models = parseModels(p.models);
            const isTesting = testingProvider === p.id;
            const testResult = testResults[p.id];
            const isEditing = editingProvider === p.id;
            const assignments = roleAssignments[p.id] || {};

            return (
              <div key={p.id} style={s.card}>
                <div className="ai-control-center-provider-header">
                  <div className="ai-control-center-provider-icon">
                    {getProviderIcon(p)}
                  </div>
                  <div className="ai-control-center-provider-info">
                    <div className="ai-control-center-provider-name">{p.providerName}</div>
                    <div className="ai-control-center-provider-models">
                      {models.join(' · ')}
                    </div>
                  </div>
                  <div className="ai-control-center-provider-status">
                    {testResult && testResult.success ? (
                      <span className="ai-control-center-status-badge ai-control-center-status-connected">
                        <Wifi size={12} /> Connected
                      </span>
                    ) : testResult && !testResult.success ? (
                      <span className="ai-control-center-status-badge ai-control-center-status-error">
                        <AlertTriangle size={12} /> Error
                      </span>
                    ) : (
                      <span className="ai-control-center-status-badge ai-control-center-status-unknown">
                        Unknown
                      </span>
                    )}
                  </div>
                </div>

                {/* Expandable section */}
                <div className="ai-control-center-provider-body">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {/* Endpoint info */}
                    <div className="ai-control-center-field-row">
                      <span className="ai-control-center-field-label">Endpoint:</span>
                      <span className="ai-control-center-field-value">{p.endpoint}</span>
                    </div>
                    {p.hasApiKey && p.apiKeyPreview && (
                      <div className="ai-control-center-field-row">
                        <span className="ai-control-center-field-label">API Key:</span>
                        <span className="ai-control-center-field-value">{p.apiKeyPreview}</span>
                      </div>
                    )}

                    {/* Model role assignments */}
                    <div>
                      <div style={s.sectionTitle}>Role Assignments</div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {roles.map((role) => (
                          <div key={role} className="ai-control-center-role-cell">
                            <div className="ai-control-center-role-label">{ROLE_LABELS[role]?.label || role}</div>
                            <select
                              className="ai-control-center-role-select"
                              value={assignments[role] || ''}
                              onChange={(e) => handleRoleChange(p.id, role, e.target.value)}
                            >
                              <option value="">-- Select Model --</option>
                              {models.map((m) => (
                                <option key={m} value={m}>{m}</option>
                              ))}
                            </select>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <button
                        style={{ ...s.btnP, display: 'flex', alignItems: 'center', gap: 4 }}
                        onClick={() => handleTestConnection(p)}
                        disabled={isTesting}
                      >
                        <RefreshCw size={12} className={isTesting ? 'ai-control-center-spin' : ''} />
                        {isTesting ? 'Testing...' : 'Test Connection'}
                      </button>
                      <button
                        style={{ ...s.btn2, display: 'flex', alignItems: 'center', gap: 4 }}
                        onClick={() => startEdit(p)}
                      >
                        Edit
                      </button>
                      {deleteConfirm === p.id ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--danger, #f44336)' }}>Confirm?</span>
                          <button style={{ ...s.btnD, padding: '3px 8px' }} onClick={() => handleDelete(p.id)}>
                            <Check size={12} />
                          </button>
                          <button style={{ ...s.btn2, padding: '3px 8px' }} onClick={() => setDeleteConfirm(null)}>
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <button
                          style={{ ...s.btnD, display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}
                          onClick={() => setDeleteConfirm(p.id)}
                        >
                          <Trash2 size={12} /> Remove
                        </button>
                      )}
                    </div>

                    {/* Test result */}
                    {testResult && (
                      <div
                        className={
                          'ai-control-center-test-result ' +
                          (testResult.success ? 'ai-control-center-test-success' : 'ai-control-center-test-fail')
                        }
                      >
                        {testResult.success ? <Check size={14} /> : <X size={14} />}
                        <span>{testResult.message}</span>
                        {testResult.latencyMs > 0 && (
                          <span className="ai-control-center-test-latency">{testResult.latencyMs}ms</span>
                        )}
                        {testResult.models.length > 0 && (
                          <span className="ai-control-center-test-models">
                            {testResult.models.slice(0, 5).join(', ')}
                            {testResult.models.length > 5 ? ` +${testResult.models.length - 5} more` : ''}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ===== Capability Status ===== */}
        <div style={{ marginBottom: 32 }}>
          <div style={s.sectionTitle}>Capability Status</div>
          {capabilityStatus.length === 0 ? (
            <div style={s.card}>
              <div style={s.emptyState}>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary, #a0a0a0)' }}>
                  No providers configured. Add a provider to see capability status.
                </div>
              </div>
            </div>
          ) : (
            <div style={s.card}>
              <div className="ai-control-center-capability-table">
                <table>
                  <thead>
                    <tr>
                      <th>Provider</th>
                      {roles.map((role) => (
                        <th key={role}>
                          <div className="ai-control-center-capability-role-header">
                            {ROLE_LABELS[role]?.label || role}
                          </div>
                          <div className="ai-control-center-capability-role-desc">
                            {ROLE_LABELS[role]?.description || ''}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {capabilityStatus.map((cs) => (
                      <tr key={cs.providerId}>
                        <td className="ai-control-center-capability-provider">
                          {cs.providerName}
                        </td>
                        {roles.map((role) => {
                          const st = cs.roles[role];
                          return (
                            <td key={role} className="ai-control-center-capability-cell">
                              <span
                                className={
                                  'ai-control-center-capability-dot ' +
                                  (st === 'available'
                                    ? 'ai-control-center-capability-available'
                                    : 'ai-control-center-capability-unconfigured')
                                }
                              />
                              {st === 'available' ? 'Ready' : 'Unconfigured'}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* ===== Skills Registry ===== */}
        {skills.length > 0 && (
          <div>
            <div style={s.sectionTitle}>Registered Skills ({skills.length})</div>
            <div style={s.card}>
              <div className="ai-control-center-skills-list">
                {skills.map((sk) => (
                  <div key={sk.id || sk.skillId} className="ai-control-center-skill-item">
                    <div className="ai-control-center-skill-icon">
                      <Brain size={16} />
                    </div>
                    <div className="ai-control-center-skill-info">
                      <div className="ai-control-center-skill-name">{sk.name}</div>
                      <div className="ai-control-center-skill-id">{sk.skillId} v{sk.version}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
