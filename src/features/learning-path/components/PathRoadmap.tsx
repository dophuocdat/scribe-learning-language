import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Check, RotateCcw, Play, Lock, Flag, ChevronDown, ChevronRight,
  ArrowRight, RefreshCw, BookOpen,
} from 'lucide-react'
import { useLearningPathStore } from '../stores/learningPathStore'
import type { CourseWithProgress, CheckpointNode, RoadmapNode } from '@/shared/types/database'

const FOCUS_LABELS: Record<string, string> = {
  general: 'Tổng quát',
  communication: 'Giao tiếp',
  ielts: 'IELTS',
  toeic: 'TOEIC',
}

function isCourseNode(node: RoadmapNode): node is CourseWithProgress {
  return 'id' in node && !('type' in node)
}

function isCheckpointNode(node: RoadmapNode): node is CheckpointNode {
  return 'type' in node && node.type === 'checkpoint'
}

export function PathRoadmap() {
  const { path, roadmap, totalLessons, completedLessons, resetPath, startCheckpoint, checkpointLoading } =
    useLearningPathStore()
  const [collapsedLevels, setCollapsedLevels] = useState<Set<string>>(new Set())

  if (!path) return null

  const progressPercent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0

  // Group nodes by level
  const levelGroups: { level: string; nodes: RoadmapNode[] }[] = []
  let currentGroup: { level: string; nodes: RoadmapNode[] } | null = null

  for (const node of roadmap) {
    if (isCourseNode(node)) {
      const level = node.difficulty_level
      if (!currentGroup || currentGroup.level !== level) {
        currentGroup = { level, nodes: [] }
        levelGroups.push(currentGroup)
      }
      currentGroup.nodes.push(node)
    } else {
      // Checkpoint goes into current group
      if (currentGroup) currentGroup.nodes.push(node)
    }
  }

  // Auto-collapse fully completed levels
  const isLevelFullyCompleted = (group: { nodes: RoadmapNode[] }) =>
    group.nodes.every(n => {
      if (isCourseNode(n)) return n.status === 'completed' || n.status === 'needs_review'
      if (isCheckpointNode(n)) return n.status === 'passed'
      return true
    })

  const toggleLevel = (level: string) => {
    setCollapsedLevels(prev => {
      const next = new Set(prev)
      if (next.has(level)) next.delete(level)
      else next.add(level)
      return next
    })
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl gradient-bg p-6">
        <div className="relative z-10">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white">
                {path.current_level} → {path.target_level} · {FOCUS_LABELS[path.focus_area] || path.focus_area}
              </h1>
              <p className="text-white/60 text-sm mt-1">
                {completedLessons}/{totalLessons} bài hoàn thành ({progressPercent}%)
              </p>
            </div>
            <button
              onClick={() => resetPath()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 text-sm transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Đổi lộ trình
            </button>
          </div>

          {/* Progress bar */}
          <div className="mt-4 h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-white/90 rounded-full transition-all duration-700 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/5" />
      </div>

      {/* Timeline */}
      <div className="relative pl-8">
        {/* Vertical line */}
        <div className="absolute left-[15px] top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary-500/50 via-accent-500/30 to-surface-700/30" />

        {levelGroups.map((group) => {
          const isCompleted = isLevelFullyCompleted(group)
          const isCollapsed = isCompleted && !collapsedLevels.has(group.level)

          return (
            <div key={group.level} className="mb-6">
              {/* Level Separator */}
              <button
                onClick={() => toggleLevel(group.level)}
                className="relative flex items-center gap-3 mb-4 -ml-8 pl-8 group cursor-pointer"
              >
                <div className="absolute left-[9px] w-3 h-3 rounded-full bg-surface-950 border-2 border-primary-400 z-10" />
                <div className={`
                  inline-flex items-center gap-2 px-3 py-1.5 rounded-lg
                  ${isCompleted ? 'bg-success/15 text-success' : 'bg-primary-500/15 text-primary-400'}
                  text-xs font-bold uppercase tracking-wider
                `}>
                  {isCompleted && <Check className="w-3 h-3" />}
                  Level {group.level}
                  {isCompleted && (
                    <span className="text-[10px] font-normal normal-case ml-1">
                      · {group.nodes.filter(n => isCourseNode(n)).length} khóa
                    </span>
                  )}
                  {isCompleted && (
                    isCollapsed
                      ? <ChevronRight className="w-3 h-3 ml-1" />
                      : <ChevronDown className="w-3 h-3 ml-1" />
                  )}
                </div>
              </button>

              {/* Collapsed summary */}
              {isCollapsed && (
                <div className="ml-4 mb-4 text-xs text-surface-200/40 italic">
                  ✅ Đã hoàn thành tất cả khóa Level {group.level}
                </div>
              )}

              {/* Nodes */}
              {!isCollapsed && group.nodes.map((node, ni) => {
                if (isCheckpointNode(node)) {
                  return <CheckpointNodeItem key={`cp-${ni}`} node={node} onStart={startCheckpoint} loading={checkpointLoading} />
                }
                if (isCourseNode(node)) {
                  return <CourseNodeItem key={node.id} node={node} />
                }
                return null
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ===== Course Node ===== */

function CourseNodeItem({ node }: { node: CourseWithProgress }) {
  const statusConfig = {
    completed: {
      dot: 'bg-success border-success animate-node-glow',
      icon: <Check className="w-3 h-3 text-white" />,
      card: 'border-success/20',
      opacity: '',
    },
    needs_review: {
      dot: 'bg-amber-500 border-amber-500',
      icon: <RotateCcw className="w-3 h-3 text-white" />,
      card: 'border-amber-500/30',
      opacity: '',
    },
    in_progress: {
      dot: 'bg-primary-500 border-primary-500 animate-node-pulse',
      icon: <Play className="w-3 h-3 text-white" />,
      card: 'border-primary-500/30',
      opacity: '',
    },
    not_started: {
      dot: node.is_next ? 'bg-surface-700 border-primary-400' : 'bg-surface-800 border-surface-600',
      icon: node.is_next ? <ArrowRight className="w-3 h-3 text-primary-400" /> : <BookOpen className="w-3 h-3 text-surface-400" />,
      card: node.is_next ? 'border-primary-500/20' : 'border-surface-700/30',
      opacity: node.is_next ? '' : 'opacity-50',
    },
  }

  const config = statusConfig[node.status]
  const progress = node.total_lessons > 0 ? Math.round((node.completed_lessons / node.total_lessons) * 100) : 0

  return (
    <div className={`relative flex items-start gap-4 mb-3 ${config.opacity}`}>
      {/* Dot */}
      <div className={`absolute -left-8 top-4 w-[14px] h-[14px] rounded-full border-2 flex items-center justify-center z-10 ${config.dot}`}>
        {(node.status !== 'not_started' || node.is_next) && (
          <div className="w-full h-full rounded-full flex items-center justify-center">
            {config.icon}
          </div>
        )}
      </div>

      {/* Card */}
      <Link
        to={`/courses/${node.id}`}
        className={`
          flex-1 p-4 rounded-xl bg-surface-800/40 border transition-all duration-200 group
          hover:bg-surface-800/60 hover:border-primary-500/30 hover:shadow-lg hover:shadow-primary-500/5
          ${config.card}
        `}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-surface-50 truncate group-hover:text-primary-400 transition-colors">
              {node.title}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-700/60 text-surface-200/50 font-medium">
                {node.difficulty_level}
              </span>
              <span className="text-[10px] text-surface-200/30">
                {node.category_name}
              </span>
              <span className="text-[10px] text-surface-200/30">
                · {node.completed_lessons}/{node.total_lessons} bài
              </span>
            </div>
            {/* Progress bar for in_progress */}
            {node.status === 'in_progress' && (
              <div className="mt-2 h-1 bg-surface-700/50 rounded-full overflow-hidden">
                <div className="h-full bg-primary-500/70 rounded-full" style={{ width: `${progress}%` }} />
              </div>
            )}
          </div>

          {/* Action */}
          <div className="shrink-0">
            {node.status === 'in_progress' && (
              <span className="text-xs text-primary-400 font-medium">Tiếp tục →</span>
            )}
            {node.status === 'needs_review' && (
              <span className="text-xs text-amber-400 font-medium">Ôn tập →</span>
            )}
            {node.is_next && (
              <span className="text-xs text-primary-400 font-medium">Bắt đầu →</span>
            )}
            {node.status === 'completed' && (
              <Check className="w-4 h-4 text-success" />
            )}
          </div>
        </div>
      </Link>
    </div>
  )
}

/* ===== Checkpoint Node ===== */

function CheckpointNodeItem({
  node,
  onStart,
  loading,
}: {
  node: CheckpointNode
  onStart: (courseIds: string[], label: string) => void
  loading: boolean
}) {
  const statusConfig = {
    passed: {
      dot: 'bg-amber-400 border-amber-400',
      border: 'border-amber-500/30 bg-amber-500/5',
    },
    ready: {
      dot: 'bg-primary-500 border-primary-400',
      border: 'border-primary-500/30 bg-primary-500/5',
    },
    locked: {
      dot: 'bg-surface-700 border-surface-600',
      border: 'border-surface-700/30 opacity-40',
    },
  }

  const config = statusConfig[node.status]

  return (
    <div className="relative flex items-start gap-4 mb-3">
      <div className={`absolute -left-8 top-4 w-[14px] h-[14px] rounded-full border-2 flex items-center justify-center z-10 ${config.dot}`}>
        {node.status === 'passed' && <Check className="w-3 h-3 text-white" />}
        {node.status === 'locked' && <Lock className="w-2.5 h-2.5 text-surface-400" />}
        {node.status === 'ready' && <Flag className="w-2.5 h-2.5 text-white" />}
      </div>

      <div className={`flex-1 p-4 rounded-xl border ${config.border} transition-all`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flag className={`w-4 h-4 ${node.status === 'passed' ? 'text-amber-400' : node.status === 'ready' ? 'text-primary-400' : 'text-surface-400'}`} />
            <span className="text-sm font-medium text-surface-50">{node.label}</span>
          </div>

          {node.status === 'passed' && (
            <span className="text-xs text-amber-400 font-medium flex items-center gap-1">
              ⭐ Đã pass
            </span>
          )}
          {node.status === 'ready' && (
            <button
              onClick={() => onStart(node.review_course_ids, node.label)}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-500/20 text-primary-400 text-xs font-medium hover:bg-primary-500/30 transition-all disabled:opacity-50"
            >
              {loading ? (
                <div className="w-3 h-3 border-2 border-primary-400/30 border-t-primary-400 rounded-full animate-spin" />
              ) : (
                <Flag className="w-3 h-3" />
              )}
              Kiểm tra →
            </button>
          )}
          {node.status === 'locked' && (
            <span className="text-[10px] text-surface-200/30 flex items-center gap-1">
              <Lock className="w-3 h-3" /> Hoàn thành khóa trước
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
