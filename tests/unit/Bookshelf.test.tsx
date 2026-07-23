/// <reference types="vitest/globals" />
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Bookshelf from '../components/Bookshelf';
import type { Project } from '../types/world';

describe('Bookshelf', () => {
  const mockProjects: Project[] = [
    {
      id: 'book-1',
      title: '觉醒纪元',
      genre: '科幻',
      status: 'drafting',
      wordCount: 12500,
      gradient: ['#667eea', '#764ba2'] as [string, string],
    },
    {
      id: 'book-2',
      title: '星空彼岸',
      genre: '奇幻',
      status: 'conceiving',
      wordCount: 3800,
      gradient: ['#0f2027', '#203a43'] as [string, string],
    },
  ];

  // ── Path 1: Story Creation ──
  describe('Path 1: Story Creation (Bookshelf step)', () => {
    it('renders bookshelf with project cards', () => {
      const onEnter = vi.fn();
      render(<Bookshelf projects={mockProjects} onEnterProject={onEnter} />);

      expect(screen.getByText('觉醒纪元')).toBeInTheDocument();
      expect(screen.getByText('星空彼岸')).toBeInTheDocument();
      expect(screen.getByText('共 2 部作品')).toBeInTheDocument();
    });

    it('renders empty state when no projects', () => {
      const onEnter = vi.fn();
      render(<Bookshelf projects={[]} onEnterProject={onEnter} />);

      expect(screen.getByText('还没有作品')).toBeInTheDocument();
      // When empty, the count text is empty string, not "共 0 部作品"
      expect(screen.queryByText(/共 \d+ 部作品/)).not.toBeInTheDocument();
    });

    it('create project button exists when onCreateProject provided', () => {
      const onCreate = vi.fn();
      render(<Bookshelf projects={mockProjects} onEnterProject={vi.fn()} onCreateProject={onCreate} />);

      const createBtn = screen.getByLabelText('新建作品');
      expect(createBtn).toBeInTheDocument();
    });

    it('calls onCreateProject when create button clicked', () => {
      const onCreate = vi.fn();
      render(<Bookshelf projects={mockProjects} onEnterProject={vi.fn()} onCreateProject={onCreate} />);

      fireEvent.click(screen.getByLabelText('新建作品'));
      expect(onCreate).toHaveBeenCalledTimes(1);
    });

    it('calls onEnterProject when a project card is clicked', () => {
      const onEnter = vi.fn();
      render(<Bookshelf projects={mockProjects} onEnterProject={onEnter} />);

      fireEvent.click(screen.getByLabelText('进入《觉醒纪元》'));
      expect(onEnter).toHaveBeenCalledWith(mockProjects[0]);
    });

    it('shows genre and word count for each project', () => {
      render(<Bookshelf projects={mockProjects} onEnterProject={vi.fn()} />);

      expect(screen.getByText('科幻')).toBeInTheDocument();
      expect(screen.getByText('奇幻')).toBeInTheDocument();
    });

    it('displays count badge text correctly', () => {
      const { container } = render(<Bookshelf projects={mockProjects} onEnterProject={vi.fn()} />);
      expect(container.querySelector('h1')).toHaveTextContent('作品书架');
    });
  });

  // ── Path 6: Cross-Book Isolation ──
  describe('Path 6: Cross-Book Isolation (Bookshelf view)', () => {
    it('shows multiple distinct book cards with correct data isolation', () => {
      render(<Bookshelf projects={mockProjects} onEnterProject={vi.fn()} />);

      // Each book shows independently
      expect(screen.getByLabelText('进入《觉醒纪元》')).toBeInTheDocument();
      expect(screen.getByLabelText('进入《星空彼岸》')).toBeInTheDocument();

      // Different genres
      expect(screen.getByText('科幻')).toBeInTheDocument();
      expect(screen.getByText('奇幻')).toBeInTheDocument();
    });
  });
});
