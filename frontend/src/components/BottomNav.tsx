// Personal fork: phone / tablet tab bar (below lg), replacing the hamburger menu. "More" opens a bottom sheet
// with the remaining pages and the account actions, which are otherwise hidden on phones.
import { useQuery } from '@tanstack/react-query'
import { Ellipsis, LogIn, LogOut, type LucideIcon } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router'
import { isActivePath, navItems } from '@/components/navItems'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { useUnreadChangelogCount } from '@/lib/useChangelog'
import { cn } from '@/lib/utils'
import { useProfileDialog } from '@/services/account/useAccount'
import { useLoginDialog, useLogout, userQuery } from '@/services/auth/useAuth'

const tabClass = (active: boolean) =>
  cn(
    'flex flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors',
    active ? 'text-white' : 'text-neutral-400 hover:text-neutral-200',
  )

// pages reached from the sheet's account section, so "More" lights up on them too
const accountPaths = ['/import', '/changelog']

function SheetLink({ to, icon: Icon, active, onClick, children }: { to: string; icon: LucideIcon; active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex flex-col items-center gap-1.5 rounded-lg p-3 text-sm',
        active ? 'bg-neutral-800 text-white' : 'text-neutral-300 hover:bg-neutral-800/60',
      )}
    >
      <Icon className="size-5" />
      {children}
    </Link>
  )
}

export function BottomNav() {
  const { t } = useTranslation('header')
  const { pathname } = useLocation()
  const { data: user } = useQuery(userQuery)
  const { setIsProfileDialogOpen } = useProfileDialog()
  const { setIsLoginDialogOpen } = useLoginDialog()
  const logoutMutation = useLogout()
  const unreadChangelog = useUnreadChangelogCount()
  const [open, setOpen] = useState(false)

  const moreItems = navItems.filter((item) => !item.tab)
  const moreActive = moreItems.some((item) => isActivePath(pathname, item.href)) || accountPaths.includes(pathname)
  const close = () => setOpen(false)

  return (
    <>
      {/* keeps the end of every page clear of the fixed bar */}
      <div className="h-16 lg:hidden" />
      <nav className="fixed inset-x-0 bottom-0 z-40 flex h-16 border-t border-neutral-800 bg-neutral-900/95 backdrop-blur lg:hidden">
        {navItems
          .filter((item) => item.tab)
          .map(({ title, href, icon: Icon }) => {
            const active = isActivePath(pathname, href)
            return (
              <Link key={href} to={href} aria-current={active ? 'page' : undefined} className={tabClass(active)}>
                <Icon className="size-5" />
                {t(title)}
              </Link>
            )
          })}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger className={tabClass(moreActive)}>
            <span className="relative">
              <Ellipsis className="size-5" />
              {unreadChangelog > 0 && <span className="absolute -top-0.5 -right-1 size-2 rounded-full bg-red-500" />}
            </span>
            More
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-xl border-neutral-800 pb-8">
            <SheetHeader>
              <SheetTitle>More</SheetTitle>
            </SheetHeader>
            <div className="grid grid-cols-4 gap-2 px-4">
              {moreItems.map((item) => (
                <SheetLink key={item.href} to={item.href} icon={item.icon} active={isActivePath(pathname, item.href)} onClick={close}>
                  {t(item.title)}
                </SheetLink>
              ))}
            </div>
            <div className="mx-4 mt-4 flex flex-col divide-y divide-neutral-800 border-t border-neutral-800 text-sm">
              {user && (
                <>
                  <Link to="/import" onClick={close} className="py-3">
                    {t('importExport')}
                  </Link>
                  <button
                    type="button"
                    className="cursor-pointer py-3 text-left"
                    onClick={() => {
                      setIsProfileDialogOpen(true)
                      close()
                    }}
                  >
                    {t('editProfile')}
                  </button>
                </>
              )}
              <Link to="/changelog" onClick={close} className="flex items-center py-3">
                {t('whatsNew')}
                {unreadChangelog > 0 && (
                  <Badge className="ml-auto h-5 min-w-5 rounded-full font-mono tabular-nums justify-center" variant="destructive">
                    {unreadChangelog}
                  </Badge>
                )}
              </Link>
              <button
                type="button"
                className="flex cursor-pointer items-center gap-2 py-3 text-left"
                onClick={() => {
                  if (user) {
                    logoutMutation.mutate()
                  } else {
                    setIsLoginDialogOpen(true)
                  }
                  close()
                }}
              >
                {user ? <LogOut className="size-4" /> : <LogIn className="size-4" />}
                {user ? t('logOut') : t('login')}
              </button>
            </div>
          </SheetContent>
        </Sheet>
      </nav>
    </>
  )
}
