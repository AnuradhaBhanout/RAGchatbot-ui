// export async function streamChat({ url, body, handlers }) {
//   const res = await fetch(url, {
//     method: "POST",
//     headers: { "Content-Type": "application/json" },
//     body: JSON.stringify(body),
//   });


// export async function streamChat({ url, body, handlers }) {
//   let res;
//   for (let attempt = 0; attempt < 5; attempt++) {
//     res = await fetch(url, {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify(body),
//     });
//     if (res.status !== 503) break;
//     if (attempt < 4) await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
//   }


export async function streamChat({ url, body, handlers }) {
  let res;
  try {
    for (let attempt = 0; attempt < 5; attempt++) {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.status !== 503) break;
      if (attempt < 4) await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
    }
  } catch (e) {
    handlers.onError?.(e instanceof Error ? e : new Error(String(e)));
    return;
  }

    if (res.status === 429) {
      const wait = res.headers.get("Retry-After");
      handlers.onError?.(new Error(`Too many requests. Try again in ${wait ?? "a minute"}.`));
      return;
    }

    if (!res.ok || !res.body) {
      handlers.onError?.(new Error(`Request failed: ${res.status}`));
      return;
    }
    
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop(); // last chunk may be incomplete, save for next read

    for (const frame of frames) {
      if (!frame.trim()) continue;
      const eventLine = frame.split("\n").find((l) => l.startsWith("event:"));
      const dataLine = frame.split("\n").find((l) => l.startsWith("data:"));
      if (!eventLine || !dataLine) continue;

      const event = eventLine.slice(6).trim();
      const data = JSON.parse(dataLine.slice(5));

      switch (event) {
        case "token":
          handlers.onToken?.(data.content);
          break;
        case "tool_start":
          handlers.onToolStart?.(data);
          break;
        case "tool_end":
          handlers.onToolEnd?.(data);
          break;
        case "interrupt":
          handlers.onInterrupt?.(data);
          break;
        case "done":
          handlers.onDone?.(data);
          break;
        case "error":
          handlers.onError?.(new Error(data.message));
          break;
      }
    }
  }
}