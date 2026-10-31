using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.BuildingBlocks.Contracts.Hateoas;
using RCLimit.Modules.System.Application.Theme;

namespace RCLimit.Modules.System.Infrastructure.Controllers;

/// <summary>
/// What the UI needs about the current tenant (docs/ui_ux_specification.md §3.5, §6.4).
/// The tenant is the one the request host resolved to (TenantMiddleware).
/// </summary>
[ApiController]
[Route("api/v1/tenant")]
public class TenantUiController(ISender sender, ITenantContext tenant) : ControllerBase
{
    // Anonymous so the login page can be branded. Holds no secrets: brand, colors, terminology, support contact.
    [HttpGet("theme")]
    [AllowAnonymous]
    [ResponseCache(Duration = 60, Location = ResponseCacheLocation.Any, VaryByHeader = "Host,X-Forwarded-Host,Origin")]
    public async Task<IActionResult> GetTheme(CancellationToken cancellationToken)
    {
        var theme = await sender.Send(new GetTenantThemeQuery(tenant.TenantId), cancellationToken);
        return Ok(theme);
    }

    [HttpGet("settings")]
    [Authorize]
    public async Task<IActionResult> GetSettings(CancellationToken cancellationToken)
    {
        var settings = await sender.Send(new GetTenantUiSettingsQuery(tenant.TenantId), cancellationToken);
        return Ok(new HateoasResponse<TenantUiSettingsDto>
        {
            Data = settings,
            Links = [new("/api/v1/tenant/settings", "self", "GET")],
        });
    }
}
