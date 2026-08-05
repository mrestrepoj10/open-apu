/**
 * `/aiu` — qué es el AIU, por qué los precios de este sitio no lo incluyen y
 * cómo calcularlo uno mismo.
 *
 * Es la página a la que apunta la advertencia «costo directo, sin AIU» que
 * aparece en todas las superficies de precio del sitio. Hasta ahora esa frase
 * era un callejón sin salida: decía lo que el número NO es y dejaba al lector
 * ahí. Esta ruta es la salida.
 *
 * ## Contenido, no dato
 *
 * No lee `lib/data/`: no hay ninguna cifra de INVIAS en la página. La única
 * cantidad en pesos es una base hipotética redonda para la calculadora, y va
 * rotulada como tal — el no negociable 1 pide procedencia para lo que viene de
 * una fuente, y lo que hay que hacer con lo que no viene de una fuente es
 * decirlo. Al no leer nada, la ruta entera es App Shell estático.
 *
 * ## Por qué sí se indexa (a diferencia de `/buscar`)
 *
 * No compite con ninguna otra URL del sitio: no es el catálogo con otra forma,
 * es la explicación que ninguna de las 74 000 páginas de precio puede dar sin
 * repetirse 74 000 veces.
 */
import type { Metadata } from "next"
import Link from "next/link"

import { CalculadoraAiuLazy } from "@/components/aiu/lazy"
import { formatearCOP } from "@/lib/format"

export const metadata: Metadata = {
  title: "AIU: administración, imprevistos y utilidad",
  description:
    "Qué es el AIU en un presupuesto de obra en Colombia, por qué los APU de " +
    "referencia de INVIAS no lo incluyen, cómo se calcula sobre el costo " +
    "directo y por qué el IVA en obra recae solo sobre la utilidad.",
  alternates: { canonical: "/aiu" },
}

/**
 * Base de la calculadora de esta página: un millón de pesos redondos.
 *
 * Es hipotética a propósito y se rotula en la página. Poner aquí el precio de
 * un ítem real obligaría a arrastrar su procedencia, su vigencia y su región a
 * una página que no habla de ningún ítem; y elegir *cuál* sería una decisión
 * editorial sin criterio. Quien quiera la calculadora sobre un precio real la
 * tiene en la página de desglose de cada ítem × provincia.
 */
const BASE_HIPOTETICA = 1_000_000

/** Las celdas del bloque de costos indirectos del FR-APU-1 (FORMATO.md §3.5). */
const CELDAS_VACIAS: readonly { celda: string; rotulo: string }[] = [
  { celda: "B106 / K106", rotulo: "ADMINISTRACION" },
  { celda: "B107 / K107", rotulo: "IMPREVISTOS" },
  { celda: "B108 / K108", rotulo: "UTILIDAD" },
  { celda: "N109", rotulo: "SUBTOTAL $" },
  { celda: "N111", rotulo: "Precio Unitario Total Aproximado al Peso $" },
]

export default function Page() {
  return (
    <main className="mx-auto w-full max-w-3xl space-y-10 px-4 py-10 sm:px-6">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight text-balance">
          AIU: administración, imprevistos y utilidad
        </h1>
        <p className="text-pretty text-muted-foreground">
          Los precios de este explorador son{" "}
          <strong className="font-medium text-foreground">costo directo</strong>
          : lo que cuesta ejecutar una unidad de obra en equipo, materiales,
          transporte y mano de obra. Entre ese número y el que se escribe en una
          oferta hay un porcentaje que INVIAS no publica y que este sitio
          tampoco inventa. Esta página explica cuál es, por qué falta y cómo
          ponerlo tú.
        </p>
      </header>

      <section className="space-y-4">
        <h2 className="text-xl font-medium tracking-tight">
          Qué es cada letra
        </h2>
        <dl className="grid gap-3 sm:grid-cols-3">
          {[
            {
              letra: "A",
              titulo: "Administración",
              texto:
                "Lo que cuesta sostener la obra y la empresa detrás de ella: dirección, oficina, pólizas, impuestos, campamento, servicios. No se ejecuta en el frente de obra, pero sin ello no hay obra.",
            },
            {
              letra: "I",
              titulo: "Imprevistos",
              texto:
                "El colchón para lo que se sabe que puede pasar pero no cuánto costará: lluvias, un tramo con material distinto al del estudio, un reproceso. No es un margen; es riesgo cuantificado a ojo.",
            },
            {
              letra: "U",
              titulo: "Utilidad",
              texto:
                "El margen del contratista. Es la letra que importa dos veces: define la ganancia y, en contratos de construcción, es la base sobre la que se liquida el IVA.",
            },
          ].map((entrada) => (
            <div key={entrada.letra} className="rounded-lg border p-4">
              <dt className="space-y-1">
                <span className="block font-mono text-2xl font-semibold text-muted-foreground">
                  {entrada.letra}
                </span>
                <span className="block font-medium">{entrada.titulo}</span>
              </dt>
              <dd className="mt-1.5 text-sm text-pretty text-muted-foreground">
                {entrada.texto}
              </dd>
            </div>
          ))}
        </dl>
        <p className="text-sm text-pretty text-muted-foreground">
          Los tres se expresan como porcentaje del costo directo y —en la
          práctica colombiana y en el propio formato de INVIAS— los tres se
          calculan sobre esa misma base, no en cascada: los imprevistos son un
          porcentaje del costo directo, no del costo directo más la
          administración.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-medium tracking-tight">
          Por qué estos precios no lo traen
        </h2>
        <p className="text-pretty text-muted-foreground">
          No es una omisión del proyecto: es lo que publica la fuente. Cada
          formato FR-APU-1 de INVIAS trae el bloque de costos indirectos
          impreso, con sus tres filas rotuladas… y todas las celdas de valor en
          blanco. El libro define la estructura y deja el número a quien
          presupuesta.
        </p>

        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <caption className="sr-only">
              Celdas del bloque «V. COSTOS INDIRECTOS» del formato FR-APU-1 y su
              contenido
            </caption>
            <thead>
              <tr className="border-b bg-muted/40 text-left">
                <th scope="col" className="px-3 py-2 font-medium">
                  Celda
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Rótulo impreso
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Valor
                </th>
              </tr>
            </thead>
            <tbody>
              {CELDAS_VACIAS.map((fila) => (
                <tr key={fila.celda} className="border-b last:border-0">
                  <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">
                    {fila.celda}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {fila.rotulo}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground italic">
                    vacía
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-sm text-pretty text-muted-foreground">
          El lector de este repositorio no se limita a ignorar ese bloque:{" "}
          <strong className="font-medium text-foreground">
            comprueba que siga vacío
          </strong>{" "}
          en cada uno de los 140 libros y falla ruidosamente si algún día una
          vigencia trae un valor ahí. El supuesto está verificado, no asumido. Y
          el esquema de datos rechaza cualquier documento que traiga campos de
          AIU, para que un porcentaje calculado no pueda colarse en los archivos
          publicados y acabar leyéndose como precio de mercado.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-medium tracking-tight">Quién lo fija</h2>
        <p className="text-pretty text-muted-foreground">
          Depende del contrato, y por eso no hay un número que publicar. La
          entidad contratante puede fijarlo en el pliego —y entonces es un dato
          del proceso, no una decisión del proponente— o dejarlo a la oferta, y
          entonces cada proponente presenta el suyo. Varía con el tamaño del
          contrato, el plazo, la distancia, el riesgo y la estructura de la
          empresa.
        </p>
        <p className="text-pretty text-muted-foreground">
          Cualquier «AIU típico» que encuentres sin la fuente del contrato del
          que salió es folclore. Este sitio prefiere no tener el número a
          tenerlo inventado: si algún día publica porcentajes de referencia,
          será una distribución construida sobre contratos reales, con enlace a
          cada uno.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-medium tracking-tight">
          El IVA va sobre la utilidad
        </h2>
        <p className="text-pretty text-muted-foreground">
          Es el detalle que más calculadoras de internet cobran de más. En los
          contratos de construcción de bien inmueble el IVA no se liquida sobre
          el valor total del contrato, sino sobre los honorarios o la{" "}
          <strong className="font-medium text-foreground">utilidad</strong> del
          constructor —la U del AIU— porque esa es la base gravable especial que
          fijó el Decreto 1372 de 1992, artículo 3, hoy compilado en el Decreto
          Único Reglamentario 1625 de 2016.
        </p>
        <p className="text-pretty text-muted-foreground">
          La diferencia no es menor: sobre un costo directo de{" "}
          {formatearCOP(BASE_HIPOTETICA)} con un AIU de 23 % repartido 15/3/5,
          el 19 % sobre la utilidad son {formatearCOP(9_500)}; el mismo 19 %
          sobre el subtotal serían {formatearCOP(233_700)}. Por eso la
          calculadora de abajo lo trae como interruptor y no como automatismo:
          el tratamiento depende del tipo de contrato y no todo lo que se
          presupuesta con un APU es construcción de bien inmueble.
        </p>
        <p className="rounded-lg border bg-muted/40 p-3 text-xs text-pretty text-muted-foreground">
          Orientación general para leer un presupuesto, no asesoría tributaria.
          La base gravable, la tarifa y las retenciones que apliquen a un
          contrato concreto se verifican con la entidad y con un asesor.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-medium tracking-tight">Pruébalo</h2>
        <p className="text-pretty text-muted-foreground">
          Sobre una base hipotética de {formatearCOP(BASE_HIPOTETICA)} de costo
          directo. Escribe tus porcentajes y mira cómo se mueve el resultado; la
          curva muestra la distancia entre el costo directo y el precio para
          cualquier AIU total.
        </p>

        <CalculadoraAiuLazy
          costoDirecto={BASE_HIPOTETICA}
          unidad="unidad"
          notaBase={`La base de ${formatearCOP(BASE_HIPOTETICA)} es hipotética, elegida por ser redonda: no corresponde a ningún ítem ni a ninguna región.`}
        />

        <p className="text-sm text-pretty text-muted-foreground">
          Para calcular sobre un precio real, entra a cualquier ítem, elige una
          provincia y usa la misma calculadora al pie del desglose:{" "}
          <Link href="/items" className="underline underline-offset-4">
            ver el catálogo de ítems
          </Link>{" "}
          o{" "}
          <Link href="/buscar" className="underline underline-offset-4">
            buscar uno
          </Link>
          .
        </p>
      </section>

      <section className="space-y-3 rounded-lg border bg-muted/40 p-4">
        <h2 className="text-base font-medium">En resumen</h2>
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-pretty text-muted-foreground">
          <li>
            Los precios de este sitio son costo directo de referencia: no
            incluyen AIU ni IVA y no son precios de mercado.
          </li>
          <li>
            El bloque de AIU viene vacío en la fuente. No falta aquí: falta
            allá, a propósito.
          </li>
          <li>
            El AIU lo pone quien contrata o quien oferta. La calculadora usa tus
            porcentajes, no unos nuestros, y no guarda nada.
          </li>
          <li>
            En construcción de bien inmueble, el IVA se liquida sobre la
            utilidad, no sobre el total.
          </li>
        </ul>
      </section>
    </main>
  )
}
