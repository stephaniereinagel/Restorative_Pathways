export async function shareOrDownloadTextFile(args: { filename: string; text: string }): Promise<void> {
  const text = args.text ?? ''
  const filename = args.filename || 'notes.txt'
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  const isIOS = /iPhone|iPad|iPod/i.test(ua)
  const isSecure = typeof window !== 'undefined' ? window.isSecureContext : false

  // Prefer Web Share (best UX on iOS → “Save to Files”).
  try {
    const navAny = navigator as unknown as {
      canShare?: (data: { files?: File[] }) => boolean
      share?: (data: { title?: string; text?: string; files?: File[] }) => Promise<void>
    }
    if (navAny.share) {
      const file = new File([text], filename, { type: 'text/plain' })
      if (!navAny.canShare || navAny.canShare({ files: [file] })) {
        await navAny.share({ title: filename, files: [file], text: undefined })
        return
      }
      // If file sharing isn't supported, fall through to text share.
      await navAny.share({ title: filename, text })
      return
    }
  } catch {
    // fall through
  }

  // iOS Safari on a LAN (http://192.168.x.x) often lacks Web Share and handles downloads poorly.
  // Prefer opening an in-app export page (no popup/data URL issues).
  if (isIOS && !isSecure) {
    const key = `export:${Date.now()}:${Math.random().toString(16).slice(2)}`
    try {
      sessionStorage.setItem(key, JSON.stringify({ filename, text }))
    } catch {
      // If storage fails, fall back to opening a data URL.
      const encoded = encodeURIComponent(text)
      window.open(`data:text/plain;charset=utf-8,${encoded}`, '_blank')
      return
    }
    const url = `/export?key=${encodeURIComponent(key)}`
    const opened = window.open(url, '_blank')
    if (!opened) window.location.href = url
    return
  }

  // Desktop / non-iOS fallback: force a download.
  try {
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
    return
  } catch {
    // fall through
  }

  // Last resort: open in a new tab so user can manually share/copy.
  const encoded = encodeURIComponent(text)
  window.open(`data:text/plain;charset=utf-8,${encoded}`, '_blank')
}

