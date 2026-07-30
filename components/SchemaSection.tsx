import { useCallback, useMemo, useState } from 'react';
import { ChevronRight, Sparkles } from 'lucide-react';
import { useCanonStore } from '../stores/canonStore';

interface SchemaSectionProps {
  projectRoot: string;
}

/** P0 字段定义：每个字段的 key、标签、提示文字 */
const P0_FIELDS: { key: string; label: string; hint: string; p: 'P0' | 'P1' }[] = [
  { key: 'coreQuestion', label: '核心追问', hint: '读者为什么继续看？', p: 'P0' },
  { key: 'aestheticSignature', label: '美学辨识度', hint: '世界第一眼的气质（颜色、材质、光线）', p: 'P0' },
  { key: 'coreMechanism', label: '核心异常/机制', hint: '这个世界最关键的规则是什么？', p: 'P0' },
  { key: 'worldLack', label: '世界缺憾', hint: '这个世界缺什么？什么稀缺到足以制造命运？', p: 'P0' },
  { key: 'protagonistLack', label: '主角缺憾', hint: '主角缺什么？为什么偏偏是他被卷进去？', p: 'P0' },
  { key: 'rulesAndCost', label: '规则与代价', hint: '允许什么、禁止什么？越界会怎样？', p: 'P0' },
  { key: 'enforcer', label: '执行人', hint: '谁制定、解释、执行奖励和惩罚？', p: 'P0' },
  { key: 'currentSituation', label: '当前局势', hint: '为什么故事现在发生？世界正在发生什么变化？', p: 'P0' },
  { key: 'compressionField', label: '压缩场', hint: '哪个地点/组织最能集中体现世界规则？', p: 'P0' },
  { key: 'effectivePast', label: '有效旧事', hint: '过去哪件事仍在影响当下？', p: 'P1' },
  { key: 'supplySystem', label: '供养系统', hint: '世界靠什么维持？谁生产，谁分配？', p: 'P1' },
  { key: 'identityQualifications', label: '身份/资格', hint: '谁有资格做什么？谁没资格？', p: 'P1' },
  { key: 'faithAndTaboo', label: '信仰与禁忌', hint: '人们相信什么？什么不能说、不能碰？', p: 'P1' },
  { key: 'dailyInterface', label: '日常接口', hint: '普通人每天怎样接触这些规则？', p: 'P1' },
];

const P0_KEYS = P0_FIELDS.map((f) => f.key);

export default function SchemaSection({ projectRoot }: SchemaSectionProps) {
  const schema = useCanonStore((s) => s.schema);
  const entities = useCanonStore((s) => s.entities);
  const updateSchema = useCanonStore((s) => s.updateSchema);
  const [expandedStep, setExpandedStep] = useState(1);

  const filled = P0_KEYS.filter((k) => (schema as any)[k]?.trim()).length;
  const total = P0_KEYS.length;

  // Count entities linked to each schema key
  const entityCountByKey = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const key of P0_KEYS) {
      counts[key] = entities.filter((e) => e.schemaKeys.includes(key)).length;
    }
    return counts;
  }, [entities]);

  const handleChange = useCallback(
    (key: string, value: string) => {
      updateSchema(projectRoot, { [key]: value } as any);
    },
    [projectRoot, updateSchema],
  );

  // Step 1: core (first 4), Step 2: rules+char (next 4), Step 3: world state (remaining)
  const stepFields = (step: number) => {
    if (step === 1) return P0_FIELDS.slice(0, 4);
    if (step === 2) return P0_FIELDS.slice(4, 8);
    return P0_FIELDS.slice(8);
  };

  const isStepExpanded = (step: number) => expandedStep >= step;

  return (
    <div className="canon-schema">
      <div className="canon-schema-header">
        <strong>世界观 · P0 骨架</strong>
        <span>{filled}/{total} 已填写</span>
      </div>

      {[1, 2, 3].map((step) => {
        const fields = stepFields(step);
        const stepFilled = fields.filter(
          (f) => (schema as any)[f.key]?.trim(),
        ).length;
        const isOpen = isStepExpanded(step);
        const isDone = stepFilled === fields.length;

        return (
          <div key={step} className="canon-step">
            <button
              className="canon-step-header"
              onClick={() => setExpandedStep(isOpen ? step : Math.max(step, expandedStep))}
            >
              <ChevronRight size={14} className={`canon-step-arrow ${isOpen ? 'open' : ''}`} />
              <span className="canon-step-label">
                {step === 1 ? '故事核心' : step === 2 ? '人物与规则' : '世界状态'}
              </span>
              <span className={`canon-step-count ${isDone ? 'done' : ''}`}>
                {stepFilled}/{fields.length}
              </span>
            </button>

            {isOpen && (
              <div className="canon-step-body">
                {fields.map((field) => {
                  const value = (schema as any)[field.key] ?? '';
                  return (
                    <div key={field.key} className="canon-field">
                      <div className="canon-field-header">
                        <span className={`canon-priority ${field.p}`}>{field.p}</span>
                        <span className="canon-field-label">{field.label}</span>
                      </div>
                      <textarea
                        className="canon-textarea"
                        value={value}
                        onChange={(e) => handleChange(field.key, e.target.value)}
                        rows={Math.max(2, value.split('\n').length)}
                        placeholder={field.hint}
                      />
                      <div className="canon-field-footer">
                        <span className="canon-hint">{field.hint}</span>
                        {entityCountByKey[field.key] > 0 && (
                          <span className="canon-entity-link-count">
                            {entityCountByKey[field.key]} 个实体关联
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {step < 3 && (
                  <button
                    className="canon-next-step"
                    onClick={() => setExpandedStep(step + 1)}
                  >
                    下一步：{step === 1 ? '人物与规则' : '世界状态'}
                    <ChevronRight size={14} />
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}

      {filled === total && (
        <div className="canon-complete-badge">
          <Sparkles size={14} /> P0 骨架已完整
        </div>
      )}
    </div>
  );
}
