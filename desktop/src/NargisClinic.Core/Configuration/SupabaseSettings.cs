namespace NargisClinic.Core.Configuration;

/// <summary>Public Supabase project settings. The publishable key is safe to ship; row-level security protects the data.</summary>
public sealed record SupabaseSettings(Uri Url, string PublishableKey)
{
    public static bool TryCreate(string? url, string? publishableKey, out SupabaseSettings? settings)
    {
        settings = null;
        if (string.IsNullOrWhiteSpace(url) || string.IsNullOrWhiteSpace(publishableKey))
            return false;

        if (!Uri.TryCreate(url.Trim(), UriKind.Absolute, out var uri))
            return false;

        // Credentials must never travel over plain HTTP, except to a loopback address used for local development.
        var secure = uri.Scheme == Uri.UriSchemeHttps || (uri.Scheme == Uri.UriSchemeHttp && uri.IsLoopback);
        if (!secure)
            return false;

        settings = new SupabaseSettings(uri, publishableKey.Trim());
        return true;
    }
}
