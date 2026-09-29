using System.Security.Claims;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RCLimit.BuildingBlocks.Contracts;
using RCLimit.BuildingBlocks.Contracts.Hateoas;
using RCLimit.BuildingBlocks.Domain.Exceptions;
using RCLimit.Modules.Accounting.Application.Commands;
using RCLimit.Modules.Accounting.Application.Dtos;
using RCLimit.Modules.Accounting.Application.Queries;

namespace RCLimit.Modules.Accounting.Infrastructure.Controllers;

[ApiController]
[Route("api/v1/accounting")]
[Authorize]
public class AccountingController(ISender sender, ITenantContext tenantContext) : ControllerBase
{
    private Guid GetUserId() =>
        Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id)
            ? id
            : throw new ForbiddenException("Invalid or missing user identity.");

    [HttpPost("accounts")]
    public async Task<IActionResult> CreateAccount([FromBody] CreateAccountRequest request)
    {
        var result = await sender.Send(new CreateLedgerAccountCommand(
            tenantContext.TenantId,
            request.AccountCode,
            request.AccountName,
            request.AccountType,
            GetUserId()));

        return Created($"/api/v1/accounting/accounts/{result.AccountId}", new HateoasResponse<LedgerAccountDto>
        {
            Data = result,
            Links =
            [
                new("/api/v1/accounting/accounts", "list", "GET"),
                new("/api/v1/accounting/balance-sheet", "balance-sheet", "GET"),
            ]
        });
    }

    [HttpGet("accounts")]
    public async Task<IActionResult> GetAccounts()
    {
        var result = await sender.Send(new GetLedgerAccountsQuery(tenantContext.TenantId));
        return Ok(new HateoasResponse<object>
        {
            Data = result,
            Links =
            [
                new("/api/v1/accounting/accounts", "self", "GET"),
                new("/api/v1/accounting/accounts", "create", "POST"),
                new("/api/v1/accounting/balance-sheet", "balance-sheet", "GET"),
            ]
        });
    }

    [HttpPost("journal-entries")]
    public async Task<IActionResult> PostJournalEntry([FromBody] PostJournalEntryRequest request)
    {
        var command = new PostJournalEntryCommand(
            tenantContext.TenantId,
            request.ReferenceId,
            request.TransactionType,
            request.Narration,
            GetUserId(),
            request.PostedByRole,
            request.SourceModule,
            request.Lines.Select(l => new JournalLineDto(l.AccountId, l.Direction, l.Amount)).ToList());

        var journalId = await sender.Send(command);
        return Created($"/api/v1/accounting/journal-entries/{journalId}", new HateoasResponse<object>
        {
            Data = new { journalId },
            Links =
            [
                new("/api/v1/accounting/journal-entries", "list", "GET"),
                new("/api/v1/accounting/trial-balance", "trial-balance", "GET"),
            ]
        });
    }

    [HttpGet("journal-entries")]
    public async Task<IActionResult> GetJournalEntries()
    {
        var result = await sender.Send(new GetJournalEntriesQuery(tenantContext.TenantId));
        return Ok(new HateoasResponse<object>
        {
            Data = result,
            Links =
            [
                new("/api/v1/accounting/journal-entries", "self", "GET"),
                new("/api/v1/accounting/journal-entries", "create", "POST"),
                new("/api/v1/accounting/trial-balance", "trial-balance", "GET"),
                new("/api/v1/accounting/balance-sheet", "balance-sheet", "GET"),
            ]
        });
    }

    [HttpGet("trial-balance")]
    public async Task<IActionResult> GetTrialBalance()
    {
        var result = await sender.Send(new GetTrialBalanceQuery(tenantContext.TenantId));
        return Ok(new HateoasResponse<TrialBalanceDto>
        {
            Data = result,
            Links =
            [
                new("/api/v1/accounting/trial-balance", "self", "GET"),
                new("/api/v1/accounting/balance-sheet", "balance-sheet", "GET"),
                new("/api/v1/accounting/journal-entries", "journal-entries", "GET"),
            ]
        });
    }

    [HttpGet("balance-sheet")]
    public async Task<IActionResult> GetBalanceSheet()
    {
        var result = await sender.Send(new GetBalanceSheetQuery(tenantContext.TenantId));
        return Ok(new HateoasResponse<BalanceSheetDto>
        {
            Data = result,
            Links =
            [
                new("/api/v1/accounting/balance-sheet", "self", "GET"),
                new("/api/v1/accounting/trial-balance", "trial-balance", "GET"),
                new("/api/v1/accounting/journal-entries", "journal-entries", "GET"),
                new("/api/v1/accounting/accounts", "accounts", "GET"),
            ]
        });
    }

    [HttpGet("posting-rules")]
    public async Task<IActionResult> GetPostingRules()
    {
        var result = await sender.Send(new GetPostingRulesQuery(tenantContext.TenantId));
        return Ok(new HateoasResponse<object>
        {
            Data = result,
            Links =
            [
                new("/api/v1/accounting/posting-rules", "self", "GET"),
                new("/api/v1/accounting/posting-rules", "create", "POST"),
                new("/api/v1/particular-types", "particular-types", "GET"),
            ]
        });
    }

    [HttpPost("posting-rules")]
    public async Task<IActionResult> CreatePostingRule([FromBody] CreatePostingRuleRequest request)
    {
        var result = await sender.Send(new CreatePostingRuleCommand(
            tenantContext.TenantId,
            request.ParticularType,
            request.DebitAccountId,
            request.CreditAccountId,
            request.TransactionType,
            request.Description));
        return Created($"/api/v1/accounting/posting-rules/{result.RuleId}", new HateoasResponse<PostingRuleDto>
        {
            Data = result,
            Links =
            [
                new("/api/v1/accounting/posting-rules", "list", "GET"),
                new($"/api/v1/accounting/posting-rules/{result.RuleId}", "update", "PUT"),
            ]
        });
    }

    [HttpPut("posting-rules/{id:guid}")]
    public async Task<IActionResult> UpdatePostingRule(Guid id, [FromBody] UpdatePostingRuleRequest request)
    {
        var result = await sender.Send(new UpdatePostingRuleCommand(
            id,
            request.DebitAccountId,
            request.CreditAccountId,
            request.TransactionType,
            request.Description,
            request.IsActive));
        return Ok(new HateoasResponse<PostingRuleDto>
        {
            Data = result,
            Links =
            [
                new("/api/v1/accounting/posting-rules", "list", "GET"),
                new($"/api/v1/accounting/posting-rules/{id}", "self", "PUT"),
            ]
        });
    }
}

public record CreateAccountRequest(string AccountCode, string AccountName, string AccountType);

public record CreatePostingRuleRequest(
    string ParticularType,
    Guid DebitAccountId,
    Guid CreditAccountId,
    string TransactionType,
    string? Description);

public record UpdatePostingRuleRequest(
    Guid DebitAccountId,
    Guid CreditAccountId,
    string TransactionType,
    string? Description,
    bool IsActive);

public record PostJournalEntryRequest(
    Guid ReferenceId,
    string TransactionType,
    string Narration,
    string PostedByRole,
    string SourceModule,
    List<JournalLineRequest> Lines);

public record JournalLineRequest(Guid AccountId, string Direction, decimal Amount);
