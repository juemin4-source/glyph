/**
 * PremiseStepWishlist — 画板① 第一步：愿望清单
 *
 * User fills out "What kind of story do you want to write?"
 * AI pre-fills 10+ wishlist items. User can add/edit/remove.
 * Gate: >= 10 items enables confirm button.
 */

import React, { useState } from 'react';
import { Button, Input, TextArea } from '../../components/ui';
import AiFillCard from '../common/method-step/AiFillCard';
import type { WishlistItem } from '../../contracts/premise.contract';

interface PremiseStepWishlistProps {
  wishlist: WishlistItem[];
  onWishlistChange: (items: WishlistItem[]) => void;
  onConfirm: () => void;
  onReTrigger: () => void;
  confirmed: boolean;
  loading: boolean;
  doNotAskAgain: boolean;
  onDoNotAskAgainChange: (v: boolean) => void;
}

const DEFAULT_WISHLIST: WishlistItem[] = [
  { id: '1', text: '主角有强烈的个人目标', category: '角色', priority: 5, enabled: true },
  { id: '2', text: '世界观独特且有深度', category: '世界观', priority: 4, enabled: true },
  { id: '3', text: '情节有悬念和反转', category: '情节', priority: 5, enabled: true },
  { id: '4', text: '角色之间有复杂关系', category: '角色', priority: 3, enabled: true },
  { id: '5', text: '有令人共鸣的情感核心', category: '情感', priority: 5, enabled: true },
  { id: '6', text: '故事节奏紧凑', category: '节奏', priority: 4, enabled: true },
  { id: '7', text: '有深刻的主題内涵', category: '主题', priority: 3, enabled: true },
  { id: '8', text: '结局令人印象深刻', category: '结构', priority: 4, enabled: true },
  { id: '9', text: '对话生动自然', category: '写作', priority: 2, enabled: true },
  { id: '10', text: '有幽默元素', category: '风格', priority: 2, enabled: true },
  { id: '11', text: '配角也立体有弧光', category: '角色', priority: 3, enabled: true },
  { id: '12', text: '适合改编为影视', category: '商业', priority: 1, enabled: true },
];

export default function PremiseStepWishlist({
  wishlist = DEFAULT_WISHLIST,
  onWishlistChange,
  onConfirm,
  onReTrigger,
  confirmed,
  loading,
  doNotAskAgain,
  onDoNotAskAgainChange,
}: PremiseStepWishlistProps) {
  const [newItemText, setNewItemText] = useState('');
  const enabledCount = wishlist.filter((w) => w.enabled).length;
  const confirmDisabled = enabledCount < 10;

  const addItem = () => {
    const text = newItemText.trim();
    if (!text) return;
    const newItem: WishlistItem = {
      id: `w_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      text,
      enabled: true,
    };
    onWishlistChange([...wishlist, newItem]);
    setNewItemText('');
  };

  const toggleItem = (id: string) => {
    onWishlistChange(
      wishlist.map((item) =>
        item.id === id ? { ...item, enabled: !item.enabled } : item,
      ),
    );
  };

  const removeItem = (id: string) => {
    onWishlistChange(wishlist.filter((item) => item.id !== id));
  };

  const updateItemText = (id: string, text: string) => {
    onWishlistChange(
      wishlist.map((item) =>
        item.id === id ? { ...item, text } : item,
      ),
    );
  };

  return (
    <AiFillCard
      title="愿望清单 | 你想写什么样的故事？"
      onConfirm={onConfirm}
      onReTrigger={onReTrigger}
      loading={loading}
      confirmed={confirmed}
      confirmDisabled={confirmDisabled}
      confirmLabel={`确认愿望清单 (${enabledCount}/10)`}
      doNotAskAgain={doNotAskAgain}
      onDoNotAskAgainChange={onDoNotAskAgainChange}
      aiContent={
        <div className="premise-ai-hint">
          AI 根据项目上下文，为你推荐了以下创作方向。选择你想探索的方向，也可以添加自己的愿望。
        </div>
      }
    >
      {/* Wishlist items */}
      <div className="premise-wishlist-grid">
        {wishlist.map((item) => (
          <div
            key={item.id}
            className={`premise-wishlist-item ${item.enabled ? 'premise-wishlist-item-enabled' : ''}`}
          >
            <label className="premise-wishlist-checkbox">
              <input
                type="checkbox"
                checked={item.enabled}
                onChange={() => toggleItem(item.id)}
              />
              <span className="premise-wishlist-custom-check" />
            </label>
            <Input
              value={item.text}
              onChange={(e) => updateItemText(item.id, e.target.value)}
              className="premise-wishlist-input"
            />
            {item.category && (
              <span className="premise-wishlist-category">{item.category}</span>
            )}
            <button
              className="premise-wishlist-remove"
              onClick={() => removeItem(item.id)}
              title="移除"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* Add new item */}
      <div className="premise-wishlist-add">
        <TextArea
          placeholder="添加你自己的创作愿望..."
          value={newItemText}
          onChange={(e) => setNewItemText(e.target.value)}
          className="premise-wishlist-add-input"
          style={{ minHeight: 40 }}
        />
        <Button
          variant="secondary"
          onClick={addItem}
          disabled={!newItemText.trim()}
        >
          添加
        </Button>
      </div>

      {/* Gate message */}
      {enabledCount < 10 && (
        <div className="premise-gate-message">
          至少选择 {10 - enabledCount} 个创作方向才能进入下一步。更多愿望有助于 AI 生成更精准的前提变体。
        </div>
      )}
    </AiFillCard>
  );
}
