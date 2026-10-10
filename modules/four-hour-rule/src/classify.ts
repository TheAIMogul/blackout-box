import { foodKeeperClassHint, lookupFoodKeeper } from './foodkeeper'
import type { FoodClass, FoodKeeperHit } from './types'

// Keyword hints (en/es/ht) are our mapping onto the FoodSafety.gov chart rows in rules.ts.
// First match wins, in the order of classifyFoodDetailed below. No match → FoodKeeper
// category hint → 'unknown' (which assess() treats as discard_4h).

export type ClassifyOptions = { location?: string | null; opened?: boolean | null }
export type Classification = { foodClass: FoodClass; via: 'keyword' | 'foodkeeper' | 'none'; foodkeeper?: FoodKeeperHit }

const norm = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

const words = (list: string) => list.split('|').map(norm)

const FROZEN_DISCARD = words('ice cream|helado|helados|krem glase|frozen yogurt|frozen yoghurt|yogur helado|popsicle|paleta|gelato|sherbet|sorbet')
const FROZEN_CONTEXT = words('frozen|congelado|congelada|congelados|congeladas|glase')
const FROZEN_VEG = words('vegetable|vegetables|veggies|veg|peas|corn|broccoli|spinach|green beans|carrots|vegetales|verduras|legumbres|legim|maiz|guisantes|espinaca')
const MAYO = words('mayo|mayonnaise|mayonesa|mayonez|tartar|tartar sauce|horseradish|aioli')
const FORMULA = words('formula|formulas|baby formula|infant formula|formula de bebe|formula infantil|let bebe|enfamil|similac|gerber good start')
const OPENED = words('opened|open|abierto|abierta|louvri|mixed|prepared|preparada')
const UNOPENED = words('unopened|sealed|sin abrir|cerrado|cerrada')
const POWDER = words('powder|polvo|poud')

const SPECIFIC_KEEP = words(
  'peanut butter|mantequilla de mani|manba|soy sauce|salsa de soya|salsa soya|salsa inglesa|worcestershire|hoisin|bbq sauce|barbecue sauce|' +
    'taco sauce|vinaigrette|italian dressing|vinegar dressing|grated parmesan|processed cheese|american cheese|fruit juice|orange juice|' +
    'apple juice|grape juice|jugo de naranja|ji zoranj|dried fruit|canned fruit|fruit cocktail|fruit pie|apple pie|whole fruit|uncut|bread|pan de molde',
)
const SPECIFIC_DISCARD = words(
  'buttermilk|cream cheese|queso crema|sour cream|crema agria|cottage cheese|queso fresco|queso blanco|soft cheese|shredded|shredded cheese|' +
    'low fat cheese|string cheese|monterey jack|pepper jack|blue cheese|fish sauce|oyster sauce|spaghetti sauce|pasta sauce|marinara|alfredo|' +
    'creamy dressing|ranch|caesar|thousand island|potato salad|pasta salad|egg salad|tuna salad|chicken salad|macaroni salad|fruit salad|' +
    'cut fruit|garlic in oil|vegetable juice|tomato juice|cookie dough|biscuit dough|refrigerator dough|cream pie|custard pie|cream filled|' +
    'cheesecake|baked potato|mashed potatoes|cooked vegetables|cooked rice|cooked pasta|canned ham|sliced coconut|shredded coconut|' +
    'evaporated milk|hard boiled eggs|deviled eggs|' +
    // cut or prepared produce ("Fresh fruits, cut", "Fresh vegetables, cut")
    'cut|sliced|chopped|diced|peeled|chunks|cubed|cortado|cortada|picado|picada|rebanado|koupe',
)
const SHELF = words(
  'can|canned|lata|enlatado|enlatada|water|agua|dlo|bottled water|cereal|crackers|chips|dry beans|dried beans|uncooked rice|dry rice|' +
    'dry pasta|flour|harina|sugar|azucar|salt|honey|miel|coffee|tea|soda|refresco',
)
const CANNED = words('can|canned|lata|enlatado|enlatada')
const KEEP = words(
  'cheddar|colby|swiss|parmesan|parmigiano|provolone|romano|hard cheese|butter|margarine|mantequilla|be|ketchup|catsup|mustard|mostaza|' +
    'moutad|jelly|jam|jalea|mermelada|relish|olive|olives|aceitunas|pickle|pickles|pepinillos|encurtidos|bbq|barbecue|vinegar|' +
    'tortilla|tortillas|bagel|muffin|cake|rolls|waffle|waffles|pancake|pancakes|apple|manzana|pom|orange|naranja|zoranj|banana|guineo|' +
    'platano|bannann|grapes|uvas|mango|lemon|limon|sitwon|lime|pear|pera|peach|melocoton|strawberries|fresas|berries|juice|jugo|ji|' +
    'raisins|pasas|mushrooms|hongos|champinones|herbs|cilantro|parsley|perejil|spices|pepper|peppers|pimiento|aji|onion|cebolla|zonyon|' +
    'garlic|ajo|carrot|carrots|zanahoria|kawot|celery|cucumber|pepino|tomato|tomate|tomat|cabbage|repollo|avocado|aguacate|zaboka',
)
// Proteins and cooked dishes are checked before the Keep list, so "orange chicken" or
// "butter chicken" never lands on Keep. Dairy and generic cheese come after it, so "cheddar cheese" does.
const DISCARD_FIRST = words(
  'egg|eggs|huevo|huevos|ze|chicken|pollo|poul|beef|carne|vyann|steak|bistec|pork|cerdo|puerco|kochon|lamb|cordero|goat|chivo|kabrit|' +
    'turkey|pavo|kodenn|meat|fish|pescado|pwason|salmon|tuna|atun|shrimp|camaron|camarones|kribich|crab|cangrejo|lobster|langosta|' +
    'seafood|mariscos|deli|lunch meat|lunchmeat|cold cuts|fiambre|ham|jamon|janbon|hot dog|salchicha|sosis|sausage|chorizo|bacon|tocino|' +
    'salami|pepperoni|bologna|leftover|leftovers|sobras|takeout|rice|arroz|diri|pasta|spaghetti|noodles|fideos|macaroni|cooked|cocido|' +
    'cocinado|kwit|soup|sopa|stew|guiso|estofado|casserole|pizza|gravy|broth|caldo|stuffing|tofu|sushi|empanada|empanadas|croquetas|' +
    'tamales|quiche|custard|flan|pudding|budin|' +
    // dairy that carries a fruit or flavor word ("Yogurt (Peach)", "Strawberry milk")
    'yogurt|yoghurt|yogurts|yogur|yogures|yogourt|yogurth|yaout|kefir|milk|leche|whipped cream|half and half|creamer',
)
const DISCARD = words(
  'milk|leche|let|cream|crema|half and half|yogurt|yoghurt|yogur|yaout|cheese|queso|fromaj|mozzarella|brie|ricotta|cottage|feta|salad|' +
    'ensalada|salsa|dough|masa|pastry|eggnog|coquito|soy milk|almond milk|oat milk|dip|hummus|guacamole',
)

function has(q: string, list: string[]): boolean {
  return list.some((k) => q.includes(` ${k} `) || q.includes(` ${k}s `) || q.includes(` ${k}es `))
}

export function classifyFoodDetailed(name: string, opts: ClassifyOptions = {}): Classification {
  const q = ` ${norm(name)} `
  const fk = lookupFoodKeeper(name) ?? undefined
  const kw = (foodClass: FoodClass): Classification => ({ foodClass, via: 'keyword', foodkeeper: fk })
  const frozenCtx = opts.location === 'freezer' || has(q, FROZEN_CONTEXT)

  if (has(q, FROZEN_DISCARD)) return kw('frozen_discard')
  if (frozenCtx) return kw(has(q, FROZEN_VEG) ? 'frozen_veg_6h' : 'frozen_refreeze')
  if (has(q, MAYO)) return kw('mayo_8h_50f')
  if (has(q, FORMULA)) {
    // "Baby formula, opened" is a Discard row; unopened or dry powder is shelf stable.
    // Formula kept in the fridge has been opened or mixed: that is the Discard row, whatever the photo says about the seal.
    const inFridge = opts.location === 'fridge' || opts.location === 'door'
    const opened = opts.opened === true || has(q, OPENED) || inFridge
    if (has(q, POWDER) || (!opened && (opts.opened === false || has(q, UNOPENED)))) return kw('shelf_stable')
    return kw('discard_4h')
  }
  if (has(q, SPECIFIC_KEEP)) return kw('keep')
  if (has(q, SPECIFIC_DISCARD)) return kw('discard_4h')
  const opened = opts.opened === true || has(q, OPENED)
  if (has(q, SHELF) && !(opened && has(q, CANNED))) return kw('shelf_stable')
  if (has(q, DISCARD_FIRST)) return kw('discard_4h')
  if (has(q, KEEP)) return kw('keep')
  if (has(q, DISCARD)) return kw('discard_4h')
  const hint = fk ? foodKeeperClassHint(fk) : null
  if (hint) return { foodClass: hint, via: 'foodkeeper', foodkeeper: fk }
  return { foodClass: 'unknown', via: 'none', foodkeeper: fk }
}

export function classifyFood(name: string, opts: ClassifyOptions = {}): FoodClass {
  return classifyFoodDetailed(name, opts).foodClass
}
