using System;
using MediaBrowser.Model.Plugins;

namespace Jellyfin.Plugin.VolumeBooster.Configuration;

/// <summary>
/// Plugin configuration.
/// </summary>
public class PluginConfiguration : BasePluginConfiguration
{
    /// <summary>
    /// The highest volume the plugin will ever allow, in percent.
    /// mpv's volume curve is cubic, so 200% is about +18 dB.
    /// </summary>
    public const int HardMaxPercent = 200;

    /// <summary>
    /// Initializes a new instance of the <see cref="PluginConfiguration"/> class.
    /// </summary>
    public PluginConfiguration()
    {
        Enabled = true;
        MaxPercent = 200;
        StepPercent = 5;
        WarnAbovePercent = 150;
        IncreaseKey = "+ ]";
        DecreaseKey = "- [";
        ResetKey = "* \\";
        ResetOnStart = false;
    }

    /// <summary>
    /// Gets or sets a value indicating whether the client script is active.
    /// </summary>
    public bool Enabled { get; set; }

    /// <summary>
    /// Gets or sets the maximum volume in percent (100 to <see cref="HardMaxPercent"/>).
    /// </summary>
    public int MaxPercent { get; set; }

    /// <summary>
    /// Gets or sets the volume step in percent (1 to 25).
    /// </summary>
    public int StepPercent { get; set; }

    /// <summary>
    /// Gets or sets the level from which the on-screen indicator turns red (name kept for saved configs).
    /// </summary>
    public int WarnAbovePercent { get; set; }

    /// <summary>
    /// Gets or sets the extra key that raises the volume.
    /// </summary>
    public string IncreaseKey { get; set; }

    /// <summary>
    /// Gets or sets the extra key that lowers the volume.
    /// </summary>
    public string DecreaseKey { get; set; }

    /// <summary>
    /// Gets or sets the extra key that resets the volume to 100%.
    /// </summary>
    public string ResetKey { get; set; }

    /// <summary>
    /// Gets or sets a value indicating whether a boosted level is reset to 100% when the client starts.
    /// </summary>
    public bool ResetOnStart { get; set; }

    /// <summary>
    /// Returns a copy with every value forced into its valid range.
    /// </summary>
    /// <returns>The normalized configuration.</returns>
    public PluginConfiguration Normalized()
    {
        var defaults = new PluginConfiguration();
        return new PluginConfiguration
        {
            Enabled = Enabled,
            MaxPercent = Math.Clamp(MaxPercent, 100, HardMaxPercent),
            StepPercent = StepPercent is >= 1 and <= 25 ? StepPercent : defaults.StepPercent,
            WarnAbovePercent = Math.Max(WarnAbovePercent, 100),
            IncreaseKey = string.IsNullOrEmpty(IncreaseKey) ? defaults.IncreaseKey : IncreaseKey,
            DecreaseKey = string.IsNullOrEmpty(DecreaseKey) ? defaults.DecreaseKey : DecreaseKey,
            ResetKey = string.IsNullOrEmpty(ResetKey) ? defaults.ResetKey : ResetKey,
            ResetOnStart = ResetOnStart,
        };
    }
}
