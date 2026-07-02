"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { ShieldCheck, ShieldAlert, Loader2, ArrowLeft, Search, Copy, Check, ExternalLink, Calendar, Users, MapPin, AlertTriangle, FileJson, Cpu, UserCheck, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import Link from "next/link"

function AuditoriaContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const keyParam = searchParams.get("key")

  const [inputKey, setInputKey] = useState(keyParam || "")
  const [loading, setLoading] = useState(false)
  const [verified, setVerified] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [copiedHash, setCopiedHash] = useState(false)

  const [data, setData] = useState<{
    creator: string
    expiresAtBlock: string | null
    payload: any
    isSimulated?: boolean
    linkedEntity?: {
      key: string
      creator: string
      expiresAtBlock: string | null
      payload: any
    } | null
    relation?: 'detection_to_dispatch' | 'dispatch_to_detection' | null
  } | null>(null)

  const handleVerify = async (keyToVerify: string) => {
    const trimmed = keyToVerify.trim()
    if (!trimmed) return
    if (!trimmed.startsWith("0x")) {
      setError("Entity key must start with '0x'")
      setVerified(false)
      setData(null)
      return
    }

    setLoading(true)
    setError(null)
    setVerified(false)
    setData(null)

    // Actualizar la URL de forma sutil
    router.replace(`/auditoria?key=${trimmed}`)

    try {
      const res = await fetch(`/api/incidentes/arkiv-verify/${trimmed}`)
      const json = await res.json()

      if (json.success) {
        setData({
          creator: json.creator,
          expiresAtBlock: json.expiresAtBlock,
          payload: json.payload,
          isSimulated: json.isSimulated,
          linkedEntity: json.linkedEntity,
          relation: json.relation,
        })
        setVerified(true)
        toast.success("Verification Completed", {
          description: "Entity found on Braga Testnet.",
        })
      } else {
        setError(json.error || "Could not verify the entity on-chain.")
      }
    } catch (err) {
      setError("Network error trying to connect to the Braga network.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (keyParam) {
      handleVerify(keyParam)
    }
  }, [keyParam])

  const copyUrl = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success("Link copied", {
      description: "Share this audit with other citizens.",
    })
  }

  const copyHash = (hash: string) => {
    navigator.clipboard.writeText(hash)
    setCopiedHash(true)
    setTimeout(() => setCopiedHash(false), 2000)
    toast.success("Hash copied")
  }

  // Incident type mapping
  const tipoLabel: Record<string, string> = {
    flood: "Flood / Hydric Alert",
    fire: "Forest / Urban Fire",
    storm: "Storms / Strong Winds",
    looting: "Looting / Social Conflict",
    violence: "Civil Violence",
    accident: "Serious Traffic Accident",
    general: "General Operational Alert",
  }

  const severityColor: Record<string, string> = {
    critical: "bg-red-500/10 text-red-400 border-red-500/30",
    high: "bg-orange-500/10 text-orange-400 border-orange-500/30",
    medium: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
    low: "bg-green-500/10 text-green-400 border-green-500/30",
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-900 via-neutral-950 to-black text-foreground antialiased selection:bg-emerald-500/30 selection:text-emerald-200">
      
      {/* Background grid texture */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

      <header className="relative border-b border-zinc-800/80 bg-zinc-950/60 backdrop-blur-md px-6 py-4">
        <div className="mx-auto max-w-5xl flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-xs font-semibold text-zinc-400 hover:text-white transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to Control Center
          </Link>
          <div className="flex items-center gap-1.5 font-mono text-[10px] text-zinc-500">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            NODE-01 Braga Testnet Active
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-4xl px-4 py-12 md:px-6">
        
        {/* Title Section */}
        <div className="text-center space-y-3 mb-10">
          <Badge className="bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/15 border-emerald-500/20 text-xs px-3 py-1 font-mono uppercase tracking-wider">
            Decentralized Citizen Audit
          </Badge>
          <h1 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-zinc-100 via-white to-zinc-400 sm:text-4xl">
            Braga On-Chain Verification
          </h1>
          <p className="max-w-xl mx-auto text-sm text-zinc-400 leading-relaxed">
            Independently query any report or dispatch from the Climate Crisis Center. Cryptographic signatures are immutable and freely accessible.
          </p>
        </div>

        {/* Input Card */}
        <div className="mb-8 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 backdrop-blur-sm shadow-xl shadow-black/40">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleVerify(inputKey)
            }}
            className="flex flex-col gap-3 sm:flex-row"
          >
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                placeholder="Paste Entity Key / Hash (0x...)"
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950/80 py-3 pl-10 pr-4 text-sm font-mono text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors"
              />
            </div>
            <Button
              type="submit"
              disabled={loading || !inputKey.trim()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg shadow-emerald-950/20"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying
                </>
              ) : (
                "Search & Audit"
              )}
            </Button>
          </form>
        </div>

        {/* Loading Step Animation */}
        {loading && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/10 p-12 text-center flex flex-col items-center justify-center gap-4">
            <Loader2 className="h-10 w-10 text-emerald-400 animate-spin" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-zinc-200">Reading block on Braga Testnet...</p>
              <p className="text-xs text-zinc-500 font-mono">Consensing operator signatures and AI telemetry hashes</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="rounded-xl border border-red-500/20 bg-red-950/20 p-6 flex flex-col gap-3">
            <div className="flex items-center gap-2.5 text-red-400">
              <ShieldAlert className="h-6 w-6 shrink-0" />
              <h3 className="font-bold text-sm uppercase tracking-wider">On-Chain Verification Failed</h3>
            </div>
            <p className="text-xs text-zinc-300 font-medium">
              We could not find or verify a record with the entered key. Make sure it is a correct hash and that it exists on the Braga Testnet.
            </p>
            <p className="text-[10px] text-zinc-500 font-mono bg-black/30 p-2 rounded">
              Detail: {error}
            </p>
          </div>
        )}

        {/* Verified Data State */}
        {verified && data && !loading && (
          <div className="space-y-6">
            
            {/* Seal Certificate Card */}
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/15 p-6 relative overflow-hidden shadow-2xl shadow-emerald-950/5">
              <div className="absolute top-0 right-0 -mr-12 -mt-12 h-36 w-36 rounded-full bg-emerald-500/10 blur-2xl pointer-events-none" />
              
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-emerald-500/20 p-2.5 shrink-0 text-emerald-400">
                    <ShieldCheck className="h-7 w-7" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-white leading-tight">CRYPTOGRAPHICALLY SIGNED ENTITY</h2>
                      <Badge className="bg-emerald-500 text-black text-[9px] font-bold py-0.5 px-2">VALID</Badge>
                    </div>
                    <p className="text-xs text-emerald-300">
                      This record has been sealed with an immutable cryptographic signature on Braga Network.
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={copyUrl} className="h-8 text-xs border-zinc-700 bg-zinc-950 text-zinc-300 hover:text-white">
                    {copied ? <Check className="h-3 w-3 mr-1.5 text-emerald-400" /> : <Copy className="h-3 w-3 mr-1.5" />}
                    Share Report
                  </Button>
                  {data.isSimulated ? (
                    <Badge className="bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 text-xs">
                      Local Only (Simulation)
                    </Badge>
                  ) : (
                    <Button variant="outline" size="sm" asChild className="h-8 text-xs border-emerald-500/20 bg-emerald-950/20 text-emerald-400 hover:bg-emerald-950/40">
                      <a href={`https://explorer.braga.hoodi.arkiv.network/entity/${inputKey}`} target="_blank" rel="noopener noreferrer">
                        Arkiv Explorer
                        <ExternalLink className="h-3 w-3 ml-1.5" />
                      </a>
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 pt-6 border-t border-emerald-500/20 text-xs">
                <div className="space-y-1">
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Creator (Cryptographic Signature)</p>
                  <p className="font-mono text-zinc-300 truncate select-all" title={data.creator}>
                    {data.creator}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Entity Key (Blockchain Hash)</p>
                  <div className="flex items-center gap-1.5">
                    <p className="font-mono text-zinc-300 truncate select-all" title={inputKey}>
                      {inputKey}
                    </p>
                    <button onClick={() => copyHash(inputKey)} className="text-zinc-500 hover:text-zinc-300">
                      {copiedHash ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Cryptographic Audit Timeline */}
            {data.linkedEntity ? (
              <div className="space-y-6">
                <h3 className="text-sm font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                  <RefreshCw className="h-4.5 w-4.5 text-emerald-500 animate-spin-slow" />
                  Linked Multi-Key Audit Timeline
                </h3>

                <div className="relative border-l border-zinc-800 ml-4 pl-6 space-y-8">
                  {/* Node 1: AI Detection */}
                  {(() => {
                    const isQueryingDetection = data.relation === 'detection_to_dispatch'
                    const detectionData = isQueryingDetection ? data : data.linkedEntity
                    const payload = detectionData.payload

                    return (
                      <div className="relative">
                        {/* Dot */}
                        <div className="absolute -left-[31px] top-1.5 flex h-4 w-4 items-center justify-center rounded-full border border-purple-500 bg-black text-purple-400">
                          <Cpu className="h-2 w-2" />
                        </div>
                        
                        <div className="rounded-xl border border-purple-500/20 bg-purple-950/5 p-5 space-y-3 shadow-lg backdrop-blur-sm">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge className="bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[10px] font-mono">
                                🤖 AI DETECTION
                              </Badge>
                              <h4 className="text-sm font-bold text-zinc-200">
                                {payload.agent || 'Gemini 2.0 Flash'}
                              </h4>
                            </div>
                            <span className="text-[10px] text-zinc-500 font-mono">
                              {payload.scannedAt ? new Date(payload.scannedAt).toLocaleTimeString('en-US') : 'Scanned'}
                            </span>
                          </div>

                          <p className="text-xs text-zinc-300 font-medium">
                            <span className="text-zinc-500 font-semibold">Alert at:</span> {payload.location}
                          </p>

                          {payload.summary && (
                            <div className="p-2.5 rounded bg-black/40 border border-zinc-800 text-xs text-zinc-300 leading-relaxed font-sans">
                              {payload.summary}
                            </div>
                          )}

                          {payload.reasoning && (
                            <div className="text-[11px] text-purple-300 bg-purple-950/20 border border-purple-900/30 p-2.5 rounded">
                              <span className="font-bold text-purple-400 block mb-1">AI reasoning:</span>
                              {payload.reasoning}
                            </div>
                          )}

                          {payload.suggestedActions && (
                            <div className="text-[11px] text-zinc-400">
                              <span className="font-semibold text-zinc-300 block mb-0.5">Suggested Actions:</span>
                              {payload.suggestedActions}
                            </div>
                          )}

                          <div className="flex flex-wrap items-center gap-3 pt-2 text-[10px] text-zinc-500 font-mono border-t border-zinc-800/40">
                            <span>Confidence: {payload.confidence ?? 90}%</span>
                            <span>Type: {tipoLabel[payload.type || payload.tipo] || payload.type || payload.tipo}</span>
                            <span>Key: <span className="text-purple-400 select-all font-semibold">{(isQueryingDetection ? inputKey : data.linkedEntity?.key || '').slice(0, 10)}...</span></span>
                            {data.isSimulated ? (
                              <Badge className="bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 text-[8px] px-1 h-4">Simulation</Badge>
                            ) : (
                              <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[8px] px-1 h-4">Lease Extended</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })()}

                  {/* Node 2: Human Confirmation and Dispatch */}
                  {(() => {
                    const isQueryingDispatch = data.relation === 'dispatch_to_detection'
                    const dispatchData = isQueryingDispatch ? data : data.linkedEntity
                    const payload = dispatchData.payload

                    return (
                      <div className="relative">
                        {/* Dot */}
                        <div className="absolute -left-[31px] top-1.5 flex h-4 w-4 items-center justify-center rounded-full border border-orange-500 bg-black text-orange-400">
                          <UserCheck className="h-2 w-2" />
                        </div>

                        <div className="rounded-xl border border-orange-500/20 bg-orange-950/5 p-5 space-y-3 shadow-lg backdrop-blur-sm">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge className="bg-orange-500/10 text-orange-400 border border-orange-500/20 text-[10px] font-mono">
                                👤 CONFIRMATION AND DISPATCH
                              </Badge>
                              <h4 className="text-sm font-bold text-zinc-200">
                                Civil Defense Operator
                              </h4>
                            </div>
                            <span className="text-[10px] text-zinc-500 font-mono">
                              {payload.dispatchedAt ? new Date(payload.dispatchedAt).toLocaleTimeString('en-US') : 'Dispatched'}
                            </span>
                          </div>

                          <div className="p-3 rounded-lg bg-black/40 border border-orange-950/15 text-xs text-zinc-300 space-y-1.5 font-mono">
                            <div className="flex justify-between">
                              <span className="text-zinc-500">Operator Wallet:</span>
                              <span className="text-zinc-400 truncate w-32 text-right select-all" title={payload.operator}>{payload.operator}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-zinc-500">Deployment Location:</span>
                              <span className="text-orange-400 font-sans font-semibold">{payload.ubicacion}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-zinc-500">Emergency Severity:</span>
                              <Badge className={severityColor[payload.severidad] || "bg-zinc-800"}>
                                {payload.severidad?.toUpperCase()}
                              </Badge>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-zinc-500">Affected Population:</span>
                              <span className="text-zinc-300">{payload.afectados ?? payload.personas_afectadas} people</span>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-3 pt-2 text-[10px] text-zinc-500 font-mono border-t border-zinc-800/40">
                            <span>Status: Resources Deployed</span>
                            <span>Dispatch Key: <span className="text-orange-400 select-all font-semibold">{(isQueryingDispatch ? inputKey : data.linkedEntity?.key || '').slice(0, 10)}...</span></span>
                            <span>Expires at block: {dispatchData.expiresAtBlock || '999999'}</span>
                          </div>
                        </div>
                      </div>
                    )
                  })()}
                </div>
              </div>
            ) : (
              /* Decoded Metadata Card (Single entity fallback) */
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/20 p-6 space-y-4">
                <h3 className="text-sm font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                  <FileJson className="h-4.5 w-4.5 text-zinc-500" />
                  {data.payload.action === 'dispatch' ? 'Operational Dispatch Payload' : 
                   data.payload.agent ? 'AI Agent Detection Payload' : 
                   'Decoded Emergency Payload'}
                </h3>

                {data.payload && typeof data.payload === "object" ? (
                  <div className="space-y-4">
                    {/* Visual Fields */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {(data.payload.tipo || data.payload.type) && (
                        <div className="rounded-lg bg-zinc-950/40 border border-zinc-800 p-3">
                          <p className="text-[10px] text-zinc-500 uppercase mb-1">Incident Type</p>
                          <div className="flex items-center gap-1.5">
                            <AlertTriangle className="h-4 w-4 text-zinc-400" />
                            <span className="text-xs font-semibold text-zinc-200">
                              {tipoLabel[data.payload.tipo || data.payload.type] || data.payload.tipo || data.payload.type}
                            </span>
                          </div>
                        </div>
                      )}
                      {(data.payload.severidad || data.payload.severity) && (
                        <div className="rounded-lg bg-zinc-950/40 border border-zinc-800 p-3">
                          <p className="text-[10px] text-zinc-500 uppercase mb-1">Severity</p>
                          <Badge className={severityColor[data.payload.severidad || data.payload.severity] || "bg-zinc-800"}>
                            {(data.payload.severidad || data.payload.severity).toUpperCase()}
                          </Badge>
                        </div>
                      )}
                      {data.payload.ubicacion && (
                        <div className="rounded-lg bg-zinc-950/40 border border-zinc-800 p-3">
                          <p className="text-[10px] text-zinc-500 uppercase mb-1">Registered Location</p>
                          <div className="flex items-center gap-1.5 truncate">
                            <MapPin className="h-4 w-4 text-zinc-400" />
                            <span className="text-xs font-semibold text-zinc-200 truncate" title={data.payload.ubicacion}>
                              {data.payload.ubicacion}
                            </span>
                          </div>
                        </div>
                      )}
                      {(data.payload.afectados !== undefined || data.payload.affectedPeople !== undefined) && (
                        <div className="rounded-lg bg-zinc-950/40 border border-zinc-800 p-3">
                          <p className="text-[10px] text-zinc-500 uppercase mb-1">Affected Population</p>
                          <div className="flex items-center gap-1.5">
                            <Users className="h-4 w-4 text-zinc-400" />
                            <span className="text-xs font-semibold text-zinc-200">
                              {data.payload.afectados ?? data.payload.affectedPeople} people
                            </span>
                          </div>
                        </div>
                      )}
                      {(data.payload.timestamp || data.payload.scannedAt || data.payload.dispatchedAt) && (
                        <div className="rounded-lg bg-zinc-950/40 border border-zinc-800 p-3 col-span-1 md:col-span-2">
                          <p className="text-[10px] text-zinc-500 uppercase mb-1">Record Timestamp</p>
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-4 w-4 text-zinc-400" />
                            <span className="text-xs font-mono text-zinc-300">
                              {new Date(data.payload.timestamp || data.payload.scannedAt || data.payload.dispatchedAt).toLocaleString("en-US")}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* AI Reasoning card if AI detection but single key */}
                    {data.payload.reasoning && (
                      <div className="text-xs text-purple-300 bg-purple-950/20 border border-purple-900/30 p-3.5 rounded-lg space-y-1.5">
                        <span className="font-bold text-purple-400 block">AI Agent Reasoning:</span>
                        <p className="leading-relaxed">{data.payload.reasoning}</p>
                        {data.payload.suggestedActions && (
                          <div className="pt-2 text-zinc-400">
                            <span className="font-semibold text-zinc-300 block mb-0.5">Suggested Actions:</span>
                            <p>{data.payload.suggestedActions}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Raw JSON viewer */}
                    <div className="space-y-1">
                      <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Raw On-Chain JSON</p>
                      <pre className="font-mono text-xs text-emerald-400/90 bg-black/60 p-4 rounded-lg border border-zinc-800 overflow-x-auto max-h-60 custom-scrollbar">
                        {JSON.stringify(data.payload, null, 2)}
                      </pre>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded bg-zinc-950 text-center font-mono text-xs text-zinc-500">
                    The payload does not contain a descriptive data format.
                  </div>
                )}

                <div className="text-[11px] text-zinc-500 flex items-center justify-between pt-4 border-t border-zinc-800/80 font-mono">
                  <span>Expires at Block: {data.expiresAtBlock || "Infinite"}</span>
                  <span>Namespace: climate-crisis-dashboard</span>
                </div>
              </div>
            )}

          </div>
        )}

      </main>
    </div>
  )
}

export default function AuditoriaPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        <Loader2 className="h-10 w-10 text-emerald-400 animate-spin" />
      </div>
    }>
      <AuditoriaContent />
    </Suspense>
  )
}
