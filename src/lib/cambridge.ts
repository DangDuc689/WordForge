export interface CambridgeData {
  ipaUk: string
  ipaUs: string
  partOfSpeech: string
  definition: string
  example: string
  cefr: string
}

export async function fetchCambridgeLocal(term: string): Promise<CambridgeData | null> {
  try {
    const slug = term.trim().toLowerCase().replace(/\s+/g, '-')
    // Call the vite proxy endpoint
    const url = `/api/cambridge/dictionary/english/${encodeURIComponent(slug)}`
    
    const res = await fetch(url, {
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Cache-Control': 'no-cache',
      },
      signal: AbortSignal.timeout(8000),
    })
    
    if (!res.ok) return null
    const html = await res.text()

    // Parse IPA UK và US
    const ipaMatches = [...html.matchAll(/class="ipa[^"]*"[^>]*>([^<]+)<\/span>/g)]
    const ipaUk = ipaMatches[0]?.[1]?.trim() ?? ''
    const ipaUs = ipaMatches[1]?.[1]?.trim() ?? ''

    // Parse phần từ loại (POS)
    const posMatches = [...html.matchAll(/class="pos dpos"[^>]*>([^<]+)<\/span>/g)]
    const partOfSpeech = posMatches[0]?.[1]?.trim() ?? ''

    // Parse definition tiếng Anh - tìm text trong .def block, loại bỏ tags
    const defMatches = [...html.matchAll(/class="def ddef_d db">([\s\S]*?)<\/div>/g)]
    const definition = defMatches[0]?.[1]?.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() ?? ''

    // Parse ví dụ đầu tiên — thử 3 patterns để đảm bảo match dù HTML khác nhau
    const egPattern1 = [...html.matchAll(/class="eg deg">([\s\S]*?)<\/span>/g)]
    const egPattern2 = [...html.matchAll(/class="eg[^"]*">([\s\S]*?)<\/span>/g)]
    const egPattern3 = [...html.matchAll(/class="[^"]*dexamp[^"]*"[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/g)]
    const egRaw = egPattern1[0]?.[1] ?? egPattern2[0]?.[1] ?? egPattern3[0]?.[1] ?? ''
    const example = egRaw.replace(/<[^>]+>/g, '').trim()

    // Parse CEFR level
    const cefrMatches = [...html.matchAll(/class="[^"]*epp-xref[^"]*">([A-C][12])<\/span>/g)]
    const cefr = cefrMatches[0]?.[1] ?? ''

    // Chỉ trả về nếu parse được ít nhất IPA hoặc definition
    if (!ipaUk && !definition) return null

    return { ipaUk, ipaUs, partOfSpeech, definition, example, cefr }
  } catch (error) {
    console.warn('[cambridge local fetch error]', error)
    // Không throw - cho phép fallback về AI-only hoặc logic của Edge Function
    return null
  }
}