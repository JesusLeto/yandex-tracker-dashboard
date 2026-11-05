import yandexTrackerApi from '../api/yandex-tracker.api'
import type { Yandex } from '../types/api/yandex-tracker/yandex-tracker.entity'
import { useTaskTimerStore } from '../store/use-task-timer-store'
import { useIssueBus } from './use-issue-bus'

export const useIssueTransition = () => {
  const timerStore = useTaskTimerStore()
  const toast = useToast()

  const isTransitioning = ref(false)

  const isOpenStatus = (issue: Yandex.Issue) => {
    const id = issue.status?.id?.toLowerCase() ?? ''
    const display = issue.status?.display?.toLowerCase() ?? ''
    return id === 'open' || display.includes('открыт')
  }

  const selectIssue = (issue: Yandex.Issue, onNeedsConfirm: (issue: Yandex.Issue) => void) => {
    if (isOpenStatus(issue)) {
      onNeedsConfirm(issue)
    } else {
      timerStore.start(issue.key, issue.summary)
    }
  }

  const confirmTransition = async (issue: Yandex.Issue, originalEstimation?: string) => {
    if (timerStore.isShared) {
      isTransitioning.value = true
      try {
        await timerStore.start(issue.key, issue.summary, true, originalEstimation)
      } finally {
        isTransitioning.value = false
      }
      return
    }
    isTransitioning.value = true
    try {
      const transitions = await yandexTrackerApi.issueTransitionsList(issue.key)
      const inProgressTransition = transitions?.find(
        t => t.to.id.toLowerCase().includes('inprogress') || t.to.display.toLowerCase().includes('работ')
      )
      if (inProgressTransition) {
        const body = originalEstimation ? { estimation: originalEstimation } : undefined
        await yandexTrackerApi.issueTransitionExecute(issue.key, inProgressTransition.id, body)
        useIssueBus().emit({ key: issue.key, status: inProgressTransition.to })
      } else {
        toast.add({ title: 'Переход не найден', description: 'Таймер запущен без смены статуса', color: 'warning' })
      }
    } catch {
      toast.add({
        title: 'Не удалось сменить статус',
        description: 'Таймер запущен без смены статуса',
        color: 'warning'
      })
    } finally {
      isTransitioning.value = false
    }
    await timerStore.start(issue.key, issue.summary)
  }

  const cancelTransition = (issue: Yandex.Issue) => {
    timerStore.start(issue.key, issue.summary)
  }

  return {
    isTransitioning,
    selectIssue,
    confirmTransition,
    cancelTransition
  }
}
