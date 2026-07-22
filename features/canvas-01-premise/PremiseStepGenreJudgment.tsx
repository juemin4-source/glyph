/**
 * PremiseStepGenreJudgment — 画板① 第五步：品类判断
 *
 * AI suggests primary genre + sub-genres based on all previous steps.
 * User can adjust. Confidence indicator displayed.
 */

import React, { useState } from 'react';
import { Input, Button } from '../../components/ui';
import AiFillCard from '../common/method-step/AiFillCard';
import type { GenreJudgment } from '../../contracts/premise.contract';

interface PremiseStepGenreJudgmentProps {
  genreJudgment: GenreJudgment | null;
  onGenreJudgmentChange: (judgment: GenreJudgment) => void;
  onConfirm: () => void;
  onReTrigger: () => void;
  confirmed: boolean;
  loading: boolean;
  doNotAskAgain: boolean;
  onDoNotAskAgainChange: (v: boolean) => void;
}

const GENRE_OPTIONS = [
  '科幻', '奇幻', '悬疑', '爱情', '历史', '武侠',
  '恐怖', '推理', '冒险', '青春', '现实', '寓言',
  '史诗', '黑暗', '轻小说', '儿童文学',
];

const CONFIDENCE_OPTIONS: { value: GenreJudgment['confidence']; label: string }[] = [
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' },
];

export default function PremiseStepGenreJudgment({
  genreJudgment,
  onGenreJudgmentChange,
  onConfirm,
  onReTrigger,
  confirmed,
  loading,
  doNotAskAgain,
  onDoNotAskAgainChange,
}: PremiseStepGenreJudgmentProps) {
  const [newSubGenre, setNewSubGenre] = useState('');

  const judgment = genreJudgment || {
    primaryGenre: '',
    subGenres: [],
    confidence: 'medium' as const,
  };

  const hasContent = judgment.primaryGenre.trim().length > 0;

  const setPrimaryGenre = (genre: string) => {
    onGenreJudgmentChange({ ...judgment, primaryGenre: genre });
  };

  const toggleSubGenre = (genre: string) => {
    const exists = judgment.subGenres.includes(genre);
    onGenreJudgmentChange({
      ...judgment,
      subGenres: exists
        ? judgment.subGenres.filter((g) => g !== genre)
        : [...judgment.subGenres, genre],
    });
  };

  const addCustomSubGenre = () => {
    const genre = newSubGenre.trim();
    if (!genre || judgment.subGenres.includes(genre)) return;
    onGenreJudgmentChange({
      ...judgment,
      subGenres: [...judgment.subGenres, genre],
    });
    setNewSubGenre('');
  };

  const setConfidence = (confidence: GenreJudgment['confidence']) => {
    onGenreJudgmentChange({ ...judgment, confidence });
  };

  return (
    <AiFillCard
      title="品类判断 | 你的故事属于什么类型？"
      onConfirm={onConfirm}
      onReTrigger={onReTrigger}
      loading={loading}
      confirmed={confirmed}
      confirmDisabled={!hasContent}
      confirmLabel="确认品类并完成"
      showReTrigger={true}
      doNotAskAgain={doNotAskAgain}
      onDoNotAskAgainChange={onDoNotAskAgainChange}
      aiContent={
        <div className="premise-ai-hint">
          AI 根据你前面几步的输入，判断了这个故事的品类归属。你可以根据实际感觉调整。
        </div>
      }
    >
      {/* Primary Genre */}
      <div className="premise-form-group">
        <label className="premise-label">
          主要品类
          <span className="premise-label-hint">选择一个最接近的品类</span>
        </label>
        <div className="premise-genre-grid">
          {GENRE_OPTIONS.map((genre) => (
            <button
              key={genre}
              className={`premise-genre-tag ${judgment.primaryGenre === genre ? 'premise-genre-tag-active' : ''}`}
              onClick={() => setPrimaryGenre(genre)}
            >
              {genre}
            </button>
          ))}
        </div>
        <div className="premise-genre-custom">
          <Input
            placeholder="或其他品类..."
            value={judgment.primaryGenre}
            onChange={(e) => setPrimaryGenre(e.target.value)}
            className="premise-genre-custom-input"
          />
        </div>
      </div>

      {/* Sub-genres */}
      <div className="premise-form-group">
        <label className="premise-label">
          子品类
          <span className="premise-label-hint">可选择多个子品类</span>
        </label>
        <div className="premise-genre-grid">
          {GENRE_OPTIONS.filter((g) => g !== judgment.primaryGenre).map((genre) => (
            <button
              key={genre}
              className={`premise-genre-tag ${judgment.subGenres.includes(genre) ? 'premise-genre-tag-sub-active' : ''}`}
              onClick={() => toggleSubGenre(genre)}
            >
              {judgment.subGenres.includes(genre) ? '✓ ' : ''}{genre}
            </button>
          ))}
        </div>
        <div className="premise-genre-custom">
          <Input
            placeholder="添加自定义子品类..."
            value={newSubGenre}
            onChange={(e) => setNewSubGenre(e.target.value)}
            className="premise-genre-custom-input"
          />
          <Button
            variant="secondary"
            onClick={addCustomSubGenre}
            disabled={!newSubGenre.trim()}
          >
            添加
          </Button>
        </div>
        {judgment.subGenres.length > 0 && (
          <div className="premise-genre-selected">
            已选: {judgment.subGenres.join(', ')}
          </div>
        )}
      </div>

      {/* Confidence Indicator */}
      <div className="premise-form-group">
        <label className="premise-label">
          判断信心
          <span className="premise-label-hint">你对这个品类判断的确信程度</span>
        </label>
        <div className="premise-confidence-bar">
          {CONFIDENCE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={`premise-confidence-btn ${judgment.confidence === opt.value ? `premise-confidence-btn-${opt.value}` : ''}`}
              onClick={() => setConfidence(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </AiFillCard>
  );
}
