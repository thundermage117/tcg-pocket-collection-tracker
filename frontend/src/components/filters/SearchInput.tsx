import type { FC } from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input.tsx'
import { cn } from '@/lib/utils'

type Props = {
  value?: string
  setValue: (searchValue: string) => void
  className?: string
}
const SearchInput: FC<Props> = ({ value, setValue, className }) => {
  const { t } = useTranslation('search-input')
  return (
    <Input
      type="search"
      placeholder={t('search')}
      // Personal fork: a neutral border that brightens on focus; the slate-blue 2px one read as focused all the time
      className={cn(
        'h-[38px] bg-neutral-800 border-neutral-700 dark:border-neutral-700 focus-visible:border-neutral-400 dark:focus-visible:border-neutral-400 focus-visible:ring-0 dark:focus-visible:ring-0',
        className,
      )}
      defaultValue={value}
      onChange={(e) => setValue(e.target.value)}
    />
  )
}

export default SearchInput
