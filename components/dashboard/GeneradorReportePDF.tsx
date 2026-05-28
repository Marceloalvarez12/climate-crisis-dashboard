"use client"

import { useState } from "react"
import { FileText, Loader2 } from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
import { Button } from "@/components/ui/button"

interface ReporteProps {
  incidente: {
    id: string;
    tipo: string;
    severidad: string;
    ubicacion: string;
    afectados: number;
    timestamp: string;
    resumenIA: string; // Resumen generado por Gemini
  };
  entityKey: string; // El hash de Arkiv (ej. 0x123...)
}

export function GeneradorReportePDF({ incidente, entityKey }: ReporteProps) {
  const [isGenerating, setIsGenerating] = useState(false)

  const handleDownload = async () => {
    setIsGenerating(true)
    try {
      // Import html2pdf.js dynamically to avoid SSR errors
      const html2pdf = (await import("html2pdf.js")).default
      const element = document.getElementById("reporte-pdf-template")

      if (!element) {
        throw new Error("Template element not found")
      }

      const opt = {
        margin:       [0.4, 0.4, 0.4, 0.4], // [top, left, bottom, right] in inches
        filename:     `Reporte_Oficial_${incidente.id.slice(0, 8)}.pdf`,
        image:        { type: "jpeg", quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, logging: false },
        jsPDF:        { unit: "in", format: "letter", orientation: "portrait" }
      }

      await html2pdf().from(element).set(opt).save()
    } catch (err) {
      console.error("Error generating PDF:", err)
    } finally {
      setIsGenerating(false)
    }
  }

  const tipoLabel = {
    flood: "Inundación",
    fire: "Incendio",
    storm: "Tormenta",
    looting: "Saqueos / Disturbios",
    violence: "Violencia Civil",
    accident: "Accidente Grave",
    general: "Emergencia General",
  }[incidente.tipo] || incidente.tipo

  return (
    <div className="w-full">
      {/* Botón visible de descarga */}
      <Button
        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center justify-center gap-2"
        onClick={handleDownload}
        disabled={isGenerating}
      >
        {isGenerating ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Generando PDF...
          </>
        ) : (
          <>
            <FileText className="h-4 w-4" />
            Descargar Reporte Oficial
          </>
        )}
      </Button>

      {/* Plantilla HTML oculta en la UI pero renderizada para html2pdf */}
      <div style={{ position: "absolute", left: "-9999px", top: "-9999px" }}>
        <div
          id="reporte-pdf-template"
          className="w-[8.5in] bg-white text-slate-800 p-8 flex flex-col justify-between font-sans leading-relaxed"
          style={{ minHeight: "11in", boxSizing: "border-box" }}
        >
          <div>
            {/* Encabezado Institucional */}
            <div className="border-b-2 border-slate-900 pb-4 mb-6 flex justify-between items-end">
              <div>
                <h1 className="text-xl font-black tracking-wider text-slate-900">
                  REPORTE OFICIAL DE INCIDENTE
                </h1>
                <p className="text-xs font-bold text-slate-500 tracking-widest uppercase mt-0.5">
                  ZNTINEL — SISTEMA DE GESTIÓN DE EMERGENCIAS
                </p>
              </div>
              <div className="text-right text-[10px] text-slate-500 font-mono">
                <p>ID: {incidente.id}</p>
                <p suppressHydrationWarning>Emisión: {new Date().toLocaleString("es-AR")}</p>
              </div>
            </div>

            {/* Datos del Incidente */}
            <div className="mb-6">
              <h2 className="text-xs font-bold tracking-widest text-slate-500 uppercase mb-3">
                DETALLES DEL SUCESO
              </h2>
              <table className="w-full border-collapse border border-slate-200 text-xs">
                <tbody>
                  <tr className="border-b border-slate-200">
                    <td className="w-1/3 bg-slate-50 p-2.5 font-bold border-r border-slate-200">Tipo de Incidente</td>
                    <td className="p-2.5">{tipoLabel}</td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="bg-slate-50 p-2.5 font-bold border-r border-slate-200">Severidad</td>
                    <td className="p-2.5">
                      <span className={`font-bold px-2 py-0.5 rounded-full text-[10px] ${
                        incidente.severidad === "critical" ? "bg-red-100 text-red-800" :
                        incidente.severidad === "high" ? "bg-orange-100 text-orange-800" :
                        incidente.severidad === "medium" ? "bg-yellow-100 text-yellow-800" :
                        "bg-green-100 text-green-800"
                      }`}>
                        {incidente.severidad.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="bg-slate-50 p-2.5 font-bold border-r border-slate-200">Ubicación</td>
                    <td className="p-2.5">{incidente.ubicacion}</td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="bg-slate-50 p-2.5 font-bold border-r border-slate-200">Población Afectada Est.</td>
                    <td className="p-2.5 font-mono">{incidente.afectados} personas</td>
                  </tr>
                  <tr>
                    <td className="bg-slate-50 p-2.5 font-bold border-r border-slate-200">Fecha y Hora Reporte</td>
                    <td className="p-2.5" suppressHydrationWarning>
                      {new Date(incidente.timestamp).toLocaleString("es-AR")}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Evaluación de Inteligencia Artificial */}
            <div className="mb-8">
              <h2 className="text-xs font-bold tracking-widest text-slate-500 uppercase mb-3">
                EVALUACIÓN DE INTELIGENCIA ARTIFICIAL (GEMINI)
              </h2>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-1.5">Resumen de Análisis</h4>
                <p className="text-xs text-slate-700 font-serif leading-relaxed italic">
                  "{incidente.resumenIA || "No se ha proporcionado un resumen de análisis para esta alerta."}"
                </p>
              </div>
            </div>
          </div>

          {/* Sello de Auditoría Blockchain */}
          <div className="mt-auto border border-slate-200 rounded-lg p-4 bg-slate-50/50 flex gap-4 items-center">
            {/* Código QR */}
            <div className="bg-white p-2 border border-slate-200 rounded shrink-0">
              <QRCodeSVG
                value={`https://data.arkiv.network/${entityKey}`}
                size={80}
                level="M"
                includeMargin={false}
              />
            </div>
            {/* Texto de auditoría legal */}
            <div className="flex-1 min-w-0">
              <h3 className="text-xs font-black text-slate-900 flex items-center gap-1.5 uppercase tracking-wide">
                🛡️ Sello de Auditoría Criptográfica
              </h3>
              <p className="text-[10px] text-slate-600 mt-1 leading-normal">
                Este documento está protegido criptográficamente. Escanee el código QR para verificar la inmutabilidad de los datos en la red **Arkiv Blockchain** (Testnet Red Braga).
              </p>
              <div className="mt-2 pt-2 border-t border-slate-200">
                <p className="text-[9px] text-slate-400 uppercase tracking-widest font-mono">Entity Key (Blockchain Hash)</p>
                <p className="text-[10px] text-slate-900 font-mono truncate">{entityKey}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
