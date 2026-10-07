import { login } from './actions'
import Link from 'next/link'
import Image from 'next/image'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; reset?: string }>
}) {
  const { error, reset } = await searchParams

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0B0F17] relative overflow-hidden selection:bg-cyan-500/30">
      {/* Grid táctico de fondo */}
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'linear-gradient(rgba(6,182,212,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(6,182,212,0.03) 1px, transparent 1px)',
          backgroundSize: '4rem 4rem',
        }}
      />

      {/* Halo central difuminado */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-500/[0.04] rounded-full blur-[120px] pointer-events-none" />

      {/* Líneas decorativas de esquina */}
      <div className="absolute top-8 left-8 w-16 h-[1px] bg-gradient-to-r from-cyan-500/40 to-transparent" />
      <div className="absolute top-8 left-8 w-[1px] h-16 bg-gradient-to-b from-cyan-500/40 to-transparent" />
      <div className="absolute bottom-8 right-8 w-16 h-[1px] bg-gradient-to-l from-cyan-500/40 to-transparent" />
      <div className="absolute bottom-8 right-8 w-[1px] h-16 bg-gradient-to-t from-cyan-500/40 to-transparent" />

      {/* Contenedor principal */}
      <div className="relative z-10 w-full max-w-md px-4">
        {/* Tarjeta */}
        <div className="backdrop-blur-2xl bg-white/[0.02] border border-white/[0.08] rounded-2xl p-8 shadow-2xl shadow-cyan-950/30">

          {/* Cabecera de marca */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 mb-6">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[10px] font-mono tracking-[0.3em] text-green-400/60 uppercase">
                System Active
              </span>
            </div>
            <div className="flex justify-center mb-6">
              <Image
                src="/zntinel-logo-optimized.png"
                alt="ZNTINEL"
                width={400}
                height={244}
                className="h-32 w-auto object-contain"
                priority
              />
            </div>
          </div>

          {/* Confirmación de contraseña restablecida */}
          {reset && !error && (
            <div className="mb-6 px-4 py-3 rounded-lg border border-green-500/20 bg-green-500/[0.05]">
              <p className="text-[11px] font-mono text-green-400/90 text-center tracking-wider">
                Contraseña actualizada. Ingresá con tu nueva clave.
              </p>
            </div>
          )}

          {/* Mensaje de error parpadeante */}
          {error && (
            <div className="mb-6 px-4 py-3 rounded-lg border border-red-500/20 bg-red-500/[0.05] animate-pulse">
              <p className="text-[11px] font-mono text-red-400/90 text-center tracking-wider">
                {error === 'suspended'
                  ? 'Cuenta suspendida o sin acceso asignado'
                  : error === 'unavailable'
                    ? 'La autenticación no está configurada en este entorno'
                    : 'Correo o contraseña incorrectos'}
              </p>
            </div>
          )}

          {/* Formulario */}
          <form action={login} className="space-y-5">
            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-[10px] font-mono tracking-widest text-cyan-400/40 uppercase mb-2"
              >
                Identification // Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="operador@zntinel.com"
                className="w-full px-4 py-3 bg-white/[0.03] border border-white/[0.08] rounded-lg text-white text-sm font-mono placeholder:text-white/15 focus:outline-none focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/10 transition-all duration-300"
              />
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="block text-[10px] font-mono tracking-widest text-cyan-400/40 uppercase mb-2"
              >
                Access Key // Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full px-4 py-3 bg-white/[0.03] border border-white/[0.08] rounded-lg text-white text-sm font-mono placeholder:text-white/15 focus:outline-none focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/10 transition-all duration-300"
              />
            </div>

            {/* Botón de envío */}
            <button
              type="submit"
              className="w-full py-3.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-sm tracking-wider hover:from-cyan-400 hover:to-blue-500 active:scale-[0.98] transition-all duration-200 shadow-lg shadow-cyan-500/20 hover:shadow-cyan-400/30"
            >
  INGRESAR AL CENTRO DE CONTROL
            </button>

            <p className="text-center">
              <Link href="/recuperar" className="text-[11px] font-mono tracking-wider text-cyan-400/60 hover:text-cyan-300 transition-colors">
                ¿Olvidaste tu contraseña?
              </Link>
            </p>
          </form>

          {/* Separador decorativo */}
          <div className="mt-8 pt-6 border-t border-white/[0.05] flex items-center justify-center gap-3">
            <div className="w-8 h-[1px] bg-white/10" />
            <div className="w-1 h-1 rounded-full bg-cyan-400/30" />
            <div className="w-8 h-[1px] bg-white/10" />
          </div>

          {/* Footer */}
          <p className="mt-4 text-center text-xs text-zinc-400">
            ¿Sos ciudadano? <Link href="/mapa" className="text-cyan-400 hover:underline">Ver mapa público y reportar</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
