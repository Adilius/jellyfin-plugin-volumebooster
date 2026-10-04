using System;
using System.Net.Http;
using System.Text.Json;
using System.Threading.Tasks;
using Jellyfin.Plugin.VolumeBooster.Configuration;
using Jellyfin.Plugin.VolumeBooster.Injection;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace Jellyfin.Plugin.VolumeBooster.Tests;

public class ConfigurationTests
{
    [Fact]
    public void Defaults()
    {
        var c = new PluginConfiguration();
        Assert.True(c.Enabled);
        Assert.Equal(200, c.MaxPercent);
        Assert.Equal(5, c.StepPercent);
        Assert.Equal(150, c.WarnAbovePercent);
        Assert.Equal("+ ]", c.IncreaseKey);
        Assert.Equal("- [", c.DecreaseKey);
        Assert.Equal("* \\", c.ResetKey);
        Assert.False(c.ResetOnStart);
    }

    [Theory]
    [InlineData(500, 200)]
    [InlineData(50, 100)]
    [InlineData(175, 175)]
    public void MaxPercentIsClamped(int input, int expected)
    {
        var c = new PluginConfiguration { MaxPercent = input }.Normalized();
        Assert.Equal(expected, c.MaxPercent);
    }

    [Fact]
    public void InvalidValuesFallBackToDefaults()
    {
        var c = new PluginConfiguration { StepPercent = 0, WarnAbovePercent = 10, IncreaseKey = string.Empty }.Normalized();
        Assert.Equal(5, c.StepPercent);
        Assert.Equal(100, c.WarnAbovePercent);
        Assert.Equal("+ ]", c.IncreaseKey);
    }
}

public class ClientScriptTests
{
    [Fact]
    public void BundleIsEmbeddedAndNonEmpty()
    {
        var bundle = ClientScript.ReadBundle();
        Assert.Contains("_mpvVideoPlayer", bundle, StringComparison.Ordinal);
        Assert.True(bundle.Length > 1000);
    }

    [Fact]
    public void BuildPrefixesNormalizedConfig()
    {
        var script = ClientScript.Build(new PluginConfiguration { MaxPercent = 999, IncreaseKey = "</script>" }, "BUNDLE");
        Assert.StartsWith("window.VolumeBoosterConfig = {", script, StringComparison.Ordinal);
        Assert.EndsWith("\nBUNDLE", script, StringComparison.Ordinal);
        Assert.DoesNotContain("</script>", script, StringComparison.Ordinal);

        var json = script["window.VolumeBoosterConfig = ".Length..script.IndexOf(";\n", StringComparison.Ordinal)];
        using var doc = JsonDocument.Parse(json);
        Assert.Equal(200, doc.RootElement.GetProperty("maxPercent").GetInt32());
        Assert.Equal("</script>", doc.RootElement.GetProperty("increaseKey").GetString());
        Assert.Equal("* \\", doc.RootElement.GetProperty("resetKey").GetString());
        Assert.True(doc.RootElement.GetProperty("enabled").GetBoolean());
    }

    [Fact]
    public void VersionChangesWithTheSettings()
    {
        var a = ClientScript.Version(ClientScript.Build(new PluginConfiguration(), "BUNDLE"));
        var b = ClientScript.Version(ClientScript.Build(new PluginConfiguration { MaxPercent = 150 }, "BUNDLE"));
        Assert.Matches("^[0-9a-f]{12}$", a);
        Assert.NotEqual(a, b);
    }
}

public class IndexHtmlTests
{
    private const string Page = "<html><head></head><body><div id=\"app\"></div></body></html>";

    [Fact]
    public void InjectsScriptTagBeforeBodyClose()
    {
        var html = IndexHtml.Inject(Page, "abc123");
        Assert.Contains("<script defer src=\"../VolumeBooster/ClientScript?v=abc123\"></script>", html, StringComparison.Ordinal);
        Assert.True(html.IndexOf("ClientScript", StringComparison.Ordinal) < html.IndexOf("</body>", StringComparison.Ordinal));
        Assert.Contains(IndexHtml.Marker, html, StringComparison.Ordinal);
    }

    [Fact]
    public void IsIdempotent()
    {
        var once = IndexHtml.Inject(Page, "v1");
        Assert.Equal(once, IndexHtml.Inject(once, "v2"));
    }

    [Fact]
    public void LeavesPagesWithoutBodyAlone()
    {
        Assert.Equal("<html>no body</html>", IndexHtml.Inject("<html>no body</html>", "v"));
    }

    [Theory]
    [InlineData("/web/", true)]
    [InlineData("/web", true)]
    [InlineData("/web/index.html", true)]
    [InlineData("/jellyfin/web/", true)]
    [InlineData("/JELLYFIN/WEB/INDEX.HTML", true)]
    [InlineData("/web/main.bundle.js", false)]
    [InlineData("/Items", false)]
    [InlineData("", false)]
    [InlineData(null, false)]
    public void RecognisesTheWebAppShell(string? path, bool expected)
    {
        Assert.Equal(expected, IndexHtml.IsIndexRequest(path));
    }
}

public class ScriptInjectionMiddlewareTests
{
    private const string Page = "<html><head></head><body>app</body></html>";

    private static async Task<HttpResponseMessage> Get(PluginConfiguration? configuration, string path, string contentType = "text/html")
    {
        var filter = new ScriptInjectionStartupFilter(NullLogger<ScriptInjectionStartupFilter>.Instance, () => configuration);
        using var server = new TestServer(new WebHostBuilder().Configure(app =>
            filter.Configure(inner => inner.Run(async context =>
            {
                context.Response.ContentType = contentType;
                context.Response.Headers.ETag = "\"static-etag\"";
                await context.Response.WriteAsync(Page);
            }))(app)));
        using var client = server.CreateClient();
        return await client.GetAsync(new Uri(path, UriKind.Relative));
    }

    [Fact]
    public async Task AddsTheScriptToIndexHtml()
    {
        using var response = await Get(new PluginConfiguration(), "/web/index.html");
        var body = await response.Content.ReadAsStringAsync();
        Assert.Contains("../VolumeBooster/ClientScript?v=", body, StringComparison.Ordinal);
        Assert.Equal(body.Length, (int)response.Content.Headers.ContentLength!.Value);
        Assert.False(response.Headers.Contains("ETag"));
    }

    [Fact]
    public async Task LeavesOtherRequestsAlone()
    {
        using var response = await Get(new PluginConfiguration(), "/web/main.bundle.js");
        Assert.Equal(Page, await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task DoesNothingWhenDisabled()
    {
        using var response = await Get(new PluginConfiguration { Enabled = false }, "/web/");
        Assert.Equal(Page, await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task DoesNothingWhenThePluginIsNotLoaded()
    {
        using var response = await Get(null, "/web/");
        Assert.Equal(Page, await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task LeavesNonHtmlResponsesAlone()
    {
        using var response = await Get(new PluginConfiguration(), "/web/", "application/json");
        Assert.Equal(Page, await response.Content.ReadAsStringAsync());
    }
}
