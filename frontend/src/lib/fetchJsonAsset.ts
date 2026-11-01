export async function fetchJsonAsset<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed loading ${url}: ${response.status}`)
  }
  return (await response.json()) as T
}
