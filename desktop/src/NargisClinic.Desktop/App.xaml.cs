using System.Net.Http;
using System.Windows;
using System.Windows.Threading;
using NargisClinic.Core.Clinic;
using NargisClinic.Core.Data;
using NargisClinic.Core.Formatting;
using NargisClinic.Desktop.Localization;
using NargisClinic.Desktop.ViewModels;
using NargisClinic.Desktop.Views;

namespace NargisClinic.Desktop;

public partial class App : Application
{
    public const string SmokeTestVariable = "NARGIS_SMOKE_TEST";

    private AppServices? _services;
    private Window? _current;

    protected override async void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);
        DispatcherUnhandledException += OnUnhandledException;
        _services = AppServices.Create();
        Strings.Instance.Language = _services.Preferences.Load();

        if (Environment.GetEnvironmentVariable(SmokeTestVariable) == "1")
        {
            RunSmokeTest(_services);
            return;
        }

        await RestoreOrShowLoginAsync(_services);
    }

    private async Task RestoreOrShowLoginAsync(AppServices services)
    {
        if (!services.IsConfigured)
        {
            ShowLogin(services, Strings.Instance["not_configured"]);
            return;
        }

        try
        {
            var session = await services.Auth.RestoreAsync();
            if (session is null)
            {
                ShowLogin(services, null);
                return;
            }

            var clinic = await services.Clinic.LoadActiveContextAsync(session.UserId, session.AccessToken);
            if (clinic is null)
            {
                await services.Auth.SignOutAsync();
                ShowLogin(services, Strings.Instance["err_no_clinic"]);
                return;
            }

            ShowShell(services, clinic);
        }
        catch (Exception error) when (error is HttpRequestException or TaskCanceledException or SupabaseException)
        {
            // Keep the stored session: a short outage should not sign staff out.
            ShowLogin(services, Strings.Instance["err_network"]);
        }
    }

    /// <summary>
    /// Last-resort handler. Staff see a plain message, and the technical details go to a local log for support.
    /// </summary>
    private static void OnUnhandledException(object sender, DispatcherUnhandledExceptionEventArgs e)
    {
        try
        {
            var folder = Path.GetDirectoryName(Infrastructure.PreferencesStore.DefaultPath)!;
            Directory.CreateDirectory(folder);
            File.AppendAllText(Path.Combine(folder, "errors.log"), $"{DateTimeOffset.UtcNow:O} {e.Exception}{Environment.NewLine}{Environment.NewLine}");
        }
        catch (IOException)
        {
            // Logging is best effort; the message below still reaches the user.
        }

        MessageBox.Show(Strings.Instance["err_unknown"], Strings.Instance["app_name"], MessageBoxButton.OK, MessageBoxImage.Error);
        e.Handled = true;
    }

    private void ShowLogin(AppServices services, string? notice)
    {
        var viewModel = new LoginViewModel(services, notice);
        viewModel.SignedIn += clinic => ShowShell(services, clinic);
        Replace(new LoginWindow(viewModel));
    }

    private void ShowShell(AppServices services, ClinicContext clinic)
    {
        var viewModel = new ShellViewModel(services, clinic);
        viewModel.SignOutRequested += () => _ = SignOutAsync(services);
        Replace(new ShellWindow(viewModel));
    }

    private async Task SignOutAsync(AppServices services)
    {
        await services.Auth.SignOutAsync();
        ShowLogin(services, null);
    }

    /// <summary>
    /// CI smoke test: creates every window in both languages and exits with code 0. WPF throws when a binding
    /// or resource is missing, so a broken view fails the job here instead of at a clinic's first launch.
    /// </summary>
    private void RunSmokeTest(AppServices services)
    {
        var clinic = new ClinicContext(Guid.Empty, "Smoke clinic", "IQD", ClinicTime.DefaultTimeZoneId, ClinicRole.Owner, "Smoke tester");

        ShowLogin(services, Strings.Instance["err_network"]);
        ShowShell(services, clinic);
        Strings.Instance.Language = AppLanguage.Arabic;
        ShowShell(services, clinic);
        ShowLogin(services, null);

        Shutdown(0);
    }

    /// <summary>Shows the next window and closes the previous one. Closing the active window exits the app.</summary>
    private void Replace(Window next)
    {
        var previous = _current;
        _current = next;
        next.Closed += (_, _) =>
        {
            if (ReferenceEquals(_current, next))
                Shutdown();
        };

        next.Show();
        previous?.Close();
    }
}
