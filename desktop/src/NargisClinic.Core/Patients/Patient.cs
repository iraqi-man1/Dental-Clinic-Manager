namespace NargisClinic.Core.Patients;

/// <summary>A patient as the desktop shows it. Balances are read from the database, never computed locally.</summary>
public sealed record Patient(
    Guid Id,
    string PatientNumber,
    string FirstName,
    string LastName,
    string? Phone,
    string? Email,
    DateOnly? DateOfBirth,
    string? Gender,
    bool IsActive,
    decimal OutstandingBalance,
    DateTimeOffset? LastVisitAt)
{
    public string FullName => string.Join(' ', new[] { FirstName, LastName }.Where(part => !string.IsNullOrWhiteSpace(part)));

    public int? AgeOn(DateOnly today) => DateOfBirth is { } birth ? AgeInYears(birth, today) : null;

    public static int AgeInYears(DateOnly birth, DateOnly today)
    {
        var age = today.Year - birth.Year;
        if (birth.AddYears(age) > today)
            age--;

        return Math.Max(0, age);
    }
}
