import { updatePassword } from "../login/actions"
import Link from "next/link"
import Image from "next/image"

export default async function RestablecerPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0B0F17] relative overflow-hidden selection:bg-cyan-500/30">
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'linear-gradient(rgba(6,182,212,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(6,182,212,0.03) 1px, transparent 1px)',
          backgroundSize: '4rem 4rem',
        }}
      />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-500/[0.04] rounded-full blur-[120px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md px-4">
        <div className="backdrop-blur-2xl bg-white/[0.02] border border-white/[0.08] rounded-2xl p-8 shadow-2xl shadow-cyan-950/30">
          <div className="text-center mb-6">
            <div className="flex justify-center mb-6">
              <Image
                src="/zntinel-logo-optimized.png"
                alt="ZNTINEL"
                width={400}
                height={244}
                className="h-24 w-auto object-contain"
                priority
              />
            </div>
            <h1 className="text-sm font-mono tracking-widest text-cyan-400/70 uppercase">
              Nueva contraseña
            </h1>
          </div>

          {error && (
            <div className="mb-6 px-4 py-3 rounded-lg border border-red-500/20 bg-red-500/[0.05]">
              <p className="text-[11px] font-mono text-red-400/90 text-center tracking-wider">
                {error === 'invalid'
                  ? 'Las contraseñas no coinciden o no cumplen el mínimo de 12 caracteres'
                  : 'El enlace expiró o no es válido. Pedí uno nuevo.'}
              </p>
            </div>
          )}

          <form action={updatePassword} className="space-y-5">
            <div>
              <label
                htmlFor="password"
                className="block text-[10px] font-mono tracking-widest text-cyan-400/40 uppercase mb-2"
              >
                Nueva contraseña (12+ caracteres)
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={12}
                maxLength={128}
                autoComplete="new-password"
                placeholder="••••••••••••"
                className="w-full px-4 py-3 bg-white/[0.03] border border-white/[0.08] rounded-lg text-white text-sm font-mono placeholder:text-white/15 focus:outline-none focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/10 transition-all duration-300"
              />
            </div>
            <div>
              <label
                htmlFor="confirm"
                className="block text-[10px] font-mono tracking-widest text-cyan-400/40 uppercase mb-2"
              >
                Confirmar contraseña
              </label>
              <input
                id="confirm"
                name="confirm"
                type="password"
                required
                minLength={12}
                maxLength={128}
                autoComplete="new-password"
                placeholder="••••••••••••"
                className="w-full px-4 py-3 bg-white/[0.03] border border-white/[0.08] rounded-lg text-white text-sm font-mono placeholder:text-white/15 focus:outline-none focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/10 transition-all duration-300"
              />
            </div>
            <button
              type="submit"
              className="w-full py-3.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-sm tracking-wider hover:from-cyan-400 hover:to-blue-500 active:scale-[0.98] transition-all duration-200 shadow-lg shadow-cyan-500/20 hover:shadow-cyan-400/30"
            >
              GUARDAR CONTRASEÑA
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-white/[0.05]">
            <p className="text-center text-xs text-zinc-400">
              <Link href="/login" className="text-cyan-400 hover:underline">Volver al ingreso</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
