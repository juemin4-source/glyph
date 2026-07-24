import { X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { saveProviderConfig } from '../api/aiControlCenterApi';

interface FsAiProviderDialogProps {
  onClose: () => void;
  onSaved: () => Promise<void>;
}

const PRESETS = {
  ollama: { name: 'Ollama', endpoint: 'http://localhost:11434/v1', model: 'qwen3:8b', needsKey: false },
  openai: { name: 'OpenAI', endpoint: 'https://api.openai.com/v1', model: 'gpt-4o-mini', needsKey: true },
  anthropic: { name: 'Anthropic', endpoint: 'https://api.anthropic.com/v1', model: 'claude-3-5-sonnet-latest', needsKey: true },
  google: { name: 'Google AI', endpoint: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-2.0-flash', needsKey: true },
  deepseek: { name: 'DeepSeek', endpoint: 'https://api.deepseek.com/v1', model: 'deepseek-chat', needsKey: true },
  custom: { name: '自定义 OpenAI 兼容接口', endpoint: '', model: '', needsKey: false },
} as const;

type PresetId = keyof typeof PRESETS;

export default function FsAiProviderDialog({ onClose, onSaved }: FsAiProviderDialogProps) {
  const [presetId, setPresetId] = useState<PresetId>('ollama');
  const preset = useMemo(() => PRESETS[presetId], [presetId]);
  const [endpoint, setEndpoint] = useState(PRESETS.ollama.endpoint);
  const [model, setModel] = useState(PRESETS.ollama.model);
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const switchPreset = (next: PresetId) => {
    setPresetId(next);
    setEndpoint(PRESETS[next].endpoint);
    setModel(PRESETS[next].model);
    setApiKey('');
    setError(null);
  };

  const save = async () => {
    if (!endpoint.trim() || !model.trim()) {
      setError('请填写接口地址和模型名称。');
      return;
    }
    if (preset.needsKey && !apiKey.trim()) {
      setError('此服务需要 API Key。');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await saveProviderConfig({
        providerId: presetId,
        providerName: preset.name,
        apiKeyEncrypted: apiKey.trim(),
        endpoint: endpoint.trim(),
        models: [model.trim()],
        timeoutMs: 60_000,
      });
      await onSaved();
      onClose();
    } catch (saveError) {
      setError(String(saveError).replace(/^Error:\s*/, ''));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fs-ai-provider-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="fs-ai-provider-dialog" role="dialog" aria-modal="true" aria-label="配置 AI 模型">
        <header>
          <div>
            <strong>配置 AI 模型</strong>
            <span>Gate B 只会把本次任务需要的项目节选发送给所选模型。</span>
          </div>
          <button onClick={onClose} aria-label="关闭"><X size={16} /></button>
        </header>

        <label>
          服务
          <select value={presetId} onChange={(event) => switchPreset(event.target.value as PresetId)}>
            {Object.entries(PRESETS).map(([id, value]) => (
              <option key={id} value={id}>{value.name}</option>
            ))}
          </select>
        </label>
        <label>
          接口地址
          <input value={endpoint} onChange={(event) => setEndpoint(event.target.value)} placeholder="https://.../v1" />
        </label>
        <label>
          模型名称
          <input value={model} onChange={(event) => setModel(event.target.value)} placeholder="模型 ID" />
        </label>
        <label>
          API Key {preset.needsKey ? '' : '（本地服务可留空）'}
          <input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} autoComplete="off" />
        </label>

        {error && <div className="fs-ai-provider-error">{error}</div>}
        <footer>
          <button onClick={onClose}>取消</button>
          <button className="primary" disabled={saving} onClick={() => void save()}>{saving ? '保存中…' : '保存并使用'}</button>
        </footer>
      </section>
    </div>
  );
}
