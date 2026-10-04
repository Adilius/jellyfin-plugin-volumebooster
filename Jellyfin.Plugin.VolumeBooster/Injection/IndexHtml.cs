using System;

namespace Jellyfin.Plugin.VolumeBooster.Injection;

/// <summary>
/// Adds the client script tag to jellyfin-web's index.html.
/// </summary>
public static class IndexHtml
{
    /// <summary>
    /// Marker that makes the injection idempotent.
    /// </summary>
    public const string Marker = "<!-- Volume Booster -->";

    /// <summary>
    /// Path of the script endpoint, relative to the web app (index.html lives under /web/).
    /// </summary>
    public const string ScriptPath = "../VolumeBooster/ClientScript";

    /// <summary>
    /// Returns <paramref name="html"/> with the script tag inserted before &lt;/body&gt;,
    /// or unchanged if it is already there or there is no &lt;/body&gt;.
    /// </summary>
    /// <param name="html">The index.html source.</param>
    /// <param name="version">Cache-busting version of the script.</param>
    /// <returns>The rewritten HTML.</returns>
    public static string Inject(string html, string version)
    {
        ArgumentNullException.ThrowIfNull(html);
        if (html.Contains(Marker, StringComparison.Ordinal))
        {
            return html;
        }

        var bodyClose = html.LastIndexOf("</body>", StringComparison.OrdinalIgnoreCase);
        if (bodyClose < 0)
        {
            return html;
        }

        var tag = $"{Marker}<script defer src=\"{ScriptPath}?v={Uri.EscapeDataString(version)}\"></script>\n";
        return html.Insert(bodyClose, tag);
    }

    /// <summary>
    /// Whether a request path is the web app shell: "/web", "/web/" or "/web/index.html",
    /// also under a base-url prefix such as "/jellyfin/web/".
    /// </summary>
    /// <param name="path">The request path.</param>
    /// <returns><c>true</c> for the web app shell.</returns>
    public static bool IsIndexRequest(string? path)
    {
        if (string.IsNullOrEmpty(path))
        {
            return false;
        }

        return path.EndsWith("/web/index.html", StringComparison.OrdinalIgnoreCase)
            || path.EndsWith("/web/", StringComparison.OrdinalIgnoreCase)
            || path.EndsWith("/web", StringComparison.OrdinalIgnoreCase);
    }
}
