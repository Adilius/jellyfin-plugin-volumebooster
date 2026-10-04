using System;
using System.IO;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Jellyfin.Plugin.VolumeBooster.Configuration;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.VolumeBooster.Injection;

/// <summary>
/// Adds the client script tag to jellyfin-web's index.html as it is served.
/// Nothing on disk is modified. On any problem the original page is served.
/// </summary>
public class ScriptInjectionStartupFilter : IStartupFilter
{
    private readonly ILogger<ScriptInjectionStartupFilter> _logger;
    private readonly Func<PluginConfiguration?> _getConfiguration;
    private int _loggedOnce;

    /// <summary>
    /// Initializes a new instance of the <see cref="ScriptInjectionStartupFilter"/> class.
    /// </summary>
    /// <param name="logger">The logger.</param>
    public ScriptInjectionStartupFilter(ILogger<ScriptInjectionStartupFilter> logger)
        : this(logger, () => Plugin.Instance?.Configuration)
    {
    }

    /// <summary>
    /// Initializes a new instance of the <see cref="ScriptInjectionStartupFilter"/> class.
    /// </summary>
    /// <param name="logger">The logger.</param>
    /// <param name="getConfiguration">Returns the current plugin configuration.</param>
    public ScriptInjectionStartupFilter(ILogger<ScriptInjectionStartupFilter> logger, Func<PluginConfiguration?> getConfiguration)
    {
        _logger = logger;
        _getConfiguration = getConfiguration;
    }

    /// <inheritdoc />
    public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next)
    {
        // Added before the rest of the pipeline, so it wraps the static file handler.
        return app =>
        {
            app.Use(InvokeAsync);
            next(app);
        };
    }

    private async Task InvokeAsync(HttpContext context, Func<Task> next)
    {
        var configuration = _getConfiguration();
        if (!HttpMethods.IsGet(context.Request.Method)
            || !IndexHtml.IsIndexRequest(context.Request.Path.Value)
            || configuration is null
            || !configuration.Enabled)
        {
            await next().ConfigureAwait(false);
            return;
        }

        // Ask for a complete, uncompressed 200 that can be rewritten.
        context.Request.Headers.Remove("Accept-Encoding");
        context.Request.Headers.Remove("Range");
        context.Request.Headers.Remove("If-Range");
        context.Request.Headers.Remove("If-None-Match");
        context.Request.Headers.Remove("If-Modified-Since");

        var originalBody = context.Response.Body;
        using var buffer = new MemoryStream();
        context.Response.Body = buffer;
        try
        {
            await next().ConfigureAwait(false);
        }
        finally
        {
            context.Response.Body = originalBody;
        }

        buffer.Seek(0, SeekOrigin.Begin);
        var isHtml = context.Response.StatusCode == StatusCodes.Status200OK
            && (context.Response.ContentType?.Contains("text/html", StringComparison.OrdinalIgnoreCase) ?? false);
        if (!isHtml)
        {
            await buffer.CopyToAsync(originalBody).ConfigureAwait(false);
            return;
        }

        string html;
        using (var reader = new StreamReader(buffer, Encoding.UTF8, true, 4096, leaveOpen: true))
        {
            html = await reader.ReadToEndAsync().ConfigureAwait(false);
        }

        try
        {
            var script = ClientScript.Build(configuration, ClientScript.Bundle);
            html = IndexHtml.Inject(html, ClientScript.Version(script));
            if (Interlocked.Exchange(ref _loggedOnce, 1) == 0)
            {
                _logger.LogInformation("Volume Booster: client script added to the web client");
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Volume Booster: could not add the client script; serving the original page");
        }

        var bytes = Encoding.UTF8.GetBytes(html);
        context.Response.ContentType = "text/html; charset=utf-8";
        context.Response.ContentLength = bytes.Length;
        // The body changed: drop validators from the static file handler, and
        // make clients re-fetch so settings changes reach them.
        context.Response.Headers.Remove("ETag");
        context.Response.Headers.Remove("Last-Modified");
        context.Response.Headers.Remove("Accept-Ranges");
        context.Response.Headers.CacheControl = "no-cache";
        await originalBody.WriteAsync(bytes).ConfigureAwait(false);
    }
}
