"use client"

import { useState } from "react"
import { FileText, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { generateIncidentPdf } from "@/lib/pdf-generator"

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
      await generateIncidentPdf(incidente, entityKey)
    } catch (err) {
      console.error("Error generating PDF:", err)
    } finally {
      setIsGenerating(false)
    }
  }

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
    </div>
  )
}
