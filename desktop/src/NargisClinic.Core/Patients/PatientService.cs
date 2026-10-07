using System.Globalization;
using System.Text.Json;
using NargisClinic.Core.Clinic;
using NargisClinic.Core.Data;

namespace NargisClinic.Core.Patients;

public sealed record PatientListRequest(string? Search = null, int Page = 1, int PageSize = 25);

public sealed record PatientPage(IReadOnlyList<Patient> Items, int TotalCount, int Page, int PageSize)
{
    public int PageCount => Math.Max(1, (int)Math.Ceiling(TotalCount / (double)PageSize));
}

public sealed class PatientService(PostgrestClient postgrest)
{
    private const string Columns = "id,patient_number,first_name,last_name,phone,email,date_of_birth,gender,status,outstanding_balance,last_visit_at";

    public async Task<PatientPage> ListAsync(ClinicContext clinic, string accessToken, PatientListRequest request, CancellationToken ct = default)
    {
        var pageSize = Math.Clamp(request.PageSize, 1, 100);
        var page = Math.Max(1, request.Page);

        var query = new PostgrestQuery()
            .Select(Columns)
            .Eq("clinic_id", clinic.ClinicId.ToString())
            .Order("last_name.asc,first_name.asc")
            .Limit(pageSize)
            .Offset((page - 1) * pageSize);

        if (PatientSearch.Sanitize(request.Search) is { } term)
            query.Or($"first_name.ilike.*{term}*", $"last_name.ilike.*{term}*", $"patient_number.ilike.*{term}*", $"phone.ilike.*{term}*");

        var result = await postgrest.SelectAsync("patients", query, accessToken, countRows: true, ct);
        var items = result.Rows.Select(Map).ToList();
        return new PatientPage(items, result.TotalCount ?? items.Count, page, pageSize);
    }

    internal static Patient Map(JsonElement row) => new(
        Id: Guid.Parse(ClinicService.GetString(row, "id") ?? throw new InvalidDataException("Patient row has no id.")),
        PatientNumber: ClinicService.GetString(row, "patient_number") ?? "",
        FirstName: ClinicService.GetString(row, "first_name") ?? "",
        LastName: ClinicService.GetString(row, "last_name") ?? "",
        Phone: ClinicService.GetString(row, "phone"),
        Email: ClinicService.GetString(row, "email"),
        DateOfBirth: DateOnly.TryParse(ClinicService.GetString(row, "date_of_birth"), CultureInfo.InvariantCulture, DateTimeStyles.None, out var birth) ? birth : null,
        Gender: ClinicService.GetString(row, "gender"),
        IsActive: ClinicService.GetString(row, "status") == "active",
        OutstandingBalance: row.TryGetProperty("outstanding_balance", out var balance) && balance.TryGetDecimal(out var amount) ? amount : 0m,
        LastVisitAt: DateTimeOffset.TryParse(
            ClinicService.GetString(row, "last_visit_at"),
            CultureInfo.InvariantCulture,
            DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal,
            out var lastVisit) ? lastVisit : null);
}

/// <summary>Removes characters that would change the structure of a PostgREST <c>or</c> filter or act as LIKE wildcards.</summary>
internal static class PatientSearch
{
    private const int MaxLength = 64;

    public static string? Sanitize(string? input)
    {
        if (string.IsNullOrWhiteSpace(input))
            return null;

        var cleaned = new string(input.Trim().Where(c => !",()\"\\*%_".Contains(c)).ToArray());
        if (cleaned.Length > MaxLength)
            cleaned = cleaned[..MaxLength];

        return cleaned.Length == 0 ? null : cleaned;
    }
}
