import { describe, expect, it } from 'vitest'
import {
  createKdfParams,
  decryptBytes,
  decryptJson,
  decryptString,
  derivePassphraseKey,
  encryptBytes,
  encryptJson,
  encryptString,
  generateVmkBytes,
  importAesKey,
  tryDecryptBytes,
  VMK_BYTES,
} from './encryption'

// Low iteration count in tests only, to keep the suite fast. Production
// code always uses DEFAULT_PBKDF2_ITERATIONS (600k) via createKdfParams().
const TEST_ITERATIONS = 1000

describe('encryption', () => {
  it('round-trips a string through encrypt/decrypt', async () => {
    const kdf = createKdfParams(TEST_ITERATIONS)
    const key = await derivePassphraseKey('correct horse battery staple', kdf)
    const blob = await encryptString(key, 'a totp secret, presumably')
    expect(await decryptString(key, blob)).toBe('a totp secret, presumably')
  })

  it('round-trips arbitrary JSON', async () => {
    const kdf = createKdfParams(TEST_ITERATIONS)
    const key = await derivePassphraseKey('pw', kdf)
    const value = { issuer: 'Example', digits: 6, nested: { ok: true } }
    const blob = await encryptJson(key, value)
    expect(await decryptJson<typeof value>(key, blob)).toEqual(value)
  })

  it('produces different ciphertext each time (random IV)', async () => {
    const kdf = createKdfParams(TEST_ITERATIONS)
    const key = await derivePassphraseKey('pw', kdf)
    const a = await encryptString(key, 'same plaintext')
    const b = await encryptString(key, 'same plaintext')
    expect(a.ciphertextB64).not.toBe(b.ciphertextB64)
    expect(a.ivB64).not.toBe(b.ivB64)
  })

  it('derives different KEKs from different passphrases', async () => {
    const kdf = createKdfParams(TEST_ITERATIONS)
    const keyA = await derivePassphraseKey('passphrase-a', kdf)
    const keyB = await derivePassphraseKey('passphrase-b', kdf)
    const blob = await encryptString(keyA, 'secret')
    await expect(decryptString(keyB, blob)).rejects.toThrow()
  })

  it('derives different KEKs from the same passphrase with different salts', async () => {
    const kdfA = createKdfParams(TEST_ITERATIONS)
    const kdfB = createKdfParams(TEST_ITERATIONS)
    expect(kdfA.saltB64).not.toBe(kdfB.saltB64)
    const keyA = await derivePassphraseKey('same passphrase', kdfA)
    const keyB = await derivePassphraseKey('same passphrase', kdfB)
    const blob = await encryptString(keyA, 'secret')
    await expect(decryptString(keyB, blob)).rejects.toThrow()
  })

  it('rejects tampered ciphertext (GCM authentication)', async () => {
    const kdf = createKdfParams(TEST_ITERATIONS)
    const key = await derivePassphraseKey('pw', kdf)
    const blob = await encryptString(key, 'sensitive data')
    const tampered = {
      ...blob,
      ciphertextB64:
        blob.ciphertextB64.slice(0, -4) +
        (blob.ciphertextB64.slice(-4) === 'AAAA' ? 'BBBB' : 'AAAA'),
    }
    await expect(decryptString(key, tampered)).rejects.toThrow()
  })

  it('tryDecryptBytes returns null instead of throwing on wrong key', async () => {
    const kdf = createKdfParams(TEST_ITERATIONS)
    const keyA = await derivePassphraseKey('right', kdf)
    const keyB = await derivePassphraseKey('wrong', kdf)
    const blob = await encryptString(keyA, 'secret')
    expect(await tryDecryptBytes(keyB, blob)).toBeNull()
    expect(await tryDecryptBytes(keyA, blob)).not.toBeNull()
  })

  it('generates 256-bit VMK material', () => {
    const vmk = generateVmkBytes()
    expect(vmk.length).toBe(VMK_BYTES)
    expect(vmk.length).toBe(32)
  })

  it('wraps and unwraps a VMK under a passphrase-derived KEK (the core vault flow)', async () => {
    const kdf = createKdfParams(TEST_ITERATIONS)
    const kek = await derivePassphraseKey('user passphrase', kdf)
    const vmkBytes = generateVmkBytes()

    // Wrap: encrypt the raw VMK bytes under the KEK.
    const wrappedVmk = await encryptBytes(kek, vmkBytes)

    // Unwrap on "unlock": re-derive the KEK, decrypt the VMK bytes back out.
    const kekAgain = await derivePassphraseKey('user passphrase', kdf)
    const recoveredVmkBytes = await decryptBytes(kekAgain, wrappedVmk)
    expect(Array.from(recoveredVmkBytes)).toEqual(Array.from(vmkBytes))

    // The recovered VMK must actually work as a data-encryption key.
    const vmkKey = await importAesKey(recoveredVmkBytes)
    const dataBlob = await encryptString(vmkKey, 'issuer=Example;secret=JBSWY3DPEHPK3PXP')
    expect(await decryptString(vmkKey, dataBlob)).toBe('issuer=Example;secret=JBSWY3DPEHPK3PXP')
  })

  it('fails to unwrap the VMK with the wrong passphrase', async () => {
    const kdf = createKdfParams(TEST_ITERATIONS)
    const kek = await derivePassphraseKey('right passphrase', kdf)
    const vmkBytes = generateVmkBytes()
    const wrappedVmk = await encryptBytes(kek, vmkBytes)

    const wrongKek = await derivePassphraseKey('wrong passphrase', kdf)
    await expect(decryptBytes(wrongKek, wrappedVmk)).rejects.toThrow()
  })

  it('imported AES keys are non-extractable by default', async () => {
    const vmkBytes = generateVmkBytes()
    const key = await importAesKey(vmkBytes)
    await expect(crypto.subtle.exportKey('raw', key)).rejects.toThrow()
  })
})
