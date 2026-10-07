using System.Collections.ObjectModel;
using System.Net.Http;
using System.Windows.Threading;
using NargisClinic.Core.Clinic;
using NargisClinic.Core.Data;
using NargisClinic.Core.Formatting;
using NargisClinic.Core.Patients;
using NargisClinic.Desktop.Localization;
using NargisClinic.Desktop.Mvvm;

namespace NargisClinic.Desktop.ViewModels;

/// <summary>One display row. Text is built in the clinic's time zone and currency, in the active language.</summary>
public sealed record PatientRow(string Number, string Name, string Phone, string Age, string Balance, string Status, string LastVisit);

public sealed class PatientsViewModel : ObservableObject, ILocalizable, IDisposable
{
    private const int PageSize = 25;

    private readonly AppServices _services;
    private readonly ClinicContext _clinic;
    private readonly DispatcherTimer _searchDelay;
    private IReadOnlyList<Patient> _items = [];
    private string _search = "";
    private int _page = 1;
    private int _pageCount = 1;
    private int _totalCount;
    private bool _loading;
    private string? _error;
    private int _requestVersion;

    public PatientsViewModel(AppServices services, ClinicContext clinic)
    {
        _services = services;
        _clinic = clinic;

        // Debounce typing so each keystroke does not send a request.
        _searchDelay = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(350) };
        _searchDelay.Tick += async (_, _) =>
        {
            _searchDelay.Stop();
            _page = 1;
            await LoadAsync();
        };

        RefreshCommand = new AsyncRelayCommand(LoadAsync, () => !_loading);
        PreviousCommand = new AsyncRelayCommand(async () => { _page--; await LoadAsync(); }, () => !_loading && _page > 1);
        NextCommand = new AsyncRelayCommand(async () => { _page++; await LoadAsync(); }, () => !_loading && _page < _pageCount);
    }

    public ObservableCollection<PatientRow> Rows { get; } = [];

    public AsyncRelayCommand RefreshCommand { get; }

    public AsyncRelayCommand PreviousCommand { get; }

    public AsyncRelayCommand NextCommand { get; }

    public string Search
    {
        get => _search;
        set
        {
            if (SetProperty(ref _search, value))
            {
                _searchDelay.Stop();
                _searchDelay.Start();
            }
        }
    }

    public bool Loading
    {
        get => _loading;
        private set
        {
            if (!SetProperty(ref _loading, value))
                return;

            RefreshCommand.NotifyCanExecuteChanged();
            PreviousCommand.NotifyCanExecuteChanged();
            NextCommand.NotifyCanExecuteChanged();
            OnPropertyChanged(nameof(IsEmpty));
        }
    }

    public string? Error
    {
        get => _error;
        private set
        {
            if (SetProperty(ref _error, value))
            {
                OnPropertyChanged(nameof(IsEmpty));
                OnPropertyChanged(nameof(HasError));
            }
        }
    }

    public bool HasError => Error is not null;

    public bool IsEmpty => !_loading && _error is null && Rows.Count == 0;

    public string CountText => Strings.Instance.Format("patients_count", _totalCount);

    public string PageText => Strings.Instance.Format("page_indicator", _page, _pageCount);

    public async Task LoadAsync()
    {
        var version = ++_requestVersion;
        Loading = true;
        Error = null;

        try
        {
            var token = await _services.Auth.GetAccessTokenAsync();
            var result = await _services.Patients.ListAsync(_clinic, token, new PatientListRequest(_search, _page, PageSize));
            if (version != _requestVersion)
                return;

            _items = result.Items;
            _totalCount = result.TotalCount;
            _pageCount = result.PageCount;
            RebuildRows();
        }
        catch (SupabaseException error)
        {
            if (version == _requestVersion)
                Error = Strings.Instance["patients_load_error"] + " " + error.Message;
        }
        catch (Exception error) when (error is HttpRequestException or TaskCanceledException)
        {
            if (version == _requestVersion)
                Error = Strings.Instance["err_network"];
        }
        catch (Exception)
        {
            if (version == _requestVersion)
                Error = Strings.Instance["patients_load_error"];
        }
        finally
        {
            if (version == _requestVersion)
                Loading = false;
        }

        RefreshCommand.NotifyCanExecuteChanged();
        PreviousCommand.NotifyCanExecuteChanged();
        NextCommand.NotifyCanExecuteChanged();
    }

    public void RefreshLocalizedText()
    {
        RebuildRows();
        OnPropertyChanged(nameof(CountText));
        OnPropertyChanged(nameof(PageText));
    }

    public void Dispose() => _searchDelay.Stop();

    private void RebuildRows()
    {
        var culture = Strings.Instance.Culture;
        var zone = ClinicTime.Resolve(_clinic.TimeZoneId);
        var today = DateOnly.FromDateTime(ClinicTime.ToClinicLocal(DateTimeOffset.UtcNow, zone));

        Rows.Clear();
        foreach (var patient in _items)
        {
            Rows.Add(new PatientRow(
                Number: patient.PatientNumber,
                Name: patient.FullName,
                Phone: patient.Phone ?? "—",
                Age: patient.AgeOn(today) is { } age ? Strings.Instance.Format("age_years", age) : "—",
                Balance: ClinicMoney.Format(patient.OutstandingBalance, _clinic.Currency, culture),
                Status: patient.IsActive ? Strings.Instance["status_active"] : Strings.Instance["status_inactive"],
                LastVisit: patient.LastVisitAt is { } visit
                    ? ClinicTime.ToClinicLocal(visit, zone).ToString("d", culture)
                    : Strings.Instance["no_visits"]));
        }

        OnPropertyChanged(nameof(CountText));
        OnPropertyChanged(nameof(PageText));
        OnPropertyChanged(nameof(IsEmpty));
    }
}
