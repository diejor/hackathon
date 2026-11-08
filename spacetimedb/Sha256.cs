// Managed SHA-256 + HMAC-SHA256 (FIPS 180-4, RFC 2104). System.Security.Cryptography throws
// PlatformNotSupportedException in the wasi build, so the Photon webhook signature check and the
// channel pseudo identities use this instead. Checked against RFC 4231 test cases 1-2 and Python's hmac.
public static class Sha256
{
    static readonly uint[] K =
    {
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
        0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
        0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
        0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
        0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
        0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
        0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
    };

    static uint Rotr(uint x, int n) => (x >> n) | (x << (32 - n));

    public static byte[] Hash(byte[] data)
    {
        uint[] h = { 0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19 };
        // Padding: 0x80, zeros, 64-bit big-endian bit length; total a multiple of 64 bytes.
        var len = data.Length;
        var padded = new byte[((len + 9 + 63) / 64) * 64];
        Array.Copy(data, padded, len);
        padded[len] = 0x80;
        var bits = (ulong)len * 8;
        for (var i = 0; i < 8; i++) padded[padded.Length - 1 - i] = (byte)(bits >> (8 * i));

        var w = new uint[64];
        for (var off = 0; off < padded.Length; off += 64)
        {
            for (var t = 0; t < 16; t++)
                w[t] = (uint)(padded[off + 4 * t] << 24 | padded[off + 4 * t + 1] << 16 | padded[off + 4 * t + 2] << 8 | padded[off + 4 * t + 3]);
            for (var t = 16; t < 64; t++)
            {
                var s0 = Rotr(w[t - 15], 7) ^ Rotr(w[t - 15], 18) ^ (w[t - 15] >> 3);
                var s1 = Rotr(w[t - 2], 17) ^ Rotr(w[t - 2], 19) ^ (w[t - 2] >> 10);
                w[t] = w[t - 16] + s0 + w[t - 7] + s1;
            }
            uint a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
            for (var t = 0; t < 64; t++)
            {
                var t1 = hh + (Rotr(e, 6) ^ Rotr(e, 11) ^ Rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[t] + w[t];
                var t2 = (Rotr(a, 2) ^ Rotr(a, 13) ^ Rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c));
                hh = g; g = f; f = e; e = d + t1; d = c; c = b; b = a; a = t1 + t2;
            }
            h[0] += a; h[1] += b; h[2] += c; h[3] += d; h[4] += e; h[5] += f; h[6] += g; h[7] += hh;
        }
        var result = new byte[32];
        for (var i = 0; i < 8; i++)
        {
            result[4 * i] = (byte)(h[i] >> 24); result[4 * i + 1] = (byte)(h[i] >> 16);
            result[4 * i + 2] = (byte)(h[i] >> 8); result[4 * i + 3] = (byte)h[i];
        }
        return result;
    }

    public static byte[] Hmac(byte[] key, byte[] message)
    {
        if (key.Length > 64) key = Hash(key);
        var ipad = new byte[64 + message.Length];
        var opad = new byte[64 + 32];
        for (var i = 0; i < 64; i++)
        {
            var k = i < key.Length ? key[i] : (byte)0;
            ipad[i] = (byte)(k ^ 0x36);
            opad[i] = (byte)(k ^ 0x5c);
        }
        Array.Copy(message, 0, ipad, 64, message.Length);
        Array.Copy(Hash(ipad), 0, opad, 64, 32);
        return Hash(opad);
    }

    // Constant-time comparison (doesn't leak how many leading bytes matched).
    public static bool FixedTimeEquals(byte[] a, byte[] b)
    {
        if (a.Length != b.Length) return false;
        var diff = 0;
        for (var i = 0; i < a.Length; i++) diff |= a[i] ^ b[i];
        return diff == 0;
    }
}
