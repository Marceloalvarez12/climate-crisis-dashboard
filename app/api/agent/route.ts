import { SocialMediaAgent } from "@/lib/agents/social-media-agent"
import { LlmAnalyzer } from "@/lib/agents/llm-analyzer"
import { apiSuccess, apiError } from "@/lib/services/api-response"

export async function GET() {
  try {
    const agent = new SocialMediaAgent()
    const connectors = agent.getConnectorStatus()
    const activeCount = connectors.filter(c => c.isConfigured).length
    const usingOpenRouter = LlmAnalyzer.isConfigured()

    return apiSuccess({
      status:          "online",
      model:           usingOpenRouter ? (process.env.OPENROUTER_MODEL || "openrouter") : "gemini-2.0-flash",
      provider:        usingOpenRouter ? "openrouter" : "google",
      connectors:      connectors.map(c => ({
        name:          c.platform.toUpperCase(),
        isConfigured:  c.isConfigured,
        lastScan:      new Date().toISOString()
      })),
      activeConnectors: activeCount,
      geminiConfigured: !!process.env.GOOGLE_AI_API_KEY,
      openrouterConfigured: usingOpenRouter,
      timestamp:       new Date().toISOString(),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return apiError(message)
  }
}

export async function POST() {
  try {
    const usingOpenRouter = LlmAnalyzer.isConfigured()
    console.log(`[API/agent] Starting live scan with ${usingOpenRouter ? "OpenRouter" : "Gemini 2.0 Flash"}...`)
    const agent = new SocialMediaAgent()
    const result = await agent.runScan()

    console.log(
      `[API/agent] Live scan completed: ${result.postsCollected} posts, ` +
      `${result.incidentsFound.length} incidents detected`
    )

    return apiSuccess(result)
  } catch (err) {
    console.error("[API/agent] Error in live scan:", err)
    const message = err instanceof Error ? err.message : String(err)
    return apiError(message)
  }
}
