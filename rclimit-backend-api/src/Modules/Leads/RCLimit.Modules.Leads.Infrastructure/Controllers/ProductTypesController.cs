using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RCLimit.BuildingBlocks.Contracts.Hateoas;
using RCLimit.BuildingBlocks.Infrastructure.Authorization;
using RCLimit.Modules.Leads.Application.ProductTypes;
using RCLimit.Modules.Leads.Domain.ValueObjects;

namespace RCLimit.Modules.Leads.Infrastructure.Controllers;

[ApiController]
[Route("api/v1/lead-product-types")]
[Authorize]
public class ProductTypesController(ISender sender) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var result = await sender.Send(new GetProductTypesQuery());
        return Ok(new HateoasResponse<object>
        {
            Data = result,
            Links =
            [
                new("/api/v1/lead-product-types", "self", "GET"),
                new("/api/v1/lead-product-types", "create", "POST"),
            ]
        });
    }

    [HttpPost]
    [HasRight("leads.product_types.manage")]
    public async Task<IActionResult> Create([FromBody] CreateProductTypeRequest request)
    {
        var result = await sender.Send(new CreateProductTypeCommand(
            request.Code, request.Label, request.SortOrder, request.FieldSchema, request.Actions));

        return Created($"/api/v1/lead-product-types/{result.ProductTypeId}", new HateoasResponse<ProductTypeDto>
        {
            Data = result,
            Links =
            [
                new("/api/v1/lead-product-types", "list", "GET"),
                new($"/api/v1/lead-product-types/{result.ProductTypeId}", "update", "PUT"),
            ]
        });
    }

    [HttpPut("{id:guid}")]
    [HasRight("leads.product_types.manage")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateProductTypeRequest request)
    {
        var result = await sender.Send(new UpdateProductTypeCommand(
            id, request.Label, request.SortOrder, request.IsActive, request.FieldSchema, request.Actions));

        return Ok(new HateoasResponse<ProductTypeDto>
        {
            Data = result,
            Links =
            [
                new("/api/v1/lead-product-types", "list", "GET"),
                new($"/api/v1/lead-product-types/{id}", "self", "PUT"),
            ]
        });
    }
}

public record CreateProductTypeRequest(
    string Code,
    string Label,
    int SortOrder,
    List<ProductFieldDefinition> FieldSchema,
    List<ActionDefinition> Actions);

public record UpdateProductTypeRequest(
    string Label,
    int SortOrder,
    bool IsActive,
    List<ProductFieldDefinition> FieldSchema,
    List<ActionDefinition> Actions);
