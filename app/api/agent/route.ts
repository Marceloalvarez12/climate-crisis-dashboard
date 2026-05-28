/**
 * app/api/agent/route.ts
 *
 * Endpoint for executing the social media monitoring agent.
 *
 * GET  /api/agent  → Agent status and available connectors
 * POST /api/agent  → Runs a complete scan and returns the result
 */

import { NextResponse } from "next/server"
import { SocialMediaAgent } from "@/lib/agents/social-media-agent"

// ---------------------------------------------------------------------------
// GET — agent status
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const agent = new SocialMediaAgent()
    const connectors = agent.getConnectorStatus()
    const activeCount = connectors.filter(c => c.isConfigured).length

    return NextResponse.json({
      status:          "online",
      model:           "gemini-2.0-flash",
      connectors:      connectors.map(c => ({
        name:          c.platform.toUpperCase(),
        isConfigured:  c.isConfigured,
        lastScan:      new Date().toISOString()
      })),
      activeConnectors: activeCount,
      geminiConfigured: !!process.env.GOOGLE_AI_API_KEY,
      timestamp:       new Date().toISOString(),
    })
  } catch (err) {
    return NextResponse.json(
      { status: "error", error: String(err) },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// POST — execute scan
// ---------------------------------------------------------------------------

export async function POST() {
  try {
    console.log("[API/agent] Starting live scan with Gemini 2.0 Flash...")
    const agent = new SocialMediaAgent()
    const result = await agent.runScan()

    console.log(
      `[API/agent] Live scan completed: ${result.postsCollected} posts, ` +
      `${result.incidentsFound.length} incidents detected`
    )

    return NextResponse.json(result)
  } catch (err) {
    console.error("[API/agent] Error in live scan:", err)
    return NextResponse.json(
      { error: String(err) },
      { status: 500 }
    )
  }
}

