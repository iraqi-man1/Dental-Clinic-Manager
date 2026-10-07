namespace NargisClinic.Core.Clinic;

/// <summary>The clinic and role the signed-in user is acting for. Loaded once per sign-in.</summary>
public sealed record ClinicContext(
    Guid ClinicId,
    string ClinicName,
    string Currency,
    string TimeZoneId,
    ClinicRole Role,
    string StaffName)
{
    public IReadOnlyList<AppSection> Sections => ClinicPermissions.SectionsFor(Role);

    public bool Can(AppSection section) => Sections.Contains(section);
}
