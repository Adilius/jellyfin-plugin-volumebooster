using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace Jellyfin.Plugin.VolumeBooster.Api;

/// <summary>
/// Serves the client script referenced from index.html.
/// </summary>
[ApiController]
[Route("VolumeBooster")]
public class ClientScriptController : ControllerBase
{
    /// <summary>
    /// Gets the client script with the current settings.
    /// </summary>
    /// <response code="200">The script.</response>
    /// <response code="404">The plugin is not loaded.</response>
    /// <returns>JavaScript.</returns>
    [HttpGet("ClientScript")]
    [AllowAnonymous]
    [Produces("application/javascript")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public ActionResult GetClientScript()
    {
        var configuration = Plugin.Instance?.Configuration;
        if (configuration is null)
        {
            return NotFound();
        }

        // index.html links the script with a content hash (?v=), so the URL
        // changes whenever the script does; a short cache is enough.
        Response.Headers.CacheControl = "public, max-age=300";
        return Content(ClientScript.Build(configuration, ClientScript.Bundle), "application/javascript; charset=utf-8");
    }
}
