using System.Text.Json;
using NargisClinic.Core.Data;
using NargisClinic.Core.Formatting;

namespace NargisClinic.Core.Clinic;

public sealed class ClinicService(PostgrestClient postgrest)
{
    /// <summary>Returns the user's active clinic membership, or null when the account is not linked to an active clinic.</summary>
    public async Task<ClinicContext?> LoadActiveContextAsync(string userId, string accessToken, CancellationToken ct = default)
    {
        var query = new PostgrestQuery()
            .Select("clinic_id,role,full_name,clinics(name,currency,timezone)")
            .Eq("user_id", userId)
            .Eq("status", "active")
            .Limit(1);

        var page = await postgrest.SelectAsync("clinic_members", query, accessToken, ct: ct);
        return page.Rows.Count == 0 ? null : Map(page.Rows[0]);
    }

    internal static ClinicContext Map(JsonElement row)
    {
        var clinic = FirstObject(row, "clinics");

        return new ClinicContext(
            ClinicId: Guid.Parse(GetString(row, "clinic_id") ?? throw new InvalidDataException("Membership has no clinic.")),
            ClinicName: GetString(clinic, "name") ?? "",
            Currency: GetString(clinic, "currency") ?? "USD",
            TimeZoneId: GetString(clinic, "timezone") ?? ClinicTime.DefaultTimeZoneId,
            Role: ClinicPermissions.ParseRole(GetString(row, "role")),
            StaffName: GetString(row, "full_name") ?? "");
    }

    /// <summary>PostgREST returns a many-to-one embed as an object, but tolerate a one-element array too.</summary>
    private static JsonElement FirstObject(JsonElement row, string name)
    {
        if (!row.TryGetProperty(name, out var value))
            return default;

        if (value.ValueKind == JsonValueKind.Array)
            return value.GetArrayLength() > 0 ? value[0] : default;

        return value;
    }

    internal static string? GetString(JsonElement element, string name) =>
        element.ValueKind == JsonValueKind.Object
        && element.TryGetProperty(name, out var value)
        && value.ValueKind == JsonValueKind.String
            ? value.GetString()
            : null;
}
