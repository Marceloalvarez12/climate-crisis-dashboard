"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { 
  MessageCircle, 
  FileText, 
  Radio, 
  Send, 
  Loader2, 
  CheckCircle2,
  Smartphone,
  Mail,
  Megaphone,
  RefreshCw
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import useSWR from "swr"
import { fetcher } from "@/lib/api"
import { generateGeneralReport } from "@/lib/pdf-generator"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface BroadcastChannel {
  id: string
  name: string
  icon: React.ReactNode
  status: "ready" | "sending" | "sent"
  recipients: number
  description: string
}

const defaultMessage = `EMERGENCY ALERT - Civil Defense Tucumán

The population of Historic Center, San Pablo and Barrio Sur is hereby informed:

- Active flooding in the area
- Preventive evacuation recommended
- Avoid Av. Roca and surrounding streets

Meeting points:
- Estadio Monumental (Yerba Buena)
- Plaza Urquiza (Center)

Emergency line: 103
More info: @DefensaCivilTuc`

export function BroadcastPanel() {
  const { data: incidents } = useSWR("/api/incidentes", fetcher)
  const { data: historicalIncidents } = useSWR("/api/incidentes?estado=atendido", fetcher)
  const { data: analytics } = useSWR("/api/analytics", fetcher)
  const { data: recursos } = useSWR("/api/recursos", fetcher)

  const [channels, setChannels] = useState<BroadcastChannel[]>([
    { 
      id: "whatsapp", 
      name: "WhatsApp Broadcast", 
      icon: <MessageCircle className="h-4 w-4" />, 
      status: "ready", 
      recipients: 12500,
      description: "Neighborhood groups and official channels"
    },
    { 
      id: "sms", 
      name: "Mass SMS", 
      icon: <Smartphone className="h-4 w-4" />, 
      status: "ready", 
      recipients: 45000,
      description: "Provincial emergency database"
    },
    { 
      id: "email", 
      name: "Authorities Email", 
      icon: <Mail className="h-4 w-4" />, 
      status: "ready", 
      recipients: 340,
      description: "Officials, hospitals, schools"
    },
    { 
      id: "radio", 
      name: "Provincial Radio", 
      icon: <Radio className="h-4 w-4" />, 
      status: "ready", 
      recipients: 0,
      description: "Live broadcast LV12 and FM Tucumán"
    },
  ])

  const [showPdfDialog, setShowPdfDialog] = useState(false)
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const [message, setMessage] = useState(defaultMessage)
  const [showMessageDialog, setShowMessageDialog] = useState(false)
  const [selectedChannel, setSelectedChannel] = useState<BroadcastChannel | null>(null)

  const handleSendToChannel = (channel: BroadcastChannel) => {
    setSelectedChannel(channel)
    setShowMessageDialog(true)
  }

  const confirmSend = async () => {
    if (!selectedChannel) return

    setChannels(prev => prev.map(ch => 
      ch.id === selectedChannel.id ? { ...ch, status: "sending" as const } : ch
    ))
    setShowMessageDialog(false)

    // Simulate sending
    await new Promise(resolve => setTimeout(resolve, 2000))

    setChannels(prev => prev.map(ch => 
      ch.id === selectedChannel.id ? { ...ch, status: "sent" as const } : ch
    ))

    toast.success(`Message sent via ${selectedChannel.name}`, {
      description: selectedChannel.recipients > 0 
        ? `${selectedChannel.recipients.toLocaleString()} recipients reached`
        : "Live broadcast started",
    })

    // Reset after 5 seconds
    setTimeout(() => {
      setChannels(prev => prev.map(ch => 
        ch.id === selectedChannel.id ? { ...ch, status: "ready" as const } : ch
      ))
    }, 5000)

    setSelectedChannel(null)
  }

  const handleGeneratePdf = () => {
    setShowPdfDialog(true)
  }
  
  const handleDownloadPdf = async () => {
    setGeneratingPdf(true)
    try {
      generateGeneralReport(incidents || [], historicalIncidents || [], recursos || [], analytics || {})
      toast.success("Operational report downloaded", {
        description: `Operational_Report_Tucuman_${new Date().toISOString().slice(0, 10)}.pdf`,
      })
    } catch (err) {
      console.error("Error generating PDF:", err)
      toast.error("Error generating PDF report")
    } finally {
      setGeneratingPdf(false)
      setShowPdfDialog(false)
    }
  }

  const handleRefreshMap = () => {
    toast.success("Heat map updated", {
      description: "New sensor data integrated",
    })
  }

  return (
    <>
      <Card className="border-border/50 bg-card/50 backdrop-blur">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-accent" />
            Broadcast Channels
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Broadcast Channels */}
          {channels.map((channel) => (
            <div
              key={channel.id}
              className={cn(
                "flex items-center gap-3 p-2.5 rounded-lg border transition-all",
                channel.status === "sent" 
                  ? "border-green-500/30 bg-green-500/5" 
                  : "border-border/50 bg-background/50"
              )}
            >
              <div className={cn(
                "p-2 rounded-full",
                channel.status === "sent" ? "bg-green-500/20 text-green-400" :
                channel.status === "sending" ? "bg-accent/20 text-accent" :
                "bg-muted text-muted-foreground"
              )}>
                {channel.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium truncate">{channel.name}</span>
                  {channel.recipients > 0 && (
                    <Badge variant="outline" className="text-[9px] h-4 px-1">
                      {channel.recipients.toLocaleString()}
                    </Badge>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground truncate">{channel.description}</p>
              </div>
              <Button
                size="sm"
                variant={channel.status === "sent" ? "outline" : "default"}
                className="h-7 text-[10px] px-2"
                onClick={() => handleSendToChannel(channel)}
                disabled={channel.status === "sending"}
              >
                {channel.status === "sending" ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : channel.status === "sent" ? (
                  <>
                    <CheckCircle2 className="h-3 w-3 mr-1 text-green-400" />
                    Sent
                  </>
                ) : (
                  <>
                    <Send className="h-3 w-3 mr-1" />
                    Send
                  </>
                )}
              </Button>
            </div>
          ))}

          {/* Quick Actions */}
          <div className="pt-2 border-t border-border/50 space-y-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full h-8 text-xs justify-start gap-2"
              onClick={handleGeneratePdf}
            >
              <FileText className="h-3.5 w-3.5 text-red-400" />
              Download Operational Report (PDF)
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full h-8 text-xs justify-start gap-2"
              onClick={handleRefreshMap}
            >
              <RefreshCw className="h-3.5 w-3.5 text-blue-400" />
              Update Heat Map
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Message Dialog */}
      <Dialog open={showMessageDialog} onOpenChange={setShowMessageDialog}>
        <DialogContent className="max-w-md z-[9999]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedChannel?.icon}
              Send via {selectedChannel?.name}
            </DialogTitle>
            <DialogDescription>
              {selectedChannel?.recipients && selectedChannel.recipients > 0 
                ? `This message will reach ${selectedChannel.recipients.toLocaleString()} recipients.`
                : "This message will be broadcast live."}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[200px] text-xs font-mono"
              placeholder="Write the alert message..."
            />
            <p className="text-[10px] text-muted-foreground">
              Message automatically generated by the AI Agent. You can edit it before sending.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMessageDialog(false)}>
              Cancel
            </Button>
            <Button onClick={confirmSend} className="gap-1">
              <Send className="h-4 w-4" />
              Confirm Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PDF Dialog */}
      <Dialog open={showPdfDialog} onOpenChange={setShowPdfDialog}>
        <DialogContent className="max-w-sm z-[9999]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-red-400" />
              Operational Report
            </DialogTitle>
          </DialogHeader>
          
          {generatingPdf ? (
            <div className="py-8 flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Generating operational report...</p>
              <p className="text-xs text-muted-foreground">Compiling incidents, resources and Arkiv hashes</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-muted/50 border border-border">
                <p className="text-xs font-medium">Operational_Report_Tucuman_{new Date().toISOString().slice(0, 10)}.pdf</p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Includes: Incident detection time, deployed resources with dispatch time, Arkiv blockchain hashes and operational summary.
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowPdfDialog(false)}>
                  Cancel
                </Button>
                <Button className="flex-1 gap-1" onClick={handleDownloadPdf}>
                  <FileText className="h-4 w-4" />
                  Download PDF
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </>
  )
}
