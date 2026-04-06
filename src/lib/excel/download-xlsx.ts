/** 浏览器内触发 .xlsx 下载（仅用于 Client Component 调用） */
export function downloadXlsxUint8(u8: Uint8Array, filename: string) {
  const blob = new Blob([Uint8Array.from(u8)], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
