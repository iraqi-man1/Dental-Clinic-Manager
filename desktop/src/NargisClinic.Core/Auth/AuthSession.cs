namespace NargisClinic.Core.Auth;

public sealed record AuthSession(string AccessToken, string RefreshToken, DateTimeOffset ExpiresAt, string UserId, string? Email)
{
    private static readonly TimeSpan RefreshWindow = TimeSpan.FromSeconds(60);

    /// <summary>True when the access token is about to expire and should be refreshed before the next request.</summary>
    public bool NeedsRefresh(DateTimeOffset now) => ExpiresAt - now < RefreshWindow;
}
