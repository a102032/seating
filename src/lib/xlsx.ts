/**
 * The first sheet of an Excel file (.xlsx), as rows of cell text, so a teacher can import the
 * file they already have rather than first learning to save it as a CSV.
 *
 * An .xlsx is a zip of XML files: the browser unzips it (DecompressionStream) and reads the XML
 * (DOMParser), so no spreadsheet library comes with the app. It is loaded only when a file is
 * chosen. The old binary .xls isn't read; the message for it says to save as .xlsx or CSV.
 */

interface ZipEntry {
  method: number
  compressedSize: number
  localOffset: number
}

function zipEntries(bytes: Uint8Array): Map<string, ZipEntry> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  // The end-of-directory record sits in the last 64KB, behind an optional comment.
  let end = -1
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      end = i
      break
    }
  }
  if (end < 0) throw new Error('not a zip')
  const count = view.getUint16(end + 10, true)
  let at = view.getUint32(end + 16, true)
  const entries = new Map<string, ZipEntry>()
  const decoder = new TextDecoder()
  for (let n = 0; n < count; n++) {
    if (view.getUint32(at, true) !== 0x02014b50) throw new Error('bad zip directory')
    const nameLength = view.getUint16(at + 28, true)
    const extraLength = view.getUint16(at + 30, true)
    const commentLength = view.getUint16(at + 32, true)
    const name = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength))
    entries.set(name, {
      method: view.getUint16(at + 10, true),
      compressedSize: view.getUint32(at + 20, true),
      localOffset: view.getUint32(at + 42, true),
    })
    at += 46 + nameLength + extraLength + commentLength
  }
  return entries
}

async function readEntry(bytes: Uint8Array, entry: ZipEntry): Promise<string> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const at = entry.localOffset
  const start = at + 30 + view.getUint16(at + 26, true) + view.getUint16(at + 28, true)
  const data = bytes.slice(start, start + entry.compressedSize)
  if (entry.method === 0) return new TextDecoder().decode(data)
  if (entry.method !== 8) throw new Error('unknown zip compression')
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Response(stream).text()
}

function xml(text: string): Document {
  return new DOMParser().parseFromString(text, 'application/xml')
}

/** Elements by local name, whatever prefix a spreadsheet program gave them. */
function all(node: Document | Element, name: string): Element[] {
  return Array.from(node.getElementsByTagNameNS('*', name))
}

/** "C12" → column 2 (counting from 0). */
function columnOf(ref: string | null): number | null {
  const letters = ref?.match(/^[A-Z]+/)?.[0]
  if (!letters) return null
  let col = 0
  for (const ch of letters) col = col * 26 + (ch.charCodeAt(0) - 64)
  return col - 1
}

export async function readXlsxRows(buffer: ArrayBuffer): Promise<string[][]> {
  const bytes = new Uint8Array(buffer)
  const entries = zipEntries(bytes)
  const read = async (path: string) => {
    const entry = entries.get(path)
    return entry ? readEntry(bytes, entry) : null
  }

  // The first sheet in the workbook's own order, found through its relationship; most files
  // simply call it sheet1.
  let sheetPath = 'xl/worksheets/sheet1.xml'
  const workbook = await read('xl/workbook.xml')
  const rels = await read('xl/_rels/workbook.xml.rels')
  if (workbook && rels) {
    const first = all(xml(workbook), 'sheet')[0]
    const relId =
      first?.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') ?? first?.getAttribute('r:id')
    const target = all(xml(rels), 'Relationship')
      .find((r) => r.getAttribute('Id') === relId)
      ?.getAttribute('Target')
    if (target) sheetPath = target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`
  }

  const sharedXml = await read('xl/sharedStrings.xml')
  // A shared string can be split into runs of differently formatted text: join them.
  const shared = sharedXml
    ? all(xml(sharedXml), 'si').map((si) =>
        all(si, 't')
          .map((t) => t.textContent ?? '')
          .join(''),
      )
    : []

  const sheetXml = await read(sheetPath)
  if (!sheetXml) throw new Error('no sheet')
  return all(xml(sheetXml), 'row').map((row) => {
    const cells: string[] = []
    all(row, 'c').forEach((c, i) => {
      const col = columnOf(c.getAttribute('r')) ?? i
      const type = c.getAttribute('t')
      const value = all(c, 'v')[0]?.textContent ?? ''
      cells[col] =
        type === 's'
          ? (shared[Number(value)] ?? '')
          : type === 'inlineStr'
            ? all(c, 't')
                .map((t) => t.textContent ?? '')
                .join('')
            : value
    })
    return Array.from(cells, (v) => (v ?? '').trim())
  })
}
