import { useState } from 'react'
import { ChevronRight, ChevronLeft, Sparkles, BookOpen, MessageCircle, Target, FileText } from 'lucide-react'
import { useLearningPathStore } from '../stores/learningPathStore'

const LEVELS = [
  { code: 'A1', label: 'Mới bắt đầu', desc: 'Chào hỏi, tự giới thiệu cơ bản', color: 'from-emerald-500 to-emerald-400' },
  { code: 'A2', label: 'Cơ bản', desc: 'Giao tiếp đơn giản hằng ngày', color: 'from-green-500 to-green-400' },
  { code: 'B1', label: 'Trung cấp', desc: 'Du lịch, công việc cơ bản', color: 'from-sky-500 to-sky-400' },
  { code: 'B2', label: 'Trung cao', desc: 'Thảo luận, viết luận, phỏng vấn', color: 'from-blue-500 to-blue-400' },
  { code: 'C1', label: 'Nâng cao', desc: 'Học thuật, chuyên nghiệp', color: 'from-purple-500 to-purple-400' },
  { code: 'C2', label: 'Thành thạo', desc: 'Gần như native speaker', color: 'from-pink-500 to-pink-400' },
]

const FOCUS_OPTIONS = [
  { code: 'general', label: 'Tổng quát', desc: 'Phát triển đều 4 kỹ năng', icon: BookOpen, color: 'from-primary-600 to-primary-400' },
  { code: 'communication', label: 'Giao tiếp', desc: 'Ưu tiên nói, nghe, phát âm', icon: MessageCircle, color: 'from-amber-500 to-amber-400' },
  { code: 'ielts', label: 'IELTS', desc: 'Luyện thi IELTS Academic/General', icon: Target, color: 'from-red-500 to-red-400' },
  { code: 'toeic', label: 'TOEIC', desc: 'Luyện thi TOEIC Listening & Reading', icon: FileText, color: 'from-indigo-500 to-indigo-400' },
]

export function PathWizard() {
  const [step, setStep] = useState(1)
  const [currentLevel, setCurrentLevel] = useState<string | null>(null)
  const [targetLevel, setTargetLevel] = useState<string | null>(null)
  const [focusArea, setFocusArea] = useState<string | null>(null)

  const { savePath, loading } = useLearningPathStore()

  const CEFR_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

  const handleNext = () => {
    if (step === 1 && currentLevel) {
      // C2 + skip step 2 for general is handled in step 3
      if (currentLevel === 'C2') {
        setTargetLevel('C2')
        setStep(3)
      } else {
        setStep(2)
      }
    } else if (step === 2 && targetLevel) {
      setStep(3)
    }
  }

  const handleBack = () => {
    if (step === 3 && currentLevel === 'C2') {
      setStep(1)
    } else if (step > 1) {
      setStep(step - 1)
    }
  }

  const handleCreate = async () => {
    if (!currentLevel || !targetLevel || !focusArea) return
    await savePath(currentLevel, targetLevel, focusArea)
  }

  const targetLevels = LEVELS.filter(l => {
    const currentIdx = CEFR_ORDER.indexOf(currentLevel || '')
    const idx = CEFR_ORDER.indexOf(l.code)
    return idx > currentIdx
  })

  // For C2, only IELTS/TOEIC make sense
  const availableFocus = currentLevel === 'C2'
    ? FOCUS_OPTIONS.filter(f => f.code === 'ielts' || f.code === 'toeic')
    : FOCUS_OPTIONS

  const progressPercent = step === 1 ? 33 : step === 2 ? 66 : 100

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-500/10 border border-primary-500/20 mb-4">
          <Sparkles className="w-4 h-4 text-primary-400" />
          <span className="text-sm text-primary-400 font-medium">Thiết lập lộ trình</span>
        </div>
        <h1 className="text-2xl font-bold gradient-text">
          {step === 1 && 'Trình độ hiện tại của bạn'}
          {step === 2 && 'Mục tiêu bạn muốn đạt'}
          {step === 3 && 'Bạn muốn tập trung vào gì?'}
        </h1>
        <p className="text-surface-200/50 text-sm mt-2">
          {step === 1 && 'Chọn level phù hợp nhất với khả năng hiện tại'}
          {step === 2 && 'Hệ thống sẽ tạo lộ trình từ level hiện tại đến mục tiêu'}
          {step === 3 && 'Lộ trình sẽ ưu tiên nội dung phù hợp mục tiêu của bạn'}
        </p>
      </div>

      {/* Progress Bar */}
      <div className="relative h-1.5 bg-surface-800 rounded-full overflow-hidden">
        <div
          className="absolute h-full gradient-bg rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Step 1: Current Level */}
      {step === 1 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-fade-in">
          {LEVELS.map((level) => (
            <button
              key={level.code}
              onClick={() => setCurrentLevel(level.code)}
              className={`
                relative p-5 rounded-2xl text-left transition-all duration-300 group
                ${currentLevel === level.code
                  ? 'bg-primary-500/15 border-2 border-primary-500/50 shadow-lg shadow-primary-500/10'
                  : 'glass-card border border-surface-700/50 hover:border-surface-600'
                }
              `}
            >
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${level.color} flex items-center justify-center shrink-0`}>
                  <span className="text-white font-bold text-sm">{level.code}</span>
                </div>
                <div>
                  <p className="font-semibold text-surface-50">{level.label}</p>
                  <p className="text-xs text-surface-200/50 mt-0.5">{level.desc}</p>
                </div>
              </div>
              {currentLevel === level.code && (
                <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary-500 flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Step 2: Target Level */}
      {step === 2 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-fade-in">
          {targetLevels.map((level) => (
            <button
              key={level.code}
              onClick={() => setTargetLevel(level.code)}
              className={`
                relative p-5 rounded-2xl text-left transition-all duration-300
                ${targetLevel === level.code
                  ? 'bg-primary-500/15 border-2 border-primary-500/50 shadow-lg shadow-primary-500/10'
                  : 'glass-card border border-surface-700/50 hover:border-surface-600'
                }
              `}
            >
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${level.color} flex items-center justify-center shrink-0`}>
                  <span className="text-white font-bold text-sm">{level.code}</span>
                </div>
                <div>
                  <p className="font-semibold text-surface-50">{level.label}</p>
                  <p className="text-xs text-surface-200/50 mt-0.5">{level.desc}</p>
                </div>
              </div>
              {targetLevel === level.code && (
                <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary-500 flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Step 3: Focus Area */}
      {step === 3 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-fade-in">
          {availableFocus.map((focus) => (
            <button
              key={focus.code}
              onClick={() => setFocusArea(focus.code)}
              className={`
                relative p-5 rounded-2xl text-left transition-all duration-300
                ${focusArea === focus.code
                  ? 'bg-primary-500/15 border-2 border-primary-500/50 shadow-lg shadow-primary-500/10'
                  : 'glass-card border border-surface-700/50 hover:border-surface-600'
                }
              `}
            >
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${focus.color} flex items-center justify-center shrink-0`}>
                  <focus.icon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-surface-50">{focus.label}</p>
                  <p className="text-xs text-surface-200/50 mt-0.5">{focus.desc}</p>
                </div>
              </div>
              {focusArea === focus.code && (
                <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary-500 flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between pt-4">
        {step > 1 ? (
          <button
            onClick={handleBack}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-surface-200/60 hover:text-surface-50 hover:bg-surface-800/50 transition-all"
          >
            <ChevronLeft className="w-4 h-4" /> Quay lại
          </button>
        ) : <div />}

        {step < 3 ? (
          <button
            onClick={handleNext}
            disabled={step === 1 ? !currentLevel : !targetLevel}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-primary-600 to-primary-500 text-white font-medium hover:shadow-lg hover:shadow-primary-500/30 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Tiếp theo <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={handleCreate}
            disabled={!focusArea || loading}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-primary-600 to-accent-500 text-white font-medium hover:shadow-lg hover:shadow-primary-500/30 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Đang tạo...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" /> Tạo lộ trình
              </>
            )}
          </button>
        )}
      </div>
    </div>
  )
}
