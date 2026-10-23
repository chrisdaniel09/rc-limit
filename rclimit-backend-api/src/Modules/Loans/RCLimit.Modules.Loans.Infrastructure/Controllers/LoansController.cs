using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RCLimit.BuildingBlocks.Contracts.Hateoas;
using RCLimit.BuildingBlocks.Domain.Exceptions;
using RCLimit.BuildingBlocks.Domain.Paging;
using RCLimit.Modules.Loans.Application.DisbursalLineItems;
using RCLimit.Modules.Loans.Application.Loans;

namespace RCLimit.Modules.Loans.Infrastructure.Controllers;

[ApiController]
[Route("api/v1/loans")]
[Authorize]
public class LoansController : ControllerBase
{
    private readonly ISender _sender;

    public LoansController(ISender sender)
    {
        _sender = sender;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? loanStatus = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = PageQuery.DefaultPageSize,
        [FromQuery] string? sortBy = null,
        [FromQuery] string? sortDir = null,
        [FromQuery] string? search = null)
    {
        var paging = new PageQuery(page, pageSize, sortBy, sortDir, search);
        var result = await _sender.Send(new GetLoansQuery(loanStatus, paging));
        return Ok(new HateoasResponse<object>
        {
            Data = result.Items,
            Meta = new PageMeta(result.Page, result.PageSize, result.TotalCount, result.TotalPages),
            Links =
            [
                new("/api/v1/loans", "self", "GET"),
                new("/api/v1/loans", "create", "POST"),
                new("/api/v1/customers", "customers", "GET"),
                new("/api/v1/lenders", "lenders", "GET"),
            ]
        });
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await _sender.Send(new GetLoanDetailQuery(id))
                     ?? throw new NotFoundException("Loan", id);

        var links = new List<HateoasLink>
        {
            new($"/api/v1/loans/{id}", "self", "GET"),
            new($"/api/v1/loans/{id}/line-items", "add-line-item", "POST"),
            new($"/api/v1/accounting/journal-entries?referenceId={id}", "journal-entries", "GET"),
            new("/api/v1/loans", "list", "GET"),
        };

        if (result.RcStage is "RC_PENDING" or "FOLLOW_UP")
            links.Add(new($"/api/v1/loans/{id}/rc-proof", "upload-rc-proof", "POST"));

        return Ok(new HateoasResponse<LoanDetailDto> { Data = result, Links = links });
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateLoanCommand command)
    {
        var id = await _sender.Send(command);
        return Created($"/api/v1/loans/{id}", new HateoasResponse<object>
        {
            Data = new { id },
            Links =
            [
                new($"/api/v1/loans/{id}", "self", "GET"),
                new($"/api/v1/loans/{id}/line-items", "add-line-item", "POST"),
                new("/api/v1/loans", "list", "GET"),
            ]
        });
    }

    [HttpPost("{id:guid}/line-items")]
    public async Task<IActionResult> AddLineItem(Guid id, [FromBody] AddDisbursalLineItemRequest request)
    {
        var command = new AddDisbursalLineItemCommand(
            id,
            request.ParticularType,
            request.ModeOfPayment,
            request.BankName,
            request.AccountNo,
            request.TransactionId,
            request.DebitAmount);

        var result = await _sender.Send(command);
        return Created($"/api/v1/loans/{id}/line-items/{result.LineItemId}", new HateoasResponse<DisbursalLineItemDto>
        {
            Data = result,
            Links =
            [
                new($"/api/v1/loans/{id}", "loan", "GET"),
                new($"/api/v1/loans/{id}/line-items", "add-another", "POST"),
            ]
        });
    }

    [HttpPatch("{id:guid}/document-status")]
    public async Task<IActionResult> UpdateDocumentStatus(Guid id, [FromBody] UpdateLoanDocumentStatusRequest request)
    {
        var result = await _sender.Send(new UpdateLoanDocumentStatusCommand(id, request.DocumentStatusId))
                     ?? throw new NotFoundException("Loan", id);

        return Ok(new HateoasResponse<LoanDetailDto>
        {
            Data = result,
            Links =
            [
                new($"/api/v1/loans/{id}", "self", "GET"),
                new("/api/v1/loans", "list", "GET"),
            ]
        });
    }
}

public record AddDisbursalLineItemRequest(
    string ParticularType,
    string? ModeOfPayment,
    string? BankName,
    string? AccountNo,
    string? TransactionId,
    decimal DebitAmount);

public record UpdateLoanDocumentStatusRequest(Guid? DocumentStatusId);
