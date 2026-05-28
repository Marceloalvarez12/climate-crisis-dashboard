/**
 * lib/pdf-utils.ts
 *
 * The html2canvas library logs a console.error for unsupported CSS color
 * functions like lab() and oklch() used by Tailwind CSS v4, but this error
 * is NON-FATAL — html2canvas falls back to transparent and continues rendering.
 *
 * Instead of complex monkey-patching (which breaks html2canvas internals),
 * we simply suppress that specific console.error during PDF generation.
 */

/**
 * Wraps a PDF generation function, temporarily suppressing the harmless
 * html2canvas "unsupported color function" console.error messages.
 * The PDF still renders correctly because html2canvas falls back to
 * transparent for those colors, and the PDF templates use explicit
 * Tailwind utility classes (bg-white, bg-slate-50, etc.) that have
 * standard hex/rgb fallbacks.
 */
export async function generatePdfSilently(fn: () => Promise<void>): Promise<void> {
  const originalConsoleError = console.error

  console.error = (...args: any[]) => {
    const msg = String(args[0] || "")
    // Suppress only the specific html2canvas color parsing warning
    if (msg.includes("unsupported color function")) {
      return
    }
    originalConsoleError.apply(console, args)
  }

  try {
    await fn()
  } finally {
    console.error = originalConsoleError
  }
}
