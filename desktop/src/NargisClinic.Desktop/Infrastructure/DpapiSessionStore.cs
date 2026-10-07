using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using NargisClinic.Core.Auth;

namespace NargisClinic.Desktop.Infrastructure;

/// <summary>
/// Stores the session encrypted with DPAPI for the current Windows user. Another Windows account on the same
/// PC cannot read it, and copying the file to another machine makes it unreadable.
/// </summary>
public sealed class DpapiSessionStore(string filePath) : ISessionStore
{
    private static readonly byte[] Entropy = Encoding.UTF8.GetBytes("NargisClinic.Session.v1");

    public static string DefaultPath => Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "NargisClinic",
        "session.bin");

    public AuthSession? Load()
    {
        if (!File.Exists(filePath))
            return null;

        try
        {
            var plain = ProtectedData.Unprotect(File.ReadAllBytes(filePath), Entropy, DataProtectionScope.CurrentUser);
            return JsonSerializer.Deserialize<AuthSession>(plain);
        }
        catch (Exception error) when (error is CryptographicException or JsonException or IOException)
        {
            // A corrupted or foreign file is treated as "signed out" rather than crashing on launch.
            Clear();
            return null;
        }
    }

    public void Save(AuthSession session)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(filePath)!);
        var plain = JsonSerializer.SerializeToUtf8Bytes(session);
        File.WriteAllBytes(filePath, ProtectedData.Protect(plain, Entropy, DataProtectionScope.CurrentUser));
    }

    public void Clear()
    {
        if (File.Exists(filePath))
            File.Delete(filePath);
    }
}
