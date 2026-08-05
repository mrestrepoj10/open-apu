/**
 * Rejilla departamento × capítulo constructivo con el nivel de precio relativo:
 * la mediana de (costo del APU ÷ mediana nacional de su ítem) en cada celda.
 * ×1 = "este capítulo cuesta aquí lo que en la mitad del país".
 *
 * Componente de SERVIDOR, como el mapa de teselas: es HTML puro con clases
 * literales (para el escáner de Tailwind) y etiquetas emergentes nativas
 * (`title`). Cero JavaScript: 256 celdas hidratadas no pagarían nada que el
 * color y el `title` no den ya.
 *
 * La escala es DIVERGENTE, no secuencial: la pregunta de la celda es "¿por
 * encima o por debajo de la referencia nacional?", que tiene polaridad. Azul =
 * por debajo, gris neutro = en la referencia (el punto medio nunca lleva tono,
 * para no inclinar la lectura), ámbar = por encima — la misma rampa cálida del
 * resto del sitio para "más caro". En oscuro cada lado baja a tonos profundos,
 * igual que la rampa del mapa de teselas.
 *
 * Los cortes salen del dato real (la mitad de las celdas cae en ×0,97–×1,03):
 * finos alrededor de ×1 para que la mayoría se lea "en la referencia", y
 * anchos en las colas, que es donde está la historia (hasta ×5 en San Andrés).
 */
import { cn } from "@/lib/utils"
import { formatearNumero } from "@/lib/format"

import type { NivelDepartamento } from "@/app/_ui/agregados"

export type NivelDepartamentosProps = {
  /** Filas ya ordenadas alfabéticamente por departamento. */
  filas: NivelDepartamento[]
  /** Capítulos constructivos presentes, ya ordenados por número. */
  capitulos: ReadonlyArray<{ numero: number; nombre: string }>
  className?: string
}

type Tramo = {
  /** ¿La razón cae en este tramo? Se evalúan en orden. */
  hasta: number
  etiqueta: string
  clase: string
}

/** Escala divergente: azul por debajo, neutro en ×1, ámbar por encima. */
const TRAMOS: Tramo[] = [
  { hasta: 0.9, etiqueta: "≤ ×0,9", clase: "bg-sky-500 dark:bg-sky-600" },
  { hasta: 0.97, etiqueta: "×0,9 – ×0,97", clase: "bg-sky-200 dark:bg-sky-900" },
  { hasta: 1.03, etiqueta: "≈ nacional", clase: "bg-muted" },
  { hasta: 1.1, etiqueta: "×1,03 – ×1,1", clase: "bg-amber-300 dark:bg-amber-800" },
  { hasta: 1.5, etiqueta: "×1,1 – ×1,5", clase: "bg-amber-500 dark:bg-amber-600" },
  { hasta: Infinity, etiqueta: "> ×1,5", clase: "bg-amber-600 dark:bg-amber-400" },
]

function tramoDe(razon: number): Tramo {
  return TRAMOS.find((tramo) => razon <= tramo.hasta) ?? TRAMOS[TRAMOS.length - 1]
}

export function NivelDepartamentos({
  filas,
  capitulos,
  className,
}: NivelDepartamentosProps) {
  return (
    <figure className={cn("w-full", className)}>
      <div className="overflow-x-auto">
        <table className="border-separate border-spacing-0.5 text-sm">
          <caption className="sr-only">
            Nivel de precio relativo por departamento y capítulo constructivo:
            mediana de la razón entre el costo directo de cada APU y la mediana
            nacional de su ítem. Sin AIU.
          </caption>
          <thead>
            <tr>
              <th scope="col" className="pr-2 text-left font-medium text-muted-foreground">
                Departamento
              </th>
              {capitulos.map((capitulo) => (
                <th
                  key={capitulo.numero}
                  scope="col"
                  title={`${capitulo.numero} · ${capitulo.nombre}`}
                  className="w-9 pb-1 text-center font-mono text-xs font-medium text-muted-foreground"
                >
                  {capitulo.numero}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((fila) => {
              const celdas = new Map(
                fila.celdas.map((celda) => [celda.numero, celda])
              )
              return (
                <tr key={fila.codigoDane}>
                  <th
                    scope="row"
                    className="max-w-40 truncate pr-2 text-left text-xs font-normal whitespace-nowrap"
                    title={fila.departamento}
                  >
                    {fila.departamento}
                  </th>
                  {capitulos.map((capitulo) => {
                    const celda = celdas.get(capitulo.numero)
                    if (!celda || celda.razon <= 0) {
                      return (
                        <td
                          key={capitulo.numero}
                          title={`${fila.departamento} · ${capitulo.numero} ${capitulo.nombre}: sin dato`}
                          className="h-6 w-9 rounded-xs bg-muted/30 text-center text-xs text-muted-foreground"
                        >
                          <span aria-hidden="true">–</span>
                          <span className="sr-only">sin dato</span>
                        </td>
                      )
                    }
                    const razon = `×${formatearNumero(celda.razon, 2)}`
                    return (
                      <td
                        key={capitulo.numero}
                        title={
                          `${fila.departamento} · ${capitulo.numero} ` +
                          `${capitulo.nombre}: ${razon} de la mediana nacional ` +
                          `(${formatearNumero(celda.apus)} APU)`
                        }
                        className={cn("h-6 w-9 rounded-xs", tramoDe(celda.razon).clase)}
                      >
                        <span className="sr-only">{razon}</span>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <figcaption className="mt-3 space-y-2">
        <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {TRAMOS.map((tramo) => (
            <li key={tramo.etiqueta} className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className={cn("inline-block size-3 rounded-xs", tramo.clase)}
              />
              <span className="tabular-nums">{tramo.etiqueta}</span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          Capítulos:{" "}
          {capitulos.map((capitulo, indice) => (
            <span key={capitulo.numero}>
              <span className="font-mono">{capitulo.numero}</span>{" "}
              {capitulo.nombre}
              {indice < capitulos.length - 1 ? " · " : ""}
            </span>
          ))}
        </p>
      </figcaption>
    </figure>
  )
}
