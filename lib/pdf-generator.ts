/**
 * lib/pdf-generator.ts
 *
 * Generates PDF reports programmatically using jsPDF.
 * Completely bypasses html2canvas — zero CSS/lab()/oklch() issues.
 *
 * Two report types:
 *   1. generateIncidentPdf  — Per-incident report with Arkiv blockchain seal
 *   2. generateGeneralReport — Operational log ("Planilla Operativa") with
 *      incident timestamps, deployed resources, and blockchain hashes
 */
import { jsPDF } from "jspdf"

// ── Layout Constants (inches, letter size) ──
const M = 0.45 // margin
const PW = 8.5
const PH = 11
const CW = PW - 2 * M

// ── Color Palette (RGB tuples) ──
const C = {
  black:     [0, 0, 0]         as [number, number, number],
  slate900:  [15, 23, 42]      as [number, number, number],
  slate800:  [30, 41, 59]      as [number, number, number],
  slate700:  [51, 65, 85]      as [number, number, number],
  slate600:  [71, 85, 105]     as [number, number, number],
  slate500:  [100, 116, 139]   as [number, number, number],
  slate400:  [148, 163, 184]   as [number, number, number],
  slate300:  [203, 213, 225]   as [number, number, number],
  slate200:  [226, 232, 240]   as [number, number, number],
  slate100:  [241, 245, 249]   as [number, number, number],
  slate50:   [248, 250, 252]   as [number, number, number],
  white:     [255, 255, 255]   as [number, number, number],
  red50:     [254, 242, 242]   as [number, number, number],
  red600:    [220, 38, 38]     as [number, number, number],
  red800:    [153, 27, 27]     as [number, number, number],
  orange50:  [255, 247, 237]   as [number, number, number],
  orange600: [234, 88, 12]     as [number, number, number],
  orange800: [154, 52, 18]     as [number, number, number],
  yellow50:  [254, 252, 232]   as [number, number, number],
  yellow700: [161, 98, 7]      as [number, number, number],
  green50:   [240, 253, 244]   as [number, number, number],
  green700:  [21, 128, 61]     as [number, number, number],
  blue50:    [239, 246, 255]   as [number, number, number],
  blue700:   [29, 78, 216]     as [number, number, number],
  emerald50: [236, 253, 245]   as [number, number, number],
  emerald700:[4, 120, 87]      as [number, number, number],
}

// ── Helpers ──

function hLine(doc: jsPDF, y: number, x1 = M, x2 = PW - M, w = 0.005) {
  doc.setLineWidth(w)
  doc.line(x1, y, x2, y)
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("es-AR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    })
  } catch { return iso || "—" }
}

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("es-AR", {
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    })
  } catch { return iso || "—" }
}

const tipoLabels: Record<string, string> = {
  flood: "Inundacion", fire: "Incendio", storm: "Tormenta",
  looting: "Saqueos", violence: "Violencia", accident: "Accidente",
  general: "General",
}

const recursoTipoLabels: Record<string, string> = {
  ambulance: "Ambulancia", firefighter: "Bomberos", helicopter: "Helicoptero",
  boat: "Lancha", police: "Policia",
}

function sevColor(sev: string): { bg: [number, number, number]; fg: [number, number, number] } {
  switch (sev) {
    case "critical": return { bg: C.red50, fg: C.red800 }
    case "high":     return { bg: C.orange50, fg: C.orange800 }
    case "medium":   return { bg: C.yellow50, fg: C.yellow700 }
    default:         return { bg: C.green50, fg: C.green700 }
  }
}

function estadoRecursoLabel(estado: string): { text: string; fg: [number, number, number] } {
  switch (estado) {
    case "dispatched": return { text: "En camino", fg: C.orange600 }
    case "busy":       return { text: "Operando", fg: C.red600 }
    default:           return { text: "Disponible", fg: C.green700 }
  }
}

// Reusable: draws a section title
function sectionTitle(doc: jsPDF, y: number, text: string): number {
  doc.setFontSize(8)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(...C.slate500)
  doc.text(text, M, y)
  return y + 0.2
}

// Check if we need a new page, return new y
function checkPage(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > PH - M - 0.4) {
    doc.addPage()
    return M + 0.2
  }
  return y
}

// ── Types ──

interface IncidenteData {
  id: string
  tipo: string
  severidad: string
  ubicacion: string
  afectados: number
  timestamp: string
  resumenIA: string
}

interface IncidentRow {
  id: string
  ubicacion: string
  tipo: string
  severidad: string
  personas_afectadas: number
  created_at: string
  updated_at: string
  fuente?: string
  arkiv_key?: string
  fuente_detalles?: Record<string, unknown>
}

interface RecursoRow {
  id: string
  nombre: string
  tipo: string
  estado: string
  incidente_id: string | null
  updated_at: string
}

interface AnalyticsData {
  riskLevel?: string
  affectedNow?: number
  enCamino?: number
  ocupados?: number
  totalResources?: number
  deployedResources?: number
  availableResources?: number
  avgResponseMin?: number
  resourceProgress?: number
}


// ════════════════════════════════════════════════════════════════
//  1. Incident Report (per-incident, with Arkiv seal & QR)
// ════════════════════════════════════════════════════════════════

function tableRow(doc: jsPDF, y: number, label: string, value: string): number {
  const rowH = 0.28
  const labelW = CW * 0.35
  const valW = CW - labelW
  doc.setFillColor(...C.slate50)
  doc.setDrawColor(...C.slate200)
  doc.rect(M, y, labelW, rowH, "FD")
  doc.setFillColor(...C.white)
  doc.rect(M + labelW, y, valW, rowH, "FD")
  doc.setFont("helvetica", "bold")
  doc.setFontSize(7.5)
  doc.setTextColor(...C.slate800)
  doc.text(label, M + 0.08, y + 0.17)
  doc.setFont("helvetica", "normal")
  doc.text(value, M + labelW + 0.08, y + 0.17)
  return y + rowH
}

export async function generateIncidentPdf(incidente: IncidenteData, entityKey: string) {
  const doc = new jsPDF({ orientation: "portrait", unit: "in", format: "letter" })
  let y = M

  // Header
  doc.setFontSize(13)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(...C.slate900)
  doc.text("REPORTE OFICIAL DE INCIDENTE", M, y + 0.14)
  y += 0.26
  doc.setFontSize(7)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(...C.slate500)
  doc.text("CLIMATE CRISIS DASHBOARD - SISTEMA DE GESTION DE EMERGENCIAS", M, y)
  doc.setFont("courier", "normal")
  doc.setFontSize(6.5)
  doc.text(`ID: ${incidente.id}`, PW - M, y - 0.12, { align: "right" })
  doc.text(`Emision: ${fmtDate(new Date().toISOString())}`, PW - M, y, { align: "right" })
  y += 0.12
  doc.setDrawColor(...C.slate900)
  hLine(doc, y, M, PW - M, 0.015)
  y += 0.35

  // Incident details
  y = sectionTitle(doc, y, "DETALLES DEL SUCESO")
  y = tableRow(doc, y, "Tipo de Incidente", tipoLabels[incidente.tipo] || incidente.tipo)
  y = tableRow(doc, y, "Severidad", incidente.severidad.toUpperCase())
  y = tableRow(doc, y, "Ubicacion", incidente.ubicacion)
  y = tableRow(doc, y, "Poblacion Afectada Est.", `${incidente.afectados} personas`)
  y = tableRow(doc, y, "Fecha/Hora Deteccion", fmtDate(incidente.timestamp))
  y += 0.35

  // AI Evaluation
  y = sectionTitle(doc, y, "EVALUACION DE INTELIGENCIA ARTIFICIAL (GEMINI)")
  const aiText = incidente.resumenIA || "No se ha proporcionado un resumen de analisis para esta alerta."
  const aiLines = doc.splitTextToSize(`"${aiText}"`, CW - 0.3)
  const aiH = Math.max(0.5, aiLines.length * 0.13 + 0.3)
  doc.setFillColor(...C.slate50)
  doc.setDrawColor(...C.slate200)
  doc.roundedRect(M, y, CW, aiH, 0.04, 0.04, "FD")
  doc.setFontSize(6)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(...C.slate400)
  doc.text("Resumen de Analisis", M + 0.12, y + 0.16)
  doc.setFontSize(7.5)
  doc.setFont("times", "italic")
  doc.setTextColor(...C.slate700)
  doc.text(aiLines, M + 0.12, y + 0.3)
  y += aiH + 0.35

  // Blockchain Seal
  const sH = 1.05
  doc.setFillColor(...C.slate50)
  doc.setDrawColor(...C.slate200)
  doc.roundedRect(M, y, CW, sH, 0.04, 0.04, "FD")
  try {
    const QRCode = (await import("qrcode")).default
    const qr = await QRCode.toDataURL(`https://data.arkiv.network/${entityKey}`, { width: 200, margin: 1 })
    doc.addImage(qr, "PNG", M + 0.12, y + 0.12, 0.75, 0.75)
  } catch { /* QR fallback */ }
  const tx = M + 1.05
  doc.setFontSize(8.5)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(...C.slate900)
  doc.text("Sello de Auditoria Criptografica", tx, y + 0.24)
  doc.setFontSize(6.5)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(...C.slate600)
  const desc = doc.splitTextToSize(
    "Este documento esta protegido criptograficamente. Escanee el codigo QR para verificar la inmutabilidad de los datos en la red Arkiv Blockchain (Testnet Red Braga).",
    CW - 1.3
  )
  doc.text(desc, tx, y + 0.4)
  doc.setDrawColor(...C.slate200)
  hLine(doc, y + 0.65, tx, PW - M - 0.12)
  doc.setFontSize(5.5)
  doc.setFont("courier", "normal")
  doc.setTextColor(...C.slate400)
  doc.text("Entity Key (Blockchain Hash)", tx, y + 0.78)
  doc.setFontSize(6.5)
  doc.setTextColor(...C.slate900)
  const dk = entityKey.length > 64 ? entityKey.slice(0, 64) + "..." : entityKey
  doc.text(dk, tx, y + 0.9)

  doc.save(`Reporte_Oficial_${incidente.id.slice(0, 8)}.pdf`)
}


// ════════════════════════════════════════════════════════════════
//  2. PLANILLA OPERATIVA — General Situation Report
//     Includes: timestamps, deployed resources per incident,
//     blockchain hashes — full operational traceability
// ════════════════════════════════════════════════════════════════

export function generateGeneralReport(
  incidents: IncidentRow[],
  recursos: RecursoRow[],
  analytics: AnalyticsData
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "in", format: "letter" })
  // Landscape: width = 11, height = 8.5
  const LW = 11
  const LH = 8.5
  const LCW = LW - 2 * M
  let y = M

  // ── Header ──
  doc.setFontSize(13)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(...C.slate900)
  doc.text("PLANILLA OPERATIVA DE SITUACION", M, y + 0.14)
  y += 0.26
  doc.setFontSize(7)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(...C.slate500)
  doc.text("CLIMATE CRISIS DASHBOARD - DEFENSA CIVIL - SAN MIGUEL DE TUCUMAN", M, y)
  doc.setFont("courier", "normal")
  doc.setFontSize(6.5)
  doc.text(`Emision: ${fmtDate(new Date().toISOString())}`, LW - M, y - 0.12, { align: "right" })
  doc.text("Sistema: Climate Crisis Dashboard Node", LW - M, y, { align: "right" })
  y += 0.12
  doc.setDrawColor(...C.slate900)
  doc.setLineWidth(0.015)
  doc.line(M, y, LW - M, y)
  y += 0.3

  // ── Summary Boxes (4 boxes) ──
  const boxCount = 4
  const gap = 0.15
  const boxW = (LCW - gap * (boxCount - 1)) / boxCount
  const boxH = 0.5
  const available = analytics.availableResources ?? ((analytics.totalResources ?? 0) - (analytics.deployedResources ?? 0))
  const summaryItems = [
    { label: "NIVEL DE RIESGO", value: analytics.riskLevel || "LOW" },
    { label: "INCIDENTES ACTIVOS", value: String(incidents.length) },
    { label: "AFECTADOS ESTIMADOS", value: String(analytics.affectedNow || 0) },
    { label: "RECURSOS DESPLEGADOS", value: `${analytics.deployedResources || 0} / ${analytics.totalResources || 0}` },
  ]
  summaryItems.forEach((item, i) => {
    const x = M + i * (boxW + gap)
    doc.setFillColor(...C.slate50)
    doc.setDrawColor(...C.slate200)
    doc.roundedRect(x, y, boxW, boxH, 0.03, 0.03, "FD")
    doc.setFontSize(5.5)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(...C.slate400)
    doc.text(item.label, x + boxW / 2, y + 0.18, { align: "center" })
    doc.setFontSize(11)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(...C.slate900)
    doc.text(item.value, x + boxW / 2, y + 0.4, { align: "center" })
  })
  y += boxH + 0.3

  // ── TABLA 1: Incidentes Detectados ──
  y = sectionTitle(doc, y, "REGISTRO DE INCIDENTES DETECTADOS")

  // Column definitions for incidents table (landscape = more space)
  const iCols = [
    { label: "Hora Deteccion",  w: LCW * 0.12 },
    { label: "Ubicacion",       w: LCW * 0.22 },
    { label: "Tipo",            w: LCW * 0.10 },
    { label: "Severidad",       w: LCW * 0.09 },
    { label: "Afectados",       w: LCW * 0.08 },
    { label: "Fuente",          w: LCW * 0.08 },
    { label: "Hash Arkiv",      w: LCW * 0.21 },
    { label: "Estado",          w: LCW * 0.10 },
  ]
  const iRowH = 0.22

  // Header row
  doc.setFillColor(...C.slate800)
  let xPos = M
  iCols.forEach(col => {
    doc.rect(xPos, y, col.w, iRowH, "F")
    xPos += col.w
  })
  doc.setDrawColor(...C.slate200)
  doc.rect(M, y, LCW, iRowH)

  xPos = M
  doc.setFontSize(6)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(...C.white)
  iCols.forEach(col => {
    doc.text(col.label, xPos + 0.06, y + 0.14)
    xPos += col.w
  })
  y += iRowH

  // Data rows
  if (!incidents || incidents.length === 0) {
    doc.setFillColor(...C.slate50)
    doc.setDrawColor(...C.slate200)
    doc.rect(M, y, LCW, 0.3, "FD")
    doc.setFontSize(7)
    doc.setFont("times", "italic")
    doc.setTextColor(...C.slate500)
    doc.text("No hay incidentes activos.", M + LCW / 2, y + 0.19, { align: "center" })
    y += 0.5
  } else {
    incidents.forEach((inc, idx) => {
      // Check page break (landscape)
      if (y + iRowH > LH - M - 1.5) {
        doc.addPage()
        y = M + 0.2
      }

      const isAlt = idx % 2 === 0
      doc.setFillColor(...(isAlt ? C.white : C.slate50))
      doc.setDrawColor(...C.slate200)
      let rx = M
      iCols.forEach(col => {
        doc.rect(rx, y, col.w, iRowH, "FD")
        rx += col.w
      })

      doc.setFontSize(6)
      doc.setFont("courier", "normal")
      doc.setTextColor(...C.slate800)

      rx = M
      // Hora Deteccion
      doc.text(fmtDate(inc.created_at), rx + 0.06, y + 0.14)
      rx += iCols[0].w
      // Ubicacion
      doc.setFont("helvetica", "normal")
      const ubic = inc.ubicacion.length > 32 ? inc.ubicacion.slice(0, 30) + ".." : inc.ubicacion
      doc.text(ubic, rx + 0.06, y + 0.14)
      rx += iCols[1].w
      // Tipo
      doc.text(tipoLabels[inc.tipo] || inc.tipo, rx + 0.06, y + 0.14)
      rx += iCols[2].w
      // Severidad (colored)
      const sc = sevColor(inc.severidad)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(...sc.fg)
      doc.text(inc.severidad.toUpperCase(), rx + 0.06, y + 0.14)
      rx += iCols[3].w
      // Afectados
      doc.setTextColor(...C.slate800)
      doc.setFont("courier", "normal")
      doc.text(String(inc.personas_afectadas || 0), rx + 0.06, y + 0.14)
      rx += iCols[4].w
      // Fuente
      doc.setFont("helvetica", "normal")
      doc.text((inc.fuente || "—").toUpperCase(), rx + 0.06, y + 0.14)
      rx += iCols[5].w
      // Hash Arkiv
      doc.setFont("courier", "normal")
      doc.setFontSize(5)
      const key = inc.arkiv_key || (inc.fuente_detalles?.arkiv_entity_key as string) || "—"
      const displayKey = key.length > 30 ? key.slice(0, 28) + ".." : key
      doc.text(displayKey, rx + 0.06, y + 0.14)
      doc.setFontSize(6)
      rx += iCols[6].w
      // Estado
      doc.setFont("helvetica", "bold")
      doc.setTextColor(...C.emerald700)
      doc.text("ACTIVO", rx + 0.06, y + 0.14)

      y += iRowH
    })
    y += 0.25
  }

  // ── TABLA 2: Recursos Desplegados ──
  // Check if we need a new page
  if (y + 0.8 > LH - M - 0.5) {
    doc.addPage()
    y = M + 0.2
  }

  y = sectionTitle(doc, y, "REGISTRO DE RECURSOS DESPLEGADOS")

  // Only show resources that are dispatched or busy (deployed)
  const deployedResources = (recursos || []).filter(r => r.estado === "dispatched" || r.estado === "busy")

  const rCols = [
    { label: "Recurso",            w: LCW * 0.18 },
    { label: "Tipo Unidad",        w: LCW * 0.12 },
    { label: "Estado",             w: LCW * 0.10 },
    { label: "Hora Despacho",      w: LCW * 0.14 },
    { label: "Incidente Asignado", w: LCW * 0.30 },
    { label: "ID Incidente",       w: LCW * 0.16 },
  ]
  const rRowH = 0.22

  // Header
  doc.setFillColor(...C.slate800)
  xPos = M
  rCols.forEach(col => {
    doc.rect(xPos, y, col.w, rRowH, "F")
    xPos += col.w
  })
  doc.setDrawColor(...C.slate200)
  doc.rect(M, y, LCW, rRowH)

  xPos = M
  doc.setFontSize(6)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(...C.white)
  rCols.forEach(col => {
    doc.text(col.label, xPos + 0.06, y + 0.14)
    xPos += col.w
  })
  y += rRowH

  if (deployedResources.length === 0) {
    doc.setFillColor(...C.slate50)
    doc.setDrawColor(...C.slate200)
    doc.rect(M, y, LCW, 0.3, "FD")
    doc.setFontSize(7)
    doc.setFont("times", "italic")
    doc.setTextColor(...C.slate500)
    doc.text("No hay recursos desplegados actualmente.", M + LCW / 2, y + 0.19, { align: "center" })
    y += 0.5
  } else {
    deployedResources.forEach((rec, idx) => {
      if (y + rRowH > LH - M - 0.5) {
        doc.addPage()
        y = M + 0.2
      }

      const isAlt = idx % 2 === 0
      doc.setFillColor(...(isAlt ? C.white : C.slate50))
      doc.setDrawColor(...C.slate200)
      let rx = M
      rCols.forEach(col => {
        doc.rect(rx, y, col.w, rRowH, "FD")
        rx += col.w
      })

      // Find the incident this resource is assigned to
      const assignedInc = incidents.find(i => i.id === rec.incidente_id)

      rx = M
      doc.setFontSize(6)
      // Recurso (nombre)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(...C.slate800)
      doc.text(rec.nombre || rec.id.slice(0, 8), rx + 0.06, y + 0.14)
      rx += rCols[0].w
      // Tipo Unidad
      doc.setFont("helvetica", "normal")
      doc.text(recursoTipoLabels[rec.tipo] || rec.tipo, rx + 0.06, y + 0.14)
      rx += rCols[1].w
      // Estado
      const est = estadoRecursoLabel(rec.estado)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(...est.fg)
      doc.text(est.text, rx + 0.06, y + 0.14)
      rx += rCols[2].w
      // Hora Despacho
      doc.setFont("courier", "normal")
      doc.setTextColor(...C.slate800)
      doc.text(fmtDate(rec.updated_at), rx + 0.06, y + 0.14)
      rx += rCols[3].w
      // Incidente Asignado (ubicacion)
      doc.setFont("helvetica", "normal")
      const incUbic = assignedInc?.ubicacion || "—"
      const truncUbic = incUbic.length > 40 ? incUbic.slice(0, 38) + ".." : incUbic
      doc.text(truncUbic, rx + 0.06, y + 0.14)
      rx += rCols[4].w
      // ID Incidente
      doc.setFont("courier", "normal")
      doc.setFontSize(5)
      const incId = rec.incidente_id || "—"
      const truncId = incId.length > 20 ? incId.slice(0, 18) + ".." : incId
      doc.text(truncId, rx + 0.06, y + 0.14)
      doc.setFontSize(6)

      y += rRowH
    })
    y += 0.25
  }

  // ── Resources Summary ──
  if (y + 0.8 > LH - M - 0.5) {
    doc.addPage()
    y = M + 0.2
  }

  y = sectionTitle(doc, y, "RESUMEN OPERATIVO")

  const smBoxW = (LCW - 0.3) / 3
  const smBoxH = 0.65
  const smItems = [
    {
      title: "FLOTA",
      lines: [
        `Despachados: ${analytics.enCamino || 0}`,
        `Operando: ${analytics.ocupados || 0}`,
        `Disponibles: ${available}`,
      ]
    },
    {
      title: "EFICIENCIA",
      lines: [
        `Resp. promedio: ${analytics.avgResponseMin || 18} min`,
        `Despliegue: ${analytics.resourceProgress || 0}%`,
        `Total unidades: ${analytics.totalResources || 0}`,
      ]
    },
    {
      title: "SEVERIDAD",
      lines: [
        `Criticos: ${incidents.filter(i => i.severidad === "critical").length}`,
        `Altos: ${incidents.filter(i => i.severidad === "high").length}`,
        `Medios/Bajos: ${incidents.filter(i => i.severidad === "medium" || i.severidad === "low").length}`,
      ]
    },
  ]

  smItems.forEach((box, i) => {
    const x = M + i * (smBoxW + 0.15)
    doc.setFillColor(...C.white)
    doc.setDrawColor(...C.slate200)
    doc.rect(x, y, smBoxW, smBoxH)

    doc.setFontSize(5.5)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(...C.slate400)
    doc.text(box.title, x + 0.1, y + 0.15)

    doc.setFontSize(6.5)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(...C.slate800)
    box.lines.forEach((line, li) => {
      doc.text(line, x + 0.1, y + 0.3 + li * 0.13)
    })
  })

  y += smBoxH + 0.2

  // ── Footer ──
  const footerY = Math.max(y + 0.1, LH - M - 0.25)
  doc.setDrawColor(...C.slate200)
  doc.setLineWidth(0.005)
  doc.line(M, footerY, LW - M, footerY)

  doc.setFontSize(5.5)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(...C.slate400)
  doc.text(
    "Datos verificados por nodos de Inteligencia Artificial. Trazabilidad on-chain via Arkiv Blockchain.",
    M, footerY + 0.12
  )
  doc.text("Climate Crisis Dashboard (c) 2026", LW - M, footerY + 0.12, { align: "right" })

  doc.save(`Planilla_Operativa_Tucuman_${new Date().toISOString().slice(0, 10)}.pdf`)
}
