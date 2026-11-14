import { describe, expect, it } from "vitest";
import { crc32, zip } from "../src/zip";

const enc = new TextEncoder();
const dec = new TextDecoder();

/** A minimal reader for stored (uncompressed) archives: walks the central directory. */
function read(buf: Uint8Array): Record<string, string> {
  const v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const eocd = buf.byteLength - 22;
  expect(v.getUint32(eocd, true)).toBe(0x06054b50);
  const count = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  const out: Record<string, string> = {};
  for (let i = 0; i < count; i++) {
    expect(v.getUint32(p, true)).toBe(0x02014b50);
    const method = v.getUint16(p + 10, true);
    const crc = v.getUint32(p + 16, true);
    const size = v.getUint32(p + 20, true);
    const nameLen = v.getUint16(p + 28, true);
    const extraLen = v.getUint16(p + 30, true);
    const commentLen = v.getUint16(p + 32, true);
    const local = v.getUint32(p + 42, true);
    const name = dec.decode(buf.subarray(p + 46, p + 46 + nameLen));
    expect(method).toBe(0);
    expect(v.getUint32(local, true)).toBe(0x04034b50);
    const lName = v.getUint16(local + 26, true);
    const lExtra = v.getUint16(local + 28, true);
    const data = buf.subarray(local + 30 + lName + lExtra, local + 30 + lName + lExtra + size);
    expect(crc32(data)).toBe(crc);
    out[name] = dec.decode(data);
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

describe("zip", () => {
  it("computes the standard CRC-32", () => {
    expect(crc32(enc.encode("123456789"))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array())).toBe(0);
  });

  it("writes folders and UTF-8 names that read back byte for byte", () => {
    const files = {
      "values-pt-rBR/strings.xml": '<resources>\n  <string name="a">Pagar {amount}</string>\n</resources>\n',
      "ja.lproj/Localizable.strings": '"a" = "支払う";\n',
      "app_pt_BR.arb": "{}",
    };
    const z = zip(Object.entries(files).map(([name, text]) => ({ name, data: enc.encode(text) })));
    expect(read(z)).toEqual(files);
  });

  it("an empty archive is just the end record", () => {
    expect(zip([]).byteLength).toBe(22);
  });
});
