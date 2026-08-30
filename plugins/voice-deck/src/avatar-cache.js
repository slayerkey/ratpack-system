export class AvatarCache {
  constructor({ fetchImpl = globalThis.fetch, maxEntries = 96, timeoutMs = 5000 } = {}) {
    this.fetchImpl = fetchImpl;
    this.maxEntries = maxEntries;
    this.timeoutMs = timeoutMs;
    this.cache = new Map();
    this.inflight = new Map();
  }

  peek(url) {
    if (!url) return "";
    const entry = this.cache.get(url);
    if (!entry) return "";
    this.cache.delete(url);
    this.cache.set(url, entry);
    return entry;
  }

  async get(url) {
    if (!url || typeof this.fetchImpl !== "function") return "";
    const cached = this.peek(url);
    if (cached) return cached;
    if (this.inflight.has(url)) return this.inflight.get(url);

    const work = this.#load(url).finally(() => this.inflight.delete(url));
    this.inflight.set(url, work);
    return work;
  }

  clear() {
    this.cache.clear();
    this.inflight.clear();
  }

  async #load(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(url, {
        signal: controller.signal,
        headers: { Accept: "image/avif,image/webp,image/png,image/*" },
      });
      if (!response?.ok) return "";
      const length = Number(response.headers?.get?.("content-length") || 0);
      if (length > 2_000_000) return "";
      const buffer = Buffer.from(await response.arrayBuffer());
      if (!buffer.length || buffer.length > 2_000_000) return "";
      const type = String(response.headers?.get?.("content-type") || "image/png").split(";")[0];
      const dataUri = `data:${/^image\//.test(type) ? type : "image/png"};base64,${buffer.toString("base64")}`;
      this.cache.set(url, dataUri);
      while (this.cache.size > this.maxEntries) {
        const oldest = this.cache.keys().next().value;
        this.cache.delete(oldest);
      }
      return dataUri;
    } catch {
      return "";
    } finally {
      clearTimeout(timer);
    }
  }
}
