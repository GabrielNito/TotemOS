import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const AUTH_COOKIE = "totemos_token"

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get(AUTH_COOKIE)?.value
  const isAuthed = Boolean(token)

  // Redirecionamento da rota raiz /
  if (pathname === "/") {
    if (isAuthed) {
      return NextResponse.redirect(new URL("/admin", request.url))
    }
    return NextResponse.redirect(new URL("/login", request.url))
  }

  // Proteção das rotas privadas /admin/*
  if (pathname.startsWith("/admin")) {
    if (!isAuthed) {
      const loginUrl = new URL("/login", request.url)
      loginUrl.searchParams.set("redirect", pathname)
      return NextResponse.redirect(loginUrl)
    }
    return NextResponse.next()
  }

  // Redirecionamento das rotas públicas quando já autenticado
  if (pathname === "/login" || pathname === "/registrar") {
    if (isAuthed) {
      return NextResponse.redirect(new URL("/admin", request.url))
    }
    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/", "/admin/:path*", "/login", "/registrar"],
}
