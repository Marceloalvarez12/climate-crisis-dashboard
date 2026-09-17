"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Mic, MicOff, X, Volume2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { useVoiceControlEnabled } from "@/hooks/use-voice-control-enabled"
import {
  dispatchCommand,
  VOICE_COMMAND_HINTS,
  type VoiceActions,
  type VoiceContext,
} from "@/lib/voice/voice-actions"

interface VoiceFabProps {
  context: VoiceContext
  actions: VoiceActions
}

/**
 * FAB de control por voz. Sólo monta la UI si el admin activó el flag.
 * Cuando enabled === false → retorna null → cero costo runtime.
 * Cuando enabled === true y el operador habla → dispatchCommand mapea
 * la transcripción a acciones sobre el estado del dashboard.
 */
export function VoiceFab({ context, actions }: VoiceFabProps) {
  const { enabled } = useVoiceControlEnabled()
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState("")
  const [error, setError] = useState<string | null>(null)
  const recognitionRef = useRef<unknown>(null)
  const finalTranscriptRef = useRef("")

  useEffect(() => {
    if (!enabled || !isListening) return
    if (typeof window === "undefined") return
    const SR = (
      window as unknown as {
        SpeechRecognition?: new () => SpeechRecognitionLike
        webkitSpeechRecognition?: new () => SpeechRecognitionLike
      }
    ).SpeechRecognition ??
      (
        window as unknown as {
          webkitSpeechRecognition?: new () => SpeechRecognitionLike
        }
      ).webkitSpeechRecognition

    if (!SR) {
      setError("Reconocimiento de voz no soportado en este navegador")
      setIsListening(false)
      return
    }

    const recognition = new SR()
    recognition.lang = "es-AR"
    recognition.continuous = false
    recognition.interimResults = true

    recognition.onresult = (event: { results: ArrayLike<{ 0: { transcript: string }; isFinal?: boolean }> }) => {
      let finalText = ""
      let interimText = ""
      const arr = Array.from(event.results)
      for (let i = 0; i < arr.length; i++) {
        const r = arr[i]
        if (r.isFinal) finalText += r[0].transcript
        else interimText += r[0].transcript
      }
      finalTranscriptRef.current = finalText
      setTranscript(finalText + interimText)
    }
    recognition.onerror = (e: { error?: string }) => {
      setError(e.error ?? "Error de reconocimiento")
      setIsListening(false)
    }
    recognition.onend = () => {
      setIsListening(false)
      const text = finalTranscriptRef.current.trim() || transcript.trim()
      if (text) {
        const result = dispatchCommand(text, context, actions)
        if (result.handled) {
          toast.success(result.message, { description: `"${text}"` })
        } else {
          toast.warning(result.message, {
            description: "Probá: " + VOICE_COMMAND_HINTS[0],
          })
        }
      }
      setTranscript("")
      finalTranscriptRef.current = ""
    }

    recognitionRef.current = recognition
    recognition.start()

    return () => {
      try {
        recognition.stop()
      } catch {
        // ignore
      }
    }
    // transcript intencionalmente NO en deps — usamos finalTranscriptRef
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, isListening, context, actions])

  const handleToggle = useCallback(() => {
    if (isListening) {
      const rec = recognitionRef.current as { stop?: () => void } | null
      try {
        rec?.stop?.()
      } catch {
        // ignore
      }
      setIsListening(false)
      return
    }
    setError(null)
    setTranscript("")
    finalTranscriptRef.current = ""
    setIsListening(true)
  }, [isListening])

  if (!enabled) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      {isListening && (
        <div className="flex max-w-xs items-start gap-2 rounded-lg border border-cyan-500/30 bg-zinc-950/95 px-3 py-2 backdrop-blur-sm">
          <Mic className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-pulse text-cyan-400" />
          <div className="flex-1 text-xs">
            <p className="text-cyan-300">
              {transcript || "Escuchando..."}
            </p>
            {error && (
              <p className="mt-1 text-[10px] text-red-400">{error}</p>
            )}
          </div>
          <button
            onClick={() => setIsListening(false)}
            className="text-zinc-500 hover:text-foreground"
            aria-label="Cerrar"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
      <button
        onClick={handleToggle}
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-full border-2 shadow-lg transition-all",
          isListening
            ? "border-cyan-400 bg-cyan-500/20 text-cyan-300 animate-pulse"
            : "border-cyan-500/30 bg-zinc-900/90 text-cyan-400 hover:scale-105 hover:border-cyan-400/60",
        )}
        title="Comando por voz"
        aria-label={isListening ? "Detener escucha" : "Iniciar escucha"}
      >
        {isListening ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
      </button>
      {!isListening && (
        <div className="flex max-w-xs items-start gap-1.5 rounded border border-cyan-500/20 bg-zinc-950/90 px-2 py-1.5 backdrop-blur-sm">
          <Volume2 className="mt-0.5 h-3 w-3 shrink-0 text-cyan-400/70" />
          <div className="text-[10px] leading-tight text-zinc-400">
            <p className="font-medium text-cyan-300/90">Comandos:</p>
            {VOICE_COMMAND_HINTS.slice(0, 4).map((h) => (
              <p key={h}>{h}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((e: { results: ArrayLike<{ 0: { transcript: string }; isFinal?: boolean }> }) => void) | null
  onerror: ((e: { error?: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}
