/** XOR 编码的 Gemini Key（解码口令为授权码） */
const ENC = "GzEUPmNAcmx4Wm07WxZkAQJlUnwQCgUNdl4BdXt3DzcXHgAUZWBa";

export function deriveGeminiKeyFromAuthCode(authCode) {
  if (!authCode) return null;
  let raw;
  try {
    raw = atob(ENC);
  } catch {
    return null;
  }
  let out = "";
  for (let i = 0; i < raw.length; i++) {
    out += String.fromCharCode(
      raw.charCodeAt(i) ^ authCode.charCodeAt(i % authCode.length),
    );
  }
  return out.startsWith("AIza") ? out : null;
}
