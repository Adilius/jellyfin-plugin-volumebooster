using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Jellyfin.Plugin.VolumeBooster.Configuration;

namespace Jellyfin.Plugin.VolumeBooster;

/// <summary>
/// Builds the client script: the embedded bundle prefixed with the configuration.
/// </summary>
public static class ClientScript
{
    /// <summary>
    /// Manifest name of the embedded bundle built from web/.
    /// </summary>
    public const string ResourceName = "Jellyfin.Plugin.VolumeBooster.Web.volumebooster.js";

    private static readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    private static readonly Lazy<string> _bundle = new(ReadBundle);

    /// <summary>
    /// Gets the embedded bundle (read once).
    /// </summary>
    public static string Bundle => _bundle.Value;

    /// <summary>
    /// Reads the embedded bundle.
    /// </summary>
    /// <returns>The bundle source.</returns>
    /// <exception cref="InvalidOperationException">The resource is missing.</exception>
    public static string ReadBundle()
    {
        using Stream stream = typeof(ClientScript).Assembly.GetManifestResourceStream(ResourceName)
            ?? throw new InvalidOperationException($"Embedded resource {ResourceName} not found. Run `npm --prefix web run build`.");
        using var reader = new StreamReader(stream, Encoding.UTF8);
        return reader.ReadToEnd();
    }

    /// <summary>
    /// Short content hash, used as a cache-busting query string so clients
    /// fetch the script again after an update or a settings change.
    /// </summary>
    /// <param name="script">The built script.</param>
    /// <returns>12 hex characters.</returns>
    public static string Version(string script)
    {
        ArgumentNullException.ThrowIfNull(script);
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(script));
        return Convert.ToHexString(hash, 0, 6).ToLowerInvariant();
    }

    /// <summary>
    /// Builds the script to inject.
    /// </summary>
    /// <param name="configuration">The plugin configuration.</param>
    /// <param name="bundle">The bundle source.</param>
    /// <returns>The script.</returns>
    public static string Build(PluginConfiguration configuration, string bundle)
    {
        ArgumentNullException.ThrowIfNull(configuration);
        var c = configuration.Normalized();
        var clientConfig = new
        {
            c.Enabled,
            c.MaxPercent,
            c.StepPercent,
            c.WarnAbovePercent,
            c.IncreaseKey,
            c.DecreaseKey,
            c.ResetKey,
            c.ResetOnStart,
        };

        // The default encoder escapes <, > and & so the JSON is safe inside a <script>.
        var json = JsonSerializer.Serialize(clientConfig, _jsonOptions);
        return $"window.VolumeBoosterConfig = {json};\n{bundle}";
    }
}
