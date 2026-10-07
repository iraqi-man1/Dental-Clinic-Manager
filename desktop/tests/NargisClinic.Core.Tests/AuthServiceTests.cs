using System.Net;
using NargisClinic.Core.Auth;
using NargisClinic.Core.Configuration;
using NargisClinic.Core.Data;

namespace NargisClinic.Core.Tests;

public class AuthServiceTests
{
    private static readonly SupabaseSettings Settings = new(new Uri("https://example.supabase.co"), "sb_publishable_test");
    private static readonly DateTimeOffset Now = new(2026, 10, 7, 12, 0, 0, TimeSpan.Zero);

    private static string SessionJson(string access, string refresh, int expiresIn = 3600) =>
        System.Text.Json.JsonSerializer.Serialize(new
        {
            access_token = access,
            refresh_token = refresh,
            expires_in = expiresIn,
            user = new { id = "11111111-1111-1111-1111-111111111111", email = "staff@clinic.test" },
        });

    private static (AuthService service, MemoryStore store, FakeHttpHandler handler) Build(Func<HttpRequestMessage, HttpResponseMessage> respond, AuthSession? stored = null)
    {
        var handler = new FakeHttpHandler(respond);
        var time = new FixedTime(Now);
        var store = new MemoryStore(stored);
        var auth = new SupabaseAuthClient(new HttpClient(handler), Settings, time);
        return (new AuthService(auth, store, time), store, handler);
    }

    [Fact]
    public async Task SignInSendsPublishableKeyAndStoresSession()
    {
        var (service, store, handler) = Build(_ => FakeHttpHandler.Json(HttpStatusCode.OK, SessionJson("access-1", "refresh-1")));

        var session = await service.SignInAsync(" staff@clinic.test ", "secret");

        Assert.Equal("access-1", session.AccessToken);
        Assert.Equal(Now.AddSeconds(3600), session.ExpiresAt);
        Assert.Same(session, store.Saved);
        var request = handler.Requests.Single();
        Assert.Equal("https://example.supabase.co/auth/v1/token?grant_type=password", request.Uri.ToString());
        Assert.Equal("sb_publishable_test", request.Headers["apikey"]);
        Assert.Contains("\"email\":\"staff@clinic.test\"", request.Body);
    }

    [Fact]
    public async Task InvalidCredentialsSurfaceServerMessage()
    {
        var (service, _, _) = Build(_ => FakeHttpHandler.Json(HttpStatusCode.BadRequest, """{"msg":"Invalid login credentials","error_code":"invalid_credentials"}"""));

        var error = await Assert.ThrowsAsync<SupabaseException>(() => service.SignInAsync("a@b.test", "wrong"));

        Assert.Equal("Invalid login credentials", error.Message);
        Assert.Equal("invalid_credentials", error.Code);
    }

    [Fact]
    public async Task RestoreReusesUnexpiredSessionWithoutNetwork()
    {
        var stored = new AuthSession("access-old", "refresh-old", Now.AddMinutes(30), "u1", null);
        var (service, _, handler) = Build(_ => throw new InvalidOperationException("should not be called"), stored);

        var restored = await service.RestoreAsync();

        Assert.Equal("access-old", restored?.AccessToken);
        Assert.Empty(handler.Requests);
    }

    [Fact]
    public async Task RestoreRefreshesExpiredSessionAndRotatesRefreshToken()
    {
        var stored = new AuthSession("access-old", "refresh-old", Now.AddSeconds(-5), "u1", null);
        var (service, store, handler) = Build(_ => FakeHttpHandler.Json(HttpStatusCode.OK, SessionJson("access-new", "refresh-new")), stored);

        var restored = await service.RestoreAsync();

        Assert.Equal("access-new", restored?.AccessToken);
        Assert.Equal("refresh-new", store.Saved?.RefreshToken);
        Assert.Contains("\"refresh_token\":\"refresh-old\"", handler.Requests.Single().Body);
    }

    [Fact]
    public async Task RejectedRefreshTokenClearsStoredSession()
    {
        var stored = new AuthSession("access-old", "refresh-old", Now.AddSeconds(-5), "u1", null);
        var (service, store, _) = Build(_ => FakeHttpHandler.Json(HttpStatusCode.BadRequest, """{"msg":"Invalid Refresh Token"}"""), stored);

        var restored = await service.RestoreAsync();

        Assert.Null(restored);
        Assert.True(store.Cleared);
    }

    [Fact]
    public async Task NetworkFailureDuringRestoreKeepsSessionForRetry()
    {
        var stored = new AuthSession("access-old", "refresh-old", Now.AddSeconds(-5), "u1", null);
        var (service, store, _) = Build(_ => throw new HttpRequestException("offline"), stored);

        await Assert.ThrowsAsync<HttpRequestException>(() => service.RestoreAsync());

        Assert.False(store.Cleared);
    }

    [Fact]
    public async Task SignOutClearsLocalSessionEvenWhenServerRevokeFails()
    {
        var (service, store, _) = Build(_ => FakeHttpHandler.Json(HttpStatusCode.OK, SessionJson("access-1", "refresh-1")));
        await service.SignInAsync("a@b.test", "pw");

        var failing = new AuthService(new SupabaseAuthClient(new HttpClient(new FakeHttpHandler(_ => throw new HttpRequestException("offline"))), Settings), store);
        await failing.SignOutAsync();

        Assert.Null(failing.CurrentSession);
        Assert.True(store.Cleared);
    }

    private sealed class MemoryStore(AuthSession? initial = null) : ISessionStore
    {
        private AuthSession? _session = initial;

        public AuthSession? Saved { get; private set; }

        public bool Cleared { get; private set; }

        public AuthSession? Load() => _session;

        public void Save(AuthSession session)
        {
            Saved = session;
            _session = session;
        }

        public void Clear()
        {
            Cleared = true;
            _session = null;
        }
    }

    private sealed class FixedTime(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
    }
}
