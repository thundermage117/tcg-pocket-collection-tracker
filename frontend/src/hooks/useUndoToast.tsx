// Personal fork: a toast with an Undo button for actions that move or remove cards, instead of a confirm dialog.
import { ToastAction } from '@/components/ui/toast'
import { toast } from '@/hooks/use-toast'
import { type ProfileRows, useRestoreCards } from '@/services/profile/useProfileCollection'

export function showUndoToast(title: string, description: string, undo: () => void) {
  toast({
    title,
    description,
    action: (
      <ToastAction altText="Undo" onClick={undo}>
        Undo
      </ToastAction>
    ),
  })
}

/** For `useTransferCards`: Undo writes back the rows its result recorded as `before`. */
export function useUndoTransferToast() {
  const restore = useRestoreCards()
  return (title: string, description: string, before: ProfileRows, onUndone?: () => void) =>
    showUndoToast(title, description, () => restore.mutate(before, { onSuccess: onUndone }))
}
