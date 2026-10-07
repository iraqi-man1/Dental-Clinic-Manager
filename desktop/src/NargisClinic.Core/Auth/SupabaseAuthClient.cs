using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using NargisClinic.Core.Configuration;
using NargisClinic.Core.Data;

namespace NargisClinic.Core.Auth;

/// <summary>Talks to Supabase Auth (GoTrue) over HTTP. No SDK dependency keeps the desktop build small and auditable.</summary>
public sealed class SupabaseAuthClient(HttpClient http, SupabaseSettings settings, TimeProvider? time = null)
{
    private readonly TimeProvider _time = time ?? TimeProvider.System;

    public Task<AuthSession> SignInWithPasswordAsync(string email, string password, CancellationToken ct = default) =>
        RequestSessionAsync("password", new { email, password }, ct);

    public Task<AuthSession> RefreshAsync(string refreshToken, CancellationToken ct = default) =>
        RequestSessionAsync("refresh_token", new { refresh_token = refreshToken }, ct);

    public async Task SignOutAsync(string accessToken, CancellationToken ct = default)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, new Uri(settings.Url, "/auth/v1/logout"));
        request.Headers.Add("apikey", settings.PublishableKey);
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);
        using var response = await http.SendAsync(request, ct);
        if (!response.IsSuccessStatusCode)
        {
            var payload = await response.Content.ReadAsStringAsync(ct);
            throw SupabaseException.FromResponse(response.StatusCode, payload);
        }
    }

    private async Task<AuthSession> RequestSessionAsync(string grantType, object body, CancellationToken ct)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, new Uri(settings.Url, $"/auth/v1/token?grant_type={grantType}"))
        {
            Content = JsonContent.Create(body),
        };
        request.Headers.Add("apikey", settings.PublishableKey);

        using var response = await http.SendAsync(request, ct);
        var payload = await response.Content.ReadAsStringAsync(ct);
        if (!response.IsSuccessStatusCode)
            throw SupabaseException.FromResponse(response.StatusCode, payload);

        return ParseSession(payload, _time.GetUtcNow());
    }

    internal static AuthSession ParseSession(string json, DateTimeOffset now)
    {
        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;

        var accessToken = RequiredString(root, "access_token");
        var refreshToken = RequiredString(root, "refresh_token");
        var expiresIn = root.TryGetProperty("expires_in", out var expires) && expires.TryGetInt32(out var seconds) ? seconds : 3600;

        if (!root.TryGetProperty("user", out var user) || user.ValueKind != JsonValueKind.Object)
            throw new SupabaseException(HttpStatusCode.BadGateway, "Supabase returned a session without a user.");

        var email = user.TryGetProperty("email", out var emailElement) && emailElement.ValueKind == JsonValueKind.String
            ? emailElement.GetString()
            : null;

        return new AuthSession(accessToken, refreshToken, now.AddSeconds(expiresIn), RequiredString(user, "id"), email);
    }

    private static string RequiredString(JsonElement element, string name)
    {
        if (element.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String && value.GetString() is { Length: > 0 } text)
            return text;

        throw new SupabaseException(HttpStatusCode.BadGateway, $"Supabase response is missing '{name}'.");
    }
}
