/**
 * PremiseStepInternExtern — 画板① 第二步：内驱/外驱
 *
 * "Why does this story matter to you? What audience needs it?"
 * Two text areas: internal drive, external drive.
 * AI suggests based on selected wishes.
 */

import React from 'react';
import { TextArea } from '../../components/ui';
import AiFillCard from '../common/method-step/AiFillCard';

interface PremiseStepInternExternProps {
  internalDrive: string;
  externalDrive: string;
  onInternalDriveChange: (v: string) => void;
  onExternalDriveChange: (v: string) => void;
  onConfirm: () => void;
  onReTrigger: () => void;
  confirmed: boolean;
  loading: boolean;
  doNotAskAgain: boolean;
  onDoNotAskAgainChange: (v: boolean) => void;
}

export default function PremiseStepInternExtern({
  internalDrive,
  externalDrive,
  onInternalDriveChange,
  onExternalDriveChange,
  onConfirm,
  onReTrigger,
  confirmed,
  loading,
  doNotAskAgain,
  onDoNotAskAgainChange,
}: PremiseStepInternExternProps) {
  const hasContent = internalDrive.trim().length > 0 || externalDrive.trim().length > 0;

  return (
    <AiFillCard
      title="内驱与外驱 | 这个故事为什么重要？"
      onConfirm={onConfirm}
      onReTrigger={onReTrigger}
      loading={loading}
      confirmed={confirmed}
      confirmDisabled={!hasContent}
      confirmLabel="确认并进入下一步"
      doNotAskAgain={doNotAskAgain}
      onDoNotAskAgainChange={onDoNotAskAgainChange}
      aiContent={
        <div className="premise-ai-hint">
          想清楚你的创作动机和作品对读者的价值，是写出好故事的关键。AI 已根据你的愿望清单给出了一些建议，请在此基础上补充你的想法。
        </div>
      }
    >
      {/* Internal Drive */}
      <div className="premise-form-group">
        <label className="premise-label">
          内驱 — 这个故事对你意味着什么？
          <span className="premise-label-hint">
            你想通过这个故事表达什么？它和你有什么私人关联？
          </span>
        </label>
        <TextArea
          placeholder="例如：我想写一个关于救赎的故事，因为我一直在思考人要如何面对自己的过去..."
          value={internalDrive}
          onChange={(e) => onInternalDriveChange(e.target.value)}
          className="premise-textarea"
          style={{ minHeight: 80 }}
        />
      </div>

      {/* External Drive */}
      <div className="premise-form-group">
        <label className="premise-label">
          外驱 — 哪些读者需要这个故事？
          <span className="premise-label-hint">
            谁是你的目标读者？他们为什么需要读这个故事？
          </span>
        </label>
        <TextArea
          placeholder="例如：喜欢硬科幻的读者，特别是对太空探索题材感兴趣的人群..."
          value={externalDrive}
          onChange={(e) => onExternalDriveChange(e.target.value)}
          className="premise-textarea"
          style={{ minHeight: 80 }}
        />
      </div>
    </AiFillCard>
  );
}
