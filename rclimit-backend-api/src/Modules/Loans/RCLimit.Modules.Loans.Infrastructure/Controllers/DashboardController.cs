using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RCLimit.BuildingBlocks.Contracts.Hateoas;
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

    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var result = await _sender.Send(new GetDashboardQuery());
        return Ok(new HateoasResponse<object>
        {
            Data = result,
            Links =
            [
                new("/api/v1/dashboard", "self", "GET"),
                new("/api/v1/loans", "loans", "GET"),
                new("/api/v1/customers", "customers", "GET"),
                new("/api/v1/lenders", "lenders", "GET"),
                new("/api/v1/accounting/balance-sheet", "balance-sheet", "GET"),
            ]
        });
    }
}
