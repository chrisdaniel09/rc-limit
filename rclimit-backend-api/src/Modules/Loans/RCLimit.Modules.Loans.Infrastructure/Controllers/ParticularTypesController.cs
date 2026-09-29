using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RCLimit.BuildingBlocks.Contracts.Hateoas;
using RCLimit.Modules.Loans.Application.DisbursalLineItems;

namespace RCLimit.Modules.Loans.Infrastructure.Controllers;

[ApiController]
[Route("api/v1/particular-types")]
[Authorize]
public class ParticularTypesController(ISender sender) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var result = await sender.Send(new GetParticularTypesQuery());
        return Ok(new HateoasResponse<object>
        {
            Data = result,
            Links =
            [
                new("/api/v1/particular-types", "self", "GET"),
                new("/api/v1/particular-types", "create", "POST"),
                new("/api/v1/accounting/posting-rules", "posting-rules", "GET"),
            ]
        });
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateParticularTypeRequest request)
    {
        var result = await sender.Send(new CreateParticularTypeCommand(
            request.Code, request.Label, request.SortOrder));
        return Created($"/api/v1/particular-types/{result.ParticularTypeId}", new HateoasResponse<DisbursalParticularTypeDto>
        {
            Data = result,
            Links =
            [
                new("/api/v1/particular-types", "list", "GET"),
                new($"/api/v1/particular-types/{result.ParticularTypeId}", "update", "PUT"),
            ]
        });
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateParticularTypeRequest request)
    {
        var result = await sender.Send(new UpdateParticularTypeCommand(
            id, request.Label, request.SortOrder, request.IsActive));
        return Ok(new HateoasResponse<DisbursalParticularTypeDto>
        {
            Data = result,
            Links =
            [
                new("/api/v1/particular-types", "list", "GET"),
                new($"/api/v1/particular-types/{id}", "self", "PUT"),
            ]
        });
    }
}

public record CreateParticularTypeRequest(string Code, string Label, int SortOrder);
public record UpdateParticularTypeRequest(string Label, int SortOrder, bool IsActive);
