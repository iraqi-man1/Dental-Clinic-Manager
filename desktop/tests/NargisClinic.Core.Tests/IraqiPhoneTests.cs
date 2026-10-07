using NargisClinic.Core.Phone;

namespace NargisClinic.Core.Tests;

public class IraqiPhoneTests
{
    [Theory]
    [InlineData("07701234567", "+9647701234567")]
    [InlineData("+964 770 123 4567", "+9647701234567")]
    [InlineData("00964-770-123-4567", "+9647701234567")]
    [InlineData("(0770) 123.4567", "+9647701234567")]
    [InlineData("٠٧٧٠١٢٣٤٥٦٧", "+9647701234567")]
    [InlineData("۰۷۷۰۱۲۳۴۵۶۷", "+9647701234567")]
    public void NormalizesSupportedFormats(string input, string expected)
    {
        Assert.Equal(expected, IraqiPhone.Normalize(input));
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("0770")]
    [InlineData("+9641234567")]
    [InlineData("+1 (415) 555-0138")]
    [InlineData("077012345678")]
    public void RejectsInvalidNumbers(string input)
    {
        Assert.Null(IraqiPhone.Normalize(input));
    }

    [Fact]
    public void ReturnsNullForMissingValue()
    {
        Assert.Null(IraqiPhone.Normalize(null));
    }
}
