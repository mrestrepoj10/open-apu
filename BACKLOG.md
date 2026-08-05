# Backlog

Ideas que no son el objetivo actual del repo. Viven aquí y no en el código
(no negociable 6: los bloques se quedan de un solo propósito).

El objetivo actual sigue siendo el de `AGENTS.md`: que cualquiera obtenga el
precio oficial de referencia de un ítem de construcción, rápido y con
procedencia, a través de un sitio estático.

## Corpus de AIU real desde SECOP II

**Qué.** Un conjunto de datos de porcentajes de AIU efectivamente pactados en
contratos de obra vial, construido desde los datos abiertos de SECOP II
(datos.gov.co) y publicado como **distribución con enlace a cada contrato** —
nunca como una cifra única.

**Por qué.** Hoy el sitio dice, con razón, que no publica AIU porque la fuente
no lo trae (`/aiu`). Eso deja al lector con la pregunta legítima de por dónde
anda el número. Un corpus con procedencia la respondería sin romper el no
negociable 2: la distribución sería dato con fuente, no una recomendación.
No existe en forma legible por máquina, que es exactamente el hueco que este
repo llenó con los APU.

**Cuidado.** El no negociable 3 prohíbe la automatización contra
hermes2.invias.gov.co; SECOP II es otra fuente y expone una API sancionada,
pero hay que verificar sus términos antes de construir nada. Es un proyecto de
ETL propio, con su vigencia, su licencia y su manifiesto — no un añadido a la
tubería actual.

## Constructor de presupuestos

**Qué.** Seleccionar ítems × cantidades, componer un presupuesto y exportarlo a
xlsx/CSV con un pie de AIU configurable (reutilizando `lib/aiu.ts`).

**Por qué.** Es para lo que sirven los APU, y es donde convergen el explorador,
la calculadora y —si llega— el corpus de SECOP.

**Cuidado.** Es la primera funcionalidad que necesitaría estado persistente por
usuario, y eso choca de frente con «archivos estáticos, sin base de datos, sin
backend». Explorar primero si cabe entero en el cliente (URL + almacenamiento
local + generación del archivo en el navegador). Si no cabe, no es este repo.

## Distribución de la herramienta

CLI y servidor MCP sobre los mismos artefactos estáticos, mencionados en
`AGENTS.md` como «más tarde». Dependen de que el esquema esté estable, no de
que el explorador esté terminado.
