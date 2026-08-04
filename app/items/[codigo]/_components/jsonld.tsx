/**
 * JSON-LD (`schema.org/Dataset`) para las páginas de ítem y de desglose.
 *
 * Estas dos rutas son las que se quiere que un buscador entienda como **dato**
 * y no como prosa: un precio de referencia oficial, con fuente, licencia y
 * vigencia. El marcado repite exactamente lo que muestra la página —incluida
 * la advertencia de costo directo— porque un dato estructurado que dijera algo
 * distinto al HTML sería, además de spam, una mentira sobre el precio.
 *
 * No se declara `distribution`: el explorador todavía no expone una URL
 * canónica del JSON por ítem, y anunciar una descarga que no existe es peor
 * que omitir el campo.
 */
import { NOTA_COSTO_DIRECTO, type Procedencia } from "@/lib/schema"

/**
 * Forma mínima del `Dataset` que se emite. Es deliberadamente laxa (`unknown`
 * en los valores anidados): schema.org admite muchas formas y el objeto se
 * compone en cada página.
 */
export type DatasetJsonLd = {
  name: string
  description: string
  keywords: string[]
  spatialCoverage: unknown
  variableMeasured?: unknown
}

/**
 * Serializa a JSON escapando `<`: sin eso, una descripción de INVIAS que
 * contuviera `</script>` cerraría la etiqueta y el resto se interpretaría como
 * HTML. `<` es JSON válido y JavaScript lo lee igual.
 */
function serializar(valor: unknown): string {
  return JSON.stringify(valor).replace(/</g, "\\u003c")
}

export function DatasetJsonLd({
  datos,
  procedencia,
}: {
  datos: DatasetJsonLd
  procedencia: Procedencia
}) {
  const dataset = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: datos.name,
    description: datos.description,
    inLanguage: "es-CO",
    isAccessibleForFree: true,
    keywords: datos.keywords,
    // La vigencia INVIAS ("2026-1") es la cobertura temporal del dato: es el
    // semestre de publicación, no un rango de obra.
    temporalCoverage: procedencia.vigencia,
    spatialCoverage: datos.spatialCoverage,
    creator: {
      "@type": "GovernmentOrganization",
      name: procedencia.fuente,
      url: procedencia.url,
    },
    // `license` apunta a la publicación oficial (una URL); el texto completo de
    // las condiciones va en `usageInfo`, que es lo que restringe el uso.
    license: procedencia.url,
    usageInfo: procedencia.licencia,
    creditText: `${procedencia.fuente} — vigencia ${procedencia.vigencia}`,
    dateModified: procedencia.fechaDescarga,
    measurementTechnique: NOTA_COSTO_DIRECTO,
    ...(datos.variableMeasured
      ? { variableMeasured: datos.variableMeasured }
      : {}),
  }

  return (
    <script
      type="application/ld+json"
      // JSON-LD serializado y escapado en `serializar`: todo `<` sale como
      // secuencia unicode, así que ningún texto de la fuente cierra la etiqueta.
      dangerouslySetInnerHTML={{ __html: serializar(dataset) }}
    />
  )
}
