using System.Text.Json;
using NargisClinic.Desktop.Localization;

namespace NargisClinic.Desktop.Infrastructure;

/// <summary>Per-PC preferences. Language is personal to the workstation, so it never changes other staff's screens.</summary>
public sealed class PreferencesStore(string filePath)
{
    public static string DefaultPath => Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "NargisClinic",
        "preferences.json");

    public AppLanguage Load()
    {
        try
        {
            if (File.Exists(filePath))
            {
                var model = JsonSerializer.Deserialize<PreferencesFile>(File.ReadAllText(filePath));
                if (string.Equals(model?.Language, "ar", StringComparison.OrdinalIgnoreCase))
                    return AppLanguage.Arabic;
            }
        }
        catch (Exception error) when (error is IOException or JsonException)
        {
            // Unreadable preferences fall back to the default language.
        }

        return AppLanguage.English;
    }

    public void Save(AppLanguage language)
    {
        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(filePath)!);
            var code = language == AppLanguage.Arabic ? "ar" : "en";
            File.WriteAllText(filePath, JsonSerializer.Serialize(new PreferencesFile(code)));
        }
        catch (IOException)
        {
            // The language still changes for this session; it just will not be remembered.
        }
    }

    private sealed record PreferencesFile(string? Language);
}
