using System.Globalization;

namespace NargisClinic.Core.Formatting;

public static class ClinicMoney
{
    /// <summary>Formats an amount with its clinic currency code. Stored values keep full precision; only display rounds.</summary>
    public static string Format(decimal amount, string currency, CultureInfo culture) =>
        $"{amount.ToString("N0", culture)} {currency}";
}
