using System.Net;
using System.Net.Http.Headers;
using System.Text;

namespace NargisClinic.Core.Tests;

/// <summary>Replays canned responses and records every request, so tests never touch the network.</summary>
internal sealed class FakeHttpHandler(Func<HttpRequestMessage, HttpResponseMessage> respond) : HttpMessageHandler
{
    public List<(HttpMethod Method, Uri Uri, string? Body, IReadOnlyDictionary<string, string> Headers)> Requests { get; } = [];

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        var body = request.Content is null ? null : await request.Content.ReadAsStringAsync(cancellationToken);
        var headers = request.Headers.ToDictionary(h => h.Key, h => string.Join(",", h.Value), StringComparer.OrdinalIgnoreCase);
        Requests.Add((request.Method, request.RequestUri!, body, headers));
        return respond(request);
    }

    public static HttpResponseMessage Json(HttpStatusCode status, string body) => new(status)
    {
        Content = new StringContent(body, Encoding.UTF8, "application/json"),
    };
}
