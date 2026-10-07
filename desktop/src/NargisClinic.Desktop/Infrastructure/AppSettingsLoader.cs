using System.Text.Json;
using NargisClinic.Core.Configuration;

namespace NargisClinic.Desktop.Infrastructure;

/// <summary>
/// Reads the Supabase project settings. Environment variables win, so IT can configure many PCs without editing files.
/// </summary>
public static class AppSettingsLoader
{
    public const string UrlVariable = "NARGIS_SUPABASE_URL";
    public const string KeyVariable = "NARGIS_SUPABASE_PUBLISHABLE_KEY";
    public const string FileName = "supabase.settings.json";

    public static SupabaseSettings? Load(string baseDirectory)
    {
        var url = Environment.GetEnvironmentVariable(UrlVariable);
        var key = Environment.GetEnvironmentVariable(KeyVariable);

        if (string.IsNullOrWhiteSpace(url) || string.IsNullOrWhiteSpace(key))
        {
            var file = Path.Combine(baseDirectory, FileName);
            var model = ReadFile(file);
            url ??= model?.SupabaseUrl;
            key ??= model?.SupabasePublishableKey;
        }

        return SupabaseSettings.TryCreate(url, key, out var settings) ? settings : null;
    }

    /// <summary>A damaged settings file means "not configured", never a crash at launch.</summary>
    private static SettingsFile? ReadFile(string path)
    {
        try
        {
            return File.Exists(path) ? JsonSerializer.Deserialize<SettingsFile>(File.ReadAllText(path)) : null;
        }
        catch (Exception error) when (error is IOException or JsonException)
        {
            return null;
        }
    }

    private sealed record SettingsFile(string? SupabaseUrl, string? SupabasePublishableKey);
}
