using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RCLimit.BuildingBlocks.Contracts.Hateoas;
using RCLimit.BuildingBlocks.Domain.Exceptions;
using RCLimit.Modules.System.Application.Commands;
using RCLimit.Modules.System.Application.Dtos;
using RCLimit.Modules.System.Application.Queries;

namespace RCLimit.Modules.System.Infrastructure.Controllers;

[ApiController]
[Route("api/v1/tenants")]
[Authorize]
public class TenantsController(ISender sender) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetTenants()
    {
        var result = await sender.Send(new GetTenantsQuery());
        return Ok(new HateoasResponse<List<TenantDto>>
        {
            Data = result,
            Links =
            [
                new("/api/v1/tenants", "self", "GET"),
                new("/api/v1/tenants", "create", "POST"),
            ]
        });
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetTenant(Guid id)
    {
        var result = await sender.Send(new GetTenantByIdQuery(id))
                     ?? throw new NotFoundException("Tenant", id);
        return Ok(new HateoasResponse<TenantDto>
        {
            Data = result,
            Links =
            [
                new($"/api/v1/tenants/{id}", "self", "GET"),
                new("/api/v1/tenants", "list", "GET"),
            ]
        });
    }

    [HttpPost]
    public async Task<IActionResult> CreateTenant([FromBody] CreateTenantRequest request)
    {
        var result = await sender.Send(new CreateTenantCommand(
            request.OrganizationName,
            request.Slug,
            request.CustomDomain));

        return Created($"/api/v1/tenants/{result.TenantId}", new HateoasResponse<TenantDto>
        {
            Data = result,
            Links =
            [
                new($"/api/v1/tenants/{result.TenantId}", "self", "GET"),
                new("/api/v1/tenants", "list", "GET"),
            ]
        });
    }
}

public record CreateTenantRequest(string OrganizationName, string Slug, string? CustomDomain);
