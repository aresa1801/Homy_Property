'use client'

import { useState } from 'react'
import { initialsFrom } from '@/lib/homy-session'

/** Avatar yang memakai foto Google dan fallback ke inisial nama. */
export function UserAvatar({ name, email, avatarUrl, size = 40, className = '' }: { name: string; email: string; avatarUrl: string; size?: number; className?: string }) {
  const [failed, setFailed] = useState(false)
  if (avatarUrl && !failed) {
    return <img src={avatarUrl} alt={name} width={size} height={size} referrerPolicy="no-referrer" onError={() => setFailed(true)} className={'rounded-full object-cover ' + className} style={{ width: size, height: size }} />
  }
  return <span className={'grid place-items-center rounded-full bg-[#0b3d2e] text-sm font-semibold text-[#f6e2a8] ' + className} style={{ width: size, height: size }}>{initialsFrom(name, email)}</span>
}
