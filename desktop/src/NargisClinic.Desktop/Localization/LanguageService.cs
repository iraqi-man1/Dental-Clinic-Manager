using NargisClinic.Desktop.Infrastructure;

namespace NargisClinic.Desktop.Localization;

public static class LanguageService
{
    /// <summary>Flips the UI language for this workstation and remembers the choice.</summary>
    public static void Toggle(PreferencesStore preferences)
    {
        var next = Strings.Instance.Language == AppLanguage.Arabic ? AppLanguage.English : AppLanguage.Arabic;
        Strings.Instance.Language = next;
        preferences.Save(next);
    }
}
