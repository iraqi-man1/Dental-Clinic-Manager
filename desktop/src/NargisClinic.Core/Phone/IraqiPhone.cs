using System.Text.RegularExpressions;

namespace NargisClinic.Core.Phone;

/// <summary>Normalizes Iraqi mobile numbers to +9647XXXXXXXXX. Mirrors the web app's rules in src/lib/utils.ts.</summary>
public static partial class IraqiPhone
{
    public const string ValidationMessage = "Enter a valid Iraqi mobile number (07XXXXXXXXX or +9647XXXXXXXXX).";

    public static string? Normalize(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return null;

        var compact = SeparatorsPattern().Replace(LatinizeDigits(value.Trim()), string.Empty);
        var international = compact.StartsWith("00964", StringComparison.Ordinal) ? "+" + compact[2..] : compact;

        if (LocalMobilePattern().IsMatch(international))
            return "+964" + international[1..];

        return InternationalMobilePattern().IsMatch(international) ? international : null;
    }

    private static string LatinizeDigits(string value)
    {
        var chars = value.ToCharArray();
        for (var i = 0; i < chars.Length; i++)
        {
            var c = chars[i];
            if (c is >= '٠' and <= '٩')
                chars[i] = (char)('0' + (c - '٠'));
            else if (c is >= '۰' and <= '۹')
                chars[i] = (char)('0' + (c - '۰'));
        }

        return new string(chars);
    }

    [GeneratedRegex(@"[\s().\-]")]
    private static partial Regex SeparatorsPattern();

    [GeneratedRegex("^07[0-9]{9}$")]
    private static partial Regex LocalMobilePattern();

    [GeneratedRegex(@"^\+9647[0-9]{9}$")]
    private static partial Regex InternationalMobilePattern();
}
