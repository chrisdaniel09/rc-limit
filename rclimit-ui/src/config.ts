let apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '';

export async function loadConfig() {
  try {
    const response = await fetch('/config.json');
    if (response.ok) {
      const config = await response.json();
      if (config.apiBaseUrl) {
        apiBaseUrl = config.apiBaseUrl;
      }
    }
  } catch {
    // Config file not found or error loading, use env var or default
  }
}

export function getApiBaseUrl(): string {
  return apiBaseUrl;
}

export function setApiBaseUrl(url: string) {
  apiBaseUrl = url;
}
