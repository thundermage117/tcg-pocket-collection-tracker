import { useQuery } from '@tanstack/react-query'
import { ChevronDown, Globe, Heart, LogOut, UserRoundPen } from 'lucide-react'
import { useState } from 'react'
import GitHubButton from 'react-github-btn'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router'
import { Login } from '@/components/Login.tsx'
import { isActivePath, navItems } from '@/components/navItems'
import { Button } from '@/components/ui/button.tsx'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog.tsx'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { NavigationMenu, NavigationMenuLink, NavigationMenuList } from '@/components/ui/navigation-menu.tsx'
import { useUnreadChangelogCount } from '@/lib/useChangelog'
import { cn } from '@/lib/utils'
import { useProfileDialog } from '@/services/account/useAccount'
import { useLoginDialog, useLogout, userQuery } from '@/services/auth/useAuth'
import { Badge } from './ui/badge'

export function Header() {
  const location = useLocation()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation('header')
  const { data: user } = useQuery(userQuery)
  const unreadChangelog = useUnreadChangelogCount()
  const logoutMutation = useLogout()

  const { isLoginDialogOpen, setIsLoginDialogOpen } = useLoginDialog()
  const { setIsProfileDialogOpen } = useProfileDialog()

  const [isAboutUsDialogOpen, setIsAboutUsDialogOpen] = useState<boolean>(false)

  const changeLanguage = (lng: string) => i18n.changeLanguage(lng)

  const languages = [
    { code: 'de-DE', name: 'Deutsch' },
    { code: 'en-US', name: 'English' },
    { code: 'es-ES', name: 'Español' },
    { code: 'fr-FR', name: 'Français' },
    { code: 'it-IT', name: 'Italiano' },
    { code: 'pt-BR', name: 'Português' },
  ] // alphabetical language order in their native form for UX accessibility

  const secondaryActive = navItems.some((item) => item.secondary && isActivePath(location.pathname, item.href))

  return (
    <>
      <header id="header" className="flex max-w-7xl mx-auto min-h-fit h-14 md:h-20 shrink-0 flex-nowrap lg:flex-wrap items-center px-4 md:px-6">
        {/* Personal fork: below lg the pages live in BottomNav; social links (friends, community) and trade badges removed */}
        <Link to="/" className="flex min-w-0 items-center gap-2">
          <img src="/pokemon-icon128.png" alt="Logo" className="h-5" />
          <div className="truncate pr-4 font-bold lg:hidden xl:block">
            <span className="sm:hidden">TCG Pocket Tracker</span>
            <span className="hidden sm:inline">TCG Pocket Collection Tracker</span>
          </div>
        </Link>
        <NavigationMenu className="hidden max-w-full justify-start lg:flex">
          <NavigationMenuList>
            {navItems
              .filter((item) => !item.secondary)
              .map((item) => (
                <NavigationMenuLink key={item.href} asChild active={isActivePath(location.pathname, item.href)}>
                  <Link to={item.href}>
                    <Button className={cn('px-4', isActivePath(location.pathname, item.href) && 'bg-neutral-800')} variant="ghost">
                      {t(item.title)}
                    </Button>
                  </Link>
                </NavigationMenuLink>
              ))}
          </NavigationMenuList>
        </NavigationMenu>
        <div className="hidden lg:block">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className={cn('px-4', secondaryActive && 'bg-neutral-800')} variant="ghost">
                More
                <ChevronDown />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {navItems
                .filter((item) => item.secondary)
                .map((item) => (
                  <DropdownMenuItem key={item.href} selected={isActivePath(location.pathname, item.href)} onClick={() => navigate(item.href)}>
                    {t(item.title)}
                  </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="grow" />
        <div className="flex shrink-0 items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="px-2 sm:px-4" variant="ghost" size="icon">
                <Globe />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
              <DropdownMenuLabel>{t('selectLanguage')}</DropdownMenuLabel>
              <DropdownMenuSeparator />

              {languages.map((lang) => (
                <DropdownMenuItem key={lang.code} selected={i18n.language === lang.code} onClick={() => changeLanguage(lang.code)}>
                  {lang.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {user ? (
            <div className="hidden sm:block">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <UserRoundPen />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56">
                  <DropdownMenuLabel>{t('myAccount')}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setIsProfileDialogOpen(true)}>{t('editProfile')}</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/import')}>{t('importExport')}</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate('/changelog')}>
                    {t('whatsNew')}
                    {unreadChangelog > 0 && (
                      <Badge className="ml-auto h-5 min-w-5 rounded-full font-mono tabular-nums justify-center" variant="destructive">
                        {unreadChangelog}
                      </Badge>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setIsAboutUsDialogOpen(true)}>{t('aboutUs')}</DropdownMenuItem>

                  <DropdownMenuGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => logoutMutation.mutate()}>
                      {t('logOut')}
                      <LogOut />
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <Dialog open={isLoginDialogOpen} onOpenChange={setIsLoginDialogOpen}>
              <DialogTrigger asChild>
                <Button>{t('login')}</Button>
              </DialogTrigger>
              <DialogContent className="border-1 border-neutral-700 shadow-none">
                <DialogHeader>
                  <DialogTitle>{t('signUp')}</DialogTitle>
                </DialogHeader>
                <Login />
              </DialogContent>
            </Dialog>
          )}
        </div>
      </header>
      <Dialog open={isAboutUsDialogOpen} onOpenChange={setIsAboutUsDialogOpen}>
        <DialogContent className="border-1 border-neutral-700 shadow-none">
          <DialogHeader>
            <DialogTitle>{t('aboutUsDialog.title')}</DialogTitle>
          </DialogHeader>
          <DialogDescription className="p-4">
            <span className="text-md" dangerouslySetInnerHTML={{ __html: t('aboutUsDialog.content', { interpolation: { escapeValue: false } }) }} />

            <span className="text-md">
              <br />
              <br />
              {t('support')}
            </span>

            <span className="flex flex-wrap mt-6 justify-center gap-2">
              <button
                type="button"
                className="inline-flex h-[28px] cursor-pointer items-center gap-1.5 rounded-sm border border-[#d1d9e0] bg-[#f6f8fa] px-[10px] text-[14px] leading-[20px] font-semibold text-[#24292f] hover:bg-[#eff2f5]"
                onClick={() => (window as unknown as { QuietJar?: { open?: () => void } }).QuietJar?.open?.()}
              >
                <Heart className="size-4" />
                {t('supportDonate')}
              </button>

              <GitHubButton
                href="https://github.com/marcelpanse/tcg-pocket-collection-tracker"
                data-color-scheme="no-preference: light; light: light; dark: light;"
                data-icon="octicon-star"
                data-size="large"
                data-show-count="true"
                aria-label="Star marcelpanse/tcg-pocket-collection-tracker on GitHub"
              >
                Star
              </GitHubButton>

              <GitHubButton
                href="https://github.com/marcelpanse/tcg-pocket-collection-tracker/issues"
                data-color-scheme="no-preference: light; light: light; dark: light;"
                data-size="large"
                data-show-count="true"
                aria-label="Issue marcelpanse/tcg-pocket-collection-tracker on GitHub"
              >
                Issue
              </GitHubButton>

              <GitHubButton
                href="https://github.com/marcelpanse/tcg-pocket-collection-tracker"
                data-color-scheme="no-preference: light; light: light; dark: light;"
                data-size="large"
                aria-label="Code marcelpanse/tcg-pocket-collection-tracker on GitHub"
              >
                Read me
              </GitHubButton>
            </span>
          </DialogDescription>
        </DialogContent>
      </Dialog>
    </>
  )
}
