using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RCLimit.BuildingBlocks.Contracts.Hateoas;
using RCLimit.BuildingBlocks.Domain.Exceptions;
using RCLimit.BuildingBlocks.Domain.Paging;
using RCLimit.BuildingBlocks.Infrastructure.Authorization;
using RCLimit.BuildingBlocks.Infrastructure.Export;
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
        [FromQuery] LoanListParams filter,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = PageQuery.DefaultPageSize,
        [FromQuery] string? sortBy = null,
        [FromQuery] string? sortDir = null,
        [FromQuery] string? search = null)
    {
        var paging = new PageQuery(page, pageSize, sortBy, sortDir, search);
        var result = await _sender.Send(new GetLoansQuery(filter.ToFilter(), paging));
        var items = result.Page;
        return Ok(new HateoasResponse<object>
        {
            Data = items.Items,
            Meta = new PageMeta(items.Page, items.PageSize, items.TotalCount, items.TotalPages)
            {
                Totals = new Dictionary<string, decimal>
                {
                    ["requestedAmount"] = result.Totals.RequestedAmount,
                    ["sanctionedAmount"] = result.Totals.SanctionedAmount,
                    ["netDisbursedAmount"] = result.Totals.NetDisbursedAmount,
                },
            },
            Links =
            [
                new("/api/v1/loans", "self", "GET"),
                new("/api/v1/loans", "create", "POST"),
                new("/api/v1/loans/export", "export", "GET"),
                new("/api/v1/loans/rc-limit-ledger", "rc-limit-ledger", "GET"),
                new("/api/v1/customers", "customers", "GET"),
                new("/api/v1/lenders", "lenders", "GET"),
            ]
        });
    }

    // CSV of every loan matching the list's filters (§15-6). Declared before the {id} route.
    [HttpGet("export")]
    [HasRight("loans.view")]
    public async Task<IActionResult> Export(
        [FromQuery] LoanListParams filter,
        [FromQuery] string? sortBy = null,
        [FromQuery] string? sortDir = null,
        [FromQuery] string? search = null)
    {
        var rows = await _sender.Send(new GetLoansExportQuery(filter.ToFilter(), new PageQuery(1, PageQuery.MaxPageSize, sortBy, sortDir, search)));
        return CsvFile.Create(
            $"loans-{DateTime.UtcNow:yyyyMMdd-HHmm}.csv",
            ["Application #", "Customer", "Vehicle", "Lender", "Agreement #", "Product", "Requested", "Sanctioned", "Balance", "Rate %", "Payout earned", "Status", "Disbursed", "RC aging days", "RC aging"],
            rows.Select(l => (IReadOnlyList<object?>)[
                l.ApplicationNumber, l.CustomerName, l.VehicleRegNo, l.LenderName, l.LenderAgreementNumber, l.ProductType,
                l.RequestedAmount, l.SanctionedAmount, l.NetDisbursedAmount, l.CustomerRate, l.TotalPayoutEarned, l.LoanStatus,
                l.DisbursalDate, l.RcAgingDays, l.RcAgingStatus,
            ]));
    }

    // The RC Limit Ledger report. Declared before the {id} route so the literal path is matched first.
    [HttpGet("rc-limit-ledger")]
    [HasRight("loans.view")]
    public async Task<IActionResult> GetRcLedger(
        [FromQuery] RcLedgerParams filter,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = PageQuery.DefaultPageSize,
        [FromQuery] string? search = null)
    {
        var paging = new PageQuery(page, pageSize, null, null, search);
        var result = await _sender.Send(filter.ToQuery(search, paging));
        var totalPages = (int)Math.Ceiling(result.TotalCount / (double)paging.NormalizedPageSize);

        return Ok(new HateoasResponse<List<RcLedgerRowDto>>
        {
            Data = result.Items,
            Meta = new PageMeta(paging.NormalizedPage, paging.NormalizedPageSize, result.TotalCount, totalPages)
            {
                Totals = new Dictionary<string, decimal> { ["credit"] = result.CreditTotal, ["debit"] = result.DebitTotal },
            },
            Links =
            [
                new("/api/v1/loans/rc-limit-ledger", "self", "GET"),
                new("/api/v1/loans/rc-limit-ledger/export", "export", "GET"),
            ]
        });
    }

    [HttpGet("rc-limit-ledger/export")]
    [HasRight("loans.view")]
    public async Task<IActionResult> ExportRcLedger([FromQuery] RcLedgerParams filter, [FromQuery] string? search = null)
    {
        var result = await _sender.Send(filter.ToQuery(search, null));
        return CsvFile.Create(
            $"rc-limit-ledger-{DateTime.UtcNow:yyyyMMdd-HHmm}.csv",
            ["Date", "Application #", "Customer", "Vehicle", "Lender", "Loan status", "Entry", "Counterparty", "Particular", "Credit", "Debit", "Balance"],
            result.Items.Select(r => (IReadOnlyList<object?>)[
                r.EntryDate, r.ApplicationNumber, r.CustomerName, r.VehicleRegNo, r.LenderName, r.LoanStatus, r.EntryDirection,
                r.Counterparty, r.ParticularType, r.CreditAmount, r.DebitAmount, r.RunningBalanceAmt,
            ]));
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

// Query-string filters for the loans list (docs/ui_ux_specification.md §10.7). loanStatus accepts a comma-separated set.
public class LoanListParams
{
    public string? LoanStatus { get; set; }
    public Guid? LenderId { get; set; }
    public Guid? PoolId { get; set; }
    public string? ProductType { get; set; }
    public Guid? PartnerId { get; set; }
    public Guid? CustomerId { get; set; }
    public DateOnly? DisbursedFrom { get; set; }
    public DateOnly? DisbursedTo { get; set; }
    public string? RcAging { get; set; }
    public bool? HasOpenBalance { get; set; }

    public LoanListFilter ToFilter() => new(
        (LoanStatus ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries),
        LenderId, PoolId, ProductType, PartnerId, CustomerId, DisbursedFrom, DisbursedTo, RcAging, HasOpenBalance);
}

public class RcLedgerParams
{
    public Guid? CustomerId { get; set; }
    public Guid? PoolId { get; set; }
    public DateOnly? StartDate { get; set; }
    public DateOnly? EndDate { get; set; }
    public bool? HasOpenBalance { get; set; }
    public bool HideDirectCustomerCredits { get; set; }

    public GetRcLedgerQuery ToQuery(string? search, PageQuery? paging) =>
        new(CustomerId, PoolId, StartDate, EndDate, HasOpenBalance, HideDirectCustomerCredits, search, paging);
}
