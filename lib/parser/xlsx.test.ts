/**
 * Pruebas de las piezas de bajo nivel: lectura del zip, barrido de celdas,
 * normalización y —sobre todo— que **todo error nombre archivo, hoja y celda**.
 *
 * Los libros de estas pruebas se construyen aquí, en memoria, para poder
 * corromperlos una celda a la vez.
 */
import { describe, expect, test } from "bun:test"
import { zipSync, strToU8 } from "fflate"
import { abrirLibro, ParserError, parseIndice, parseItem } from "./index"
import {
  decodificarXml,
  leerCadenasCompartidas,
  leerCeldas,
  ArchivoZip,
} from "./xlsx"
import {
  capitalizarNombre,
  codigoConComas,
  codigoDesdeNombreHoja,
  limpiarTexto,
  normalizarUnidad,
  partirDescripcion,
} from "./normalizar"
import { parseRegionDesdeNombreArchivo } from "./region"
import type { Procedencia } from "../schema"

const procedencia: Procedencia = {
  fuente: "INVIAS",
  url: "https://www.invias.gov.co/",
  vigencia: "2026-1",
  fechaDescarga: "2026-08-03",
  licencia: "Dato público INVIAS; costo directo sin AIU.",
}

// ————————————————————————————————————————————————————————————————
// Libro falso mínimo
// ————————————————————————————————————————————————————————————————

const NS_REL =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships"

/** Envuelve filas sueltas en una hoja válida. */
function hoja(filas: string): string {
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ` +
    `xmlns:r="${NS_REL}"><sheetData>${filas}</sheetData></worksheet>`
  )
}

/** Construye un .xlsx en memoria a partir de `{ nombreDeHoja: xml }`. */
function libroFalso(hojas: Record<string, string>): Uint8Array {
  const nombres = Object.keys(hojas)
  const partes: Record<string, Uint8Array> = {}
  nombres.forEach((nombre, i) => {
    partes[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(hojas[nombre]!)
  })
  partes["xl/workbook.xml"] = strToU8(
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ` +
      `xmlns:r="${NS_REL}"><sheets>` +
      nombres
        .map(
          (n, i) => `<sheet name="${n}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`
        )
        .join("") +
      `</sheets></workbook>`
  )
  partes["xl/_rels/workbook.xml.rels"] = strToU8(
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      nombres
        .map(
          (_, i) =>
            `<Relationship Id="rId${i + 1}" Type="${NS_REL}/worksheet" ` +
            `Target="worksheets/sheet${i + 1}.xml"/>`
        )
        .join("") +
      `</Relationships>`
  )
  partes["[Content_Types].xml"] = strToU8(
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      `<Default Extension="xml" ContentType="application/xml"/></Types>`
  )
  return zipSync(partes)
}

const PORTADA_MINIMA = hoja(
  `<row r="24"><c r="D24" t="str"><v>ANTIOQUIA</v></c>` +
    `<c r="F24" t="str"><v>VALLE DE ABURRÁ</v></c></row>`
)

/** Una fila de ÍNDICE con los cinco números en su sitio. */
function filaIndice(fila: number, codigo: string, valores: number[]): string {
  const [equipo, materiales, transporte, manoDeObra, costo] = valores
  return (
    `<row r="${fila}">` +
    `<c r="A${fila}"><v>${fila - 4}</v></c>` +
    `<c r="E${fila}" t="str"><v>${codigo}</v></c>` +
    `<c r="F${fila}" t="str"><v>ÍTEM DE PRUEBA</v></c>` +
    `<c r="G${fila}" t="str"><v>m3</v></c>` +
    `<c r="H${fila}"><v>${equipo}</v></c>` +
    `<c r="I${fila}"><v>${materiales}</v></c>` +
    `<c r="J${fila}"><v>${transporte}</v></c>` +
    `<c r="K${fila}"><v>${manoDeObra}</v></c>` +
    `<c r="L${fila}"><v>${costo}</v></c>` +
    `</row>`
  )
}

// ————————————————————————————————————————————————————————————————

describe("ArchivoZip", () => {
  test("rechaza bytes que no son un zip, nombrando el archivo", () => {
    const basura = new Uint8Array(64).fill(7)
    let error: unknown
    try {
      abrirLibro(basura, { archivo: "roto.xlsx" })
    } catch (e) {
      error = e
    }
    expect(error).toBeInstanceOf(ParserError)
    expect((error as ParserError).archivo).toBe("roto.xlsx")
    expect((error as ParserError).message).toContain("roto.xlsx")
    expect((error as ParserError).message).toContain("directorio central")
  })

  test("un zip sin xl/workbook.xml no es un .xlsx", () => {
    const zip = zipSync({ "hola.txt": strToU8("hola") })
    expect(() => abrirLibro(zip, { archivo: "x.xlsx" })).toThrow(
      /falta xl\/workbook\.xml/
    )
  })

  test("lee entradas almacenadas sin comprimir", () => {
    const zip = new ArchivoZip(
      zipSync({ "a.txt": [strToU8("contenido"), { level: 0 }] })
    )
    expect(zip.leerTexto("a.txt")).toBe("contenido")
  })

  test("nombra la entrada que falta", () => {
    const zip = new ArchivoZip(zipSync({ "a.txt": strToU8("x") }), "l.xlsx")
    expect(() => zip.leer("b.txt")).toThrow(/l\.xlsx[\s\S]*b\.txt/)
  })
})

describe("leerCeldas", () => {
  const cadenas = ["HOLA", "", "CON <escape> & tilde á"]

  test("resuelve cadenas compartidas, texto de fórmula y números", () => {
    const celdas = leerCeldas(
      `<c r="A1" t="s"><v>0</v></c>` +
        `<c r="B1" t="str"><f>VLOOKUP(1)</f><v>200,1,1</v></c>` +
        `<c r="C1"><f>ROUND(1,2)</f><v>1234.56</v></c>`,
      cadenas
    )
    expect(celdas.get("A1")?.valor).toBe("HOLA")
    expect(celdas.get("B1")?.valor).toBe("200,1,1")
    expect(celdas.get("C1")?.valor).toBe(1234.56)
  })

  test("una fórmula con resultado vacío (<v/>) es una línea sin usar", () => {
    // Es exactamente la forma de las filas no utilizadas de cada sección
    // (FORMATO.md §6.3): la celda existe, con fórmula, y el resultado es vacío.
    const celdas = leerCeldas(
      `<c r="B43" s="125" t="str"><f>IF(...)</f><v/></c>` +
        `<c r="N43" s="127" t="str"><f t="shared" si="0"/><v/></c>` +
        `<c r="B51" s="128"/>`,
      cadenas
    )
    expect(celdas.has("B43")).toBe(false)
    expect(celdas.has("N43")).toBe(false)
    expect(celdas.has("B51")).toBe(false)
  })

  test("las celdas de error #VALUE! decorativas se ignoran", () => {
    const celdas = leerCeldas(`<c r="N1" t="e" vm="145"><v>#VALUE!</v></c>`, [])
    expect(celdas.has("N1")).toBe(false)
  })

  test("una celda sin referencia A1 es un XML inesperado", () => {
    expect(() =>
      leerCeldas(`<c s="1"><v>1</v></c>`, [], { hoja: "ÍNDICE" })
    ).toThrow(/ÍNDICE[\s\S]*atributo r=/)
  })

  test("decodifica entidades XML", () => {
    expect(decodificarXml("a &amp; b &lt;c&gt; &#10; &#x41;")).toBe(
      "a & b <c> \n A"
    )
  })

  test("lee cadenas compartidas con texto enriquecido", () => {
    const cadenasXml =
      `<sst><si><t>simple</t></si>` +
      `<si><r><t xml:space="preserve">Artículo 730 - 22 </t></r>` +
      `<r><t>Barreras</t></r></si></sst>`
    expect(leerCadenasCompartidas(cadenasXml)).toEqual([
      "simple",
      "Artículo 730 - 22 Barreras",
    ])
  })
})

describe("normalización", () => {
  test("las 14 grafías de unidad del ÍNDICE colapsan a 10 canónicas", () => {
    const crudas = [
      "ha",
      "m2",
      "m",
      "kg",
      "u",
      "m3",
      "Kg",
      "L",
      "m³",
      "tf-m",
      "kg-km",
      "m3 - E",
      "m3 - Km",
      "m3 - km",
    ]
    const canonicas = crudas.map((c) => normalizarUnidad(c)!.unidad)
    expect(new Set(canonicas).size).toBe(10)
    expect(normalizarUnidad("Kg")).toEqual({
      unidad: "kg",
      cruda: "Kg",
      conocida: true,
    })
    expect(normalizarUnidad("m³")!.unidad).toBe("m3")
    expect(normalizarUnidad("m3 - E")!.unidad).toBe("m3-km")
    expect(normalizarUnidad("m3 - Km")!.unidad).toBe("m3-km")
  })

  test("una unidad desconocida se conserva y se marca", () => {
    expect(normalizarUnidad("pulg")).toEqual({
      unidad: "pulg",
      cruda: "pulg",
      conocida: false,
    })
  })

  test("los 6 códigos numéricos se normalizan a la forma de la hoja", () => {
    expect(codigoConComas(730.4)).toBe("730,4")
    expect(codigoConComas("200,1,1")).toBe("200,1,1")
    expect(codigoDesdeNombreHoja("730,4")).toBe("730.4")
    expect(codigoDesdeNombreHoja("630,1,3,1,2")).toBe("630.1.3.1.2")
  })

  test("limpia CRLF y dobles espacios sin perder los saltos de línea", () => {
    const texto = limpiarTexto(
      "DESMONTE Y LIMPIEZA\r\n(Análisis aplicado  para la tala)  "
    )
    expect(texto).toBe("DESMONTE Y LIMPIEZA\n(Análisis aplicado para la tala)")
    expect(partirDescripcion(texto!)).toEqual({
      titulo: "DESMONTE Y LIMPIEZA",
      alcance: "(Análisis aplicado para la tala)",
    })
  })

  test("capitaliza nombres en español dejando los conectores abajo", () => {
    expect(capitalizarNombre("VALLE DE ABURRÁ")).toBe("Valle de Aburrá")
    expect(capitalizarNombre("NORTE_DE_SANTANDER")).toBe("Norte de Santander")
  })
})

describe("parseRegionDesdeNombreArchivo", () => {
  test("deduce código, DANE, departamento y slug", () => {
    expect(
      parseRegionDesdeNombreArchivo(
        "APU_0509_ANTIOQUIA__VALLE_DE_ABURRA_2026_1.xlsx"
      )
    ).toEqual({
      codigo: "0509",
      codigoDane: "05",
      departamento: "Antioquia",
      provincia: "Valle de Aburra",
      slug: "antioquia-valle-de-aburra",
    })
  })

  test("provincia única: el sufijo 00 del código", () => {
    const region = parseRegionDesdeNombreArchivo(
      "APU_8100_ARAUCA__ARAUCA_2026_1.xlsx"
    )
    expect(region.codigo).toBe("8100")
    expect(region.departamento).toBe("Arauca")
    expect(region.slug).toBe("arauca-arauca")
  })

  test("rechaza un nombre que no sigue el patrón INVIAS", () => {
    expect(() => parseRegionDesdeNombreArchivo("precios.xlsx")).toThrow(
      ParserError
    )
  })

  test("rechaza un código DANE que no existe", () => {
    expect(() =>
      parseRegionDesdeNombreArchivo("APU_0109_INVENTADO__X_2026_1.xlsx")
    ).toThrow(/DANE/)
  })
})

describe("errores con ubicación", () => {
  test("un libro sin ÍNDICE falla nombrando la hoja que falta", () => {
    const bytes = libroFalso({ PORTADA: PORTADA_MINIMA, "200,1,1": hoja("") })
    expect(() => abrirLibro(bytes, { archivo: "x.xlsx" })).toThrow(
      /x\.xlsx[\s\S]*falta la hoja "ÍNDICE"/
    )
  })

  test("un libro sin hojas de ítem falla", () => {
    const bytes = libroFalso({
      PORTADA: PORTADA_MINIMA,
      ÍNDICE: hoja(filaIndice(5, "200,1,1", [1, 1, 1, 1, 4])),
    })
    expect(() => abrirLibro(bytes)).toThrow(/ninguna hoja de ítem/)
  })

  test("un subtotal no numérico del ÍNDICE nombra hoja y celda", () => {
    const bytes = libroFalso({
      PORTADA: PORTADA_MINIMA,
      ÍNDICE: hoja(
        `<row r="5"><c r="E5" t="str"><v>200,1,1</v></c>` +
          `<c r="F5" t="str"><v>ÍTEM</v></c><c r="G5" t="str"><v>m3</v></c>` +
          `<c r="H5"><v>1</v></c><c r="I5"><v>1</v></c>` +
          `<c r="J5"><v>1</v></c><c r="L5"><v>4</v></c></row>`
      ),
      "200,1,1": hoja(""),
    })
    const libro = abrirLibro(bytes, { archivo: "x.xlsx" })
    let error: unknown
    try {
      parseIndice(libro)
    } catch (e) {
      error = e
    }
    expect(error).toBeInstanceOf(ParserError)
    const parser = error as ParserError
    expect(parser.archivo).toBe("x.xlsx")
    expect(parser.hoja).toBe("ÍNDICE")
    expect(parser.celda).toBe("K5")
    expect(parser.message).toContain("subtotal de mano de obra")
  })

  test("una hoja de ítem sin el banner esperado nombra la celda del banner", () => {
    const bytes = libroFalso({
      PORTADA: PORTADA_MINIMA,
      ÍNDICE: hoja(filaIndice(5, "200,1,1", [1, 1, 1, 1, 4])),
      "200,1,1": hoja(
        `<row r="35"><c r="B35" t="str"><v>OTRA COSA</v></c></row>`
      ),
    })
    const libro = abrirLibro(bytes, { archivo: "x.xlsx" })
    let error: unknown
    try {
      parseItem(libro, "200,1,1", { procedencia })
    } catch (e) {
      error = e
    }
    expect(error).toBeInstanceOf(ParserError)
    const parser = error as ParserError
    expect(parser.hoja).toBe("200,1,1")
    expect(parser.celda).toBe("B35")
    expect(parser.message).toContain("I. EQUIPO")
  })

  test("una hoja que no existe se reporta por nombre", () => {
    const bytes = libroFalso({
      PORTADA: PORTADA_MINIMA,
      ÍNDICE: hoja(filaIndice(5, "200,1,1", [1, 1, 1, 1, 4])),
      "200,1,1": hoja(""),
    })
    const libro = abrirLibro(bytes, { archivo: "x.xlsx" })
    expect(() => parseItem(libro, "999,9", { procedencia })).toThrow(
      /no tiene la hoja "999,9"/
    )
  })

  test("un bloque de AIU con valor rompe el supuesto de costo directo", () => {
    const secciones =
      `<row r="35"><c r="B35" t="str"><v>I. EQUIPO</v></c></row>` +
      `<row r="53"><c r="B53" t="str"><v>SUBTOTAL $</v></c></row>` +
      `<row r="55"><c r="B55" t="str"><v>II. MATERIALES</v></c></row>` +
      `<row r="74"><c r="B74" t="str"><v>SUBTOTAL $</v></c></row>` +
      `<row r="76"><c r="B76" t="str"><v>III. TRANSPORTES</v></c></row>` +
      `<row r="84"><c r="B84" t="str"><v>SUBTOTAL $</v></c></row>` +
      `<row r="86"><c r="B86" t="str"><v>IV. MANO DE OBRA</v></c></row>` +
      `<row r="99"><c r="B99" t="str"><v>SUBTOTAL $</v></c></row>` +
      `<row r="101"><c r="B101" t="str"><v>TOTAL COSTO DIRECTO $</v></c></row>` +
      `<row r="109"><c r="N109"><v>123456</v></c></row>`
    const bytes = libroFalso({
      PORTADA: PORTADA_MINIMA,
      ÍNDICE: hoja(filaIndice(5, "200,1,1", [1, 1, 1, 1, 4])),
      "200,1,1": hoja(secciones),
    })
    const libro = abrirLibro(bytes, { archivo: "x.xlsx" })
    let error: unknown
    try {
      parseItem(libro, "200,1,1", { procedencia })
    } catch (e) {
      error = e
    }
    expect(error).toBeInstanceOf(ParserError)
    expect((error as ParserError).celda).toBe("N109")
    expect((error as ParserError).message).toContain("costos indirectos")
  })
})
