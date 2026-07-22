/**
 * PremiseStepReaderQA — 画板① 第四步：读者问答
 *
 * AI generates 5-7 natural questions a reader would ask about the premise.
 * Each question: a text field for user's answer.
 * User fills answers or skips.
 */

import React from 'react';
import { TextArea } from '../../components/ui';
import AiFillCard from '../common/method-step/AiFillCard';
import type { ReaderQuestion } from '../../contracts/premise.contract';

interface PremiseStepReaderQAProps {
  questions: ReaderQuestion[];
  onAnswerChange: (id: string, answer: string) => void;
  onConfirm: () => void;
  onReTrigger: () => void;
  confirmed: boolean;
  loading: boolean;
  doNotAskAgain: boolean;
  onDoNotAskAgainChange: (v: boolean) => void;
}

export default function PremiseStepReaderQA({
  questions,
  onAnswerChange,
  onConfirm,
  onReTrigger,
  confirmed,
  loading,
  doNotAskAgain,
  onDoNotAskAgainChange,
}: PremiseStepReaderQAProps) {
  const answeredCount = questions.filter((q) => (q.answer || '').trim().length > 0).length;

  return (
    <AiFillCard
      title="读者问答 | 读者会问什么问题？"
      onConfirm={onConfirm}
      onReTrigger={onReTrigger}
      loading={loading}
      confirmed={confirmed}
      confirmDisabled={false}
      confirmLabel={`确认问答 (已回答 ${answeredCount}/${questions.length})`}
      showReTrigger={true}
      doNotAskAgain={doNotAskAgain}
      onDoNotAskAgainChange={onDoNotAskAgainChange}
      aiContent={
        <div className="premise-ai-hint">
          设想读者看到你的故事前提后会问什么问题。回答这些问题能帮你发现故事中的盲区。
          可以不答——留空的问题会标记为待思考。
        </div>
      }
    >
      {questions.length === 0 && !loading && (
        <div className="premise-empty-variants">
          还没有生成读者问题，点击「重新生成」让 AI 为你生成。
        </div>
      )}

      <div className="premise-qa-list">
        {questions.map((q, index) => {
          const hasAnswer = (q.answer || '').trim().length > 0;
          return (
            <div
              key={q.id}
              className={`premise-qa-item ${hasAnswer ? 'premise-qa-item-answered' : ''}`}
            >
              <div className="premise-qa-header">
                <span className="premise-qa-number">{index + 1}.</span>
                <span className="premise-qa-question">{q.question}</span>
                {q.category && (
                  <span className="premise-qa-category">{q.category}</span>
                )}
                <span className={`premise-qa-status ${hasAnswer ? 'premise-qa-status-done' : ''}`}>
                  {hasAnswer ? '已答' : '待答'}
                </span>
              </div>
              <TextArea
                placeholder="你的回答..."
                value={q.answer || ''}
                onChange={(e) => onAnswerChange(q.id, e.target.value)}
                className="premise-textarea"
                style={{ minHeight: 60 }}
              />
            </div>
          );
        })}
      </div>
    </AiFillCard>
  );
}
