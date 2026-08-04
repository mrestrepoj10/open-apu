/**
 * Tabla de las 140 provincias para un ítem. Es el contenido principal de la
 * página: costo directo por región, en el HTML del servidor, sin JavaScript.
 *
 * Decisiones:
 *
 * - **Enlaces `next/link`.** Son 280 (provincia + desglose) y no cuestan
 *   payload: el módulo cliente de `Link` se serializa una vez por página, así
 *   que la conversión desde `<a>` midió ≈ 0 bytes gzip. La tormenta de
 *   prefetch que justificaba el `<a>` plano era real antes de 16.3 —cada
 *   enlace precargaba su destino: 293 peticiones / 4,5 MB en una vista—, pero
 *   con `partialPrefetching` el prefetch es por RUTA: estos 280 enlaces
 *   apuntan a dos rutas y traen dos App Shells compartidos.
 * - **Fila de encabezado por departamento** en vez de `rowspan`: da el ancla
 *   `#depto-XX` a la que apunta el mapa de teselas y deja todas las filas de
 *   datos con la misma forma (7 celdas), que es lo que permite alinear los
 *   números con selectores descendentes y no con clases por celda.
 * - **`costoDirecto === 0` se escribe "No aplica"**, nunca `$ 0`. Un cero en
 *   la fuente significa que el ítem no aplica en esa región (FORMATO.md §6.5);
 *   presentarlo como precio sería inventar un precio de cero pesos. Esas filas
 *   tampoco enlazan al desglose: no hay líneas publicadas que mostrar.
 */
import Link from "next/link"

import type { ItemRegion } from "@/lib/schema"

import { formatearPrecio } from "./formato"
import { Tabla } from "./tabla"

const CLASES = [
  // Alineación numérica de todas las columnas salvo la primera (provincia).
  "[&_th:nth-child(n+2)]:text-right [&_td:nth-child(n+2)]:text-right",
  "[&_td:nth-child(n+2)]:tabular-nums",
  // Costo directo: la cifra que el usuario viene a buscar.
  "[&_td:nth-child(6)]:font-medium [&_td:nth-child(6)]:whitespace-nowrap",
  // Encabezado de grupo (departamento).
  "[&_tbody_th]:bg-muted/30 [&_tbody_th]:text-left [&_tbody_th]:scroll-mt-4",
  // Los cuatro componentes son detalle: en pantallas estrechas estorban.
  // Siguen en el HTML (SEO, copiar/pegar), solo se ocultan visualmente.
  "max-md:[&_th:nth-child(n+2):nth-child(-n+5)]:hidden",
  "max-md:[&_td:nth-child(n+2):nth-child(-n+5)]:hidden",
].join(" ")

/** Agrupa las regiones por departamento, ordenadas por nombre (es-CO). */
function porDepartamento(regiones: ItemRegion[]) {
  const grupos = new Map<string, ItemRegion[]>()
  for (const fila of regiones) {
    const clave = fila.region.codigoDane
    const lista = grupos.get(clave)
    if (lista) lista.push(fila)
    else grupos.set(clave, [fila])
  }
  return [...grupos.values()]
    .map((filas) =>
      filas.sort((a, b) =>
        a.region.provincia.localeCompare(b.region.provincia, "es")
      )
    )
    .sort((a, b) =>
      a[0].region.departamento.localeCompare(b[0].region.departamento, "es")
    )
}

export function TablaProvincias({
  codigo,
  unidad,
  regiones,
}: {
  codigo: string
  unidad: string
  regiones: ItemRegion[]
}) {
  const grupos = porDepartamento(regiones)

  return (
    <Tabla className={CLASES}>
      <caption className="sr-only">
        Costo directo de referencia del ítem {codigo} en las {regiones.length}{" "}
        provincias INVIAS, en pesos colombianos por {unidad}. Sin AIU.
      </caption>
      <thead>
        <tr>
          <th scope="col">Provincia</th>
          <th scope="col">Equipo</th>
          <th scope="col">Materiales</th>
          <th scope="col">Transporte</th>
          <th scope="col">Mano de obra</th>
          <th scope="col">Costo directo</th>
          <th scope="col">
            <span className="sr-only">Acciones</span>
          </th>
        </tr>
      </thead>
      {grupos.map((filas) => (
        <tbody key={filas[0].region.codigoDane}>
          <tr>
            <th
              scope="colgroup"
              colSpan={7}
              id={`depto-${filas[0].region.codigoDane}`}
            >
              {filas[0].region.departamento}
            </th>
          </tr>
          {filas.map(({ region, totales, costoDirecto }) => {
            const aplica = costoDirecto > 0
            return (
              <tr key={region.slug}>
                <td>
                  <Link href={`/provincias/${region.slug}`}>
                    {region.provincia}
                  </Link>
                </td>
                <td>{aplica ? formatearPrecio(totales.equipo) : "—"}</td>
                <td>{aplica ? formatearPrecio(totales.materiales) : "—"}</td>
                <td>{aplica ? formatearPrecio(totales.transporte) : "—"}</td>
                <td>{aplica ? formatearPrecio(totales.manoDeObra) : "—"}</td>
                <td>
                  {aplica ? (
                    formatearPrecio(costoDirecto)
                  ) : (
                    <span className="font-normal text-muted-foreground">
                      No aplica
                    </span>
                  )}
                </td>
                <td>
                  {aplica ? (
                    // El nombre accesible va en `aria-label` y no en un
                    // `<span class="sr-only">`: 140 elementos extra pesan el
                    // doble en la carga RSC embebida que en el HTML.
                    <Link
                      href={`/items/${codigo}/${region.slug}`}
                      aria-label={`Desglose de ${codigo} en ${region.provincia}`}
                    >
                      Desglose
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      ))}
    </Tabla>
  )
}
