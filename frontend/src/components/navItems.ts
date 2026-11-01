// Personal fork: one list of pages for the desktop header, the phone tab bar and their "More" menus.
import { ArrowLeftRight, Layers, LayoutDashboard, Library, ListChecks, type LucideIcon, Package, ScanLine, Trophy } from 'lucide-react'

export type NavItem = {
  title: string // header locale key; i18next falls back to the title for fork pages without one
  href: string
  icon: LucideIcon
  tab?: boolean // one of the phone tab bar's tabs; the rest go in its "More" sheet
  secondary?: boolean // behind "More" in the desktop header
}

export const navItems: NavItem[] = [
  { title: 'overview', href: '/', icon: LayoutDashboard, tab: true },
  { title: 'collection', href: '/collection', icon: Library, tab: true },
  { title: 'Packs', href: '/packs', icon: Package, tab: true },
  { title: 'Rankings', href: '/rankings', icon: Trophy },
  { title: 'trade', href: '/trade', icon: ArrowLeftRight, tab: true },
  { title: 'scan', href: '/scan', icon: ScanLine },
  { title: 'decks', href: '/decks', icon: Layers, secondary: true },
  { title: 'missions', href: '/missions', icon: ListChecks, secondary: true },
]

/** Overview matches only `/`; other pages match their sub-paths too (`/trade/check`, `/collection/<friend id>`). */
export const isActivePath = (pathname: string, href: string) => (href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`))
