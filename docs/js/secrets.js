/** XOR 编码的 Gemini Key（需与编码时使用的口令一致） */
const ENC = "GzEUPmNAcmx4Wm07WxZkAQJlUnwQCgUNdl4BdXt3DzcXHgAUZWBa";

export function deriveGeminiKey(password) {
  if (!password) return null;
  let raw;
  try {
    raw = atob(ENC);
  } catch {
    return null;
  }
  let out = "";
  for (let i = 0; i < raw.length; i++) {
    out += String.fromCharCode(
      raw.charCodeAt(i) ^ password.charCodeAt(i % password.length),
    );
  }
  return out.startsWith("AIza") ? out : null;
}
