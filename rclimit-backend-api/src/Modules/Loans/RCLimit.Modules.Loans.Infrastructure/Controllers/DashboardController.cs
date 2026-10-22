using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RCLimit.BuildingBlocks.Contracts.Hateoas;
using RCLimit.BuildingBlocks.Infrastructure.Authorization;
using RCLimit.Modules.Loans.Application.Dashboard;

namespace RCLimit.Modules.Loans.Infrastructure.Controllers;

[ApiController]
[Route("api/v1/dashboard")]
[Authorize]
public class DashboardController : ControllerBase
{
    private readonly ISender _sender;

    public DashboardController(ISender sender)
    {
        _sender = sender;
    }

    [HttpGet("summary")]
    [HasRight("dashboard.loan_stats")]
    public async Task<IActionResult> GetSummary()
    {
        var result = await _sender.Send(new GetDashboardSummaryQuery());
        return Ok(new HateoasResponse<object>
        {
            Data = result,
            Links =
            [
                new("/api/v1/dashboard/summary", "self", "GET"),
                new("/api/v1/loans", "loans", "GET"),
                new("/api/v1/customers", "customers", "GET"),
            ]
        });
    }

    [HttpGet("rc-aging")]
    [HasRight("dashboard.rc_aging")]
    public async Task<IActionResult> GetRcAging()
    {
        var result = await _sender.Send(new GetRcAgingAlertsQuery());
        return Ok(new HateoasResponse<object>
        {
            Data = result,
            Links =
            [
                new("/api/v1/dashboard/rc-aging", "self", "GET"),
                new("/api/v1/loans", "loans", "GET"),
            ]
        });
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
