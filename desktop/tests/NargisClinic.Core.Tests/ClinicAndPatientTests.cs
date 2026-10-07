using System.Net;
using NargisClinic.Core.Auth;
using NargisClinic.Core.Clinic;
using NargisClinic.Core.Configuration;
using NargisClinic.Core.Data;
using NargisClinic.Core.Formatting;
using NargisClinic.Core.Patients;

namespace NargisClinic.Core.Tests;

public class ClinicAndPatientTests
{
    private static readonly SupabaseSettings Settings = new(new Uri("https://example.supabase.co"), "sb_publishable_test");
    private static readonly Guid ClinicId = Guid.Parse("20000000-0000-0000-0000-000000000001");

    private static PostgrestClient Client(FakeHttpHandler handler) => new(new HttpClient(handler), Settings);

    [Fact]
    public async Task LoadsActiveMembershipWithEmbeddedClinic()
    {
        var body = System.Text.Json.JsonSerializer.Serialize(new[]
        {
            new
            {
                clinic_id = ClinicId,
                role = "front_desk",
                full_name = "Sara",
                clinics = new { name = "Nargis", currency = "IQD", timezone = "Asia/Baghdad" },
            },
        });
        var handler = new FakeHttpHandler(_ => FakeHttpHandler.Json(HttpStatusCode.OK, body));

        var context = await new ClinicService(Client(handler)).LoadActiveContextAsync("u1", "token");

        Assert.NotNull(context);
        Assert.Equal(ClinicId, context.ClinicId);
        Assert.Equal("Nargis", context.ClinicName);
        Assert.Equal("IQD", context.Currency);
        Assert.Equal(ClinicRole.FrontDesk, context.Role);
        Assert.True(context.Can(AppSection.Payments));
        Assert.False(context.Can(AppSection.Staff));

        var request = handler.Requests.Single();
        Assert.Contains("user_id=eq.u1", request.Uri.Query);
        Assert.Contains("status=eq.active", request.Uri.Query);
        Assert.Equal("Bearer token", request.Headers["Authorization"]);
    }

    [Fact]
    public async Task ReturnsNullWhenUserHasNoActiveMembership()
    {
        var handler = new FakeHttpHandler(_ => FakeHttpHandler.Json(HttpStatusCode.OK, "[]"));

        var context = await new ClinicService(Client(handler)).LoadActiveContextAsync("u1", "token");

        Assert.Null(context);
    }

    [Theory]
    [InlineData("owner", AppSection.Settings, true)]
    [InlineData("admin", AppSection.Staff, true)]
    [InlineData("dentist", AppSection.Payments, false)]
    [InlineData("viewer", AppSection.Appointments, false)]
    public void RolesSeeOnlyTheirSections(string role, AppSection section, bool expected)
    {
        var context = new ClinicContext(ClinicId, "Nargis", "IQD", ClinicTime.DefaultTimeZoneId, ClinicPermissions.ParseRole(role), "x");

        Assert.Equal(expected, context.Can(section));
    }

    [Fact]
    public void UnknownRoleFailsClosed()
    {
        Assert.Equal(ClinicRole.Unknown, ClinicPermissions.ParseRole("super_admin"));
        Assert.Empty(ClinicPermissions.SectionsFor(ClinicRole.Unknown));
    }

    [Fact]
    public async Task ListsPatientsWithSanitizedSearchAndExactCount()
    {
        var body = """
        [{"id":"30000000-0000-0000-0000-000000000001","patient_number":"PT-1","first_name":"Ali","last_name":"Hassan",
          "phone":"+9647701234567","email":null,"date_of_birth":"1990-02-28","gender":"Male","status":"active",
          "outstanding_balance":12500.50,"last_visit_at":"2026-09-01T09:30:00+00:00"}]
        """;
        var handler = new FakeHttpHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(body, System.Text.Encoding.UTF8, "application/json")
            {
                Headers = { ContentRange = new System.Net.Http.Headers.ContentRangeHeaderValue(0, 0, 42) },
            },
        });
        var clinic = new ClinicContext(ClinicId, "Nargis", "IQD", ClinicTime.DefaultTimeZoneId, ClinicRole.Owner, "x");

        var page = await new PatientService(Client(handler)).ListAsync(clinic, "token", new PatientListRequest("Al,i(*)", Page: 2, PageSize: 10));

        Assert.Equal(42, page.TotalCount);
        Assert.Equal(5, page.PageCount);
        var patient = Assert.Single(page.Items);
        Assert.Equal("Ali Hassan", patient.FullName);
        Assert.Equal(12500.50m, patient.OutstandingBalance);
        Assert.Equal(new DateOnly(1990, 2, 28), patient.DateOfBirth);

        var request = handler.Requests.Single();
        Assert.Contains($"clinic_id=eq.{ClinicId}", request.Uri.Query);
        Assert.Contains("limit=10", request.Uri.Query);
        Assert.Contains("offset=10", request.Uri.Query);
        Assert.Equal("count=exact", request.Headers["Prefer"]);
        // Commas, parentheses and wildcards from user input are removed before they reach the filter.
        Assert.Contains("first_name.ilike.%2AAli%2A", request.Uri.Query, StringComparison.Ordinal);
        Assert.DoesNotContain("Al%2Ci", request.Uri.Query, StringComparison.Ordinal);
        Assert.DoesNotContain("%28%2A", request.Uri.Query, StringComparison.Ordinal);
    }

    [Fact]
    public void AgeRespectsBirthdaysLaterInTheYear()
    {
        var birth = new DateOnly(1990, 12, 31);

        Assert.Equal(35, Patient.AgeInYears(birth, new DateOnly(2026, 10, 7)));
        Assert.Equal(36, Patient.AgeInYears(birth, new DateOnly(2027, 1, 1)));
    }

    [Fact]
    public void UnknownTimeZoneFallsBackToBaghdad()
    {
        var zone = ClinicTime.Resolve("Not/AZone");

        Assert.Equal(ClinicTime.DefaultTimeZoneId, zone.Id);
    }

    [Fact]
    public void ConvertsUtcInstantToClinicLocalTime()
    {
        var zone = ClinicTime.Resolve("Asia/Baghdad");
        var instant = new DateTimeOffset(2026, 10, 7, 21, 30, 0, TimeSpan.Zero);

        Assert.Equal(new DateTime(2026, 10, 8, 0, 30, 0), ClinicTime.ToClinicLocal(instant, zone));
    }

    [Fact]
    public void FormatsMoneyWithCurrencyCode()
    {
        var culture = System.Globalization.CultureInfo.InvariantCulture;

        Assert.Equal("12,501 IQD", ClinicMoney.Format(12500.50m, "IQD", culture));
    }

    [Theory]
    [InlineData("https://example.supabase.co", true)]
    [InlineData("http://127.0.0.1:54321", true)]
    [InlineData("http://example.supabase.co", false)]
    [InlineData("not a url", false)]
    public void OnlyAcceptsSecureOrLoopbackProjectUrls(string url, bool accepted)
    {
        Assert.Equal(accepted, SupabaseSettings.TryCreate(url, "key", out _));
    }
}
