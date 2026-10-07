namespace NargisClinic.Desktop.ViewModels;

/// <summary>Implemented by view models that build text in code, so they can rebuild it when the language changes.</summary>
public interface ILocalizable
{
    void RefreshLocalizedText();
}
