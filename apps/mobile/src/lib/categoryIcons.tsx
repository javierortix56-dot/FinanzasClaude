import {
  Home, ShoppingCart, HeartPulse, GraduationCap, Zap, Car, Clapperboard, Shirt, PiggyBank,
  Package, Briefcase, Laptop, TrendingUp, Gift, Coins, Utensils, Coffee, Plane, Dumbbell,
  Gamepad2, Smartphone, Dog, Baby, Wrench, Fuel, Bus, Pill, Book, Music, Sparkles,
  Landmark, CreditCard, Receipt, Wifi, Droplets, Flame, Bike, Wine, Cigarette, Scissors,
  type LucideIcon,
} from 'lucide-react'

// Catálogo de íconos para categorías. Se guarda el nombre (string) en
// Category.icono; las categorías sin ícono usan el default por id o un genérico.
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  home: Home, cart: ShoppingCart, health: HeartPulse, education: GraduationCap, bolt: Zap,
  car: Car, movie: Clapperboard, shirt: Shirt, piggy: PiggyBank, package: Package,
  briefcase: Briefcase, laptop: Laptop, trending: TrendingUp, gift: Gift, coins: Coins,
  food: Utensils, coffee: Coffee, plane: Plane, gym: Dumbbell, game: Gamepad2,
  phone: Smartphone, pet: Dog, baby: Baby, tools: Wrench, fuel: Fuel, bus: Bus,
  pill: Pill, book: Book, music: Music, sparkles: Sparkles, bank: Landmark,
  card: CreditCard, receipt: Receipt, wifi: Wifi, water: Droplets, gas: Flame,
  bike: Bike, wine: Wine, cigar: Cigarette, beauty: Scissors,
}

/** Íconos por defecto de las categorías que trae la app */
const DEFAULT_BY_ID: Record<string, string> = {
  grp_esenciales: 'home', vivienda: 'home', alimentacion: 'cart', salud: 'health',
  educacion: 'education', servicios: 'bolt', grp_variable: 'sparkles', transporte: 'car',
  entretenimiento: 'movie', ropa: 'shirt', grp_financiero: 'piggy', ahorro: 'piggy',
  grp_otros_gasto: 'package', otros_gasto: 'package', grp_laboral: 'briefcase', sueldo: 'briefcase',
  freelance: 'laptop', grp_pasivo_ing: 'trending', inversiones: 'trending',
  grp_otros_ingreso: 'coins', regalo: 'gift', otros_ingreso: 'coins',
}

export function categoryIconName(cat: { id: string; icono?: string } | undefined | null): string {
  if (!cat) return 'package'
  return (cat.icono && CATEGORY_ICONS[cat.icono] ? cat.icono : DEFAULT_BY_ID[cat.id]) ?? 'package'
}

/** Ícono de una categoría (usa el elegido, el default por id o uno genérico) */
export function CategoryIcon({ cat, size = 14, className = '' }: {
  cat: { id: string; icono?: string } | undefined | null
  size?: number
  className?: string
}) {
  const Icon = CATEGORY_ICONS[categoryIconName(cat)]
  return <Icon size={size} className={className} />
}
