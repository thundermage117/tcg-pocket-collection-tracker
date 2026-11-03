// Personal fork: split out of components/SelectCard.tsx so App can lazy-load the dialog without pulling it into the entry chunk
import { createContext } from 'react'
import type { Card } from '@/types'

export interface SelectCardRequest {
  cards: Card[]
  callback: (internal_id: number) => void | Promise<void>
}

export interface ISelectCardContext {
  selectCard: (request: SelectCardRequest) => void
}

export const SelectCardContext = createContext<ISelectCardContext>({
  selectCard: () => {
    throw new Error("Can't open SelectCardDialog: not in SelectCardContext")
  },
})
