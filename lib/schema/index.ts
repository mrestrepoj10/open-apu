/**
 * Esquema de datos de APU Stack (zod + tipos inferidos).
 *
 * Compatible con el navegador: sin `node:*` ni APIs de Bun. Todos los precios
 * son costo directo en COP y todo documento de nivel superior lleva
 * `schemaVersion` y `procedencia`.
 */
export {
  COMPONENTES,
  ComponenteSchema,
  CopSchema,
  CantidadSchema,
  FactorSchema,
  NOTA_COSTO_DIRECTO,
  ProcedenciaSchema,
  SCHEMA_VERSION,
  SchemaVersionSchema,
  TextoSchema,
  VigenciaSchema,
  type Componente,
  type Procedencia,
  type Vigencia,
} from "./comun"

export {
  CodigoDaneSchema,
  CodigoRegionSchema,
  DEPARTAMENTOS_DANE,
  RegionSchema,
  SlugSchema,
  codigoDaneDeRegion,
  nombreDepartamentoDane,
  slugRegion,
  type Region,
} from "./region"

export {
  ApuCoherenteSchema,
  ApuLineaSchema,
  ApuSchema,
  CodigoApuSchema,
  TOLERANCIA_COP,
  TotalesPorComponenteSchema,
  revisarCoherencia,
  type Apu,
  type ApuLinea,
  type TotalesPorComponente,
} from "./apu"

export {
  InsumoSchema,
  ListaInsumosSchema,
  type Insumo,
  type ListaInsumos,
} from "./insumo"

export {
  AgregadosSchema,
  CapituloInviasStatSchema,
  CapituloNumeroSchema,
  CapituloSchema,
  CapituloStatSchema,
  CatalogoItemSchema,
  CatalogoSchema,
  ConteosSchema,
  DepartamentoStatSchema,
  ItemRegionSchema,
  ItemRegionalSchema,
  ProvinciaItemSchema,
  ProvinciaResumenSchema,
  ProvinciaStatSchema,
  StatsSchema,
  type Agregados,
  type Catalogo,
  type CatalogoItem,
  type Conteos,
  type ItemRegion,
  type ItemRegional,
  type ProvinciaItem,
  type ProvinciaResumen,
  type Stats,
} from "./artefactos"
