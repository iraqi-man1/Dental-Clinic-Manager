using System.Net.Http;
using NargisClinic.Core.Clinic;
using NargisClinic.Core.Data;
using NargisClinic.Desktop.Localization;
using NargisClinic.Desktop.Mvvm;

namespace NargisClinic.Desktop.ViewModels;

public sealed class LoginViewModel : ObservableObject
{
    private readonly AppServices _services;
    private string _email = "";
    private string _password = "";
    private string? _error;
    private bool _busy;

    public LoginViewModel(AppServices services, string? notice)
    {
        _services = services;
        Notice = notice;
        SignInCommand = new AsyncRelayCommand(SignInAsync, () => _services.IsConfigured && !_busy);
        ToggleLanguageCommand = new RelayCommand(() => LanguageService.Toggle(_services.Preferences));
        Strings.Instance.PropertyChanged += (_, _) => OnPropertyChanged(nameof(SignInText));
    }

    /// <summary>Raised after a successful sign-in with the user's active clinic.</summary>
    public event Action<ClinicContext>? SignedIn;

    public AsyncRelayCommand SignInCommand { get; }

    public RelayCommand ToggleLanguageCommand { get; }

    public string? Notice { get; }

    public string Email
    {
        get => _email;
        set => SetProperty(ref _email, value);
    }

    /// <summary>Set from the PasswordBox in code-behind, because PasswordBox.Password is not a bindable property.</summary>
    public string Password
    {
        get => _password;
        set => _password = value;
    }

    public string? Error
    {
        get => _error;
        private set => SetProperty(ref _error, value);
    }

    public bool Busy
    {
        get => _busy;
        private set
        {
            if (SetProperty(ref _busy, value))
            {
                SignInCommand.NotifyCanExecuteChanged();
                OnPropertyChanged(nameof(SignInText));
            }
        }
    }

    public string SignInText => Busy ? Strings.Instance["signing_in"] : Strings.Instance["sign_in"];

    private async Task SignInAsync()
    {
        Error = null;
        if (string.IsNullOrWhiteSpace(Email) || string.IsNullOrEmpty(_password))
        {
            Error = Strings.Instance["err_fields_required"];
            return;
        }

        Busy = true;
        try
        {
            var session = await _services.Auth.SignInAsync(Email, _password);
            var clinic = await _services.Clinic.LoadActiveContextAsync(session.UserId, session.AccessToken);
            if (clinic is null)
            {
                // Do not keep a session for an account that has no clinic access.
                await _services.Auth.SignOutAsync();
                Error = Strings.Instance["err_no_clinic"];
                return;
            }

            _password = "";
            SignedIn?.Invoke(clinic);
        }
        catch (SupabaseException error)
        {
            Error = error.Code == "invalid_credentials" ? Strings.Instance["err_invalid_credentials"] : error.Message;
        }
        catch (Exception error) when (error is HttpRequestException or TaskCanceledException)
        {
            Error = Strings.Instance["err_network"];
        }
        catch (Exception)
        {
            // Unexpected failures never leave the user on a silent spinner.
            Error = Strings.Instance["err_unknown"];
        }
        finally
        {
            Busy = false;
        }
    }
}
