using System.Globalization;
using System.Windows;
using System.Windows.Data;

namespace NargisClinic.Desktop.Converters;

/// <summary>Shows the element when the bound value is non-empty text or any non-null object.</summary>
public sealed class NullToVisibilityConverter : IValueConverter
{
    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
    {
        var hasValue = value switch
        {
            null => false,
            string text => text.Length > 0,
            _ => true,
        };

        return hasValue ? Visibility.Visible : Visibility.Collapsed;
    }

    public object ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture) =>
        throw new NotSupportedException();
}
