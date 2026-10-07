namespace NargisClinic.Core.Clinic;

/// <summary>Roles as stored in the database enum <c>public.clinic_role</c>. Unknown values fail closed.</summary>
public enum ClinicRole
{
    Unknown,
    Owner,
    Admin,
    Dentist,
    Hygienist,
    Assistant,
    FrontDesk,
    Billing,
    Viewer,
}

public enum AppSection
{
    Patients,
    Appointments,
    Payments,
    Staff,
    Inventory,
    Reports,
    Settings,
}

public static class ClinicPermissions
{
    /// <summary>
    /// Which screens a role sees. This only shapes the UI. Row-level security in PostgreSQL is the authority,
    /// so a hidden screen is never the only protection.
    /// </summary>
    public static IReadOnlyList<AppSection> SectionsFor(ClinicRole role) => role switch
    {
        ClinicRole.Owner or ClinicRole.Admin =>
            [AppSection.Patients, AppSection.Appointments, AppSection.Payments, AppSection.Staff, AppSection.Inventory, AppSection.Reports, AppSection.Settings],
        ClinicRole.Dentist or ClinicRole.Hygienist =>
            [AppSection.Patients, AppSection.Appointments],
        ClinicRole.Assistant or ClinicRole.FrontDesk or ClinicRole.Billing =>
            [AppSection.Patients, AppSection.Appointments, AppSection.Payments],
        ClinicRole.Viewer =>
            [AppSection.Patients],
        _ => [],
    };

    public static ClinicRole ParseRole(string? value) => value switch
    {
        "owner" => ClinicRole.Owner,
        "admin" => ClinicRole.Admin,
        "dentist" => ClinicRole.Dentist,
        "hygienist" => ClinicRole.Hygienist,
        "assistant" => ClinicRole.Assistant,
        "front_desk" => ClinicRole.FrontDesk,
        "billing" => ClinicRole.Billing,
        "viewer" => ClinicRole.Viewer,
        _ => ClinicRole.Unknown,
    };
}
