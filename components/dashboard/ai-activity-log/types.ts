export interface ReasoningStep {
  step:     number
  thought:  string
  action?:  string
  result?:  string
}

export interface ActivityItem {
  id:          string
  type:        "extraction" | "analysis" | "alert" | "database" | "monitoring" | "complete" | "reasoning"
  message:     string
  timestamp:   Date
  isNew?:      boolean
  actionable?: boolean
  location?:   string
  severity?:   "critical" | "high" | "medium" | "low"
  confidence?: number
  reasoning?:  ReasoningStep[]
  arkivKey?:   string
}

export interface SatelliteValidation {
  activity:     ActivityItem
  imageUrl:     string
  analysisData: {
    waterDetected:    boolean
    affectedAreaKm2:  number
    vegetationDamage: string
    thermalAnomaly:   boolean
    cloudCoverage:    number
    captureTime:      string
    satellite:        string
    resolution:       string
  }
}
