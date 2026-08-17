// Kleine Fetch-Helfer für Client-Komponenten.

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body && !(init.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...init?.headers,
    },
  });
  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // kein JSON
  }
  if (!response.ok) {
    const message =
      (data as { error?: string } | null)?.error ?? `Fehler ${response.status}`;
    throw new Error(message);
  }
  return data as T;
}
