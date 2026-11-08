using System.Numerics;

// Managed Ed25519 signature verification (RFC 8032 §5.1.7) + SHA-512 (FIPS 180-4), for the Discord
// interactions endpoint (Discord.cs). System.Security.Cryptography is unavailable in the wasi build.
// Verify only (no secret keys here), so constant time doesn't matter: inputs are all public.
// Checked against RFC 8032 TEST 1-3 and signatures made with Python's `cryptography`.
public static class Sha512
{
    static readonly ulong[] K =
    {
        0x428a2f98d728ae22UL, 0x7137449123ef65cdUL, 0xb5c0fbcfec4d3b2fUL, 0xe9b5dba58189dbbcUL,
        0x3956c25bf348b538UL, 0x59f111f1b605d019UL, 0x923f82a4af194f9bUL, 0xab1c5ed5da6d8118UL,
        0xd807aa98a3030242UL, 0x12835b0145706fbeUL, 0x243185be4ee4b28cUL, 0x550c7dc3d5ffb4e2UL,
        0x72be5d74f27b896fUL, 0x80deb1fe3b1696b1UL, 0x9bdc06a725c71235UL, 0xc19bf174cf692694UL,
        0xe49b69c19ef14ad2UL, 0xefbe4786384f25e3UL, 0x0fc19dc68b8cd5b5UL, 0x240ca1cc77ac9c65UL,
        0x2de92c6f592b0275UL, 0x4a7484aa6ea6e483UL, 0x5cb0a9dcbd41fbd4UL, 0x76f988da831153b5UL,
        0x983e5152ee66dfabUL, 0xa831c66d2db43210UL, 0xb00327c898fb213fUL, 0xbf597fc7beef0ee4UL,
        0xc6e00bf33da88fc2UL, 0xd5a79147930aa725UL, 0x06ca6351e003826fUL, 0x142929670a0e6e70UL,
        0x27b70a8546d22ffcUL, 0x2e1b21385c26c926UL, 0x4d2c6dfc5ac42aedUL, 0x53380d139d95b3dfUL,
        0x650a73548baf63deUL, 0x766a0abb3c77b2a8UL, 0x81c2c92e47edaee6UL, 0x92722c851482353bUL,
        0xa2bfe8a14cf10364UL, 0xa81a664bbc423001UL, 0xc24b8b70d0f89791UL, 0xc76c51a30654be30UL,
        0xd192e819d6ef5218UL, 0xd69906245565a910UL, 0xf40e35855771202aUL, 0x106aa07032bbd1b8UL,
        0x19a4c116b8d2d0c8UL, 0x1e376c085141ab53UL, 0x2748774cdf8eeb99UL, 0x34b0bcb5e19b48a8UL,
        0x391c0cb3c5c95a63UL, 0x4ed8aa4ae3418acbUL, 0x5b9cca4f7763e373UL, 0x682e6ff3d6b2b8a3UL,
        0x748f82ee5defb2fcUL, 0x78a5636f43172f60UL, 0x84c87814a1f0ab72UL, 0x8cc702081a6439ecUL,
        0x90befffa23631e28UL, 0xa4506cebde82bde9UL, 0xbef9a3f7b2c67915UL, 0xc67178f2e372532bUL,
        0xca273eceea26619cUL, 0xd186b8c721c0c207UL, 0xeada7dd6cde0eb1eUL, 0xf57d4f7fee6ed178UL,
        0x06f067aa72176fbaUL, 0x0a637dc5a2c898a6UL, 0x113f9804bef90daeUL, 0x1b710b35131c471bUL,
        0x28db77f523047d84UL, 0x32caab7b40c72493UL, 0x3c9ebe0a15c9bebcUL, 0x431d67c49c100d4cUL,
        0x4cc5d4becb3e42b6UL, 0x597f299cfc657e2aUL, 0x5fcb6fab3ad6faecUL, 0x6c44198c4a475817UL,
    };

    static ulong Rotr(ulong x, int n) => (x >> n) | (x << (64 - n));

    public static byte[] Hash(byte[] data)
    {
        ulong[] h =
        {
            0x6a09e667f3bcc908UL, 0xbb67ae8584caa73bUL, 0x3c6ef372fe94f82bUL, 0xa54ff53a5f1d36f1UL,
            0x510e527fade682d1UL, 0x9b05688c2b3e6c1fUL, 0x1f83d9abfb41bd6bUL, 0x5be0cd19137e2179UL,
        };
        // Padding: 0x80, zeros, 128-bit big-endian bit length; total a multiple of 128 bytes.
        var len = data.Length;
        var padded = new byte[((len + 17 + 127) / 128) * 128];
        Array.Copy(data, padded, len);
        padded[len] = 0x80;
        var bits = (ulong)len * 8;
        for (var i = 0; i < 8; i++) padded[padded.Length - 1 - i] = (byte)(bits >> (8 * i));

        var w = new ulong[80];
        for (var off = 0; off < padded.Length; off += 128)
        {
            for (var t = 0; t < 16; t++)
            {
                ulong v = 0;
                for (var j = 0; j < 8; j++) v = (v << 8) | padded[off + 8 * t + j];
                w[t] = v;
            }
            for (var t = 16; t < 80; t++)
            {
                var s0 = Rotr(w[t - 15], 1) ^ Rotr(w[t - 15], 8) ^ (w[t - 15] >> 7);
                var s1 = Rotr(w[t - 2], 19) ^ Rotr(w[t - 2], 61) ^ (w[t - 2] >> 6);
                w[t] = w[t - 16] + s0 + w[t - 7] + s1;
            }
            ulong a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
            for (var t = 0; t < 80; t++)
            {
                var t1 = hh + (Rotr(e, 14) ^ Rotr(e, 18) ^ Rotr(e, 41)) + ((e & f) ^ (~e & g)) + K[t] + w[t];
                var t2 = (Rotr(a, 28) ^ Rotr(a, 34) ^ Rotr(a, 39)) + ((a & b) ^ (a & c) ^ (b & c));
                hh = g; g = f; f = e; e = d + t1; d = c; c = b; b = a; a = t1 + t2;
            }
            h[0] += a; h[1] += b; h[2] += c; h[3] += d; h[4] += e; h[5] += f; h[6] += g; h[7] += hh;
        }
        var result = new byte[64];
        for (var i = 0; i < 8; i++)
            for (var j = 0; j < 8; j++) result[8 * i + j] = (byte)(h[i] >> (56 - 8 * j));
        return result;
    }
}

public static class Ed25519
{
    static readonly BigInteger P = BigInteger.Pow(2, 255) - 19;
    static readonly BigInteger L = BigInteger.Pow(2, 252) + BigInteger.Parse("27742317777372353535851937790883648493");
    static readonly BigInteger D = Mod(-121665 * Inv(121666));
    static readonly BigInteger D2 = Mod(2 * D);
    static readonly BigInteger SqrtM1 = BigInteger.ModPow(2, (P - 1) / 4, P);
    static readonly Point Base = Decode(LittleEndian32(Mod(4 * Inv(5))))!.Value; // x is the even root

    // Extended twisted Edwards coordinates: x = X/Z, y = Y/Z, x*y = T/Z.
    readonly record struct Point(BigInteger X, BigInteger Y, BigInteger Z, BigInteger T);

    static readonly Point Identity = new(0, 1, 1, 0);

    static BigInteger Mod(BigInteger x) { var r = x % P; return r.Sign < 0 ? r + P : r; }
    static BigInteger Inv(BigInteger x) => BigInteger.ModPow(Mod(x), P - 2, P);

    // RFC 8032 §5.1.4 (add-2008-hwcd-3 / dbl-2008-hwcd).
    static Point Add(Point p, Point q)
    {
        var a = Mod((p.Y - p.X) * (q.Y - q.X));
        var b = Mod((p.Y + p.X) * (q.Y + q.X));
        var c = Mod(p.T * D2 % P * q.T);
        var d = Mod(2 * p.Z * q.Z);
        BigInteger e = b - a, f = d - c, g = d + c, h = b + a;
        return new Point(Mod(e * f), Mod(g * h), Mod(f * g), Mod(e * h));
    }

    static Point Double(Point p)
    {
        var a = p.X * p.X % P;
        var b = p.Y * p.Y % P;
        var c = 2 * (p.Z * p.Z % P);
        var h = a + b;
        var s = p.X + p.Y;
        var e = h - s * s % P;
        var g = a - b;
        var f = c + g;
        return new Point(Mod(e * f), Mod(g * h), Mod(f * g), Mod(e * h));
    }

    static Point Negate(Point p) => new(Mod(-p.X), p.Y, p.Z, Mod(-p.T));

    static byte[] LittleEndian32(BigInteger v)
    {
        var raw = v.ToByteArray(isUnsigned: true, isBigEndian: false);
        var out32 = new byte[32];
        Array.Copy(raw, out32, Math.Min(32, raw.Length));
        return out32;
    }

    static byte[] Encode(Point p)
    {
        var zi = Inv(p.Z);
        var x = Mod(p.X * zi);
        var y = Mod(p.Y * zi);
        var bytes = LittleEndian32(y);
        if (!x.IsEven) bytes[31] |= 0x80;
        return bytes;
    }

    // RFC 8032 §5.1.3. null = not a valid point encoding.
    static Point? Decode(byte[] s)
    {
        if (s.Length != 32) return null;
        var bytes = (byte[])s.Clone();
        var sign = (bytes[31] & 0x80) != 0;
        bytes[31] &= 0x7F;
        var y = new BigInteger(bytes, isUnsigned: true, isBigEndian: false);
        if (y >= P) return null;
        var yy = y * y % P;
        var u = Mod(yy - 1);
        var v = Mod(D * yy + 1);
        var v3 = v * v % P * v % P;
        var x = Mod(u * v3 % P * BigInteger.ModPow(u * v3 % P * v3 % P * v % P, (P - 5) / 8, P));
        var vxx = v * x % P * x % P;
        if (vxx != u)
        {
            if (vxx != Mod(-u)) return null;
            x = x * SqrtM1 % P;
        }
        if (x.IsZero && sign) return null;
        if (!x.IsEven != sign) x = P - x;
        return new Point(x, y, 1, x * y % P);
    }

    // True when `signature` (64 bytes: R || S) is a valid Ed25519 signature of `message` by `publicKey` (32 bytes).
    // Cofactorless check like libsodium/ref10: encode([S]B - [k]A) == R.
    public static bool Verify(byte[] publicKey, byte[] message, byte[] signature)
    {
        if (publicKey.Length != 32 || signature.Length != 64) return false;
        if (Decode(publicKey) is not { } a) return false;
        var s = new BigInteger(signature.AsSpan(32, 32), isUnsigned: true, isBigEndian: false);
        if (s >= L) return false;

        var hashInput = new byte[64 + message.Length];
        Array.Copy(signature, 0, hashInput, 0, 32);
        Array.Copy(publicKey, 0, hashInput, 32, 32);
        Array.Copy(message, 0, hashInput, 64, message.Length);
        var k = new BigInteger(Sha512.Hash(hashInput), isUnsigned: true, isBigEndian: false) % L;

        // Shamir's trick: one pass over the bits of s and k.
        var negA = Negate(a);
        var both = Add(Base, negA);
        var q = Identity;
        var sBits = LittleEndian32(s);
        var kBits = LittleEndian32(k);
        bool Bit(byte[] b, int i) => ((b[i >> 3] >> (i & 7)) & 1) != 0;
        var top = 252; // s, k < L < 2^253
        while (top >= 0 && !Bit(sBits, top) && !Bit(kBits, top)) top--;
        for (var i = top; i >= 0; i--)
        {
            q = Double(q);
            var sb = Bit(sBits, i);
            var kb = Bit(kBits, i);
            if (sb && kb) q = Add(q, both);
            else if (sb) q = Add(q, Base);
            else if (kb) q = Add(q, negA);
        }
        var r = Encode(q);
        var diff = 0;
        for (var i = 0; i < 32; i++) diff |= r[i] ^ signature[i];
        return diff == 0;
    }

    public static byte[]? FromHex(string hex)
    {
        hex = hex.Trim();
        if (hex.Length % 2 != 0) return null;
        try { return Convert.FromHexString(hex); } catch (FormatException) { return null; }
    }
}
