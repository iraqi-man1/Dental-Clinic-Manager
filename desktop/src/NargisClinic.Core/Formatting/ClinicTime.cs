namespace NargisClinic.Core.Formatting;

/// <summary>Clinic-local time handling. Instants are stored in UTC and converted only when displayed.</summary>
public static class ClinicTime
{
    public const string DefaultTimeZoneId = "Asia/Baghdad";

    public static TimeZoneInfo Resolve(string? timeZoneId)
    {
        if (!string.IsNullOrWhiteSpace(timeZoneId) && TimeZoneInfo.TryFindSystemTimeZoneById(timeZoneId, out var zone))
            return zone;

        return TimeZoneInfo.TryFindSystemTimeZoneById(DefaultTimeZoneId, out var fallback) ? fallback : TimeZoneInfo.Utc;
    }

    public static DateTime ToClinicLocal(DateTimeOffset instant, TimeZoneInfo zone) =>
        TimeZoneInfo.ConvertTime(instant, zone).DateTime;
}
