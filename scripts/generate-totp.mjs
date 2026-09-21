import { createHmac } from "node:crypto";

// Base32 decode according to RFC 4648
function base32Decode(base32) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let cleaned = base32.replace(/=+$/, "").toUpperCase().replace(/\s+/g, "");
  let bits = "";
  for (let i = 0; i < cleaned.length; i++) {
    const val = alphabet.indexOf(cleaned[i]);
    if (val === -1) throw new Error(`Invalid base32 character: ${cleaned[i]}`);
    bits += val.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substring(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

export function generateTOTP(secret, timeStepSeconds = 30) {
  const key = base32Decode(secret);
  const epochSeconds = Math.floor(Date.now() / 1000);
  const counter = Math.floor(epochSeconds / timeStepSeconds);
  
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  
  const hmac = createHmac("sha1", key);
  hmac.update(buf);
  const digest = hmac.digest();
  
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
    
  const otp = binary % 1000000;
  return otp.toString().padStart(6, "0");
}

if (process.argv[2]) {
  console.log(generateTOTP(process.argv[2]));
}
