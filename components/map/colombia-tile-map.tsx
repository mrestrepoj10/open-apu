/**
 * Mapa de teselas (tilegram) de los 33 departamentos de Colombia.
 *
 * Componente de SERVIDOR: sale como SVG en el HTML estático, cero JavaScript
 * en el cliente. Las etiquetas emergentes son elementos `<title>` nativos del
 * SVG y los enlaces son `<a>` planos, no `next/link`, para no arrastrar el
 * runtime de navegación a una página que puede ser puramente estática.
 *
 * ── Por qué teselas y no un mapa real ────────────────────────────────────────
 * Un GeoJSON de Colombia pesa cientos de kB y hace ilegibles a Atlántico,
 * Quindío o Risaralda frente a Amazonas o Vichada. Aquí cada departamento vale
 * una tesela del mismo tamaño: el dato de cada uno se lee igual de bien, que es
 * justo lo que se quiere en un comparador de precios.
 *
 * ── La rejilla ───────────────────────────────────────────────────────────────
 * 6 columnas (0 = oeste → 5 = este) × 9 filas (0 = norte → 8 = sur). Las
 * posiciones se derivaron de los centroides de cada departamento cuantizados a
 * la rejilla y luego se ajustaron a mano para conservar las vecindades reales
 * (el eje cafetero apilado en la columna 2, la Orinoquia y la Amazonía como
 * bloque oriental, Nariño en la esquina suroccidental).
 *
 *        c0     c1     c2     c3     c4     c5
 *   f0   SAP     ·      ·      ·     GUJ     ·      ← Caribe / San Andrés
 *   f1    ·      ·     ATL    MAG    CES     ·
 *   f2    ·     COR    SUC    BOL    NSA     ·
 *   f3    ·      ·     ANT    SAN    ARA     ·      ← Andes / Piedemonte
 *   f4    ·     CHO    CAL    BOY    CAS    VIC
 *   f5    ·     RIS    QUI    CUN     ·      ·
 *   f6    ·     VAL    TOL    BOG    MET     ·
 *   f7    ·     CAU    HUI    CAQ    GUV    GUI     ← Amazonía / Orinoquia
 *   f8   NAR    PUT     ·     AMA    VAU     ·
 *
 * Notas de la rejilla:
 * - San Andrés (SAP) va como recuadro separado arriba a la izquierda: es
 *   insular y está a 700 km del continente; pegarlo a la costa mentiría.
 * - Bogotá D.C. (BOG) es un punto dentro de Cundinamarca; se coloca justo al
 *   sur de CUN, entre Tolima y Meta, que es su posición relativa real.
 * - El hueco en (1, f3) es aproximadamente el golfo de Urabá; los huecos de la
 *   columna 5 son el borde oriental despoblado (frontera con Venezuela/Brasil).
 *
 * ── Bogotá D.C. ──────────────────────────────────────────────────────────────
 * Bogotá está FUERA del alcance de INVIAS (no existe archivo `11xx`). Su tesela
 * se dibuja siempre rayada y con borde discontinuo, nunca coloreada, incluso si
 * `valores["11"]` viniera con un número: la referencia de precios para Bogotá
 * es el IDU (ver AGENTS.md, no negociable 5).
 */
import { DEPARTAMENTOS_DANE } from "@/lib/schema"
import { formatearNumero } from "@/lib/format"
import { cn } from "@/lib/utils"

/** Código DANE de Bogotá D.C. — siempre fuera del alcance INVIAS. */
const DANE_BOGOTA = "11"

export const NOTA_BOGOTA = "Fuera del alcance INVIAS — ver IDU"

type Tesela = {
  /** Código DANE de 2 dígitos. */
  dane: string
  /** Abreviatura de 3 letras que se imprime en la tesela. */
  abrev: string
  col: number
  fila: number
}

/** Ver el diagrama de la rejilla arriba. Orden: norte → sur, oeste → este. */
const TESELAS: readonly Tesela[] = [
  { dane: "88", abrev: "SAP", col: 0, fila: 0 },
  { dane: "44", abrev: "GUJ", col: 4, fila: 0 },

  { dane: "08", abrev: "ATL", col: 2, fila: 1 },
  { dane: "47", abrev: "MAG", col: 3, fila: 1 },
  { dane: "20", abrev: "CES", col: 4, fila: 1 },

  { dane: "23", abrev: "COR", col: 1, fila: 2 },
  { dane: "70", abrev: "SUC", col: 2, fila: 2 },
  { dane: "13", abrev: "BOL", col: 3, fila: 2 },
  { dane: "54", abrev: "NSA", col: 4, fila: 2 },

  { dane: "05", abrev: "ANT", col: 2, fila: 3 },
  { dane: "68", abrev: "SAN", col: 3, fila: 3 },
  { dane: "81", abrev: "ARA", col: 4, fila: 3 },

  { dane: "27", abrev: "CHO", col: 1, fila: 4 },
  { dane: "17", abrev: "CAL", col: 2, fila: 4 },
  { dane: "15", abrev: "BOY", col: 3, fila: 4 },
  { dane: "85", abrev: "CAS", col: 4, fila: 4 },
  { dane: "99", abrev: "VIC", col: 5, fila: 4 },

  { dane: "66", abrev: "RIS", col: 1, fila: 5 },
  { dane: "63", abrev: "QUI", col: 2, fila: 5 },
  { dane: "25", abrev: "CUN", col: 3, fila: 5 },

  { dane: "76", abrev: "VAL", col: 1, fila: 6 },
  { dane: "73", abrev: "TOL", col: 2, fila: 6 },
  { dane: DANE_BOGOTA, abrev: "BOG", col: 3, fila: 6 },
  { dane: "50", abrev: "MET", col: 4, fila: 6 },

  { dane: "19", abrev: "CAU", col: 1, fila: 7 },
  { dane: "41", abrev: "HUI", col: 2, fila: 7 },
  { dane: "18", abrev: "CAQ", col: 3, fila: 7 },
  { dane: "95", abrev: "GUV", col: 4, fila: 7 },
  { dane: "94", abrev: "GUI", col: 5, fila: 7 },

  { dane: "52", abrev: "NAR", col: 0, fila: 8 },
  { dane: "86", abrev: "PUT", col: 1, fila: 8 },
  { dane: "91", abrev: "AMA", col: 3, fila: 8 },
  { dane: "97", abrev: "VAU", col: 4, fila: 8 },
]

const COLUMNAS = 6
const FILAS = 9
const LADO = 40
const SEPARACION = 4
const PASO = LADO + SEPARACION
const ANCHO = COLUMNAS * PASO - SEPARACION
const ALTO = FILAS * PASO - SEPARACION

/**
 * Rampa secuencial ámbar en 6 tramos. Se escriben como clases literales (y no
 * como `var(--color-amber-N)`) para que Tailwind las detecte al escanear el
 * archivo. En oscuro la rampa se invierte hacia tonos profundos para mantener
 * el contraste con el fondo.
 */
const RAMPA = [
  {
    relleno: "fill-amber-100 dark:fill-amber-950",
    texto: "fill-amber-950 dark:fill-amber-100",
  },
  {
    relleno: "fill-amber-200 dark:fill-amber-900",
    texto: "fill-amber-950 dark:fill-amber-100",
  },
  {
    relleno: "fill-amber-300 dark:fill-amber-800",
    texto: "fill-amber-950 dark:fill-amber-100",
  },
  {
    relleno: "fill-amber-400 dark:fill-amber-700",
    texto: "fill-amber-950 dark:fill-amber-50",
  },
  {
    relleno: "fill-amber-500 dark:fill-amber-600",
    texto: "fill-amber-950 dark:fill-amber-50",
  },
  {
    relleno: "fill-amber-600 dark:fill-amber-500",
    texto: "fill-amber-50 dark:fill-amber-950",
  },
] as const

/**
 * Identificador del patrón rayado de Bogotá. Es constante a propósito: si hay
 * dos mapas en la misma página, ambos `<pattern>` son idénticos y compartirlos
 * no cambia el render (no se puede usar `useId` en un componente de servidor).
 */
const ID_RAYADO = "apu-tesela-rayado"

export type ColombiaTileMapProps = {
  /** Valor por código DANE de 2 dígitos, p. ej. `{ "05": 1034000 }`. */
  valores: Record<string, number>
  /** Cómo se muestra el valor en la etiqueta emergente. */
  formatear?: (valor: number) => string
  /** Si se pasa, cada tesela con valor se vuelve un enlace. */
  href?: (codigoDane: string) => string
  /** Texto que acompaña al valor en la etiqueta emergente, p. ej. "COP/m3". */
  unidad?: string
  /** Nombre accesible del mapa. */
  titulo?: string
  /** Oculta la leyenda de la rampa. */
  sinLeyenda?: boolean
  className?: string
}

/** Índice en `RAMPA` para un valor dentro del dominio [min, max]. */
function tramo(valor: number, min: number, max: number): number {
  if (max <= min) return RAMPA.length - 1
  const posicion = (valor - min) / (max - min)
  return Math.min(RAMPA.length - 1, Math.floor(posicion * RAMPA.length))
}

export function ColombiaTileMap({
  valores,
  formatear = formatearNumero,
  href,
  unidad,
  titulo = "Mapa de departamentos de Colombia",
  sinLeyenda = false,
  className,
}: ColombiaTileMapProps) {
  // Bogotá nunca entra en el dominio: no tiene dato INVIAS que escalar.
  const conDato = TESELAS.filter(
    (t) => t.dane !== DANE_BOGOTA && Number.isFinite(valores[t.dane])
  ).map((t) => valores[t.dane])

  const min = conDato.length ? Math.min(...conDato) : 0
  const max = conDato.length ? Math.max(...conDato) : 0
  const sufijo = unidad ? ` ${unidad}` : ""

  return (
    <figure className={cn("w-full max-w-xs", className)}>
      <svg
        viewBox={`0 0 ${ANCHO} ${ALTO}`}
        role="img"
        aria-label={titulo}
        className="h-auto w-full"
      >
        <title>{titulo}</title>
        <defs>
          <pattern
            id={ID_RAYADO}
            width={6}
            height={6}
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line
              x1={0}
              y1={0}
              x2={0}
              y2={6}
              className="stroke-muted-foreground/60"
              strokeWidth={2}
            />
          </pattern>
        </defs>

        {TESELAS.map((tesela) => {
          const nombre = DEPARTAMENTOS_DANE[tesela.dane] ?? tesela.abrev
          const x = tesela.col * PASO
          const y = tesela.fila * PASO
          const cx = x + LADO / 2
          const cy = y + LADO / 2
          const esBogota = tesela.dane === DANE_BOGOTA
          const valor = valores[tesela.dane]
          const tieneDato = !esBogota && Number.isFinite(valor)

          const paso = tieneDato ? RAMPA[tramo(valor, min, max)] : undefined

          const etiqueta = esBogota
            ? `${nombre} — ${NOTA_BOGOTA}`
            : tieneDato
              ? `${nombre}: ${formatear(valor)}${sufijo}`
              : `${nombre}: sin dato`

          const contenido = (
            <g>
              <title>{etiqueta}</title>
              <rect
                x={x}
                y={y}
                width={LADO}
                height={LADO}
                rx={4}
                className={cn(
                  "stroke-border",
                  esBogota && "fill-background stroke-muted-foreground/70",
                  !esBogota && (paso?.relleno ?? "fill-muted")
                )}
                strokeWidth={esBogota ? 1.5 : 1}
                strokeDasharray={esBogota ? "3 2" : undefined}
              />
              {esBogota ? (
                <rect
                  x={x}
                  y={y}
                  width={LADO}
                  height={LADO}
                  rx={4}
                  fill={`url(#${ID_RAYADO})`}
                  stroke="none"
                />
              ) : null}
              <text
                x={cx}
                y={cy}
                textAnchor="middle"
                dominantBaseline="central"
                className={cn(
                  "pointer-events-none text-[11px] font-medium",
                  esBogota && "fill-muted-foreground",
                  !esBogota && (paso?.texto ?? "fill-muted-foreground")
                )}
              >
                {tesela.abrev}
              </text>
            </g>
          )

          const enlace = href && tieneDato ? href(tesela.dane) : undefined

          return enlace ? (
            <a
              key={tesela.dane}
              href={enlace}
              className="outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring"
            >
              {contenido}
            </a>
          ) : (
            <g key={tesela.dane}>{contenido}</g>
          )
        })}
      </svg>

      {sinLeyenda ? null : (
        <figcaption className="mt-2 space-y-1 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className="tabular-nums">
              {conDato.length ? `${formatear(min)}${sufijo}` : "—"}
            </span>
            <svg
              viewBox={`0 0 ${RAMPA.length * 12} 8`}
              className="h-2 w-auto shrink-0"
              aria-hidden="true"
            >
              {RAMPA.map((paso, i) => (
                <rect
                  key={paso.relleno}
                  x={i * 12}
                  y={0}
                  width={12}
                  height={8}
                  className={paso.relleno}
                />
              ))}
            </svg>
            <span className="tabular-nums">
              {conDato.length ? `${formatear(max)}${sufijo}` : "—"}
            </span>
          </div>
          <p>
            <span className="text-foreground/80">BOG</span>: {NOTA_BOGOTA}.
            Teselas apagadas: sin dato en esta vigencia.
          </p>
        </figcaption>
      )}
    </figure>
  )
}
