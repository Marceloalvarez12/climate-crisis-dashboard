"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import {
  ArrowLeft,
  Search,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  ExternalLink,
  Cpu,
  FileJson,
  Check,
  Copy,
} from "lucide-react"

interface Groth16ProofInput {
  a: string
  b: string
  c: string
}

interface VerifyResult {
  valid: boolean
  network: string
  contractId: string
  simulationSuccess: boolean
  error?: string
  rawResult?: string
  isSimulated: boolean
  txHash?: string
  explorerUrl?: string
}

function AuditoriaContent() {
  const searchParams = useSearchParams()
  const [proofA, setProofA] = useState(searchParams.get("a") || "")
  const [proofB, setProofB] = useState(searchParams.get("b") || "")
  const [proofC, setProofC] = useState(searchParams.get("c") || "")
  const [pubSignals, setPubSignals] = useState(searchParams.get("pubSignals") || "")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<VerifyResult | null>(null)
  const [copied, setCopied] = useState(false)

  const fillExample = () => {
    setProofA("2da923408f1088c5dd2b8ca41f60688028b4f583b7c9b2169b163457f33b59c61499b07e865b5ed24e4734d4cce4afbb3d218c9e03598a5827bbd1278071417d")
    setProofB("201999950936be76bd9508f0a1a376494af576c8e16cf009400b009c422c23dc04c3820b7c31583538b45f5dea2c1d4b2678cbac4f573ed0603cd93804de83d83052ee2861da73dcc6e160fa67fa799ce80acf0bbf3d8a651614e3c135e0ae4d0661416bc8ab40938a1886ff75b21995e8d9217459d756f90086296ed93a194c")
    setProofC("273d23661a91befb777bbf5917b875796253fbb0fa89b13921858acaec10252121f3f86edad773df42e3a1c70ca75245315933d5af497e9ac2c41095c63c0cf0")
    setPubSignals("12345,63000000,63500000,114500000,115000000,12345")
    toast.info("Fields filled with example data")
  }

  const parsePubSignals = (): string[] | null => {
    if (!pubSignals.trim()) return []
    const parts = pubSignals.split(",").map(s => s.trim()).filter(Boolean)
    return parts.length > 0 ? parts : null
  }

  const handleVerify = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const signals = parsePubSignals()
    if (!proofA || !proofB || !proofC || signals === null) return

    setLoading(true)
    setResult(null)

    try {
      const proof: Groth16ProofInput = { a: proofA, b: proofB, c: proofC }
      const res = await fetch("/api/stellar/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proof, pubSignals: signals }),
      })
      const json = await res.json()

      if (json.success) {
        setResult(json.data)
        toast.success(json.data.valid ? "Proof verified on Stellar" : "Verification failed")
      } else {
        toast.error(json.error || "Error verifying proof")
      }
    } catch (err) {
      toast.error("Network error connecting to Stellar")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (proofA && proofB && proofC) {
      handleVerify()
    }
  }, [])

  const copyContractId = () => {
    navigator.clipboard.writeText(result?.contractId || "")
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success("Contract ID copied")
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-900 via-neutral-950 to-black text-foreground antialiased selection:bg-indigo-500/30 selection:text-indigo-200">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

      <header className="relative border-b border-zinc-800/80 bg-zinc-950/60 backdrop-blur-md px-6 py-4">
        <div className="mx-auto max-w-5xl flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-xs font-semibold text-zinc-400 hover:text-white transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to Control Center
          </Link>
          <div className="flex items-center gap-1.5 font-mono text-[10px] text-zinc-500">
            <span className="h-2 w-2 rounded-full bg-indigo-400 animate-pulse" />
            STELLAR TESTNET ACTIVE
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-4xl px-4 py-12 md:px-6">
        <div className="text-center space-y-3 mb-10">
          <Badge className="bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/15 border-indigo-500/20 text-xs px-3 py-1 font-mono uppercase tracking-wider">
            Circom + Groth16 Proof Audit
          </Badge>
          <h1 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-zinc-100 via-white to-zinc-400 sm:text-4xl">
            Stellar On-Chain Verification
          </h1>
          <p className="max-w-xl mx-auto text-sm text-zinc-400 leading-relaxed">
            Verify risk-zone membership proofs generated with Circom and Groth16 directly against the Stellar/Soroban verifier contract.
          </p>
        </div>

        <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 backdrop-blur-sm shadow-xl shadow-black/40">
          <form className="space-y-4">
            <div className="grid gap-4 md:grid-cols-1">
              <div className="space-y-1.5">
                <Label htmlFor="proofA" className="text-xs font-semibold text-zinc-300 flex items-center gap-2">
                  <Cpu className="h-3.5 w-3.5 text-indigo-400" />
                  Proof A (64 bytes hex)
                </Label>
                <Input
                  id="proofA"
                  value={proofA}
                  onChange={(e) => setProofA(e.target.value)}
                  placeholder="0x..."
                  className="font-mono text-xs bg-zinc-950/80 border-zinc-700 text-zinc-200"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="proofB" className="text-xs font-semibold text-zinc-300 flex items-center gap-2">
                  <Cpu className="h-3.5 w-3.5 text-purple-400" />
                  Proof B (128 bytes hex)
                </Label>
                <Input
                  id="proofB"
                  value={proofB}
                  onChange={(e) => setProofB(e.target.value)}
                  placeholder="0x..."
                  className="font-mono text-xs bg-zinc-950/80 border-zinc-700 text-zinc-200"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="proofC" className="text-xs font-semibold text-zinc-300 flex items-center gap-2">
                  <Cpu className="h-3.5 w-3.5 text-emerald-400" />
                  Proof C (64 bytes hex)
                </Label>
                <Input
                  id="proofC"
                  value={proofC}
                  onChange={(e) => setProofC(e.target.value)}
                  placeholder="0x..."
                  className="font-mono text-xs bg-zinc-950/80 border-zinc-700 text-zinc-200"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pubSignals" className="text-xs font-semibold text-zinc-300 flex items-center gap-2">
                  <FileJson className="h-3.5 w-3.5 text-amber-400" />
                  Public Signals (comma-separated decimals)
                </Label>
                <Input
                  id="pubSignals"
                  value={pubSignals}
                  onChange={(e) => setPubSignals(e.target.value)}
                  placeholder="12345,63000000,..."
                  className="font-mono text-xs bg-zinc-950/80 border-zinc-700 text-zinc-200"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button
                type="button"
                onClick={handleVerify}
                disabled={loading || !proofA || !proofB || !proofC}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying on Soroban...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Verify Proof
                  </>
                )}
              </Button>
              <Button type="button" variant="outline" onClick={fillExample} className="border-zinc-700 text-zinc-300 hover:text-white">
                Load example
              </Button>
            </div>
          </form>
        </div>

        {result && (
          <div className={`rounded-xl border p-6 relative overflow-hidden shadow-2xl ${result.valid ? "border-emerald-500/30 bg-emerald-950/15" : "border-red-500/20 bg-red-950/20"}`}>
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="flex items-start gap-3">
                <div className={`rounded-full p-2.5 shrink-0 ${result.valid ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
                  {result.valid ? <ShieldCheck className="h-7 w-7" /> : <ShieldAlert className="h-7 w-7" />}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-white leading-tight">
                      {result.valid ? "CRYPTOGRAPHICALLY VALID PROOF" : "PROOF REJECTED"}
                    </h2>
                    <Badge className={`text-[9px] font-bold py-0.5 px-2 ${result.valid ? "bg-emerald-500 text-black" : "bg-red-500 text-white"}`}>
                      {result.valid ? "VALID" : "INVALID"}
                    </Badge>
                  </div>
                  <p className="text-xs text-zinc-300">
                    {result.isSimulated
                      ? "Simulation mode active: the verifier runs the Groth16 verification locally with snarkjs. Configure STELLAR_SECRET_KEY to enable on-chain mode."
                      : `Verification executed against the deployed verifier contract on ${result.network}. The proof was checked inside the contract and an audit record was stored on-chain.`}
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={copyContractId} className="h-8 text-xs border-zinc-700 bg-zinc-950 text-zinc-300 hover:text-white">
                  {copied ? <Check className="h-3 w-3 mr-1.5 text-emerald-400" /> : <Copy className="h-3 w-3 mr-1.5" />}
                  Copy Contract ID
                </Button>
                <Button variant="outline" size="sm" asChild className="h-8 text-xs border-indigo-500/20 bg-indigo-950/20 text-indigo-400 hover:bg-indigo-950/40">
                  <a
                    href={`https://stellar.expert/explorer/testnet/contract/${result.contractId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Stellar Explorer
                    <ExternalLink className="h-3 w-3 ml-1.5" />
                  </a>
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 pt-6 border-t border-zinc-800/40 text-xs">
              <div className="space-y-1">
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Contract ID</p>
                <p className="font-mono text-zinc-300 truncate select-all" title={result.contractId}>
                  {result.contractId}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Network</p>
                <p className="font-mono text-zinc-300">{result.network}</p>
              </div>
              {result.error && (
                <div className="col-span-1 md:col-span-2 space-y-1">
                  <p className="text-[10px] text-red-400 uppercase tracking-wider">Error detail</p>
                  <p className="font-mono text-zinc-400 bg-black/30 p-2 rounded">{result.error}</p>
                </div>
              )}
              {result.rawResult && (
                <div className="col-span-1 md:col-span-2 space-y-1">
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Raw result</p>
                  <p className="font-mono text-zinc-400 bg-black/30 p-2 rounded break-all">{result.rawResult}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default function StellarAuditoriaPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-zinc-400">
        <Loader2 className="h-8 w-8 animate-spin mr-3" />
        Loading Stellar audit...
      </div>
    }>
      <AuditoriaContent />
    </Suspense>
  )
}
