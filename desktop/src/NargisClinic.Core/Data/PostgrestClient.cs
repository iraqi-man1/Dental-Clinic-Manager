using System.Globalization;
using System.Net.Http.Headers;
using System.Text.Json;
using NargisClinic.Core.Configuration;

namespace NargisClinic.Core.Data;

public sealed record PostgrestPage(IReadOnlyList<JsonElement> Rows, int? TotalCount);

/// <summary>Minimal PostgREST client. Every call carries the user's access token, so row-level security applies.</summary>
public sealed class PostgrestClient(HttpClient http, SupabaseSettings settings)
{
    public async Task<PostgrestPage> SelectAsync(
        string table,
        PostgrestQuery query,
        string accessToken,
        bool countRows = false,
        CancellationToken ct = default)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, BuildUri($"/rest/v1/{Uri.EscapeDataString(table)}", query));
        ApplyHeaders(request, accessToken);
        if (countRows)
            request.Headers.Add("Prefer", "count=exact");

        using var response = await http.SendAsync(request, ct);
        var payload = await response.Content.ReadAsStringAsync(ct);
        if (!response.IsSuccessStatusCode)
            throw SupabaseException.FromResponse(response.StatusCode, payload);

        var total = countRows ? ParseTotal(response.Content.Headers.ContentRange?.Length) : null;
        return new PostgrestPage(ParseRows(payload), total);
    }

    public async Task<JsonElement> RpcAsync(string function, object parameters, string accessToken, CancellationToken ct = default)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, BuildUri($"/rest/v1/rpc/{Uri.EscapeDataString(function)}", null))
        {
            Content = System.Net.Http.Json.JsonContent.Create(parameters),
        };
        ApplyHeaders(request, accessToken);

        using var response = await http.SendAsync(request, ct);
        var payload = await response.Content.ReadAsStringAsync(ct);
        if (!response.IsSuccessStatusCode)
            throw SupabaseException.FromResponse(response.StatusCode, payload);

        using var document = JsonDocument.Parse(string.IsNullOrWhiteSpace(payload) ? "null" : payload);
        return document.RootElement.Clone();
    }

    private Uri BuildUri(string path, PostgrestQuery? query)
    {
        var suffix = query is null || query.ToString().Length == 0 ? string.Empty : "?" + query;
        return new Uri(settings.Url, path + suffix);
    }

    private void ApplyHeaders(HttpRequestMessage request, string accessToken)
    {
        request.Headers.Add("apikey", settings.PublishableKey);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
    }

    private static IReadOnlyList<JsonElement> ParseRows(string payload)
    {
        using var document = JsonDocument.Parse(string.IsNullOrWhiteSpace(payload) ? "[]" : payload);
        if (document.RootElement.ValueKind != JsonValueKind.Array)
            return [];

        var rows = new List<JsonElement>(document.RootElement.GetArrayLength());
        foreach (var row in document.RootElement.EnumerateArray())
            rows.Add(row.Clone());
        return rows;
    }

    private static int? ParseTotal(long? length) =>
        length is null ? null : (int)Math.Min(length.Value, int.MaxValue);
}
