namespace NargisClinic.Core.Data;

/// <summary>
/// Builds a PostgREST query string. Every value is percent-encoded once, so user input cannot
/// change the structure of a filter. Column names are fixed by the caller, never taken from users.
/// </summary>
public sealed class PostgrestQuery
{
    private readonly List<string> _parts = [];

    public PostgrestQuery Select(string columns) => Add("select", columns);

    public PostgrestQuery Eq(string column, string value) => Add(column, "eq." + value);

    /// <summary>Adds an OR group. Each condition is a raw PostgREST expression such as <c>name.ilike.*term*</c>.</summary>
    public PostgrestQuery Or(params string[] conditions) => Add("or", "(" + string.Join(',', conditions) + ")");

    public PostgrestQuery Order(string ordering) => Add("order", ordering);

    public PostgrestQuery Limit(int count) => Add("limit", count.ToString(System.Globalization.CultureInfo.InvariantCulture));

    public PostgrestQuery Offset(int count) => Add("offset", count.ToString(System.Globalization.CultureInfo.InvariantCulture));

    public override string ToString() => string.Join('&', _parts);

    private PostgrestQuery Add(string key, string value)
    {
        _parts.Add($"{Uri.EscapeDataString(key)}={Uri.EscapeDataString(value)}");
        return this;
    }
}
