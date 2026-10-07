namespace NargisClinic.Core.Auth;

/// <summary>Persists the signed-in session. Implementations must protect the stored tokens (Windows uses DPAPI).</summary>
public interface ISessionStore
{
    AuthSession? Load();

    void Save(AuthSession session);

    void Clear();
}
