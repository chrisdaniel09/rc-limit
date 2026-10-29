using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RCLimit.BuildingBlocks.Contracts.Hateoas;
using RCLimit.BuildingBlocks.Domain.Exceptions;
using RCLimit.BuildingBlocks.Domain.Paging;
using RCLimit.BuildingBlocks.Infrastructure.Authorization;
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
    [HasRight("loans.view")]
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
                new("/api/v1/loans/rc-limit-ledger", "rc-limit-ledger", "GET"),
                new("/api/v1/customers", "customers", "GET"),
                new("/api/v1/lenders", "lenders", "GET"),
            ]
        });
    }

    // The RC Limit Ledger report. Declared before the {id} route so the literal path is matched first.
    [HttpGet("rc-limit-ledger")]
    [HasRight("loans.view")]
    public async Task<IActionResult> GetRcLedger(
        [FromQuery] Guid? customerId = null,
        [FromQuery] Guid? poolId = null,
        [FromQuery] DateOnly? startDate = null,
        [FromQuery] DateOnly? endDate = null,
        [FromQuery] bool? hasOpenBalance = null,
        [FromQuery] bool hideDirectCustomerCredits = false)
    {
        var rows = await _sender.Send(new GetRcLedgerQuery(
            customerId, poolId, startDate, endDate, hasOpenBalance, hideDirectCustomerCredits));

        return Ok(new HateoasResponse<List<RcLedgerRowDto>>
        {
            Data = rows,
            Links = [new("/api/v1/loans/rc-limit-ledger", "self", "GET")]
        });
    }

    [HttpGet("{id:guid}")]
    [HasRight("loans.view")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var result = await _sender.Send(new GetLoanDetailQuery(id))
                     ?? throw new NotFoundException("Loan", id);

        return Ok(new HateoasResponse<LoanDetailDto> { Data = result, Links = LoanLinks(id, result.NextStatuses) });
    }

    [HttpPost]
    [HasRight("loans.create")]
    public async Task<IActionResult> Create([FromBody] CreateLoanCommand command)
    {
        var id = await _sender.Send(command);
        return Created($"/api/v1/loans/{id}", new HateoasResponse<object>
        {
            Data = new { id },
            Links =
            [
                new($"/api/v1/loans/{id}", "self", "GET"),
                new("/api/v1/loans", "list", "GET"),
            ]
        });
    }

    [HttpPost("{id:guid}/sanction")]
    [HasRight("loans.edit")]
    public async Task<IActionResult> Sanction(Guid id, [FromBody] SanctionLoanRequest request)
    {
        var result = await _sender.Send(new SanctionLoanCommand(
            id, request.SanctionedAmount, request.TenureMonths, request.CustomerRate, request.SanctionDate));

        return Ok(new HateoasResponse<LoanDetailDto> { Data = result, Links = LoanLinks(id, result.NextStatuses) });
    }

    [HttpPost("{id:guid}/disburse")]
    [HasRight("loans.edit")]
    public async Task<IActionResult> Disburse(Guid id, [FromBody] DisburseLoanRequest request)
    {
        var result = await _sender.Send(new DisburseLoanCommand(
            id, request.DisbursalDate, request.EmiStartDate, request.EmiDueDay));

        return Ok(new HateoasResponse<LoanDetailDto> { Data = result, Links = LoanLinks(id, result.NextStatuses) });
    }

    [HttpPost("{id:guid}/status")]
    [HasRight("loans.edit")]
    public async Task<IActionResult> ChangeStatus(Guid id, [FromBody] ChangeLoanStatusRequest request)
    {
        var result = await _sender.Send(new ChangeLoanStatusCommand(id, request.TargetStatus, request.Reason));
        return Ok(new HateoasResponse<LoanDetailDto> { Data = result, Links = LoanLinks(id, result.NextStatuses) });
    }

    [HttpPost("{id:guid}/line-items")]
    [HasRight("loans.edit")]
    public async Task<IActionResult> AddLineItem(Guid id, [FromBody] AddDisbursalLineItemRequest request)
    {
        var command = new AddDisbursalLineItemCommand(
            id,
            request.EntryDirection,
            request.Counterparty,
            request.ParticularType,
            request.ModeOfPayment,
            request.BankName,
            request.AccountNo,
            request.TransactionId,
            request.Amount);

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
    [HasRight("loans.edit")]
    public async Task<IActionResult> UpdateDocumentStatus(Guid id, [FromBody] UpdateLoanDocumentStatusRequest request)
    {
        var result = await _sender.Send(new UpdateLoanDocumentStatusCommand(id, request.DocumentStatusId));

        return Ok(new HateoasResponse<LoanDetailDto> { Data = result, Links = LoanLinks(id, result.NextStatuses) });
    }

    private static List<HateoasLink> LoanLinks(Guid id, IEnumerable<string> nextStatuses)
    {
        var links = new List<HateoasLink>
        {
            new($"/api/v1/loans/{id}", "self", "GET"),
            new($"/api/v1/loans/{id}/line-items", "add-line-item", "POST"),
            new($"/api/v1/accounting/journal-entries?referenceId={id}", "journal-entries", "GET"),
            new("/api/v1/loans", "list", "GET"),
        };

        // Stage actions the loan can take next. Sanction and disburse have their own routes.
        foreach (var status in nextStatuses)
        {
            var route = status switch
            {
                "SANCTIONED" => $"/api/v1/loans/{id}/sanction",
                "DISBURSED" => $"/api/v1/loans/{id}/disburse",
                _ => $"/api/v1/loans/{id}/status",
            };
            links.Add(new(route, $"move-to-{status.ToLowerInvariant()}", "POST"));
        }

        return links;
    }
}

public record SanctionLoanRequest(decimal SanctionedAmount, int TenureMonths, decimal CustomerRate, DateOnly SanctionDate);

public record DisburseLoanRequest(DateOnly DisbursalDate, DateOnly EmiStartDate, int EmiDueDay);

public record ChangeLoanStatusRequest(string TargetStatus, string? Reason);

public record AddDisbursalLineItemRequest(
    string EntryDirection,
    string Counterparty,
    string? ParticularType,
    string? ModeOfPayment,
    string? BankName,
    string? AccountNo,
    string? TransactionId,
    decimal Amount);

public record UpdateLoanDocumentStatusRequest(Guid? DocumentStatusId);
