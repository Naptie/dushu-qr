/**
 * Generate the HDR white asset for the QR card background
 * (src/lib/assets/hdr-white.jpg).
 *
 * The image is a plain white JPEG carrying an ISO 21496-1 gain map. Browsers
 * with HDR support (Safari 26+/iOS 26, Chrome 137+) render it brighter than
 * SDR white; every other browser shows the plain white base rendition.
 * Run via `pnpm hdr`.
 *
 * Tuning (measured, see the sweep notes): libultrahdr's WASM encoder ignores
 * `targetHdrCapacity` and always writes gainMapMax = hdrCapacityMax ≈ 5.62
 * stops, storing the gain as pixel = 255 · dataGain/5.62. The gain map pixel
 * therefore saturates at 255 once the linear input gain ≥ 64 — and at pixel
 * 255 the ISO 21496-1 application formula reduces to "use the display's whole
 * current HDR headroom" (applied stops = available headroom), which is the
 * strongest a gain map can do at any ambient light level.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import sharp from 'sharp';
import { encodeUltraHdr, probeUltraHdr } from 'open-ultrahdr';

const SIZE = 512;
// 2^6 linear; anything ≥ 64 saturates the stored gain map at pixel 255.
const INPUT_GAIN = 64;

function toArrayBuffer(b: Uint8Array): ArrayBuffer {
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
}

async function main() {
  // Pure white base rendition — also the SDR fallback.
  const base = await sharp({
    create: { width: SIZE, height: SIZE, channels: 3, background: { r: 255, g: 255, b: 255 } }
  })
    .jpeg({ quality: 95, chromaSubsampling: '4:4:4' })
    .toBuffer();

  // Linear-light HDR values, 3 floats per pixel.
  const hdrLinear = new Float32Array(SIZE * SIZE * 3).fill(INPUT_GAIN);

  const encoded = Buffer.from(
    await encodeUltraHdr('hdr-white', toArrayBuffer(base), hdrLinear.buffer, {
      baseQuality: 95,
      gainMapQuality: 85,
      targetHdrCapacity: 3, // ignored by the encoder (see header note)
      gainMapScale: 1
    })
  );

  const probe = await probeUltraHdr(toArrayBuffer(encoded));
  if (!probe.isValid || !probe.hasGainMap || probe.hdrCapacity < 1) {
    throw new Error(`encoder produced invalid gain map: ${JSON.stringify(probe)}`);
  }

  const out = resolve('src/lib/assets/hdr-white.jpg');
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, encoded);
  console.log(`wrote ${out} (${encoded.byteLength} bytes, hdrCapacity ${probe.hdrCapacity})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
