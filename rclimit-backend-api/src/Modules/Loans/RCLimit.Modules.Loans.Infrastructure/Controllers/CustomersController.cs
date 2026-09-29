using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RCLimit.BuildingBlocks.Contracts.Hateoas;
using RCLimit.BuildingBlocks.Domain.Exceptions;
using RCLimit.Modules.Loans.Application.Customers;
using RCLimit.Modules.Loans.Application.Vehicles;

namespace RCLimit.Modules.Loans.Infrastructure.Controllers;

[ApiController]
[Route("api/v1/customers")]
[Authorize]
public class CustomersController : ControllerBase
{
    private readonly ISender _sender;

    public CustomersController(ISender sender)
    {
        _sender = sender;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var result = await _sender.Send(new GetCustomersQuery());
        return Ok(new HateoasResponse<object>
        {
            Data = result,
            Links =
            [
                new("/api/v1/customers", "self", "GET"),
                new("/api/v1/customers", "create", "POST"),
            ]
        });
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await _sender.Send(new GetCustomerDetailQuery(id))
                     ?? throw new NotFoundException("Customer", id);
        return Ok(new HateoasResponse<object>
        {
            Data = result,
            Links =
            [
                new($"/api/v1/customers/{id}", "self", "GET"),
                new($"/api/v1/customers/{id}/vehicles", "vehicles", "GET"),
                new($"/api/v1/customers/{id}/vehicles", "add-vehicle", "POST"),
                new("/api/v1/customers", "list", "GET"),
            ]
        });
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateCustomerCommand command)
    {
        var id = await _sender.Send(command);
        return Created($"/api/v1/customers/{id}", new HateoasResponse<object>
        {
            Data = new { id },
            Links =
            [
                new($"/api/v1/customers/{id}", "self", "GET"),
                new($"/api/v1/customers/{id}/vehicles", "add-vehicle", "POST"),
            ]
        });
    }

    [HttpGet("{id:guid}/vehicles")]
    public async Task<IActionResult> GetVehicles(Guid id)
    {
        var result = await _sender.Send(new GetVehiclesByCustomerQuery(id));
        return Ok(new HateoasResponse<object>
        {
            Data = result,
            Links =
            [
                new($"/api/v1/customers/{id}/vehicles", "self", "GET"),
                new($"/api/v1/customers/{id}/vehicles", "add-vehicle", "POST"),
                new($"/api/v1/customers/{id}", "customer", "GET"),
            ]
        });
    }

    [HttpPost("{id:guid}/vehicles")]
    public async Task<IActionResult> AddVehicle(Guid id, [FromBody] CreateVehicleRequest request)
    {
        var command = new CreateVehicleCommand(
            request.RegistrationNumber,
            request.ChassisNumber,
            request.EngineNumber,
            request.Make,
            request.Model,
            request.Variant,
            request.YearOfMfg,
            id);
        var vehicleId = await _sender.Send(command);
        return Created($"/api/v1/vehicles/{vehicleId}", new HateoasResponse<object>
        {
            Data = new { id = vehicleId },
            Links =
            [
                new($"/api/v1/vehicles/{vehicleId}", "self", "GET"),
                new($"/api/v1/customers/{id}/vehicles", "customer-vehicles", "GET"),
            ]
        });
    }
}

public record CreateVehicleRequest(
    string RegistrationNumber,
    string? ChassisNumber,
    string? EngineNumber,
    string? Make,
    string? Model,
    string? Variant,
    int? YearOfMfg);
