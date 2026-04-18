import { useEffect, useState, useCallback } from 'react'
import { Headphones, Mic, BookOpenText, PenTool, Check, ArrowLeft } from 'lucide-react'
import { useLearnStore, type LessonSkillExercise, type SkillType } from '../stores/learnStore'
import { SkillExercisePlayer } from './SkillExercisePlayer'

const SKILL_CONFIG: Record<SkillType, {
  label: string
  icon: typeof Headphones
  gradient: string
  color: string
  bgLight: string
}> = {
  listening: {
    label: 'Nghe',
    icon: Headphones,
    gradient: 'from-violet-500 to-blue-500',
    color: 'text-violet-400',
    bgLight: 'bg-violet-500/10',
  },
  speaking: {
    label: 'Nói',
    icon: Mic,
    gradient: 'from-rose-500 to-orange-500',
    color: 'text-rose-400',
    bgLight: 'bg-rose-500/10',
  },
  reading: {
    label: 'Đọc',
    icon: BookOpenText,
    gradient: 'from-emerald-500 to-teal-500',
    color: 'text-emerald-400',
    bgLight: 'bg-emerald-500/10',
  },
  writing: {
    label: 'Viết',
    icon: PenTool,
    gradient: 'from-amber-500 to-yellow-500',
    color: 'text-amber-400',
    bgLight: 'bg-amber-500/10',
  },
}

const SKILL_ORDER: SkillType[] = ['listening', 'speaking', 'reading', 'writing']

interface SkillPracticeGridProps {
  lessonId: string
}

export function SkillPracticeGrid({ lessonId }: SkillPracticeGridProps) {
  const { skillExercises, skillProgress, loadingSkills, fetchLessonSkillExercises } = useLearnStore()
  const [activeExercise, setActiveExercise] = useState<LessonSkillExercise | null>(null)
  const [activeSkill, setActiveSkill] = useState<SkillType | null>(null)

  useEffect(() => {
    fetchLessonSkillExercises(lessonId)
  }, [lessonId, fetchLessonSkillExercises])

  // Group exercises by skill
  const exercisesBySkill: Record<SkillType, LessonSkillExercise[]> = {
    listening: [], speaking: [], reading: [], writing: [],
  }
  for (const ex of skillExercises) {
    if (exercisesBySkill[ex.skill as SkillType]) {
      exercisesBySkill[ex.skill as SkillType].push(ex)
    }
  }

  // Active exercise view
  const handleExerciseComplete = useCallback(() => {
    setActiveExercise(null)
    setActiveSkill(null)
    fetchLessonSkillExercises(lessonId)
  }, [lessonId, fetchLessonSkillExercises])

  if (activeExercise) {
    return (
      <div className="space-y-4 animate-fade-in">
        <button
          onClick={() => {
            setActiveExercise(null)
            fetchLessonSkillExercises(lessonId)
          }}
          className="inline-flex items-center gap-1.5 text-sm text-surface-200/40 hover:text-primary-400 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Quay lại 4 kỹ năng
        </button>
        <SkillExercisePlayer
          exercise={activeExercise}
          onComplete={handleExerciseComplete}
        />
      </div>
    )
  }

  // Exercise list within a skill
  if (activeSkill) {
    const exercises = exercisesBySkill[activeSkill]
    const config = SKILL_CONFIG[activeSkill]
    return (
      <div className="space-y-3 animate-fade-in">
        <button
          onClick={() => setActiveSkill(null)}
          className="inline-flex items-center gap-1.5 text-sm text-surface-200/40 hover:text-primary-400 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Quay lại 4 kỹ năng
        </button>
        <h3 className={`text-sm font-bold ${config.color}`}>{config.label} ({exercises.length} bài)</h3>
        {exercises.map((ex, i) => {
          const prog = skillProgress[ex.id]
          const isDone = prog?.is_completed
          return (
            <button
              key={ex.id}
              onClick={() => setActiveExercise(ex)}
              className={`w-full text-left glass-card p-4 flex items-center gap-3 transition-all hover:border-primary-500/30 ${
                isDone ? 'border-success/20' : ''
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                isDone ? `bg-gradient-to-br ${config.gradient}` : config.bgLight
              }`}>
                {isDone ? <Check className="w-4 h-4 text-white" /> : <span className="text-xs font-bold text-surface-200/40">{i + 1}</span>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-surface-50 truncate">{ex.title_vi || ex.title}</p>
                <p className="text-[10px] text-surface-200/30">{ex.mode}</p>
              </div>
              {isDone && prog?.best_score != null && (
                <span className={`text-xs font-bold shrink-0 ${
                  prog.best_score >= 80 ? 'text-success' : prog.best_score >= 60 ? 'text-amber-400' : 'text-red-400'
                }`}>
                  {prog.best_score}%
                </span>
              )}
            </button>
          )
        })}
      </div>
    )
  }

  // Loading state
  if (loadingSkills) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="glass-card p-5 space-y-3 animate-pulse">
            <div className="w-10 h-10 rounded-xl bg-surface-800/60" />
            <div className="h-4 w-16 rounded bg-surface-800/60" />
            <div className="h-2 w-full rounded bg-surface-800/60" />
          </div>
        ))}
      </div>
    )
  }

  // Empty state
  if (skillExercises.length === 0) {
    return (
      <div className="glass-card p-8 text-center">
        <Headphones className="w-10 h-10 text-surface-200/20 mx-auto mb-3" />
        <p className="text-sm text-surface-200/40">
          Bài học này chưa có bài luyện 4 kỹ năng
        </p>
        <p className="text-xs text-surface-200/25 mt-1">
          Admin có thể tạo bài tập từ trang quản trị
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-surface-200/40">
        Luyện tập dựa trên nội dung bài học. Nhấn vào kỹ năng để bắt đầu.
      </p>

      <div className="grid grid-cols-2 gap-3">
        {SKILL_ORDER.map(skill => {
          const config = SKILL_CONFIG[skill]
          const Icon = config.icon
          const exercises = exercisesBySkill[skill]

          if (exercises.length === 0) {
            return (
              <div key={skill} className="glass-card p-5 opacity-40 cursor-not-allowed">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${config.bgLight} mb-2`}>
                  <Icon className={`w-5 h-5 ${config.color}`} />
                </div>
                <p className={`text-sm font-medium ${config.color}`}>{config.label}</p>
                <p className="text-[10px] text-surface-200/30 mt-1">Chưa có bài tập</p>
              </div>
            )
          }

          // Calculate progress
          const completedCount = exercises.filter(ex => skillProgress[ex.id]?.is_completed).length
          const bestScore = exercises.reduce((max, ex) => {
            const prog = skillProgress[ex.id]
            return prog?.best_score ? Math.max(max, prog.best_score) : max
          }, 0)
          const isAllDone = completedCount === exercises.length

          return (
            <button
              key={skill}
              onClick={() => setActiveSkill(skill)}
              className={`glass-card p-5 text-left group transition-all hover:border-primary-500/30 ${isAllDone ? 'border-success/20' : ''}`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                  isAllDone
                    ? `bg-gradient-to-br ${config.gradient} shadow-lg`
                    : config.bgLight
                }`}>
                  <Icon className={`w-5 h-5 ${isAllDone ? 'text-white' : config.color}`} />
                </div>
                {isAllDone && (
                  <div className="w-5 h-5 rounded-full bg-success flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}
              </div>

              <p className={`text-sm font-semibold ${config.color}`}>{config.label}</p>

              {/* Progress bar */}
              <div className="mt-2 h-1.5 rounded-full bg-surface-800/50 overflow-hidden">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${config.gradient} transition-all duration-500`}
                  style={{ width: `${exercises.length > 0 ? (completedCount / exercises.length) * 100 : 0}%` }}
                />
              </div>

              <div className="flex items-center justify-between mt-1.5">
                <span className="text-[10px] text-surface-200/30">
                  {completedCount}/{exercises.length} bài
                </span>
                {bestScore > 0 && (
                  <span className={`text-[10px] font-bold ${bestScore >= 80 ? 'text-success' : bestScore >= 60 ? 'text-amber-400' : 'text-red-400'}`}>
                    {bestScore}%
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
