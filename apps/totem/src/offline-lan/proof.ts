import { hmac } from "@noble/hashes/hmac.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";

export async function createLanProof(context: string, credential: string) {
  return bytesToHex(
    hmac(sha256, utf8ToBytes(credential), utf8ToBytes(context)),
  );
}
