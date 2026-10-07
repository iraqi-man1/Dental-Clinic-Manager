using NargisClinic.Desktop.Localization;
using NargisClinic.Desktop.Mvvm;

namespace NargisClinic.Desktop.ViewModels;

/// <summary>Shown for sections the Windows app has not built yet. Keeps navigation honest without faking data.</summary>
public sealed class PlaceholderViewModel(string titleKey) : ObservableObject, ILocalizable
{
    public string TitleKey { get; } = titleKey;

    public string Title => Strings.Instance[TitleKey];

    public string Body => Strings.Instance["coming_soon_body"];

    public string Heading => Strings.Instance["coming_soon_title"];

    public void RefreshLocalizedText()
    {
        OnPropertyChanged(nameof(Title));
        OnPropertyChanged(nameof(Body));
        OnPropertyChanged(nameof(Heading));
    }
}
