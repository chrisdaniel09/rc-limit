using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RCLimit.BuildingBlocks.Contracts.Hateoas;
using RCLimit.Modules.Loans.Application.DocumentStatuses;

namespace RCLimit.Modules.Loans.Infrastructure.Controllers;

[ApiController]
[Route("api/v1/document-statuses")]
[Authorize]
public class PostDisbursementDocumentStatusController(ISender sender) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var result = await sender.Send(new GetDocumentStatusesQuery());
        return Ok(new HateoasResponse<object>
        {
            Data = result,
            Links =
            [
                new("/api/v1/document-statuses", "self", "GET"),
                new("/api/v1/document-statuses", "create", "POST"),
            ]
        });
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateDocumentStatusRequest request)
    {
        var result = await sender.Send(new CreateDocumentStatusCommand(
            request.Code, request.Label, request.SortOrder));
        return Created($"/api/v1/document-statuses/{result.DocumentStatusId}", new HateoasResponse<PostDisbursementDocumentStatusDto>
        {
            Data = result,
            Links =
            [
                new("/api/v1/document-statuses", "list", "GET"),
                new($"/api/v1/document-statuses/{result.DocumentStatusId}", "update", "PUT"),
            ]
        });
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateDocumentStatusRequest request)
    {
        var result = await sender.Send(new UpdateDocumentStatusCommand(
            id, request.Label, request.SortOrder, request.IsActive));
        return Ok(new HateoasResponse<PostDisbursementDocumentStatusDto>
        {
            Data = result,
            Links =
            [
                new("/api/v1/document-statuses", "list", "GET"),
                new($"/api/v1/document-statuses/{id}", "self", "PUT"),
            ]
        });
    }
}

public record CreateDocumentStatusRequest(string Code, string Label, int SortOrder);
public record UpdateDocumentStatusRequest(string Label, int SortOrder, bool IsActive);
