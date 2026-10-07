using System.Collections.ObjectModel;
using NargisClinic.Core.Clinic;
using NargisClinic.Desktop.Localization;
using NargisClinic.Desktop.Mvvm;

namespace NargisClinic.Desktop.ViewModels;

/// <summary>Main window state. Navigation is built from the role's sections, so a role never sees a screen it cannot use.</summary>
public sealed class ShellViewModel : ObservableObject
{
    private readonly AppServices _services;
    private readonly ClinicContext _clinic;
    private readonly PatientsViewModel? _patients;
    private object? _currentView;

    public ShellViewModel(AppServices services, ClinicContext clinic)
    {
        _services = services;
        _clinic = clinic;

        foreach (var section in clinic.Sections)
            Navigation.Add(new NavItem(section, TitleKey(section), Select));

        if (clinic.Can(AppSection.Patients))
        {
            _patients = new PatientsViewModel(services, clinic);
            _patients.RefreshCommand.Execute(null);
        }

        SignOutCommand = new RelayCommand(() => SignOutRequested?.Invoke());
        ToggleLanguageCommand = new RelayCommand(() => LanguageService.Toggle(_services.Preferences));

        Strings.Instance.LanguageChanged += (_, _) => RefreshLocalizedText();

        if (Navigation.Count > 0)
            Select(Navigation[0]);
    }

    /// <summary>Raised when the user asks to sign out. The app shell decides what to show next.</summary>
    public event Action? SignOutRequested;

    public ObservableCollection<NavItem> Navigation { get; } = [];

    public RelayCommand SignOutCommand { get; }

    public RelayCommand ToggleLanguageCommand { get; }

    public object? CurrentView
    {
        get => _currentView;
        private set => SetProperty(ref _currentView, value);
    }

    public string ClinicName => _clinic.ClinicName;

    public string ClinicLabel => Strings.Instance["clinic_label"];

    public string StaffLine => Strings.Instance.Format("signed_in_as", _clinic.StaffName);

    public string RoleText => Strings.Instance[RoleKey(_clinic.Role)];

    public bool HasNavigation => Navigation.Count > 0;

    public string NoSectionsText => HasNavigation ? "" : Strings.Instance["no_sections"];

    private void Select(NavItem item)
    {
        foreach (var nav in Navigation)
            nav.IsSelected = nav == item;

        CurrentView = item.Section == AppSection.Patients && _patients is not null
            ? _patients
            : new PlaceholderViewModel(item.Section switch
            {
                AppSection.Appointments => "nav_appointments",
                AppSection.Payments => "nav_payments",
                AppSection.Staff => "nav_staff",
                AppSection.Inventory => "nav_inventory",
                AppSection.Reports => "nav_reports",
                AppSection.Settings => "nav_settings",
                _ => "nav_patients",
            });
    }

    private void RefreshLocalizedText()
    {
        foreach (var nav in Navigation)
            nav.RefreshLocalizedText();

        if (CurrentView is ILocalizable localizable)
            localizable.RefreshLocalizedText();

        OnPropertyChanged(nameof(ClinicLabel));
        OnPropertyChanged(nameof(StaffLine));
        OnPropertyChanged(nameof(RoleText));
        OnPropertyChanged(nameof(NoSectionsText));
    }

    private static string TitleKey(AppSection section) => section switch
    {
        AppSection.Patients => "nav_patients",
        AppSection.Appointments => "nav_appointments",
        AppSection.Payments => "nav_payments",
        AppSection.Staff => "nav_staff",
        AppSection.Inventory => "nav_inventory",
        AppSection.Reports => "nav_reports",
        _ => "nav_settings",
    };

    private static string RoleKey(ClinicRole role) => role switch
    {
        ClinicRole.Owner => "role_owner",
        ClinicRole.Admin => "role_admin",
        ClinicRole.Dentist => "role_dentist",
        ClinicRole.Hygienist => "role_hygienist",
        ClinicRole.Assistant => "role_assistant",
        ClinicRole.FrontDesk => "role_front_desk",
        ClinicRole.Billing => "role_billing",
        ClinicRole.Viewer => "role_viewer",
        _ => "role_unknown",
    };
}
