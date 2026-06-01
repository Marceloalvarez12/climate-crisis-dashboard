import { NextResponse } from "next/server"

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json(data, { status })
}

export function apiError(message: string, status = 500, details?: unknown) {
  return NextResponse.json(
    { error: message, ...(details ? { details } : {}) },
    { status }
  )
}

export function apiValidationError(details: unknown) {
  return NextResponse.json(
    { error: "Validation error", details },
    { status: 400 }
  )
}

export function apiNotFound(message = "Not found") {
  return NextResponse.json({ error: message }, { status: 404 })
}

export function apiUnauthorized(message = "Unauthorized") {
  return NextResponse.json({ error: message }, { status: 401 })
}
