using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RCLimit.BuildingBlocks.Contracts.Hateoas;
using RCLimit.Modules.Loans.Application.BankPools;

namespace RCLimit.Modules.Loans.Infrastructure.Controllers;

[ApiController]
[Route("api/v1/bank-pools")]
[Authorize]
public class BankPoolsController : ControllerBase
{
    private readonly ISender _sender;

    public BankPoolsController(ISender sender)
    {
        _sender = sender;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var result = await _sender.Send(new GetBankPoolsQuery());
        return Ok(new HateoasResponse<object>
        {
            Data = result,
            Links =
            [
                new("/api/v1/bank-pools", "self", "GET"),
                new("/api/v1/lenders", "lenders", "GET"),
            ]
        });
    }
}
