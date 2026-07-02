"use client"

import { Satellite, CheckCircle2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import type { SatelliteValidation } from "./types"

interface SatelliteModalProps {
  validation: SatelliteValidation | null
  onClose:    () => void
}

export function SatelliteModal({ validation, onClose }: SatelliteModalProps) {
  return (
    <Dialog open={!!validation} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl z-[9999]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Satellite className="h-5 w-5 text-blue-400" />
            Satellite Validation - Sentinel-2
          </DialogTitle>
        </DialogHeader>

        {validation && (
          <div className="space-y-4">
            {/* Satellite image */}
            <div className="relative rounded-lg overflow-hidden border border-border">
              <img
                src={validation.imageUrl}
                alt="Satellite image of the affected area"
                className="w-full h-48 object-cover"
              />
              <div className="absolute top-2 left-2 flex gap-1.5">
                <Badge className="bg-green-500/90 text-white text-[10px]">LIVE</Badge>
                <Badge variant="outline" className="bg-background/80 text-[10px]">
                  {validation.analysisData.satellite}
                </Badge>
              </div>
              <div className="absolute bottom-2 right-2">
                <Badge variant="outline" className="bg-background/80 text-[10px]">
                  Res: {validation.analysisData.resolution}
                </Badge>
              </div>
              {/* Grid overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  backgroundImage: `
                    linear-gradient(to right, rgba(59,130,246,0.1) 1px, transparent 1px),
                    linear-gradient(to bottom, rgba(59,130,246,0.1) 1px, transparent 1px)
                  `,
                  backgroundSize: "20px 20px",
                }}
              />
            </div>

            {/* Analysis grid */}
            <div className="grid grid-cols-2 gap-3">
              {[
                {
                  label: "Water Detection",
                  value: validation.analysisData.waterDetected ? "CONFIRMED" : "Not detected",
                  color: validation.analysisData.waterDetected ? "text-blue-400" : "text-muted-foreground",
                },
                {
                  label: "Thermal Anomaly",
                  value: validation.analysisData.thermalAnomaly ? "DETECTED" : "Normal",
                  color: validation.analysisData.thermalAnomaly ? "text-primary" : "text-muted-foreground",
                },
                {
                  label: "Affected Area",
                  value: `${validation.analysisData.affectedAreaKm2} km²`,
                  color: "text-accent",
                },
                {
                  label: "Vegetation Damage",
                  value: validation.analysisData.vegetationDamage,
                  color: "text-yellow-400",
                },
              ].map(({ label, value, color }) => (
                <div key={label} className="p-3 rounded-lg bg-muted/30 border border-border">
                  <p className="text-[10px] text-muted-foreground mb-1">{label}</p>
                  <p className={cn("text-sm font-semibold", color)}>{value}</p>
                </div>
              ))}
            </div>

            {/* Successful validation */}
            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-400" />
                  <div>
                    <p className="text-sm font-semibold text-green-400">Validation Successful</p>
                    <p className="text-[10px] text-muted-foreground">
                      Satellite image confirms the reported anomaly
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-muted-foreground">Updated confidence</p>
                  <p className="text-xl font-bold text-green-400">98%</p>
                </div>
              </div>
            </div>

            {/* Metadata */}
            <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-2 border-t border-border">
              <span>Cloud coverage: {validation.analysisData.cloudCoverage}%</span>
              <span>Captured: {new Date(validation.analysisData.captureTime).toLocaleString("en-US")}</span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
