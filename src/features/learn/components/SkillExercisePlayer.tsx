import { useEffect, useRef, useState } from 'react'
import type { LessonSkillExercise } from '../stores/learnStore'
import { useLearnStore } from '../stores/learnStore'

// Import stores for injection
import { useListeningStore } from '@/features/listening/stores/listeningStore'
import { useSpeakingStore } from '@/features/speaking/stores/speakingStore'
import { useReadingStore } from '@/features/reading/stores/readingStore'
import { useWritingStore } from '@/features/writing/stores/writingStore'

// Import exercise components
import { DictationExercise } from '@/features/listening/components/DictationExercise'
import { FillBlankExercise } from '@/features/listening/components/FillBlankExercise'
import { DialogueExercise } from '@/features/listening/components/DialogueExercise'
import { DictationResult } from '@/features/listening/components/DictationResult'
import { FillBlankResult } from '@/features/listening/components/FillBlankResult'
import { DialogueResult } from '@/features/listening/components/DialogueResult'

import { PronunciationExercise } from '@/features/speaking/components/PronunciationExercise'
import { ShadowingExercise } from '@/features/speaking/components/ShadowingExercise'
import { PronunciationResult } from '@/features/speaking/components/PronunciationResult'
import { ShadowingResult } from '@/features/speaking/components/ShadowingResult'

import { LevelReading } from '@/features/reading/components/LevelReading'
import { ReadingQuestions } from '@/features/reading/components/ReadingQuestions'
import { ReadingAloud } from '@/features/reading/components/ReadingAloud'
import { ReadingResult } from '@/features/reading/components/ReadingResult'
import { ReadingAloudResult } from '@/features/reading/components/ReadingAloudResult'

import { SentenceBuilding } from '@/features/writing/components/SentenceBuilding'
import { ParaphraseExercise } from '@/features/writing/components/ParaphraseExercise'
import { EssayWriting } from '@/features/writing/components/EssayWriting'
import { SentenceBuildingResult } from '@/features/writing/components/SentenceBuildingResult'
import { ParaphraseResult } from '@/features/writing/components/ParaphraseResult'
import { EssayFeedback } from '@/features/writing/components/EssayFeedback'

/* eslint-disable @typescript-eslint/no-explicit-any */

interface SkillExercisePlayerProps {
  exercise: LessonSkillExercise
  onComplete: () => void
}

export function SkillExercisePlayer({ exercise, onComplete }: SkillExercisePlayerProps) {
  const { saveSkillProgress } = useLearnStore()
  const [saved, setSaved] = useState(false)
  const injectedRef = useRef(false)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  // Function to inject exercise into store
  const injectExercise = () => {
    injectedRef.current = false

    if (exercise.skill === 'listening') {
      useListeningStore.setState({
        content: exercise.content,
        mode: exercise.mode as any,
        phase: 'exercise',
        result: null,
        error: null,
        batchItems: [{ content: exercise.content, exerciseLibraryId: null, source: 'cache' as const }],
        currentBatchIndex: 0,
      })
    } else if (exercise.skill === 'speaking') {
      useSpeakingStore.setState({
        content: exercise.content,
        mode: exercise.mode as any,
        phase: 'exercise',
        result: null,
        error: null,
        batchItems: [{ content: exercise.content, exerciseLibraryId: null }],
        currentBatchIndex: 0,
      })
    } else if (exercise.skill === 'reading') {
      useReadingStore.setState({
        content: exercise.content,
        mode: exercise.mode as any,
        phase: 'reading',
        evalResult: null,
        error: null,
        batchItems: [{ content: exercise.content, exerciseLibraryId: null }],
        currentBatchIndex: 0,
      })
    } else if (exercise.skill === 'writing') {
      useWritingStore.setState({
        content: exercise.content,
        mode: exercise.mode as any,
        phase: 'exercise',
        evalResult: null,
        error: null,
        batchItems: [exercise.content],
        currentBatchIndex: 0,
      })
    }

    injectedRef.current = true
    setSaved(false)
  }

  // Inject exercise content into the appropriate store on mount (and on retry)
  useEffect(() => {
    injectExercise()

    // Cleanup: reset stores on unmount
    return () => {
      if (exercise.skill === 'listening') {
        useListeningStore.setState({ phase: 'config', content: null, result: null })
      } else if (exercise.skill === 'speaking') {
        useSpeakingStore.setState({ phase: 'config', content: null, result: null })
      } else if (exercise.skill === 'reading') {
        useReadingStore.setState({ phase: 'config', content: null, evalResult: null })
      } else if (exercise.skill === 'writing') {
        useWritingStore.setState({ phase: 'config', content: null, evalResult: null })
      }
    }
  }, [exercise])


  // Watch for result phase to save progress automatically
  const listeningPhase = useListeningStore(s => s.phase)
  const listeningResult = useListeningStore(s => s.result)
  const speakingPhase = useSpeakingStore(s => s.phase)
  const speakingResult = useSpeakingStore(s => s.result)
  const readingPhase = useReadingStore(s => s.phase)
  const readingResult = useReadingStore(s => s.evalResult)
  const writingPhase = useWritingStore(s => s.phase)
  const writingResult = useWritingStore(s => s.evalResult)

  useEffect(() => {
    if (saved || !injectedRef.current) return

    let score = 0
    let hasResult = false

    if (exercise.skill === 'listening' && listeningPhase === 'result' && listeningResult) {
      score = (listeningResult as any).score || (listeningResult as any).accuracy || 0
      hasResult = true
    } else if (exercise.skill === 'speaking' && speakingPhase === 'result' && speakingResult) {
      score = (speakingResult as any).score || (speakingResult as any).overall_score || 0
      hasResult = true
    } else if (exercise.skill === 'reading' && readingPhase === 'result' && readingResult) {
      score = (readingResult as any).score || (readingResult as any).accuracy || 0
      hasResult = true
    } else if (exercise.skill === 'writing' && writingPhase === 'result' && writingResult) {
      score = (writingResult as any).overall_score || 0
      if ((writingResult as any).is_correct) score = 100
      if (!score && (writingResult as any).xp_earned) score = 80
      hasResult = true
    }

    if (hasResult) {
      setSaved(true)
      saveSkillProgress(exercise.id, score, score >= 50)
    }
  }, [exercise, saved, listeningPhase, listeningResult, speakingPhase, speakingResult, readingPhase, readingResult, writingPhase, writingResult, saveSkillProgress])


  // Detect when internal component resets to config (e.g., "Hoàn thành" button)
  // This means the exercise's own UI finished → go back to grid
  const isConfigPhase =
    (exercise.skill === 'listening' && listeningPhase === 'config') ||
    (exercise.skill === 'speaking' && speakingPhase === 'config') ||
    (exercise.skill === 'reading' && readingPhase === 'config') ||
    (exercise.skill === 'writing' && writingPhase === 'config')

  useEffect(() => {
    // Only trigger if we already injected AND saved progress (meaning exercise was completed, then reset to config)
    if (injectedRef.current && saved && isConfigPhase) {
      onCompleteRef.current()
    }
  }, [isConfigPhase, saved])

  // Render the appropriate exercise or result component
  const renderExercise = () => {
    const { skill, mode } = exercise

    if (skill === 'listening') {
      if (listeningPhase === 'result') {
        if (mode === 'dictation') return <DictationResult />
        if (mode === 'fill_blank') return <FillBlankResult />
        if (mode === 'dialogue') return <DialogueResult />
      }
      if (mode === 'dictation') return <DictationExercise />
      if (mode === 'fill_blank') return <FillBlankExercise />
      if (mode === 'dialogue') return <DialogueExercise />
    }

    if (skill === 'speaking') {
      if (speakingPhase === 'result') {
        if (mode === 'pronunciation') return <PronunciationResult />
        if (mode === 'shadowing') return <ShadowingResult />
      }
      if (mode === 'pronunciation') return <PronunciationExercise />
      if (mode === 'shadowing') return <ShadowingExercise />
    }

    if (skill === 'reading') {
      if (readingPhase === 'result') {
        if (mode === 'level_reading') return <ReadingResult />
        if (mode === 'reading_aloud') return <ReadingAloudResult />
      }
      if (readingPhase === 'questions') return <ReadingQuestions />
      if (mode === 'level_reading') return <LevelReading />
      if (mode === 'reading_aloud') return <ReadingAloud />
    }

    if (skill === 'writing') {
      if (writingPhase === 'result') {
        if (mode === 'sentence_building') return <SentenceBuildingResult />
        if (mode === 'paraphrase') return <ParaphraseResult />
        if (mode === 'essay') return <EssayFeedback />
      }
      if (mode === 'sentence_building') return <SentenceBuilding />
      if (mode === 'paraphrase') return <ParaphraseExercise />
      if (mode === 'essay') return <EssayWriting />
    }

    return (
      <div className="glass-card p-6 text-center">
        <p className="text-sm text-surface-200/40">
          Không hỗ trợ loại bài tập: {skill}/{mode}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Exercise title & instruction */}
      <div className="glass-card p-4">
        <h3 className="text-sm font-bold text-surface-50">{exercise.title_vi || exercise.title}</h3>
        {exercise.instruction_vi && (
          <p className="text-xs text-surface-200/50 mt-1">{exercise.instruction_vi}</p>
        )}
      </div>

      {/* Exercise component (reused from skill modules) */}
      {renderExercise()}

    </div>
  )
}
