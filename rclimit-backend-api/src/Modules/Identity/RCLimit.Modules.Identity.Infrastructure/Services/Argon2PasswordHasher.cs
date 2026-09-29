using System.Security.Cryptography;
using System.Text;
using Konscious.Security.Cryptography;
using RCLimit.Modules.Identity.Application.Abstractions;

namespace RCLimit.Modules.Identity.Infrastructure.Services;

public class Argon2PasswordHasher : IPasswordHasher
{
    private const int SaltSize = 16;
    private const int HashSize = 32;
    private const int MemorySize = 65536;
    private const int Iterations = 3;
    private const int Parallelism = 1;

    public (string Hash, string Salt) HashPassword(string password)
    {
        var salt = RandomNumberGenerator.GetBytes(SaltSize);

        using var argon2 = new Argon2id(Encoding.UTF8.GetBytes(password));
        argon2.Salt = salt;
        argon2.MemorySize = MemorySize;
        argon2.Iterations = Iterations;
        argon2.DegreeOfParallelism = Parallelism;

        var hash = argon2.GetBytes(HashSize);

        return (Convert.ToBase64String(hash), Convert.ToBase64String(salt));
    }

    public bool VerifyPassword(string password, string hash, string salt)
    {
        var saltBytes = Convert.FromBase64String(salt);
        var expectedHash = Convert.FromBase64String(hash);

        using var argon2 = new Argon2id(Encoding.UTF8.GetBytes(password));
        argon2.Salt = saltBytes;
        argon2.MemorySize = MemorySize;
        argon2.Iterations = Iterations;
        argon2.DegreeOfParallelism = Parallelism;

        var actualHash = argon2.GetBytes(HashSize);

        return CryptographicOperations.FixedTimeEquals(expectedHash, actualHash);
    }
}
