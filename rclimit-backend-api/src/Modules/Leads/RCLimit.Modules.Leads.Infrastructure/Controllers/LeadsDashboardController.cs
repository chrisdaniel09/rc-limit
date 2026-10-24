using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RCLimit.BuildingBlocks.Contracts.Hateoas;
using RCLimit.BuildingBlocks.Infrastructure.Authorization;
using RCLimit.Modules.Leads.Application.Dashboard;

namespace RCLimit.Modules.Leads.Infrastructure.Controllers;

[ApiController]
[Route("api/v1/dashboard")]
[Authorize]
public class LeadsDashboardController : ControllerBase
{
    private readonly ISender _sender;

    public LeadsDashboardController(ISender sender)
    {
        _sender = sender;
    }

    [HttpGet("me")]
    [HasRight("dashboard.my_leads")]
    public async Task<IActionResult> GetMine()
    {
        var result = await _sender.Send(new GetMyDashboardQuery());
        return Ok(new HateoasResponse<object>
        {
            Data = result,
            Links =
            [
                new("/api/v1/dashboard/me", "self", "GET"),
                new("/api/v1/leads?assignedToMe=true", "my-leads", "GET"),
            ]
        });
    }
}
