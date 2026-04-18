import { useEffect } from 'react'
import { useLearningPathStore } from '../stores/learningPathStore'
import { PathWizard } from '../components/PathWizard'
import { PathRoadmap } from '../components/PathRoadmap'
import { CheckpointQuizModal } from '../components/CheckpointQuizModal'

export function LearningPathPage() {
  const { path, loading, fetchPath, checkpointQuiz } = useLearningPathStore()

  useEffect(() => {
    fetchPath()
  }, [fetchPath])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-3 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
          <p className="text-sm text-surface-200/50">Đang tải lộ trình...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 animate-fade-in">
      {path ? <PathRoadmap /> : <PathWizard />}
      {checkpointQuiz && <CheckpointQuizModal />}
    </div>
  )
}
