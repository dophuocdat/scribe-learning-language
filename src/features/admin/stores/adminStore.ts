import { create } from 'zustand'
import { invokeAdminApi } from '@/shared/lib/edgeFunctions'
import type { Category, Course, DifficultyLevel, Lesson, Vocabulary, Quiz, QuizQuestion } from '@/shared/types/database'

interface AdminStats {
  totalCourses: number
  totalLessons: number
  totalVocabulary: number
  totalUsers: number
}

/* eslint-disable @typescript-eslint/no-explicit-any */

// Use shared invokeAdminApi — alias for backward compat
const adminApi = invokeAdminApi

interface AdminState {
  // Data
  stats: AdminStats | null
  categories: Category[]
  difficultyLevels: DifficultyLevel[]
  courses: (Course & { category?: Category; lessons_count?: number })[]
  lessons: Lesson[]
  currentCourse: Course | null
  currentLesson: Lesson | null
  vocabularyItems: Vocabulary[]
  quizzes: (Quiz & { questions?: QuizQuestion[] })[]

  // UI State — separate loading flags per resource
  isLoading: boolean        // legacy/generic
  loadingStats: boolean
  loadingCourses: boolean
  loadingLessons: boolean
  loadingCategories: boolean
  isSaving: boolean

  // Stats
  fetchStats: () => Promise<void>

  // Categories
  fetchCategories: () => Promise<void>
  createCategory: (data: { name: string; slug: string; description?: string }) => Promise<Category | null>
  updateCategory: (id: string, data: Partial<Category>) => Promise<void>
  deleteCategory: (id: string) => Promise<void>

  // Difficulty Levels
  fetchDifficultyLevels: () => Promise<void>
  createDifficultyLevel: (data: Record<string, any>) => Promise<DifficultyLevel | null>
  updateDifficultyLevel: (id: string, data: Record<string, any>) => Promise<void>
  deleteDifficultyLevel: (id: string) => Promise<void>

  // Courses
  fetchCourses: () => Promise<void>
  fetchCourse: (id: string) => Promise<void>
  createCourse: (data: Record<string, any>) => Promise<Course | null>
  updateCourse: (id: string, data: Record<string, any>) => Promise<void>
  deleteCourse: (id: string) => Promise<void>

  // Lessons
  fetchLessons: (courseId: string) => Promise<void>
  fetchLesson: (id: string) => Promise<void>
  createLesson: (data: Record<string, any>) => Promise<Lesson | null>
  updateLesson: (id: string, data: Record<string, any>) => Promise<void>
  deleteLesson: (id: string) => Promise<void>

  // Vocabulary
  fetchVocabulary: (lessonId: string) => Promise<void>
  createVocabulary: (data: Record<string, any>) => Promise<Vocabulary | null>
  updateVocabulary: (id: string, data: Record<string, any>) => Promise<void>
  deleteVocabulary: (id: string) => Promise<void>

  // Quizzes
  fetchQuizzes: (lessonId: string) => Promise<void>
  createQuiz: (data: Record<string, any>) => Promise<Quiz | null>
  deleteQuiz: (id: string) => Promise<void>

  // Quiz Questions
  createQuizQuestion: (data: Record<string, any>) => Promise<QuizQuestion | null>
  updateQuizQuestion: (id: string, data: Record<string, any>) => Promise<void>
  deleteQuizQuestion: (id: string) => Promise<void>
}

export const useAdminStore = create<AdminState>((set, get) => ({
  stats: null,
  categories: [],
  difficultyLevels: [],
  courses: [],
  lessons: [],
  currentCourse: null,
  currentLesson: null,
  vocabularyItems: [],
  quizzes: [],
  isLoading: false,
  loadingStats: false,
  loadingCourses: false,
  loadingLessons: false,
  loadingCategories: false,
  isSaving: false,

  // ===== STATS =====
  fetchStats: async () => {
    set({ loadingStats: true, isLoading: true })
    const { data, error } = await adminApi<AdminStats>('stats')
    if (error) { console.error(error); set({ loadingStats: false, isLoading: false }); return }
    set({ stats: data, loadingStats: false, isLoading: false })
  },

  // ===== CATEGORIES =====
  fetchCategories: async () => {
    set({ loadingCategories: true })
    const { data, error } = await adminApi<Category[]>('categories')
    if (error) { console.error(error); set({ loadingCategories: false }); return }
    set({ categories: data ?? [], loadingCategories: false })
  },

  createCategory: async (catData) => {
    set({ isSaving: true })
    const { data, error } = await adminApi<Category>('categories', 'POST', undefined, catData)
    set({ isSaving: false })
    if (error) { console.error(error); return null }
    await get().fetchCategories()
    return data
  },

  updateCategory: async (id, catData) => {
    set({ isSaving: true })
    const { error } = await adminApi('categories', 'PUT', { id }, catData as Record<string, any>)
    set({ isSaving: false })
    if (error) { console.error(error); return }
    await get().fetchCategories()
  },

  deleteCategory: async (id) => {
    const { error } = await adminApi('categories', 'DELETE', { id })
    if (error) { console.error(error); return }
    await get().fetchCategories()
  },

  // ===== DIFFICULTY LEVELS =====
  fetchDifficultyLevels: async () => {
    const { data, error } = await adminApi<DifficultyLevel[]>('difficulty-levels')
    if (error) { console.error(error); return }
    set({ difficultyLevels: data ?? [] })
  },

  createDifficultyLevel: async (levelData) => {
    set({ isSaving: true })
    const { data, error } = await adminApi<DifficultyLevel>('difficulty-levels', 'POST', undefined, levelData)
    set({ isSaving: false })
    if (error) { console.error(error); return null }
    await get().fetchDifficultyLevels()
    return data
  },

  updateDifficultyLevel: async (id, levelData) => {
    set({ isSaving: true })
    const { error } = await adminApi('difficulty-levels', 'PUT', { id }, levelData)
    set({ isSaving: false })
    if (error) { console.error(error); return }
    await get().fetchDifficultyLevels()
  },

  deleteDifficultyLevel: async (id) => {
    const { error } = await adminApi('difficulty-levels', 'DELETE', { id })
    if (error) { console.error(error); return }
    await get().fetchDifficultyLevels()
  },

  // ===== COURSES =====
  fetchCourses: async () => {
    set({ loadingCourses: true, isLoading: true })
    const { data, error } = await adminApi<(Course & { category?: Category; lessons_count?: number })[]>('courses')
    if (error) { console.error(error); set({ loadingCourses: false, isLoading: false }); return }
    set({ courses: data ?? [], loadingCourses: false, isLoading: false })
  },

  fetchCourse: async (id) => {
    const { data, error } = await adminApi<Course>('courses', 'GET', { id })
    if (error) { console.error(error); return }
    set({ currentCourse: data })
  },

  createCourse: async (courseData) => {
    set({ isSaving: true })
    const { data, error } = await adminApi<Course>('courses', 'POST', undefined, courseData)
    set({ isSaving: false })
    if (error) { console.error(error); return null }
    return data
  },

  updateCourse: async (id, courseData) => {
    set({ isSaving: true })
    const { error } = await adminApi('courses', 'PUT', { id }, courseData)
    set({ isSaving: false })
    if (error) { console.error(error); return }
    await get().fetchCourse(id)
  },

  deleteCourse: async (id) => {
    const { error } = await adminApi('courses', 'DELETE', { id })
    if (error) { console.error(error); return }
    await get().fetchCourses()
  },

  // ===== LESSONS =====
  fetchLessons: async (courseId) => {
    set({ loadingLessons: true, isLoading: true })
    const { data, error } = await adminApi<Lesson[]>('lessons', 'GET', { courseId })
    if (error) { console.error(error); set({ loadingLessons: false, isLoading: false }); return }
    set({ lessons: data ?? [], loadingLessons: false, isLoading: false })
  },

  fetchLesson: async (id) => {
    const { data, error } = await adminApi<Lesson>('lessons', 'GET', { id })
    if (error) { console.error(error); return }
    set({ currentLesson: data })
  },

  createLesson: async (lessonData) => {
    set({ isSaving: true })
    const { data, error } = await adminApi<Lesson>('lessons', 'POST', undefined, lessonData)
    set({ isSaving: false })
    if (error) { console.error(error); return null }
    return data
  },

  updateLesson: async (id, lessonData) => {
    set({ isSaving: true })
    const { error } = await adminApi('lessons', 'PUT', { id }, lessonData)
    set({ isSaving: false })
    if (error) { console.error(error); return }
    await get().fetchLesson(id)
  },

  deleteLesson: async (id) => {
    const { error } = await adminApi('lessons', 'DELETE', { id })
    if (error) { console.error(error); return }
  },

  // ===== VOCABULARY =====
  fetchVocabulary: async (lessonId) => {
    const { data, error } = await adminApi<Vocabulary[]>('vocabulary', 'GET', { lessonId })
    if (error) { console.error(error); return }
    set({ vocabularyItems: data ?? [] })
  },

  createVocabulary: async (vocabData) => {
    set({ isSaving: true })
    const { data, error } = await adminApi<Vocabulary>('vocabulary', 'POST', undefined, vocabData)
    set({ isSaving: false })
    if (error) { console.error(error); return null }
    return data
  },

  updateVocabulary: async (id, vocabData) => {
    set({ isSaving: true })
    const { error } = await adminApi('vocabulary', 'PUT', { id }, vocabData)
    set({ isSaving: false })
    if (error) { console.error(error); return }
  },

  deleteVocabulary: async (id) => {
    const { error } = await adminApi('vocabulary', 'DELETE', { id })
    if (error) { console.error(error); return }
  },

  // ===== QUIZZES =====
  fetchQuizzes: async (lessonId) => {
    const { data, error } = await adminApi<(Quiz & { questions?: QuizQuestion[] })[]>('quizzes', 'GET', { lessonId })
    if (error) { console.error(error); return }
    set({ quizzes: data ?? [] })
  },

  createQuiz: async (quizData) => {
    set({ isSaving: true })
    const { data, error } = await adminApi<Quiz>('quizzes', 'POST', undefined, quizData)
    set({ isSaving: false })
    if (error) { console.error(error); return null }
    return data
  },

  deleteQuiz: async (id) => {
    const { error } = await adminApi('quizzes', 'DELETE', { id })
    if (error) { console.error(error); return }
  },

  // ===== QUIZ QUESTIONS =====
  createQuizQuestion: async (qData) => {
    set({ isSaving: true })
    const { data, error } = await adminApi<QuizQuestion>('quiz-questions', 'POST', undefined, qData)
    set({ isSaving: false })
    if (error) { console.error(error); return null }
    return data
  },

  updateQuizQuestion: async (id, qData) => {
    set({ isSaving: true })
    const { error } = await adminApi('quiz-questions', 'PUT', { id }, qData)
    set({ isSaving: false })
    if (error) { console.error(error); return }
  },

  deleteQuizQuestion: async (id) => {
    const { error } = await adminApi('quiz-questions', 'DELETE', { id })
    if (error) { console.error(error); return }
  },
}))
