import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import DOMPurify from 'dompurify'
import {
  ArrowLeft,
  BookOpen,
  Languages,
  Brain,
  FileText,
  ChevronDown,
  ChevronUp,
  Zap,
} from 'lucide-react'
import { useLearnStore } from '../stores/learnStore'
import { VocabularyPractice } from '../components/VocabularyPractice'
import { QuizPlayer } from '../components/QuizPlayer'

type Tab = 'content' | 'vocabulary' | 'quiz'

export function LessonStudyPage() {
  const { lessonId } = useParams<{ lessonId: string }>()
  const { currentLesson, loadingLesson, fetchLessonDetail } = useLearnStore()
  const [activeTab, setActiveTab] = useState<Tab>('content')
  const [contentExpanded, setContentExpanded] = useState(true)

  useEffect(() => {
    if (lessonId) fetchLessonDetail(lessonId)
  }, [lessonId, fetchLessonDetail])

  if (loadingLesson) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="h-5 w-32 bg-surface-800/60 rounded animate-pulse" />
        <div className="glass-card p-6 space-y-4">
          <div className="h-7 w-2/3 bg-surface-800/60 rounded animate-pulse" />
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-3 bg-surface-800/60 rounded animate-pulse" style={{ width: `${90 - i * 10}%` }} />
          ))}
        </div>
      </div>
    )
  }

  if (!currentLesson) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in">
        <div className="glass-card p-12 text-center max-w-md">
          <h2 className="text-xl font-bold text-surface-200/60 mb-2">
            Không tìm thấy bài học
          </h2>
          <Link to="/courses" className="text-primary-400 text-sm hover:underline">
            ← Quay lại danh sách khóa học
          </Link>
        </div>
      </div>
    )
  }

  const vocabCount = currentLesson.vocabulary?.length || 0
  const quizCount = currentLesson.quizzes?.length || 0

  const tabs: { key: Tab; label: string; icon: React.ReactNode; count?: number }[] = [
    { key: 'content', label: 'Nội dung', icon: <FileText className="w-4 h-4" /> },
    { key: 'vocabulary', label: 'Từ vựng', icon: <Languages className="w-4 h-4" />, count: vocabCount },
    { key: 'quiz', label: 'Bài tập', icon: <Brain className="w-4 h-4" />, count: quizCount },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Breadcrumb */}
      <Link
        to={`/courses/${currentLesson.course_id}`}
        className="inline-flex items-center gap-1.5 text-sm text-surface-200/40 hover:text-primary-400 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Quay lại khóa học
      </Link>

      {/* Lesson Title */}
      <div>
        <h1 className="text-2xl font-bold gradient-text">{currentLesson.title}</h1>
        {currentLesson.ai_summary && (
          <p className="text-sm text-surface-200/50 mt-1">{currentLesson.ai_summary}</p>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 p-1 bg-surface-800/40 rounded-xl">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.key
                ? 'bg-surface-700/80 text-surface-50 shadow-sm'
                : 'text-surface-200/40 hover:text-surface-200/60'
            }`}
          >
            {tab.icon}
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className="text-[10px] bg-primary-500/20 text-primary-400 px-1.5 py-0.5 rounded-full">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content Tab */}
      {activeTab === 'content' && (
        <div className="space-y-4">
          {currentLesson.processed_content || currentLesson.raw_content ? (
            <div className="glass-card overflow-hidden">
              <button
                onClick={() => setContentExpanded(!contentExpanded)}
                className="w-full p-4 flex items-center justify-between text-sm font-medium text-surface-200/60 hover:text-surface-50 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4" />
                  Nội dung bài học
                </span>
                {contentExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {contentExpanded && (
                <div className="px-6 pb-6">
                  {currentLesson.processed_content ? (
                    <div
                      className="prose prose-invert prose-sm max-w-none text-surface-200/70 leading-relaxed
                        [&_h1]:text-xl [&_h1]:font-bold [&_h1]:text-surface-50 [&_h1]:mb-4 [&_h1]:mt-2
                        [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-surface-100 [&_h2]:mb-3 [&_h2]:mt-5
                        [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-surface-100 [&_h3]:mb-2 [&_h3]:mt-4
                        [&_p]:mb-2 [&_p]:text-surface-200/80
                        [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3
                        [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-3
                        [&_li]:mb-1 [&_li]:text-surface-200/80
                        [&_strong]:text-primary-300 [&_strong]:font-semibold
                        [&_em]:text-surface-200/60 [&_em]:italic
                        [&_code]:bg-surface-700/50 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-primary-300 [&_code]:text-xs"
                      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(currentLesson.processed_content) }}
                    />
                  ) : currentLesson.raw_content ? (
                    <div className="prose prose-invert prose-sm max-w-none text-surface-200/70 leading-relaxed whitespace-pre-wrap">
                      {currentLesson.raw_content}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          ) : (
            <div className="glass-card p-8 text-center">
              <FileText className="w-10 h-10 text-surface-200/20 mx-auto mb-3" />
              <p className="text-sm text-surface-200/40">
                Bài học này chưa có nội dung văn bản
              </p>
            </div>
          )}
        </div>
      )}

      {/* Vocabulary Tab */}
      {activeTab === 'vocabulary' && (
        <VocabularyPractice vocabulary={currentLesson.vocabulary || []} />
      )}

      {/* Quiz Tab */}
      {activeTab === 'quiz' && (
        <div className="space-y-4">
          {quizCount > 0 ? (
            currentLesson.quizzes!.map((quiz) => (
              <div key={quiz.id}>
                <h3 className="text-sm font-semibold text-surface-50 mb-3 flex items-center gap-2">
                  <Brain className="w-4 h-4 text-primary-400" />
                  {quiz.title}
                  <span className="text-xs text-surface-200/30 font-normal">
                    ({quiz.quiz_type})
                  </span>
                  <span className="flex items-center gap-1 text-xs text-amber-400/60 font-normal ml-auto">
                    <Zap className="w-3 h-3" />
                    10-50 XP
                  </span>
                </h3>
                <QuizPlayer quiz={quiz} />
              </div>
            ))
          ) : (
            <div className="glass-card p-8 text-center">
              <Brain className="w-10 h-10 text-surface-200/20 mx-auto mb-3" />
              <p className="text-sm text-surface-200/40">
                Bài học này chưa có bài tập
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
