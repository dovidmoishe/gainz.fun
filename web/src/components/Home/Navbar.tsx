'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { usePrivy } from '@privy-io/react-auth'

type Props = {}

function Navbar({}: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const { authenticated } = usePrivy()

  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/features', label: 'Features' },
    { href: '/demo', label: 'Demo' },
  ]

  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/'
    }
    return pathname?.startsWith(href)
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 w-full px-6 pt-4 pb-4">
      <div className="max-w-7xl mx-auto backdrop-blur-md bg-background-soft/60 border border-electric-green/20 rounded-2xl shadow-[0_8px_32px_0_rgba(34,255,136,0.15)] px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center group">
          <p className="text-2xl font-bold text-white cursor-pointer group-hover:text-electric-green transition-all duration-300 drop-shadow-[0_0_8px_rgba(34,255,136,0.3)]">
            Gainz.fun
          </p>
        </Link>

        <div className="hidden md:flex items-center gap-4">
          <ul className="list-none flex items-center gap-6">
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={`text-sm font-medium transition-all duration-300 relative ${
                    isActive(link.href)
                      ? 'text-electric-green'
                      : 'text-foreground/70 hover:text-electric-green'
                  }`}
                >
                  {link.label}
                  {isActive(link.href) && (
                    <span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-electric-green shadow-[0_0_8px_rgba(34,255,136,0.6)]" />
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center gap-4">
          {authenticated ? (
            <button
              onClick={() => router.push('/chat')}
              className="outline-none bg-electric-green text-deep-black px-4 py-2 rounded-lg hover:bg-electric-green/90 hover:shadow-[0_0_16px_rgba(34,255,136,0.3)] transition-all duration-300 font-medium text-sm"
            >
              Go to Chat
            </button>
          ) : (
            <button className="outline-none bg-background-soft/50 backdrop-blur-sm border border-electric-green/30 text-electric-green px-4 py-2 rounded-lg hover:bg-electric-green/10 hover:border-electric-green/60 hover:shadow-[0_0_16px_rgba(34,255,136,0.3)] transition-all duration-300 font-medium text-sm">
              Get Started
            </button>
          )}

          <button className="md:hidden text-foreground hover:text-electric-green transition-all duration-300">
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
        </div>
      </div>
    </nav>
  )
}

export default Navbar
