using NargisClinic.Core.Auth;
using NargisClinic.Core.Clinic;
using NargisClinic.Core.Configuration;
using NargisClinic.Core.Data;
using NargisClinic.Core.Patients;
using NargisClinic.Desktop.Infrastructure;
using NargisClinic.Desktop.Localization;

namespace NargisClinic.Desktop;

/// <summary>Composition root. Built once at startup and shared by every view model.</summary>
public sealed class AppServices
{
    // Used only when settings are missing. IsConfigured is false in that case, so no request is ever sent.
    private static readonly SupabaseSettings Unconfigured = new(new Uri("https://unconfigured.invalid"), "unconfigured");

    private AppServices(
        SupabaseSettings? settings,
        AuthService auth,
        ClinicService clinic,
        PatientService patients,
        PreferencesStore preferences)
    {
        Settings = settings;
        Auth = auth;
        Clinic = clinic;
        Patients = patients;
        Preferences = preferences;
    }

    public SupabaseSettings? Settings { get; }

    public AuthService Auth { get; }

    public ClinicService Clinic { get; }

    public PatientService Patients { get; }

    public PreferencesStore Preferences { get; }

    public bool IsConfigured => Settings is not null;

    public static AppServices Create()
    {
        var settings = AppSettingsLoader.Load(AppContext.BaseDirectory);
        var effective = settings ?? Unconfigured;

        var http = new HttpClient { Timeout = TimeSpan.FromSeconds(30) };
        var auth = new SupabaseAuthClient(http, effective);
        var postgrest = new PostgrestClient(http, effective);

        return new AppServices(
            settings,
            new AuthService(auth, new DpapiSessionStore(DpapiSessionStore.DefaultPath)),
            new ClinicService(postgrest),
            new PatientService(postgrest),
            new PreferencesStore(PreferencesStore.DefaultPath));
    }
}
