export interface RealtimeEnvelope<TData = unknown> {
  id: string;
  type: string;
  occurredAt: string;
  data: TData;
}

export interface SseSubscription {
  unsubscribe: () => void;
}

export function subscribeToSse(options: {
  url: string;
  accessToken: string | null;
  onEvent: (eventName: string, data: RealtimeEnvelope) => void;
  onOpen?: () => void;
  onError?: (message: string) => void;
}): SseSubscription {
  const controller = new AbortController();

  if (!options.accessToken) {
    window.queueMicrotask(() => options.onError?.("Authentication required"));
    return { unsubscribe: () => controller.abort() };
  }

  void readSseStream({ ...options, accessToken: options.accessToken }, controller);

  return {
    unsubscribe: () => controller.abort(),
  };
}

async function readSseStream(
  options: {
    url: string;
    accessToken: string;
    onEvent: (eventName: string, data: RealtimeEnvelope) => void;
    onOpen?: () => void;
    onError?: (message: string) => void;
  },
  controller: AbortController,
): Promise<void> {
  try {
    const response = await fetch(options.url, {
      headers: { Authorization: `Bearer ${options.accessToken}` },
      signal: controller.signal,
    });

    if (!response.ok || !response.body) {
      options.onError?.(`Realtime connection failed (${response.status})`);
      return;
    }

    options.onOpen?.();

    const reader = response.body
      .pipeThrough(new TextDecoderStream())
      .getReader();
    let buffer = "";

    while (!controller.signal.aborted) {
      const chunk = await reader.read();
      if (chunk.done) break;
      buffer += chunk.value;
      const parts = buffer.split(/\n\n/);
      buffer = parts.pop() ?? "";

      for (const part of parts) {
        dispatchSseBlock(part, options.onEvent);
      }
    }
  } catch (error) {
    if (!controller.signal.aborted) {
      options.onError?.(error instanceof Error ? error.message : "Realtime connection failed");
    }
  }
}

function dispatchSseBlock(
  block: string,
  onEvent: (eventName: string, data: RealtimeEnvelope) => void,
): void {
  if (!block.trim() || block.startsWith(":")) return;

  let eventName = "message";
  const dataLines: string[] = [];

  for (const line of block.split(/\n/)) {
    if (line.startsWith("event:")) eventName = line.slice("event:".length).trim();
    if (line.startsWith("data:")) dataLines.push(line.slice("data:".length).trim());
  }

  if (!dataLines.length) return;

  try {
    onEvent(eventName, JSON.parse(dataLines.join("\n")) as RealtimeEnvelope);
  } catch {
    return;
  }
}
