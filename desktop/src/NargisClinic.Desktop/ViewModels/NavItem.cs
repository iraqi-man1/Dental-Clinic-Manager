using NargisClinic.Core.Clinic;
using NargisClinic.Desktop.Localization;
using NargisClinic.Desktop.Mvvm;

namespace NargisClinic.Desktop.ViewModels;

public sealed class NavItem : ObservableObject
{
    private readonly string _titleKey;
    private bool _isSelected;

    public NavItem(AppSection section, string titleKey, Action<NavItem> select)
    {
        Section = section;
        _titleKey = titleKey;
        Title = Strings.Instance[titleKey];
        SelectCommand = new Mvvm.RelayCommand(() => select(this));
    }

    public AppSection Section { get; }

    public string Title { get; private set; }

    public Mvvm.RelayCommand SelectCommand { get; }

    public bool IsSelected
    {
        get => _isSelected;
        set => SetProperty(ref _isSelected, value);
    }

    public void RefreshLocalizedText()
    {
        Title = Strings.Instance[_titleKey];
        OnPropertyChanged(nameof(Title));
    }
}
