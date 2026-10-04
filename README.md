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


## Development

Prerequisites: Node 22, .NET SDK 10, ASP.NET Core runtime 9


## License

GPL-3.0
