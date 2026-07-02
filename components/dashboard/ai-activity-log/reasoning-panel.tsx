"use client"

import { useState } from "react"
import { Brain, Sparkles, Zap, CheckCircle2, Loader2, Satellite, ChevronDown, ChevronUp, Target, ShieldCheck, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { ActivityItem } from "./types"

// ---------------------------------------------------------------------------
// Expandable AI reasoning panel
// ---------------------------------------------------------------------------

interface ReasoningPanelProps {
  activity:           ActivityItem
  isExpanded:         boolean
  validatingSatellite: string | null
  onToggle:           () => void
  onValidateSatellite: (id: string) => void
}

export function ReasoningPanel({
  activity,
  isExpanded,
  validatingSatellite,
  onToggle,
  onValidateSatellite,
}: ReasoningPanelProps) {
  if (!activity.reasoning?.length) return null

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 mt-1.5 text-[10px] text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 px-2 gap-1"
        onClick={onToggle}
      >
        <Brain className="h-3 w-3" />
        {isExpanded ? "Hide" : "View"} Reasoning
        {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </Button>

      {isExpanded && (
        <div className="mt-2 p-2.5 rounded-md bg-purple-500/5 border border-purple-500/20 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-1.5 mb-2">
            <Sparkles className="h-3 w-3 text-purple-400" />
            <span className="text-[10px] font-medium text-purple-400">Reasoning Chain</span>
          </div>

          <div className="space-y-2">
            {activity.reasoning.map((step, idx) => (
              <div key={idx} className="flex gap-2 text-[10px]">
                <div className="flex-shrink-0 w-4 h-4 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 text-[9px] font-bold">
                  {step.step}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-muted-foreground leading-relaxed">{step.thought}</p>
                  {step.action && (
                    <p className="text-blue-400 mt-0.5 flex items-center gap-1">
                      <Zap className="h-2.5 w-2.5" />
                      {step.action}
                    </p>
                  )}
                  {step.result && (
                    <p className="text-green-400 mt-0.5 font-medium flex items-center gap-1">
                      <CheckCircle2 className="h-2.5 w-2.5" />
                      {step.result}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Validate with Satellite — only if confidence is < 98 */}
          {activity.confidence && activity.confidence < 98 && (
            <div className="mt-2.5 pt-2 border-t border-purple-500/20">
              <Button
                variant="outline"
                size="sm"
                className="w-full h-7 text-[10px] bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20"
                onClick={() => onValidateSatellite(activity.id)}
                disabled={validatingSatellite === activity.id}
              >
                {validatingSatellite === activity.id ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Querying Sentinel-2...
                  </>
                ) : (
                  <>
                    <Satellite className="h-3 w-3 mr-1" />
                    Validate with Satellite Image
                  </>
                )}
              </Button>
            </div>
          )}

          {/* On-Chain Audit Badge */}
          {activity.arkivKey && (
            <div className="mt-2.5 pt-2 border-t border-purple-500/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <Badge variant="outline" className="text-[9px] h-5 border-emerald-500/50 bg-emerald-500/10 text-emerald-400 gap-1 self-start">
                <ShieldCheck className="h-3 w-3" />
                AI Report Certified On-Chain
              </Badge>
              <a
                href={`https://explorer.braga.hoodi.arkiv.network/entity/${activity.arkivKey}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[9px] text-purple-400 hover:text-purple-300 hover:underline flex items-center gap-1 self-start sm:self-auto"
              >
                Verify on Braga <ExternalLink className="h-2.5 w-2.5" />
              </a>
            </div>
          )}
        </div>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// AI confidence badge
// ---------------------------------------------------------------------------

export function ConfidenceBadge({ value }: { value: number }) {
  return (
    <Badge
      variant="outline"
      className="text-[9px] h-4 px-1.5 bg-purple-500/10 text-purple-400 border-purple-500/30"
    >
      <Target className="h-2.5 w-2.5 mr-0.5" />
      {value}%
    </Badge>
  )
}
