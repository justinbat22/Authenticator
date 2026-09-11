/**
 * Casts a Uint8Array to the ArrayBuffer-backed generic form that
 * lib.dom.d.ts's `BufferSource` type expects (`Uint8Array<ArrayBuffer>`).
 *
 * This is a type-level cast only, not a copy. It's safe throughout this
 * codebase because every Uint8Array we construct comes from `new
 * Uint8Array(n)` or `crypto.getRandomValues`, both of which are always
 * backed by a real ArrayBuffer — we never hand Web Crypto a view over a
 * SharedArrayBuffer, which is the only case this type distinction guards
 * against.
 */
export function asBufferSource(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  return bytes as Uint8Array<ArrayBuffer>
}
