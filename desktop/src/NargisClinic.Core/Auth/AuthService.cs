using System.Net;
using NargisClinic.Core.Data;

namespace NargisClinic.Core.Auth;

/// <summary>Owns the signed-in session: sign-in, restore on launch, transparent token refresh and sign-out.</summary>
public sealed class AuthService(SupabaseAuthClient auth, ISessionStore store, TimeProvider? time = null)
{
    private readonly TimeProvider _time = time ?? TimeProvider.System;
    private readonly SemaphoreSlim _refreshGate = new(1, 1);

    public AuthSession? CurrentSession { get; private set; }

    public async Task<AuthSession> SignInAsync(string email, string password, CancellationToken ct = default)
    {
        var session = await auth.SignInWithPasswordAsync(email.Trim(), password, ct);
        return Remember(session);
    }

    /// <summary>
    /// Restores the stored session on launch. Returns null when nothing is stored or the refresh token was rejected.
    /// Network failures propagate so the UI can offer a retry instead of silently signing the user out.
    /// </summary>
    public async Task<AuthSession?> RestoreAsync(CancellationToken ct = default)
    {
        var stored = store.Load();
        if (stored is null)
            return null;

        try
        {
            var session = stored.NeedsRefresh(_time.GetUtcNow())
                ? await auth.RefreshAsync(stored.RefreshToken, ct)
                : stored;
            return Remember(session);
        }
        catch (SupabaseException error) when (error.StatusCode is HttpStatusCode.BadRequest or HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden)
        {
            store.Clear();
            return null;
        }
    }

    /// <summary>Returns a valid access token, refreshing it first when it is close to expiry.</summary>
    public async Task<string> GetAccessTokenAsync(CancellationToken ct = default)
    {
        await _refreshGate.WaitAsync(ct);
        try
        {
            var session = CurrentSession ?? throw new InvalidOperationException("No signed-in session.");
            if (session.NeedsRefresh(_time.GetUtcNow()))
                session = Remember(await auth.RefreshAsync(session.RefreshToken, ct));

            return session.AccessToken;
        }
        finally
        {
            _refreshGate.Release();
        }
    }

    public async Task SignOutAsync(CancellationToken ct = default)
    {
        var session = CurrentSession;
        CurrentSession = null;
        store.Clear();

        if (session is null)
            return;

        try
        {
            await auth.SignOutAsync(session.AccessToken, ct);
        }
        catch (Exception error) when (error is HttpRequestException or SupabaseException)
        {
            // The local session is already cleared; a failed server-side revoke must not block sign-out.
        }
    }

    private AuthSession Remember(AuthSession session)
    {
        CurrentSession = session;
        store.Save(session);
        return session;
    }
}
