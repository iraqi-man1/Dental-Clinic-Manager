using NargisClinic.Core.Data;

namespace NargisClinic.Core.Tests;

public class PostgrestQueryTests
{
    [Fact]
    public void EncodesValuesSoTheyCannotChangeTheFilterStructure()
    {
        var query = new PostgrestQuery().Eq("user_id", "a&b=c");

        Assert.Equal("user_id=eq.a%26b%3Dc", query.ToString());
    }

    [Fact]
    public void BuildsOrGroupWithEncodedDelimiters()
    {
        var query = new PostgrestQuery().Or("first_name.ilike.*ali*", "phone.ilike.*077*");

        Assert.Equal("or=%28first_name.ilike.%2Aali%2A%2Cphone.ilike.%2A077%2A%29", query.ToString());
    }

    [Fact]
    public void JoinsClausesInOrder()
    {
        var query = new PostgrestQuery().Select("id,name").Eq("status", "active").Limit(5).Offset(10);

        Assert.Equal("select=id%2Cname&status=eq.active&limit=5&offset=10", query.ToString());
    }
}
