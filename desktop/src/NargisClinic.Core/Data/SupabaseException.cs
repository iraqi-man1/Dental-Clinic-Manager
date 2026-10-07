using System.Net;
using System.Text.Json;

namespace NargisClinic.Core.Data;

/// <summary>An error returned by Supabase Auth or PostgREST, carrying the server's message when one is available.</summary>
public sealed class SupabaseException(HttpStatusCode statusCode, string message, string? code = null) : Exception(message)
{
    public HttpStatusCode StatusCode { get; } = statusCode;

    public string? Code { get; } = code;

    public static SupabaseException FromResponse(HttpStatusCode statusCode, string payload)
    {
        var message = $"Supabase request failed ({(int)statusCode}).";
        string? code = null;

        try
        {
            using var document = JsonDocument.Parse(payload);
            if (document.RootElement.ValueKind == JsonValueKind.Object)
            {
                message = FirstString(document.RootElement, "msg", "error_description", "message", "error") ?? message;
                code = FirstString(document.RootElement, "error_code", "code");
            }
        }
        catch (JsonException)
        {
            // Non-JSON error bodies (proxies, outages) keep the generic message.
        }

        return new SupabaseException(statusCode, message, code);
    }

    private static string? FirstString(JsonElement element, params string[] names)
    {
        foreach (var name in names)
        {
            if (element.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String)
                return value.GetString();
        }

        return null;
    }
}
