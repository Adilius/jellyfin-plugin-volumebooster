# Volume Booster

![Volume Booster](logo.jpg)

Play louder than 100%, up to 200%, in Jellyfin.


## Install

1. Dashboard → Plugins → Repositories → **+**, and add
   `https://raw.githubusercontent.com/Adilius/jellyfin-plugin-volumebooster/main/manifest.json`
2. Catalog → install **Volume Booster** → restart the server.
3. Reload the desktop client (Ctrl+R) or restart it.
4. Optional: change settings under Dashboard → Plugins → Volume Booster (max %, step, keys,
   reset-on-start).


### Using it

- During playback, use the Up/Down arrows to boost the volume up to 200% or back down.
- An on-screen indicator shows `Volume 150% (+10.6 dB)` and turns red from 150% (configurable).
- Works in Jellyfin Media Player and Jellyfin Desktop. Web browsers can't play above 100%, so the plugin does nothing there.


## Development

Prerequisites: Node 22, .NET SDK 10, ASP.NET Core runtime 9

```
cd web
npm ci
npm run build    # builds the client script into the plugin
npm test         # JS unit tests
cd ..
dotnet test Jellyfin.Plugin.VolumeBooster.slnx
```

`dev/dev.ps1` builds the plugin and runs it in a local Jellyfin Docker container
(http://localhost:8096). See `docs/troubleshooting.md` for debugging the desktop client.


## License

GPL-3.0
