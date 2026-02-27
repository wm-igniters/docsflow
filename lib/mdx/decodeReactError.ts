import errorCodes from "@/lib/error-codes.json";

const REACT_DEV_ERRORS_PREFIX = "https://react.dev/errors/";
const REACT_LEGACY_ERRORS_PREFIX = "https://reactjs.org/docs/error-decoder.html";

const extractCodeFromMessage = (message: string): string | null => {
  const index = message.indexOf(REACT_DEV_ERRORS_PREFIX);
  if (index >= 0) {
    const start = index + REACT_DEV_ERRORS_PREFIX.length;
    let end = start;
    while (end < message.length && message[end] >= "0" && message[end] <= "9") {
      end += 1;
    }
    return end > start ? message.slice(start, end) : null;
  }

  const legacyIndex = message.indexOf(REACT_LEGACY_ERRORS_PREFIX);
  if (legacyIndex >= 0) {
    try {
      const urlStart = legacyIndex;
      const urlEnd = message.indexOf(" ", urlStart);
      const rawUrl = urlEnd === -1 ? message.slice(urlStart) : message.slice(urlStart, urlEnd);
      const parsed = new URL(rawUrl);
      const invariant = parsed.searchParams.get("invariant");
      return invariant || null;
    } catch {
      return null;
    }
  }

  return null;
};

export const decodeReactError = (message: string) => {
  if (!message.startsWith("Minified React error")) return message;
  const code = extractCodeFromMessage(message);
  if (!code) return message;
  const template = (errorCodes as Record<string, string>)[code];
  return template ?? message;
};
