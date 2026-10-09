/** Public audit fields require explicit evidence; absent flags never imply verification. */
export function publicStellarAudit(value: unknown) {
  if (!value || typeof value !== "object") return undefined
  const audit = value as Record<string, unknown>
  const txHash = typeof audit.txHash === "string" && /^[0-9a-f]{64}$/i.test(audit.txHash) ? audit.txHash : undefined
  const onChain = audit.verified === true && audit.onChain === true && audit.isSimulated !== true && Boolean(txHash)
  const explorerUrl = onChain && typeof audit.explorerUrl === "string" && /^https:\/\/stellar\.expert\/explorer\/(testnet|public|futurenet)\/tx\/[0-9a-f]{64}$/i.test(audit.explorerUrl) && audit.explorerUrl.endsWith(`/${txHash}`) ? audit.explorerUrl : undefined
  return {
    verified: audit.verified === true, onChain,
    txHash: onChain ? txHash : undefined, explorerUrl,
    journalDigest: typeof audit.journalDigest === "string" && /^[0-9a-f]{64}$/i.test(audit.journalDigest) ? audit.journalDigest : undefined,
  }
}
