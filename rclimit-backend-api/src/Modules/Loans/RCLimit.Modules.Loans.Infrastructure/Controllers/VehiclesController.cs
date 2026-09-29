using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RCLimit.BuildingBlocks.Contracts.Hateoas;
using RCLimit.BuildingBlocks.Domain.Exceptions;
using RCLimit.Modules.Loans.Application.Vehicles;

namespace RCLimit.Modules.Loans.Infrastructure.Controllers;

[ApiController]
[Route("api/v1/vehicles")]
[Authorize]
public class VehiclesController : ControllerBase
{
    private readonly ISender _sender;

    public VehiclesController(ISender sender)
    {
        _sender = sender;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var result = await _sender.Send(new GetVehiclesQuery());
        return Ok(new HateoasResponse<object>
        {
            Data = result,
            Links =
            [
                new("/api/v1/vehicles", "self", "GET"),
                new("/api/v1/vehicles", "create", "POST"),
            ]
        });
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateVehicleCommand command)
    {
        var id = await _sender.Send(command);
        return Created($"/api/v1/vehicles/{id}", new HateoasResponse<object>
        {
            Data = new { id },
            Links =
            [
                new($"/api/v1/vehicles/{id}", "self", "GET"),
                new("/api/v1/vehicles", "list", "GET"),
            ]
        });
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateVehicleRequest request)
    {
        var command = new UpdateVehicleCommand(
            id,
            request.RegistrationNumber,
            request.ChassisNumber,
            request.EngineNumber,
            request.Make,
            request.Model,
            request.Variant,
            request.YearOfMfg,
            request.OwnershipCount,
            request.OwnerCustomerId,
            request.CurrentRtoStatus);
        var success = await _sender.Send(command);
        if (!success) throw new NotFoundException("Vehicle", id);
        return NoContent();
    }
}

public record UpdateVehicleRequest(
    string RegistrationNumber,
    string? ChassisNumber,
    string? EngineNumber,
    string? Make,
    string? Model,
    string? Variant,
    int? YearOfMfg,
    int OwnershipCount,
    Guid? OwnerCustomerId,
    string CurrentRtoStatus);
