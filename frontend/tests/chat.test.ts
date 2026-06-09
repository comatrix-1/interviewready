import { describe, expect, it } from "vite-plus/test";
import { uint8ArrayToBase64 } from "../utils/base64";

describe("uint8ArrayToBase64", () => {
  it("encodes a small array identically to btoa", () => {
    const bytes = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
    expect(uint8ArrayToBase64(bytes)).toBe(btoa("Hello"));
  });

  it("encodes an empty array", () => {
    expect(uint8ArrayToBase64(new Uint8Array([]))).toBe("");
  });

  it("handles a 5 MB Uint8Array without stack overflow", () => {
    const size = 5 * 1024 * 1024;
    const bytes = new Uint8Array(size);
    for (let i = 0; i < size; i++) bytes[i] = i % 256;

    const result = uint8ArrayToBase64(bytes);

    // base64 output length is ~4/3 of input, padded to multiple of 4
    expect(result.length).toBe(Math.ceil(size / 3) * 4);
    // Must be valid base64 characters
    expect(result).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });

  it("matches btoa for a 16 KB payload", () => {
    const bytes = new Uint8Array(16384);
    for (let i = 0; i < bytes.length; i++) bytes[i] = i % 256;

    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCodePoint(bytes[i]);

    expect(uint8ArrayToBase64(bytes)).toBe(btoa(binary));
  });
});
