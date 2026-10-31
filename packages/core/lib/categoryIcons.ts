import { createElement } from 'react'
import {
  Home, ShoppingCart, HeartPulse, GraduationCap, Zap, Car, Clapperboard, Shirt, PiggyBank,
  Package, Briefcase, Laptop, TrendingUp, Gift, Coins, Utensils, Coffee, Plane, Dumbbell,
  Gamepad2, Smartphone, Dog, Baby, Wrench, Fuel, Bus, Pill, Book, Music, Sparkles,
  Landmark, CreditCard, Receipt, Wifi, Droplets, Flame, Bike, Wine, Cigarette, Scissors,
  UserRound, TriangleAlert, Shield, CircleDashed,
  type LucideIcon,
} from 'lucide-react'

// Catálogo de íconos para categorías (compartido por mobile y desktop). Se guarda el nombre (string) en
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
  user: UserRound, alert: TriangleAlert, shield: Shield, none: CircleDashed,
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

/**
 * Ícono deducido del nombre para categorías propias sin ícono elegido
 * ("Nafta" → surtidor, "Seguro Auto" → auto). El orden importa: gana la
 * primera regla que coincide.
 */
const POR_NOMBRE: [RegExp, string][] = [
  [/seguro.*(auto|coche|moto)|(auto|coche|moto).*seguro/, 'car'],
  [/alquiler|vivienda|hipoteca|casa|hogar|departamento/, 'home'],
  [/esencial|basico|fijo/, 'home'],
  [/nafta|combustible|gasolina|gasoil|ypf|shell/, 'fuel'],
  [/mercado|super|almacen|verduler|carniceria|compras/, 'cart'],
  [/celular|telefon|movil/, 'phone'],
  [/internet|wifi|tv|cable|streaming|fibra/, 'wifi'],
  [/\bluz\b|electric|edenor|edesur|energia/, 'bolt'],
  [/\bgas\b|metrogas/, 'gas'],
  [/agua|aysa/, 'water'],
  [/expensa|abl|impuesto|patente|tasa|afip|arba|monotributo|factura/, 'receipt'],
  [/colegio|escuela|educacion|universidad|curso|facultad|jardin/, 'education'],
  [/comedor|comida|restaurant|delivery|almuerzo|cena|vianda/, 'food'],
  [/cafe|cafeteria/, 'coffee'],
  [/salud|medic|prepaga|osde|swiss|galeno|obra social|clinica|dentista/, 'health'],
  [/farmacia|remedio/, 'pill'],
  [/seguro/, 'shield'],
  [/auto|coche|transporte|uber|taxi|cabify|estacionamiento|peaje|mecanico/, 'car'],
  [/colectivo|subte|tren|\bsube\b|bus/, 'bus'],
  [/moto|bici/, 'bike'],
  [/ahorro|inversion|plazo fijo/, 'piggy'],
  [/deuda|tarjeta|prestamo|credito|cuota/, 'card'],
  [/imprevisto|emergencia|urgencia|reparacion|arreglo/, 'alert'],
  [/personal|propio|gusto/, 'user'],
  [/ropa|indumentaria|calzado|zapatilla/, 'shirt'],
  [/gimnasio|gym|club|deporte|natacion|futbol/, 'gym'],
  [/mascota|perro|gato|veterinari/, 'pet'],
  [/viaje|vacacion|hotel|vuelo|pasaje/, 'plane'],
  [/netflix|spotify|disney|hbo|cine|salida|ocio|entretenimiento|juego|playstation/, 'movie'],
  [/regalo|cumple/, 'gift'],
  [/bebe|panal|hijo|hija|nene|nena/, 'baby'],
  [/peluqueria|belleza|estetica/, 'beauty'],
  [/sueldo|salario|honorario|trabajo/, 'briefcase'],
  [/freelance|proyecto/, 'laptop'],
  [/banco|comision|mantenimiento/, 'bank'],
  [/^n\/?a$|^otros?$|^varios$|sin categoria/, 'package'],
]

function iconoPorNombre(nombre: string | undefined): string | undefined {
  if (!nombre) return undefined
  const n = nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  return POR_NOMBRE.find(([re]) => re.test(n))?.[1]
}

export function categoryIconName(cat: { id: string; icono?: string; nombre?: string } | undefined | null): string {
  if (!cat) return 'package'
  if (cat.icono && CATEGORY_ICONS[cat.icono]) return cat.icono
  return DEFAULT_BY_ID[cat.id] ?? iconoPorNombre(cat.nombre) ?? 'package'
}

/** Ícono de una categoría (usa el elegido, el default por id o uno genérico) */
export function CategoryIcon({ cat, size = 14, className = '' }: {
  cat: { id: string; icono?: string; nombre?: string } | undefined | null
  size?: number
  className?: string
}) {
  return createElement(CATEGORY_ICONS[categoryIconName(cat)], { size, className })
}
